import { HyperevmContractInteraction } from '../../scripts/contract_interaction';
import { ethers } from 'ethers';

// ethersのモック
jest.mock('ethers', () => ({
  ethers: {
    providers: {
      getNetwork: jest.fn(() => ({ name: 'hyperevm' })),
      StaticJsonRpcProvider: jest.fn().mockImplementation(() => ({}))
    },
    Wallet: jest.fn().mockImplementation(() => ({
      address: '0x1234567890123456789012345678901234567890'
    })),
    Contract: jest.fn()
  }
}));

describe('HyperevmContractInteraction', () => {
  let contractInteraction: HyperevmContractInteraction;
  let mockProvider: any;
  let mockWallet: any;

  beforeEach(() => {
    mockProvider = {};
    mockWallet = {
      address: '0x1234567890123456789012345678901234567890'
    };

    (ethers.providers.StaticJsonRpcProvider as unknown as jest.Mock).mockImplementation(() => mockProvider);
    (ethers.Wallet as unknown as jest.Mock).mockImplementation(() => mockWallet);

    contractInteraction = new HyperevmContractInteraction(
      'http://localhost:8545',
      '0x' + '1'.repeat(64)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with private key', () => {
      expect(ethers.providers.StaticJsonRpcProvider).toHaveBeenCalledWith(
        'http://localhost:8545',
        { name: 'hyperevm' }
      );
      expect(ethers.Wallet).toHaveBeenCalledWith(
        '0x' + '1'.repeat(64),
        mockProvider
      );
    });

    it('should initialize without private key', () => {
      new HyperevmContractInteraction('http://localhost:8545');
      // 秘密鍵なしでも初期化できることを確認
    });

    it('should not initialize wallet with dummy private key', () => {
      jest.clearAllMocks();
      new HyperevmContractInteraction('http://localhost:8545', '0x' + '0'.repeat(64));
      expect(ethers.Wallet).not.toHaveBeenCalled();
    });
  });

  describe('callContractMethod', () => {
    const contractAddress = '0xcontract123456789012345678901234567890';
    const abi = [
      {
        name: 'balanceOf',
        type: 'function',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }]
      }
    ];

    it('should call read-only method successfully', async () => {
      const mockContract = {
        balanceOf: jest.fn().mockResolvedValue('1000000000000000000')
      };

      (ethers.Contract as unknown as jest.Mock).mockImplementation(() => mockContract);

      const result = await contractInteraction.callContractMethod(
        contractAddress,
        abi,
        'balanceOf',
        ['0x1234567890123456789012345678901234567890'],
        { readOnly: true }
      );

      expect(result).toEqual({
        success: true,
        contractAddress,
        method: 'balanceOf',
        parameters: ['0x1234567890123456789012345678901234567890'],
        result: '1000000000000000000',
        transactionHash: null,
        timestamp: expect.any(String)
      });

      expect(ethers.Contract).toHaveBeenCalledWith(contractAddress, abi, mockProvider);
    });

    it('should call write method successfully', async () => {
      const mockTransaction = {
        hash: '0xtransaction123456789',
        wait: jest.fn().mockResolvedValue({})
      };

      const mockContract = {
        transfer: jest.fn().mockResolvedValue(mockTransaction)
      };

      (ethers.Contract as unknown as jest.Mock).mockImplementation(() => mockContract);

      const result = await contractInteraction.callContractMethod(
        contractAddress,
        abi,
        'transfer',
        ['0x1234567890123456789012345678901234567890', '1000000000000000000'],
        { readOnly: false }
      );

      expect(result).toEqual({
        success: true,
        contractAddress,
        method: 'transfer',
        parameters: ['0x1234567890123456789012345678901234567890', '1000000000000000000'],
        result: mockTransaction,
        transactionHash: '0xtransaction123456789',
        timestamp: expect.any(String)
      });

      expect(ethers.Contract).toHaveBeenCalledWith(contractAddress, abi, mockWallet);
    });

    it('should require private key for write operations', async () => {
      const contractInteractionWithoutKey = new HyperevmContractInteraction('http://localhost:8545');

      const result = await contractInteractionWithoutKey.callContractMethod(
        contractAddress,
        abi,
        'transfer',
        [],
        { readOnly: false }
      );

      expect(result).toEqual({
        success: false,
        contractAddress,
        method: 'transfer',
        parameters: [],
        error: 'Private key required for write operations',
        timestamp: expect.any(String)
      });
    });

    it('should handle contract method errors', async () => {
      const errorMessage = 'Contract method failed';
      const mockContract = {
        balanceOf: jest.fn().mockRejectedValue(new Error(errorMessage))
      };

      (ethers.Contract as unknown as jest.Mock).mockImplementation(() => mockContract);

      const result = await contractInteraction.callContractMethod(
        contractAddress,
        abi,
        'balanceOf',
        ['0x1234567890123456789012345678901234567890'],
        { readOnly: true }
      );

      expect(result).toEqual({
        success: false,
        contractAddress,
        method: 'balanceOf',
        parameters: ['0x1234567890123456789012345678901234567890'],
        error: errorMessage,
        timestamp: expect.any(String)
      });
    });

    it('should handle method with toString result', async () => {
      const mockResult = {
        toString: () => '1000000000000000000'
      };

      const mockContract = {
        balanceOf: jest.fn().mockResolvedValue(mockResult)
      };

      (ethers.Contract as unknown as jest.Mock).mockImplementation(() => mockContract);

      const result = await contractInteraction.callContractMethod(
        contractAddress,
        abi,
        'balanceOf',
        ['0x1234567890123456789012345678901234567890'],
        { readOnly: true }
      );

      expect(result.result).toBe('1000000000000000000');
    });
  });

  describe('getContractEvents', () => {
    const contractAddress = '0xcontract123456789012345678901234567890';
    const abi = [
      {
        name: 'Transfer',
        type: 'event',
        inputs: [
          { name: 'from', type: 'address', indexed: true },
          { name: 'to', type: 'address', indexed: true },
          { name: 'value', type: 'uint256', indexed: false }
        ]
      }
    ];

    it('should get contract events successfully', async () => {
      const mockEvents = [
        {
          blockNumber: 12345,
          transactionHash: '0xtx1',
          args: ['0xfrom', '0xto', '1000000000000000000']
        },
        {
          blockNumber: 12346,
          transactionHash: '0xtx2',
          args: ['0xfrom2', '0xto2', '2000000000000000000']
        }
      ];

      const mockFilter = {};
      const mockContract = {
        filters: {
          Transfer: jest.fn(() => mockFilter)
        },
        queryFilter: jest.fn().mockResolvedValue(mockEvents)
      };

      (ethers.Contract as unknown as jest.Mock).mockImplementation(() => mockContract);

      const result = await contractInteraction.getContractEvents(
        contractAddress,
        abi,
        'Transfer',
        0,
        'latest'
      );

      expect(result).toEqual({
        success: true,
        contractAddress,
        eventName: 'Transfer',
        events: [
          {
            blockNumber: 12345,
            transactionHash: '0xtx1',
            args: ['0xfrom', '0xto', '1000000000000000000'],
            timestamp: expect.any(String)
          },
          {
            blockNumber: 12346,
            transactionHash: '0xtx2',
            args: ['0xfrom2', '0xto2', '2000000000000000000'],
            timestamp: expect.any(String)
          }
        ],
        timestamp: expect.any(String)
      });

      expect(mockContract.filters.Transfer).toHaveBeenCalled();
      expect(mockContract.queryFilter).toHaveBeenCalledWith(mockFilter, 0, 'latest');
    });

    it('should handle event query errors', async () => {
      const errorMessage = 'Event query failed';
      const mockContract = {
        filters: {
          Transfer: jest.fn(() => ({}))
        },
        queryFilter: jest.fn().mockRejectedValue(new Error(errorMessage))
      };

      (ethers.Contract as unknown as jest.Mock).mockImplementation(() => mockContract);

      const result = await contractInteraction.getContractEvents(
        contractAddress,
        abi,
        'Transfer'
      );

      expect(result).toEqual({
        success: false,
        contractAddress,
        eventName: 'Transfer',
        error: errorMessage,
        timestamp: expect.any(String)
      });
    });

    it('should handle non-existent event', async () => {
      const mockContract = {
        filters: {
          // Transfer eventがない
        }
      };

      (ethers.Contract as unknown as jest.Mock).mockImplementation(() => mockContract);

      const result = await contractInteraction.getContractEvents(
        contractAddress,
        abi,
        'NonExistentEvent'
      );

      expect(result).toEqual({
        success: false,
        contractAddress,
        eventName: 'NonExistentEvent',
        error: 'Event NonExistentEvent not found in contract ABI',
        timestamp: expect.any(String)
      });
    });

    it('should use default block range', async () => {
      const mockContract = {
        filters: {
          Transfer: jest.fn(() => ({}))
        },
        queryFilter: jest.fn().mockResolvedValue([])
      };

      (ethers.Contract as unknown as jest.Mock).mockImplementation(() => mockContract);

      await contractInteraction.getContractEvents(contractAddress, abi, 'Transfer');

      expect(mockContract.queryFilter).toHaveBeenCalledWith({}, 0, 'latest');
    });
  });
});