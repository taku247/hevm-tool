import { HyperevmBalanceChecker } from '../../scripts/balance_check';
import { ethers } from 'ethers';

// ethersのモック
jest.mock('ethers', () => ({
  ethers: {
    providers: {
      getNetwork: jest.fn(() => ({ name: 'hyperevm' })),
      StaticJsonRpcProvider: jest.fn().mockImplementation(() => ({
        getBalance: jest.fn()
      }))
    },
    utils: {
      formatEther: jest.fn((value) => (parseInt(value) / 1e18).toString())
    }
  }
}));

describe('HyperevmBalanceChecker', () => {
  let balanceChecker: HyperevmBalanceChecker;
  let mockProvider: any;

  beforeEach(() => {
    mockProvider = {
      getBalance: jest.fn()
    };
    (ethers.providers.StaticJsonRpcProvider as unknown as jest.Mock).mockImplementation(() => mockProvider);
    balanceChecker = new HyperevmBalanceChecker('http://localhost:8545');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkBalance', () => {
    it('should return balance successfully', async () => {
      const mockBalance = '1000000000000000000'; // 1 ETH in wei
      const mockAddress = '0x1234567890123456789012345678901234567890';
      
      mockProvider.getBalance.mockResolvedValue(mockBalance);
      (ethers.utils.formatEther as jest.Mock).mockReturnValue('1.0');

      const result = await balanceChecker.checkBalance(mockAddress);

      expect(result).toEqual({
        success: true,
        address: mockAddress,
        balance: '1.0',
        balanceWei: mockBalance,
        timestamp: expect.any(String)
      });
      expect(mockProvider.getBalance).toHaveBeenCalledWith(mockAddress);
    });

    it('should handle errors gracefully', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      const errorMessage = 'Network error';
      
      mockProvider.getBalance.mockRejectedValue(new Error(errorMessage));

      const result = await balanceChecker.checkBalance(mockAddress);

      expect(result).toEqual({
        success: false,
        address: mockAddress,
        error: errorMessage,
        timestamp: expect.any(String)
      });
    });

    it('should validate timestamp format', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      mockProvider.getBalance.mockResolvedValue('0');

      const result = await balanceChecker.checkBalance(mockAddress);

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('checkMultipleBalances', () => {
    it('should check multiple addresses', async () => {
      const addresses = [
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321'
      ];
      
      mockProvider.getBalance
        .mockResolvedValueOnce('1000000000000000000')
        .mockResolvedValueOnce('2000000000000000000');
      
      (ethers.utils.formatEther as jest.Mock)
        .mockReturnValueOnce('1.0')
        .mockReturnValueOnce('2.0');

      const results = await balanceChecker.checkMultipleBalances(addresses);

      expect(results).toHaveLength(2);
      expect(results[0]?.success).toBe(true);
      expect(results[0]?.balance).toBe('1.0');
      expect(results[1]?.success).toBe(true);
      expect(results[1]?.balance).toBe('2.0');
    });

    it('should handle mixed success and failure', async () => {
      const addresses = [
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321'
      ];
      
      mockProvider.getBalance
        .mockResolvedValueOnce('1000000000000000000')
        .mockRejectedValueOnce(new Error('Invalid address'));

      (ethers.utils.formatEther as jest.Mock).mockReturnValueOnce('1.0');

      const results = await balanceChecker.checkMultipleBalances(addresses);

      expect(results).toHaveLength(2);
      expect(results[0]?.success).toBe(true);
      expect(results[1]?.success).toBe(false);
      expect(results[1]?.error).toBe('Invalid address');
    });

    it('should handle empty address array', async () => {
      const results = await balanceChecker.checkMultipleBalances([]);
      expect(results).toEqual([]);
    });
  });

  describe('constructor', () => {
    it('should initialize with correct network settings', () => {
      expect(ethers.providers.getNetwork).toHaveBeenCalledWith(999);
      expect(ethers.providers.StaticJsonRpcProvider).toHaveBeenCalledWith(
        'http://localhost:8545',
        { name: 'hyperevm' }
      );
    });

    it('should handle different RPC URLs', () => {
      const customRpcUrl = 'https://custom-rpc.example.com';
      new HyperevmBalanceChecker(customRpcUrl);

      expect(ethers.providers.StaticJsonRpcProvider).toHaveBeenCalledWith(
        customRpcUrl,
        { name: 'hyperevm' }
      );
    });
  });
});