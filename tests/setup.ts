import dotenv from 'dotenv';

// テスト環境用の環境変数を設定
dotenv.config({ path: '.env.test' });

// デフォルトの環境変数を設定
process.env.NODE_ENV = 'test';
process.env.HYPEREVM_RPC_URL = process.env.HYPEREVM_RPC_URL || 'http://localhost:8545';
process.env.PRIVATE_KEY = process.env.PRIVATE_KEY || '0x' + '1'.repeat(64);
process.env.PORT = '0'; // ランダムポートを使用

// タイムアウトを設定
jest.setTimeout(30000);

// グローバルなモック設定
jest.mock('child_process');

// console.logを抑制（必要に応じて）
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};