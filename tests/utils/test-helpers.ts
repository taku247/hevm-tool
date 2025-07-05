import { ethers } from 'ethers';

/**
 * テスト用のユーティリティ関数
 */

/**
 * モックのEthersプロバイダーを作成
 */
export function createMockProvider(overrides: Partial<any> = {}) {
  return {
    getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
    getGasPrice: jest.fn().mockResolvedValue('20000000000'),
    getNetwork: jest.fn().mockResolvedValue({ chainId: 999, name: 'hyperevm' }),
    ...overrides
  };
}

/**
 * モックのEthersウォレットを作成
 */
export function createMockWallet(overrides: Partial<any> = {}) {
  return {
    address: '0x1234567890123456789012345678901234567890',
    sendTransaction: jest.fn().mockResolvedValue({
      hash: '0xabcdef1234567890',
      gasLimit: { toString: () => '21000' },
      wait: jest.fn().mockResolvedValue({})
    }),
    ...overrides
  };
}

/**
 * モックのEthersコントラクトを作成
 */
export function createMockContract(overrides: Partial<any> = {}) {
  return {
    address: '0xcontract123456789012345678901234567890',
    balanceOf: jest.fn().mockResolvedValue('1000000000000000000'),
    transfer: jest.fn().mockResolvedValue({
      hash: '0xtransaction123456789',
      wait: jest.fn().mockResolvedValue({})
    }),
    filters: {
      Transfer: jest.fn().mockReturnValue({}),
      Approval: jest.fn().mockReturnValue({})
    },
    queryFilter: jest.fn().mockResolvedValue([]),
    deployed: jest.fn().mockResolvedValue({}),
    deployTransaction: {
      hash: '0xdeployment123456789'
    },
    ...overrides
  };
}

/**
 * モックのコントラクトファクトリーを作成
 */
export function createMockContractFactory(contract: any = createMockContract()) {
  return {
    deploy: jest.fn().mockResolvedValue(contract)
  };
}

/**
 * 有効なEthereumアドレスを生成
 */
export function generateAddress(seed: string = '1'): string {
  return '0x' + seed.repeat(40).substring(0, 40);
}

/**
 * 有効な秘密鍵を生成
 */
export function generatePrivateKey(seed: string = '1'): string {
  return '0x' + seed.repeat(64).substring(0, 64);
}

/**
 * モックのトランザクション結果を作成
 */
export function createMockTransactionResult(overrides: Partial<any> = {}) {
  return {
    success: true,
    transactionHash: '0xabcdef1234567890',
    from: generateAddress('1'),
    to: generateAddress('2'),
    value: '1.0',
    gasUsed: '21000',
    timestamp: new Date().toISOString(),
    ...overrides
  };
}

/**
 * モックの残高結果を作成
 */
export function createMockBalanceResult(overrides: Partial<any> = {}) {
  return {
    success: true,
    address: generateAddress('1'),
    balance: '1.0',
    balanceWei: '1000000000000000000',
    timestamp: new Date().toISOString(),
    ...overrides
  };
}

/**
 * モックのコントラクト呼び出し結果を作成
 */
export function createMockContractCallResult(overrides: Partial<any> = {}) {
  return {
    success: true,
    contractAddress: generateAddress('c'),
    method: 'balanceOf',
    parameters: [generateAddress('1')],
    result: '1000000000000000000',
    transactionHash: null,
    timestamp: new Date().toISOString(),
    ...overrides
  };
}

/**
 * モックのイベント結果を作成
 */
export function createMockEventResult(overrides: Partial<any> = {}) {
  return {
    success: true,
    contractAddress: generateAddress('c'),
    eventName: 'Transfer',
    events: [
      {
        blockNumber: 12345,
        transactionHash: '0xtx123',
        args: [generateAddress('1'), generateAddress('2'), '1000000000000000000'],
        timestamp: new Date().toISOString()
      }
    ],
    timestamp: new Date().toISOString(),
    ...overrides
  };
}

/**
 * 非同期処理の待機
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * テスト用の環境変数を設定
 */
export function setupTestEnvironment() {
  const originalEnv = process.env;
  
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      HYPEREVM_RPC_URL: 'http://localhost:8545',
      PRIVATE_KEY: generatePrivateKey('1'),
      PORT: '0'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });
}

/**
 * Ethersモックを設定
 */
export function setupEthersMocks() {
  const mockProvider = createMockProvider();
  const mockWallet = createMockWallet();
  const mockContract = createMockContract();
  const mockContractFactory = createMockContractFactory(mockContract);

  beforeEach(() => {
    jest.mock('ethers', () => ({
      ethers: {
        providers: {
          getNetwork: jest.fn(() => ({ name: 'hyperevm' })),
          StaticJsonRpcProvider: jest.fn(() => mockProvider)
        },
        Wallet: jest.fn(() => mockWallet),
        Contract: jest.fn(() => mockContract),
        ContractFactory: jest.fn(() => mockContractFactory),
        utils: {
          formatEther: jest.fn((value) => (parseInt(value) / 1e18).toString()),
          parseEther: jest.fn((value) => (parseFloat(value) * 1e18).toString()),
          isAddress: jest.fn((address) => /^0x[a-fA-F0-9]{40}$/.test(address)),
          getAddress: jest.fn((address) => address.toLowerCase())
        }
      }
    }));
  });

  return {
    mockProvider,
    mockWallet,
    mockContract,
    mockContractFactory
  };
}

/**
 * タイムスタンプの形式を検証
 */
export function isValidTimestamp(timestamp: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timestamp);
}

/**
 * Ethereumアドレスの形式を検証
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * トランザクションハッシュの形式を検証
 */
export function isValidTransactionHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * テスト用のスクリプト実行結果を作成
 */
export function createMockScriptExecutionResult(overrides: Partial<any> = {}) {
  return {
    scriptName: 'balance_check.ts',
    args: [generateAddress('1')],
    exitCode: 0,
    output: JSON.stringify(createMockBalanceResult()),
    error: '',
    timestamp: new Date().toISOString(),
    ...overrides
  };
}

/**
 * WebSocketメッセージの形式を検証
 */
export function isValidWebSocketMessage(message: any): boolean {
  return (
    message &&
    typeof message === 'object' &&
    message.type === 'script_execution' &&
    message.data &&
    typeof message.data === 'object'
  );
}