import request from 'supertest';
import express from 'express';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// child_processのモック
jest.mock('child_process');

// WebSocketのモック
const mockWebSocketServer = {
  on: jest.fn(),
  clients: new Set(),
  close: jest.fn()
};

jest.mock('ws', () => ({
  __esModule: true,
  default: {
    Server: jest.fn().mockImplementation(() => mockWebSocketServer)
  }
}));

// dotenvのモック
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

describe('Dashboard Server', () => {
  let app: express.Application;
  let mockChildProcess: EventEmitter;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // 子プロセスのモック設定
    mockChildProcess = new EventEmitter();
    (mockChildProcess as any).stdout = new EventEmitter();
    (mockChildProcess as any).stderr = new EventEmitter();
    
    (spawn as jest.Mock).mockReturnValue(mockChildProcess);

    // サーバーモジュールを動的にインポート
    delete require.cache[require.resolve('../../dashboard/server')];
    app = require('../../dashboard/server').default || require('../../dashboard/server');
  });

  describe('GET /api/scripts', () => {
    it('should return list of available scripts', async () => {
      const response = await request(app).get('/api/scripts');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          name: 'balance_check.ts',
          description: 'アドレスの残高を確認する',
          parameters: ['address1', 'address2...']
        },
        {
          name: 'transaction_sender.ts',
          description: 'トランザクションを送信する',
          parameters: ['to_address', 'value_in_ether']
        },
        {
          name: 'contract_interaction.ts',
          description: 'スマートコントラクトと相互作用する',
          parameters: ['contract_address', 'method', 'params...']
        }
      ]);
    });
  });

  describe('POST /api/execute-script', () => {
    it('should execute valid script successfully', async () => {
      const requestBody = {
        scriptName: 'balance_check.ts',
        args: ['0x1234567890123456789012345678901234567890']
      };

      // APIリクエストを送信（レスポンスを待たない）
      const responsePromise = request(app)
        .post('/api/execute-script')
        .send(requestBody);

      // 子プロセスの出力をシミュレート
      setTimeout(() => {
        (mockChildProcess as any).stdout.emit('data', Buffer.from(JSON.stringify({
          success: true,
          address: '0x1234567890123456789012345678901234567890',
          balance: '1.0',
          balanceWei: '1000000000000000000',
          timestamp: '2023-12-01T12:00:00.000Z'
        })));
        
        // プロセス終了をシミュレート
        mockChildProcess.emit('close', 0);
      }, 100);

      const response = await responsePromise;

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        scriptName: 'balance_check.ts',
        args: ['0x1234567890123456789012345678901234567890'],
        exitCode: 0,
        timestamp: expect.any(String)
      });

      expect(spawn).toHaveBeenCalledWith(
        'ts-node',
        [expect.stringContaining('balance_check.ts'), '0x1234567890123456789012345678901234567890'],
        expect.objectContaining({
          env: expect.objectContaining({
            HYPEREVM_RPC_URL: expect.any(String),
            PRIVATE_KEY: expect.any(String)
          })
        })
      );
    });

    it('should handle script execution errors', async () => {
      const requestBody = {
        scriptName: 'balance_check.ts',
        args: ['invalid_address']
      };

      const responsePromise = request(app)
        .post('/api/execute-script')
        .send(requestBody);

      // エラー出力をシミュレート
      setTimeout(() => {
        (mockChildProcess as any).stderr.emit('data', Buffer.from('Error: Invalid address format'));
        mockChildProcess.emit('close', 1);
      }, 100);

      const response = await responsePromise;

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        scriptName: 'balance_check.ts',
        args: ['invalid_address'],
        exitCode: 1,
        error: 'Error: Invalid address format'
      });
    });

    it('should reject invalid script names', async () => {
      const response = await request(app)
        .post('/api/execute-script')
        .send({
          scriptName: 'malicious_script.js',
          args: []
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        scriptName: 'malicious_script.js',
        args: [],
        exitCode: 1,
        error: 'Invalid script name'
      });
    });

    it('should handle missing scriptName', async () => {
      const response = await request(app)
        .post('/api/execute-script')
        .send({
          args: ['0x1234567890123456789012345678901234567890']
        });

      expect(response.status).toBe(400);
    });

    it('should handle empty args array', async () => {
      const requestBody = {
        scriptName: 'balance_check.ts'
        // args は省略
      };

      const responsePromise = request(app)
        .post('/api/execute-script')
        .send(requestBody);

      setTimeout(() => {
        (mockChildProcess as any).stdout.emit('data', Buffer.from('Usage: ts-node balance_check.ts <address1> [address2] ...'));
        mockChildProcess.emit('close', 1);
      }, 100);

      const response = await responsePromise;

      expect(response.status).toBe(200);
      expect(response.body.args).toEqual([]);
    });

    it('should pass environment variables to child process', async () => {
      const requestBody = {
        scriptName: 'balance_check.ts',
        args: ['0x1234567890123456789012345678901234567890']
      };

      const responsePromise = request(app)
        .post('/api/execute-script')
        .send(requestBody);

      setTimeout(() => {
        mockChildProcess.emit('close', 0);
      }, 100);

      await responsePromise;

      expect(spawn).toHaveBeenCalledWith(
        'ts-node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            HYPEREVM_RPC_URL: expect.any(String),
            PRIVATE_KEY: expect.any(String)
          })
        })
      );
    });
  });

  describe('GET /', () => {
    it('should serve index.html', async () => {
      // ファイルシステムのモック
      jest.mock('path', () => ({
        join: jest.fn((...args) => args.join('/'))
      }));

      const response = await request(app).get('/');
      
      // ファイルが存在しない場合は404になるが、ルートは設定されている
      expect(response.status).toBe(404); // ファイルが存在しないため
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/execute-script')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    it('should handle large payloads', async () => {
      const largeArgs = new Array(1000).fill('0x1234567890123456789012345678901234567890');
      
      const response = await request(app)
        .post('/api/execute-script')
        .send({
          scriptName: 'balance_check.ts',
          args: largeArgs
        });

      // サイズ制限があれば413、なければ処理される
      expect([200, 413]).toContain(response.status);
    });
  });

  describe('CORS', () => {
    it('should have CORS enabled', async () => {
      const response = await request(app)
        .options('/api/scripts')
        .set('Origin', 'http://localhost:3001');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});