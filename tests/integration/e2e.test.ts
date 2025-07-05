import request from 'supertest';
import WebSocket from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { AddressInfo } from 'net';

describe('End-to-End Integration Tests', () => {
  let server: ChildProcess;
  let app: any;
  let baseUrl: string;
  let wsUrl: string;

  beforeAll(async () => {
    // テスト用サーバーを起動
    server = spawn('ts-node', ['dashboard/server.ts'], {
      env: {
        ...process.env,
        PORT: '0', // ランダムポートを使用
        NODE_ENV: 'test',
        HYPEREVM_RPC_URL: 'http://localhost:8545',
        PRIVATE_KEY: '0x' + '1'.repeat(64)
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // サーバーの起動を待機
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 10000);

      server.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('Server output:', output);
        
        if (output.includes('Dashboard server running on')) {
          const match = output.match(/http:\/\/localhost:(\d+)/);
          if (match) {
            const port = match[1];
            baseUrl = `http://localhost:${port}`;
            wsUrl = `ws://localhost:8080`;
            clearTimeout(timeout);
            resolve(void 0);
          }
        }
      });

      server.stderr?.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      server.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 15000);

  afterAll(async () => {
    // サーバーを停止
    if (server) {
      server.kill('SIGTERM');
      await new Promise((resolve) => {
        server.on('close', resolve);
        setTimeout(() => {
          server.kill('SIGKILL');
          resolve(void 0);
        }, 5000);
      });
    }
  }, 10000);

  describe('API Integration', () => {
    it('should get list of available scripts', async () => {
      const response = await request(baseUrl).get('/api/scripts');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'balance_check.ts',
            description: expect.any(String),
            parameters: expect.any(Array)
          })
        ])
      );
    });

    it('should reject invalid script execution', async () => {
      const response = await request(baseUrl)
        .post('/api/execute-script')
        .send({
          scriptName: 'malicious_script.js',
          args: []
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Invalid script name'
      });
    });

    it('should execute balance check script', async () => {
      const response = await request(baseUrl)
        .post('/api/execute-script')
        .send({
          scriptName: 'balance_check.ts',
          args: ['0x1234567890123456789012345678901234567890']
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        scriptName: 'balance_check.ts',
        args: ['0x1234567890123456789012345678901234567890'],
        exitCode: expect.any(Number),
        timestamp: expect.any(String)
      });

      // 実際のスクリプト実行なので、ネットワークエラーになる可能性が高い
      if (response.body.exitCode !== 0) {
        expect(response.body.error).toContain('network');
      }
    }, 30000);

    it('should handle script with invalid arguments', async () => {
      const response = await request(baseUrl)
        .post('/api/execute-script')
        .send({
          scriptName: 'balance_check.ts',
          args: []
        });

      expect(response.status).toBe(200);
      expect(response.body.exitCode).not.toBe(0);
      expect(response.body.output || response.body.error).toContain('Usage');
    }, 15000);
  });

  describe('WebSocket Integration', () => {
    it('should connect to WebSocket server', (done) => {
      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should receive script execution results via WebSocket', (done) => {
      const ws = new WebSocket(wsUrl);
      let messageReceived = false;

      ws.on('open', async () => {
        // WebSocket接続後にスクリプトを実行
        const response = await request(baseUrl)
          .post('/api/execute-script')
          .send({
            scriptName: 'balance_check.ts',
            args: ['0x1234567890123456789012345678901234567890']
          });

        expect(response.status).toBe(200);
      });

      ws.on('message', (data) => {
        if (messageReceived) return; // 重複メッセージを防ぐ
        messageReceived = true;

        try {
          const message = JSON.parse(data.toString());
          
          expect(message).toMatchObject({
            type: 'script_execution',
            data: {
              scriptName: 'balance_check.ts',
              args: ['0x1234567890123456789012345678901234567890'],
              exitCode: expect.any(Number),
              timestamp: expect.any(String)
            }
          });

          ws.close();
          done();
        } catch (error) {
          ws.close();
          done(error);
        }
      });

      ws.on('error', (error) => {
        done(error);
      });

      // タイムアウト設定
      setTimeout(() => {
        if (!messageReceived) {
          ws.close();
          done(new Error('WebSocket message timeout'));
        }
      }, 20000);
    }, 25000);
  });

  describe('Error Handling Integration', () => {
    it('should handle concurrent script executions', async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        request(baseUrl)
          .post('/api/execute-script')
          .send({
            scriptName: 'balance_check.ts',
            args: [`0x${'1'.repeat(40)}`]
          })
      );

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          scriptName: 'balance_check.ts',
          exitCode: expect.any(Number),
          timestamp: expect.any(String)
        });
      });
    }, 30000);

    it('should handle malformed requests gracefully', async () => {
      const response = await request(baseUrl)
        .post('/api/execute-script')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    it('should serve static files', async () => {
      const response = await request(baseUrl).get('/');
      
      // index.htmlが存在しない場合は404、存在する場合は200
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Performance Tests', () => {
    it('should handle rapid API requests', async () => {
      const startTime = Date.now();
      
      const promises = Array.from({ length: 10 }, () =>
        request(baseUrl).get('/api/scripts')
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // 10リクエストが5秒以内に完了すること
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should handle WebSocket connections under load', (done) => {
      const connections: WebSocket[] = [];
      let connectedCount = 0;
      const targetConnections = 5;

      for (let i = 0; i < targetConnections; i++) {
        const ws = new WebSocket(wsUrl);
        connections.push(ws);

        ws.on('open', () => {
          connectedCount++;
          if (connectedCount === targetConnections) {
            // すべての接続を閉じる
            connections.forEach(connection => connection.close());
            done();
          }
        });

        ws.on('error', (error) => {
          connections.forEach(connection => connection.close());
          done(error);
        });
      }

      // タイムアウト設定
      setTimeout(() => {
        connections.forEach(connection => connection.close());
        if (connectedCount < targetConnections) {
          done(new Error(`Only ${connectedCount}/${targetConnections} connections established`));
        }
      }, 10000);
    }, 15000);
  });
});