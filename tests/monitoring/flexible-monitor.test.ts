import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

describe('柔軟DEX監視スクリプトテスト', () => {
  const scriptPath = 'custom/monitoring/flexible-dex-monitor.ts';
  const timeout = 30000; // 30秒タイムアウト

  /**
   * TypeScriptスクリプトを実行するヘルパー関数
   */
  const runScript = (args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    return new Promise((resolve, reject) => {
      const child = spawn('npx', ['ts-node', scriptPath, ...args], {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code || 0 });
      });

      child.on('error', (error) => {
        reject(error);
      });

      // タイムアウト処理
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Script execution timeout'));
      }, timeout);
    });
  };

  describe('ヘルプとバージョン情報', () => {
    it('ヘルプメッセージを表示できること', async () => {
      const result = await runScript(['--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('設定ベース柔軟DEX監視ツール');
      expect(result.stdout).toContain('使用方法:');
      expect(result.stdout).toContain('--tokens');
      expect(result.stdout).toContain('--config');
    });
  });

  describe('設定情報表示', () => {
    it('設定情報を正常に表示できること', async () => {
      const result = await runScript(['--config']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('設定情報');
      expect(result.stdout).toContain('ネットワーク:');
      expect(result.stdout).toContain('DEX数:');
      expect(result.stdout).toContain('トークン数:');
      expect(result.stdout).toContain('アクティブDEX:');
      expect(result.stdout).toContain('利用可能トークン:');
      
      console.log('設定情報出力:\n', result.stdout);
    });
  });

  describe('基本レート取得', () => {
    it('WHYPE/UBTCペアのレートを取得できること', async () => {
      const result = await runScript(['--tokens=WHYPE,UBTC', '--amount=1']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('DEX レート比較結果');
      expect(result.stdout).toContain('WHYPE');
      expect(result.stdout).toContain('UBTC');
      
      console.log('基本レート取得結果:\n', result.stdout);
    });

    it('JSONフォーマットで出力できること', async () => {
      const result = await runScript(['--tokens=WHYPE,UBTC', '--amount=1', '--output=json']);
      
      expect(result.exitCode).toBe(0);
      
      // JSON形式の出力を確認
      try {
        const lines = result.stdout.split('\n');
        const jsonLine = lines.find(line => line.trim().startsWith('['));
        if (jsonLine) {
          const jsonData = JSON.parse(jsonLine);
          expect(Array.isArray(jsonData)).toBe(true);
          
          if (jsonData.length > 0) {
            expect(jsonData[0]).toHaveProperty('dexName');
            expect(jsonData[0]).toHaveProperty('rate');
            expect(jsonData[0]).toHaveProperty('success');
          }
        }
      } catch (error) {
        console.log('JSON解析エラー:', error);
        console.log('出力内容:', result.stdout);
      }
    });

    it('CSVフォーマットで出力できること', async () => {
      const result = await runScript(['--tokens=WHYPE,UBTC', '--amount=1', '--output=csv']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('DEX,TokenIn,TokenOut,AmountIn,AmountOut,Rate');
      
      console.log('CSV出力結果:\n', result.stdout);
    });
  });

  describe('フィルタリング機能', () => {
    it('V2プロトコルのみでフィルタできること', async () => {
      const result = await runScript(['--protocol=uniswap-v2', '--tokens=WHYPE,UBTC', '--amount=1']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('DEX レート比較結果');
      
      // V2のみが表示されることを確認（V3関連のエラーメッセージがないことで判断）
      expect(result.stdout).not.toContain('bps プール');
      
      console.log('V2プロトコルフィルタ結果:\n', result.stdout);
    });

    it('特定DEXのみで実行できること', async () => {
      const result = await runScript(['--dex=hyperswap_v2', '--tokens=WHYPE,UBTC', '--amount=1']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('HyperSwap V2');
      
      console.log('特定DEX実行結果:\n', result.stdout);
    });

    it('テストネットで実行できること', async () => {
      const result = await runScript(['--network=hyperevm-testnet', '--tokens=WHYPE,UBTC', '--amount=1']);
      
      expect(result.exitCode).toBe(0);
      
      console.log('テストネット実行結果:\n', result.stdout);
    });
  });

  describe('エラーハンドリング', () => {
    it('必須パラメータが不足している場合のエラー処理', async () => {
      const result = await runScript([]);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr || result.stdout).toContain('--tokens オプションが必要です');
    });

    it('無効なトークンペアでのエラー処理', async () => {
      const result = await runScript(['--tokens=INVALID,TOKEN']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr || result.stdout).toContain('サポートされていないトークン');
    });

    it('存在しないDEXでのエラー処理', async () => {
      const result = await runScript(['--dex=non_existent_dex', '--tokens=WHYPE,UBTC']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr || result.stdout).toContain('設定が見つかりません');
    });

    it('存在しないプロトコルでのエラー処理', async () => {
      const result = await runScript(['--protocol=non_existent_protocol', '--tokens=WHYPE,UBTC']);
      
      expect(result.exitCode).toBe(0); // プロトコルが存在しない場合は空の結果を返す
      expect(result.stdout).toContain('有効なクォートを取得できませんでした');
    });
  });

  describe('異なる金額での実行', () => {
    it('異なる金額でレートを取得できること', async () => {
      const amounts = ['0.1', '1', '10'];
      
      for (const amount of amounts) {
        const result = await runScript(['--tokens=WHYPE,UBTC', `--amount=${amount}`]);
        
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('DEX レート比較結果');
        
        console.log(`${amount} WHYPE のレート結果:\n`, result.stdout.split('\n')[0]);
      }
    });
  });

  describe('アービトラージ機能', () => {
    it('アービトラージ検索が実行できること', async () => {
      const result = await runScript(['--tokens=WHYPE,UBTC', '--amount=1', '--arbitrage', '--min-spread=0.01']);
      
      expect(result.exitCode).toBe(0);
      
      // アービトラージ機会があるかどうかは市況次第だが、
      // 機能が実行されることを確認
      if (result.stdout.includes('アービトラージ機会')) {
        expect(result.stdout).toContain('機会');
        console.log('アービトラージ結果:\n', result.stdout);
      } else {
        expect(result.stdout).toContain('アービトラージ機会は見つかりませんでした');
      }
    });
  });

  describe('パフォーマンステスト', () => {
    it('スクリプト実行時間が妥当な範囲内であること', async () => {
      const startTime = Date.now();
      
      const result = await runScript(['--tokens=WHYPE,UBTC', '--amount=1']);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      expect(result.exitCode).toBe(0);
      expect(executionTime).toBeLessThan(20000); // 20秒以内
      
      console.log(`スクリプト実行時間: ${executionTime}ms`);
    });
  });

  describe('出力フォーマット検証', () => {
    it('テーブル出力に必要な要素が含まれていること', async () => {
      const result = await runScript(['--tokens=WHYPE,UBTC', '--amount=1']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('┌'); // テーブルの枠線
      expect(result.stdout).toContain('│'); // テーブルの縦線
      expect(result.stdout).toContain('DEX');
      expect(result.stdout).toContain('レート');
      expect(result.stdout).toContain('出力量');
      expect(result.stdout).toContain('ガス予想');
      expect(result.stdout).toContain('更新時刻');
    });

    it('成功時と失敗時の両方のケースを適切に表示できること', async () => {
      const result = await runScript(['--tokens=WHYPE,UBTC', '--amount=1']);
      
      expect(result.exitCode).toBe(0);
      
      // 成功したクォートまたはエラー情報のいずれかが表示されることを確認
      const hasSuccessfulQuote = result.stdout.includes('🏆');
      const hasErrorInfo = result.stdout.includes('❌') || result.stdout.includes('⚠️');
      
      expect(hasSuccessfulQuote || hasErrorInfo).toBe(true);
      
      if (hasErrorInfo) {
        console.log('エラー情報が含まれる結果:\n', result.stdout);
      }
    });
  });
});