import { HyperevmTransactionSender } from '../../scripts/transaction_sender';
import { ethers } from 'ethers';

// ethersのモック
jest.mock('ethers', () => ({
  ethers: {
    providers: {
      getNetwork: jest.fn(() => ({ name: 'hyperevm' })),
      StaticJsonRpcProvider: jest.fn().mockImplementation(() => ({
        getGasPrice: jest.fn()
      }))
    },
    Wallet: jest.fn().mockImplementation(() => ({
      address: '0x1234567890123456789012345678901234567890',
      sendTransaction: jest.fn()
    })),
    ContractFactory: jest.fn(),
    utils: {
      parseEther: jest.fn((value) => (parseFloat(value) * 1e18).toString())
    }
  }
}));

describe('HyperevmTransactionSender', () => {
  let transactionSender: HyperevmTransactionSender;
  let mockProvider: any;
  let mockWallet: any;

  beforeEach(() => {
    mockProvider = {
      getGasPrice: jest.fn().mockResolvedValue('20000000000') // 20 gwei
    };
    mockWallet = {
      address: '0x1234567890123456789012345678901234567890',
      sendTransaction: jest.fn()
    };

    (ethers.providers.StaticJsonRpcProvider as unknown as jest.Mock).mockImplementation(() => mockProvider);
    (ethers.Wallet as unknown as jest.Mock).mockImplementation(() => mockWallet);

    transactionSender = new HyperevmTransactionSender(
      'http://localhost:8545',
      '0x' + '1'.repeat(64)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error for invalid private key', () => {
      expect(() => {
        new HyperevmTransactionSender('http://localhost:8545', '0x' + '0'.repeat(64));
      }).toThrow('Valid private key is required for transaction sending');
    });

    it('should throw error for empty private key', () => {
      expect(() => {
        new HyperevmTransactionSender('http://localhost:8545', '');
      }).toThrow('Valid private key is required for transaction sending');
    });

    it('should initialize with valid private key', () => {
      expect(() => {
        new HyperevmTransactionSender('http://localhost:8545', '0x' + '1'.repeat(64));
      }).not.toThrow();
    });
  });

  describe('sendTransaction', () => {
    it('should send transaction successfully', async () => {
      const mockTransaction = {
        hash: '0xabcdef1234567890',
        gasLimit: { toString: () => '21000' },
        wait: jest.fn().mockResolvedValue({})
      };

      mockWallet.sendTransaction.mockResolvedValue(mockTransaction);
      (ethers.utils.parseEther as jest.Mock).mockReturnValue('1000000000000000000');

      const result = await transactionSender.sendTransaction(
        '0x0987654321098765432109876543210987654321',
        '1.0'
      );

      expect(result).toEqual({
        success: true,
        transactionHash: '0xabcdef1234567890',
        from: mockWallet.address,
        to: '0x0987654321098765432109876543210987654321',
        value: '1.0',
        gasUsed: '21000',
        timestamp: expect.any(String)
      });

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith({
        to: '0x0987654321098765432109876543210987654321',
        value: '1000000000000000000',
        gasLimit: 21000,
        gasPrice: '20000000000'
      });
    });

    it('should handle transaction failure', async () => {
      const errorMessage = 'Insufficient funds';
      mockWallet.sendTransaction.mockRejectedValue(new Error(errorMessage));

      const result = await transactionSender.sendTransaction(
        '0x0987654321098765432109876543210987654321',
        '1.0'
      );

      expect(result).toEqual({
        success: false,
        from: mockWallet.address,
        to: '0x0987654321098765432109876543210987654321',
        value: '1.0',
        error: errorMessage,
        timestamp: expect.any(String)
      });
    });

    it('should accept numeric value', async () => {
      const mockTransaction = {
        hash: '0xabcdef1234567890',
        gasLimit: { toString: () => '21000' },
        wait: jest.fn().mockResolvedValue({})
      };

      mockWallet.sendTransaction.mockResolvedValue(mockTransaction);
      (ethers.utils.parseEther as jest.Mock).mockReturnValue('500000000000000000');

      const result = await transactionSender.sendTransaction(
        '0x0987654321098765432109876543210987654321',
        0.5
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe('0.5');
    });

    it('should use custom gas limit', async () => {
      const mockTransaction = {
        hash: '0xabcdef1234567890',
        gasLimit: { toString: () => '50000' },
        wait: jest.fn().mockResolvedValue({})
      };

      mockWallet.sendTransaction.mockResolvedValue(mockTransaction);

      await transactionSender.sendTransaction(
        '0x0987654321098765432109876543210987654321',
        '1.0',
        50000
      );

      expect(mockWallet.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          gasLimit: 50000
        })
      );
    });
  });

  describe('deployContract', () => {
    it('should deploy contract successfully', async () => {
      const mockContract = {
        address: '0xcontract123456789012345678901234567890',
        deployTransaction: {
          hash: '0xdeployment123456789'
        },
        deployed: jest.fn().mockResolvedValue({})
      };

      const mockFactory = {
        deploy: jest.fn().mockResolvedValue(mockContract)
      };

      (ethers.ContractFactory as unknown as jest.Mock).mockImplementation(() => mockFactory);

      const abi = [{ type: 'constructor', inputs: [] }];
      const bytecode = '0x608060405234801561001057600080fd5b50';

      const result = await transactionSender.deployContract(bytecode, abi);

      expect(result).toEqual({
        success: true,
        contractAddress: mockContract.address,
        transactionHash: mockContract.deployTransaction.hash,
        deployer: mockWallet.address,
        timestamp: expect.any(String)
      });

      expect(ethers.ContractFactory).toHaveBeenCalledWith(abi, bytecode, mockWallet);
      expect(mockFactory.deploy).toHaveBeenCalledWith();
    });

    it('should deploy contract with constructor arguments', async () => {
      const mockContract = {
        address: '0xcontract123456789012345678901234567890',
        deployTransaction: {
          hash: '0xdeployment123456789'
        },
        deployed: jest.fn().mockResolvedValue({})
      };

      const mockFactory = {
        deploy: jest.fn().mockResolvedValue(mockContract)
      };

      (ethers.ContractFactory as unknown as jest.Mock).mockImplementation(() => mockFactory);

      const abi = [{ type: 'constructor', inputs: [{ type: 'uint256' }] }];
      const bytecode = '0x608060405234801561001057600080fd5b50';
      const constructorArgs = ['1000'];

      await transactionSender.deployContract(bytecode, abi, constructorArgs);

      expect(mockFactory.deploy).toHaveBeenCalledWith('1000');
    });

    it('should handle deployment failure', async () => {
      const errorMessage = 'Deployment failed';
      const mockFactory = {
        deploy: jest.fn().mockRejectedValue(new Error(errorMessage))
      };

      (ethers.ContractFactory as unknown as jest.Mock).mockImplementation(() => mockFactory);

      const result = await transactionSender.deployContract('0x123', [], []);

      expect(result).toEqual({
        success: false,
        deployer: mockWallet.address,
        error: errorMessage,
        timestamp: expect.any(String)
      });
    });
  });
});