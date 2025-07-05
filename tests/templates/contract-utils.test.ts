import { UniversalContractUtils } from '../../templates/contract-utils';
import { ReadCallConfig, WriteCallConfig } from '../../src/contract-template-types';
import { ethers } from 'ethers';
import fs from 'fs';

// Mocking dependencies
jest.mock('ethers');
jest.mock('fs');

describe('UniversalContractUtils', () => {
  let contractUtils: UniversalContractUtils;
  let mockProvider: any;
  let mockSigner: any;
  let mockContract: any;

  beforeEach(() => {
    // Mock provider
    mockProvider = {
      getBlockNumber: jest.fn().mockResolvedValue(12345),
      getCode: jest.fn().mockResolvedValue('0x123456'),
      getBalance: jest.fn().mockResolvedValue(ethers.BigNumber.from('1000000000000000000'))
    };

    // Mock signer
    mockSigner = {
      address: '0x1234567890123456789012345678901234567890'
    };

    // Mock contract
    mockContract = {
      balanceOf: jest.fn().mockResolvedValue(ethers.BigNumber.from('1000000000000000000')),
      transfer: jest.fn().mockResolvedValue({
        hash: '0xabcdef1234567890',
        wait: jest.fn().mockResolvedValue({
          blockNumber: 12346,
          gasUsed: ethers.BigNumber.from('21000'),
          effectiveGasPrice: ethers.BigNumber.from('20000000000')
        })
      }),
      estimateGas: {
        transfer: jest.fn().mockResolvedValue(ethers.BigNumber.from('21000'))
      },
      filters: {
        Transfer: jest.fn().mockReturnValue({}),
        Approval: jest.fn().mockReturnValue({})
      },
      queryFilter: jest.fn().mockResolvedValue([
        {
          address: '0x1234567890123456789012345678901234567890',
          topics: ['0xtopic1', '0xtopic2'],
          data: '0xdata',
          blockNumber: 12345,
          transactionHash: '0xtxhash',
          transactionIndex: 0,
          logIndex: 0,
          removed: false,
          args: ['0xfrom', '0xto', ethers.BigNumber.from('1000')],
          event: 'Transfer'
        }
      ])
    };

    // Mock ethers
    (ethers.providers.getNetwork as jest.Mock).mockReturnValue({ name: 'hyperevm' });
    (ethers.providers.StaticJsonRpcProvider as unknown as jest.Mock).mockImplementation(() => mockProvider);
    (ethers.Wallet as unknown as jest.Mock).mockImplementation(() => mockSigner);
    (ethers.Contract as unknown as jest.Mock).mockImplementation(() => mockContract);
    (ethers.BigNumber.isBigNumber as jest.Mock).mockImplementation((value) => 
      value && typeof value.toString === 'function' && value._isBigNumber
    );
    (ethers.utils.parseEther as jest.Mock).mockImplementation((value) => 
      ethers.BigNumber.from((parseFloat(value) * 1e18).toString())
    );
    (ethers.utils.formatEther as jest.Mock).mockImplementation((value) => 
      (parseFloat(value.toString()) / 1e18).toString()
    );

    // Mock fs
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([
      {
        name: 'balanceOf',
        type: 'function',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view'
      },
      {
        name: 'transfer',
        type: 'function',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable'
      }
    ]));

    contractUtils = new UniversalContractUtils('http://localhost:8545', '0x' + '1'.repeat(64));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with RPC URL only', () => {
      const utils = new UniversalContractUtils('http://localhost:8545');
      expect(ethers.providers.StaticJsonRpcProvider).toHaveBeenCalledWith(
        'http://localhost:8545',
        { name: 'hyperevm' }
      );
    });

    it('should initialize with RPC URL and private key', () => {
      expect(ethers.providers.StaticJsonRpcProvider).toHaveBeenCalledWith(
        'http://localhost:8545',
        { name: 'hyperevm' }
      );
      expect(ethers.Wallet).toHaveBeenCalledWith('0x' + '1'.repeat(64), mockProvider);
    });

    it('should not create signer with dummy private key', () => {
      jest.clearAllMocks();
      new UniversalContractUtils('http://localhost:8545', '0x' + '0'.repeat(64));
      expect(ethers.Wallet).not.toHaveBeenCalled();
    });
  });

  describe('callReadFunction', () => {
    it('should execute read function successfully', async () => {
      const config: ReadCallConfig = {
        abiPath: './abi/test.json',
        contractAddress: '0x1234567890123456789012345678901234567890',
        functionName: 'balanceOf',
        args: ['0xabcdef1234567890123456789012345678901234']
      };

      const result = await contractUtils.callReadFunction(config);

      expect(result.success).toBe(true);
      expect(result.contractAddress).toBe(config.contractAddress);
      expect(result.functionName).toBe(config.functionName);
      expect(result.args).toEqual(config.args);
      expect(result.result).toBeDefined();
      expect(result.blockNumber).toBe(12345);
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should handle read function errors', async () => {
      mockContract.balanceOf.mockRejectedValue(new Error('Contract call failed'));

      const config: ReadCallConfig = {
        abiPath: './abi/test.json',
        contractAddress: '0x1234567890123456789012345678901234567890',
        functionName: 'balanceOf',
        args: ['0xabcdef1234567890123456789012345678901234']
      };

      const result = await contractUtils.callReadFunction(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Contract call failed');
      expect(result.contractAddress).toBe(config.contractAddress);
      expect(result.functionName).toBe(config.functionName);
    });

    it('should use provided ABI instead of loading from file', async () => {
      const abi = [{ name: 'test', type: 'function' }];
      const config: ReadCallConfig = {
        abi,
        contractAddress: '0x1234567890123456789012345678901234567890',
        functionName: 'balanceOf',
        args: []
      };

      await contractUtils.callReadFunction(config);

      expect(fs.readFileSync).not.toHaveBeenCalled();
      expect(ethers.Contract).toHaveBeenCalledWith(
        config.contractAddress,
        abi,
        mockProvider
      );
    });

    it('should handle block tag parameter', async () => {
      const config: ReadCallConfig = {
        abiPath: './abi/test.json',
        contractAddress: '0x1234567890123456789012345678901234567890',
        functionName: 'balanceOf',
        args: ['0xabcdef1234567890123456789012345678901234'],
        blockTag: 12000
      };

      await contractUtils.callReadFunction(config);

      expect(mockContract.balanceOf).toHaveBeenCalledWith(
        '0xabcdef1234567890123456789012345678901234',
        { blockTag: 12000 }
      );
    });
  });

  describe('callWriteFunction', () => {
    it('should execute write function successfully', async () => {
      const config: WriteCallConfig = {
        abiPath: './abi/test.json',
        contractAddress: '0x1234567890123456789012345678901234567890',
        functionName: 'transfer',
        args: ['0xabcdef1234567890123456789012345678901234', '1000000000000000000']
      };

      const result = await contractUtils.callWriteFunction(config);

      expect(result.success).toBe(true);
      expect(result.contractAddress).toBe(config.contractAddress);
      expect(result.functionName).toBe(config.functionName);
      expect(result.args).toEqual(config.args);
      expect(result.transactionHash).toBe('0xabcdef1234567890');
      expect(result.blockNumber).toBe(12346);
      expect(result.gasUsed).toBe('21000');
    });

    it('should handle write function without signer', async () => {
      const utilsWithoutSigner = new UniversalContractUtils('http://localhost:8545');
      
      const config: WriteCallConfig = {
        abiPath: './abi/test.json',
        contractAddress: '0x1234567890123456789012345678901234567890',
        functionName: 'transfer',
        args: ['0xabcdef1234567890123456789012345678901234', '1000000000000000000']
      };

      const result = await utilsWithoutSigner.callWriteFunction(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Private key required for write operations');
    });

    it('should handle gas options', async () => {
      const config: WriteCallConfig = {
        abiPath: './abi/test.json',
        contractAddress: '0x1234567890123456789012345678901234567890',
        functionName: 'transfer',
        args: ['0xabcdef1234567890123456789012345678901234', '1000000000000000000'],
        options: {
          gasLimit: '100000',
          gasPrice: '30000000000',
          value: '0.1'
        }
      };

      await contractUtils.callWriteFunction(config);

      expect(mockContract.transfer).toHaveBeenCalledWith(
        '0xabcdef1234567890123456789012345678901234',
        '1000000000000000000',
        expect.objectContaining({
          gasLimit: expect.any(Object),
          gasPrice: expect.any(Object),
          value: expect.any(Object)
        })
      );
    });

    it('should skip confirmation when waitForConfirmation is false', async () => {
      const mockTx = {
        hash: '0xabcdef1234567890',
        wait: jest.fn()
      };
      mockContract.transfer.mockResolvedValue(mockTx);

      const config: WriteCallConfig = {
        abiPath: './abi/test.json',
        contractAddress: '0x1234567890123456789012345678901234567890',
        functionName: 'transfer',
        args: ['0xabcdef1234567890123456789012345678901234', '1000000000000000000'],
        waitForConfirmation: false
      };

      const result = await contractUtils.callWriteFunction(config);

      expect(result.success).toBe(true);
      expect(mockTx.wait).not.toHaveBeenCalled();
      expect(result.blockNumber).toBeUndefined();
    });
  });

  describe('getContractEvents', () => {
    it('should get contract events successfully', async () => {
      const filter = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        abiPath: './abi/test.json',
        eventName: 'Transfer',
        fromBlock: 12000,
        toBlock: 12500
      };

      const result = await contractUtils.getContractEvents(filter);

      expect(result.success).toBe(true);
      expect(result.contractAddress).toBe(filter.contractAddress);
      expect(result.eventName).toBe(filter.eventName);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        address: '0x1234567890123456789012345678901234567890',
        blockNumber: 12345,
        transactionHash: '0xtxhash'
      });
    });

    it('should handle event query errors', async () => {
      mockContract.queryFilter.mockRejectedValue(new Error('Event query failed'));

      const filter = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        abiPath: './abi/test.json',
        eventName: 'Transfer'
      };

      const result = await contractUtils.getContractEvents(filter);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Event query failed');
    });

    it('should use default block range', async () => {
      const filter = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        abiPath: './abi/test.json',
        eventName: 'Transfer'
      };

      await contractUtils.getContractEvents(filter);

      expect(mockContract.queryFilter).toHaveBeenCalledWith({}, 0, 'latest');
    });
  });

  describe('getContractInfo', () => {
    it('should get contract basic information', async () => {
      const contractAddress = '0x1234567890123456789012345678901234567890';
      
      const info = await contractUtils.getContractInfo(contractAddress);

      expect(info).toMatchObject({
        address: contractAddress,
        hasCode: true,
        codeSize: 3, // '0x123456' -> 3 bytes
        balance: expect.any(String),
        balanceWei: expect.any(String)
      });
    });

    it('should detect contract without code', async () => {
      mockProvider.getCode.mockResolvedValue('0x');
      const contractAddress = '0x1234567890123456789012345678901234567890';
      
      const info = await contractUtils.getContractInfo(contractAddress);

      expect(info.hasCode).toBe(false);
      expect(info.codeSize).toBe(0);
    });
  });

  describe('estimateGas', () => {
    it('should estimate gas for transaction', async () => {
      const config: WriteCallConfig = {
        abiPath: './abi/test.json',
        contractAddress: '0x1234567890123456789012345678901234567890',
        functionName: 'transfer',
        args: ['0xabcdef1234567890123456789012345678901234', '1000000000000000000']
      };

      const gasEstimate = await contractUtils.estimateGas(config);

      expect(gasEstimate).toBe('21000');
      expect(mockContract.estimateGas.transfer).toHaveBeenCalledWith(
        '0xabcdef1234567890123456789012345678901234',
        '1000000000000000000'
      );
    });

    it('should require signer for gas estimation', async () => {
      const utilsWithoutSigner = new UniversalContractUtils('http://localhost:8545');
      
      const config: WriteCallConfig = {
        abiPath: './abi/test.json',
        contractAddress: '0x1234567890123456789012345678901234567890',
        functionName: 'transfer',
        args: ['0xabcdef1234567890123456789012345678901234', '1000000000000000000']
      };

      await expect(utilsWithoutSigner.estimateGas(config))
        .rejects.toThrow('Private key required for gas estimation');
    });
  });

  describe('serializeResult', () => {
    it('should serialize BigNumber results', async () => {
      const bigNumberResult = ethers.BigNumber.from('1000000000000000000');
      bigNumberResult._isBigNumber = true;
      
      mockContract.balanceOf.mockResolvedValue(bigNumberResult);

      const config: ReadCallConfig = {
        abiPath: './abi/test.json',
        contractAddress: '0x1234567890123456789012345678901234567890',
        functionName: 'balanceOf',
        args: ['0xabcdef1234567890123456789012345678901234']
      };

      const result = await contractUtils.callReadFunction(config);

      expect(result.success).toBe(true);
      expect(result.result).toBe('1000000000000000000');
    });

    it('should serialize array results', async () => {
      const arrayResult = [
        ethers.BigNumber.from('1000'),
        'test',
        true
      ];
      arrayResult[0]._isBigNumber = true;
      
      mockContract.balanceOf.mockResolvedValue(arrayResult);

      const config: ReadCallConfig = {
        abiPath: './abi/test.json',
        contractAddress: '0x1234567890123456789012345678901234567890',
        functionName: 'balanceOf',
        args: ['0xabcdef1234567890123456789012345678901234']
      };

      const result = await contractUtils.callReadFunction(config);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(['1000', 'test', true]);
    });
  });
});