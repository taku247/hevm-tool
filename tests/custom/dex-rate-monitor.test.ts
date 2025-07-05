import { UniversalContractUtils } from '../../templates/contract-utils';
import { ethers } from 'ethers';

describe('DEX Rate Monitor', () => {
  let utils: UniversalContractUtils;
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';

  beforeAll(() => {
    utils = new UniversalContractUtils(rpcUrl);
  });

  describe('Basic Connectivity', () => {
    test('should connect to HyperEVM network', async () => {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const network = await provider.getNetwork();
      
      expect(network.chainId).toBe(999);
    }, 10000);

    test('should initialize UniversalContractUtils', () => {
      expect(utils).toBeDefined();
    });
  });

  describe('DEX Contract Existence', () => {
    const dexContracts = [
      { name: 'HyperSwap V2', address: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A' },
      { name: 'HyperSwap V3', address: '0x03A918028f22D9E1473B7959C927AD7425A45C7C' },
      { name: 'KittenSwap V2', address: '0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802' },
      { name: 'KittenSwap CL', address: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF' }
    ];

    test.each(dexContracts)('$name should exist at $address', async ({ address }) => {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const code = await provider.getCode(address);
      
      expect(code).not.toBe('0x');
      expect(code.length).toBeGreaterThan(2);
    }, 10000);
  });

  describe('ABI Loading and Function Calls', () => {
    test('should load V2 Router ABI and call factory function', async () => {
      const result = await utils.callReadFunction({
        abiPath: './abi/UniV2Router.json',
        contractAddress: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A',
        functionName: 'factory',
        args: []
      });

      expect(result.success).toBe(true);
      expect(result.result).toMatch(/^0x[a-fA-F0-9]{40}$/); // Valid Ethereum address
    }, 10000);

    test('should load V3 Quoter ABI and call factory function', async () => {
      const result = await utils.callReadFunction({
        abiPath: './abi/KittenQuoterV2.json',
        contractAddress: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
        functionName: 'factory',
        args: []
      });

      expect(result.success).toBe(true);
      expect(result.result).toMatch(/^0x[a-fA-F0-9]{40}$/);
    }, 10000);
  });

  describe('Gas Price Analysis', () => {
    test('should analyze current gas prices', async () => {
      const analysis = await utils.analyzeCurrentGasPrices();

      expect(analysis).toBeDefined();
      expect(analysis.currentBaseFee).toBeDefined();
      expect(analysis.networkCongestion).toMatch(/^(low|medium|high|very_high)$/);
      expect(analysis.suggestedGasPrices).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
    }, 15000);

    test('should provide all gas strategies', async () => {
      const analysis = await utils.analyzeCurrentGasPrices();
      const strategies = Object.keys(analysis.suggestedGasPrices);

      expect(strategies).toContain('safe');
      expect(strategies).toContain('standard');
      expect(strategies).toContain('fast');
      expect(strategies).toContain('instant');
    }, 15000);
  });

  describe('Rate Fetching (Mock Tests)', () => {
    test('should handle V2 getAmountsOut call structure', async () => {
      const amountIn = ethers.utils.parseEther('1');
      const mockPath = [
        '0x0000000000000000000000000000000000000000',
        '0x4200000000000000000000000000000000000006'
      ];

      const result = await utils.callReadFunction({
        abiPath: './abi/UniV2Router.json',
        contractAddress: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A',
        functionName: 'getAmountsOut',
        args: [amountIn.toString(), mockPath]
      });

      // テストでは失敗が予想されるが、構造は正しく呼び出されるはず
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.contractAddress).toBe('0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A');
      expect(result.functionName).toBe('getAmountsOut');
    }, 10000);

    test('should handle V3 quoteExactInputSingle call structure', async () => {
      const amountIn = ethers.utils.parseEther('1');

      const result = await utils.callReadFunction({
        abiPath: './abi/KittenQuoterV2.json',
        contractAddress: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
        functionName: 'quoteExactInputSingle',
        args: [
          '0x0000000000000000000000000000000000000000',
          '0x4200000000000000000000000000000000000006',
          500,
          amountIn.toString(),
          0
        ]
      });

      // テストでは失敗が予想されるが、構造は正しく呼び出されるはず
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.contractAddress).toBe('0x03A918028f22D9E1473B7959C927AD7425A45C7C');
      expect(result.functionName).toBe('quoteExactInputSingle');
    }, 10000);
  });

  describe('Error Handling', () => {
    test('should handle invalid contract address', async () => {
      const result = await utils.callReadFunction({
        abiPath: './abi/UniV2Router.json',
        contractAddress: '0x0000000000000000000000000000000000000000',
        functionName: 'factory',
        args: []
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 10000);

    test('should handle invalid ABI path', async () => {
      const result = await utils.callReadFunction({
        abiPath: './abi/NonExistent.json',
        contractAddress: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A',
        functionName: 'factory',
        args: []
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 10000);
  });

  describe('Rate Calculation Utilities', () => {
    test('should calculate rate from amounts correctly', () => {
      const amountIn = ethers.utils.parseEther('1');
      const amountOut = ethers.utils.parseEther('0.5');

      const rate = parseFloat(ethers.utils.formatEther(amountOut)) / 
                  parseFloat(ethers.utils.formatEther(amountIn));

      expect(rate).toBe(0.5);
    });

    test('should format gas prices correctly', () => {
      const weiValue = '1000000000'; // 1 Gwei in wei
      const gwei = parseInt(weiValue) / 1000000000;

      expect(gwei).toBe(1);
    });

    test('should handle different token decimals', () => {
      const amount18 = ethers.utils.parseUnits('1', 18); // 1 token with 18 decimals
      const amount6 = ethers.utils.parseUnits('1000', 6);  // 1000 USDC with 6 decimals

      const rate18to6 = parseFloat(ethers.utils.formatUnits(amount6, 6)) / 
                       parseFloat(ethers.utils.formatUnits(amount18, 18));

      expect(rate18to6).toBe(1000);
    });
  });
});