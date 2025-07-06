/**
 * フルシステム統合テスト
 * 設定ベースDEXシステム全体の動作を検証
 */

import { spawn } from 'child_process';
import { DexManager } from '../../src/dex/dex-manager';
import { configLoader } from '../../src/config/config-loader';

describe('フルシステム統合テスト', () => {
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  let dexManager: DexManager;

  beforeAll(() => {
    dexManager = new DexManager(rpcUrl, 'hyperevm-mainnet');
  });

  describe('システム設定検証', () => {
    it('設定ファイルが正しく読み込まれること', async () => {
      const validation = await configLoader.validateConfig();
      
      expect(validation.valid).toBe(true);
      
      if (!validation.valid) {
        console.error('設定検証エラー:', validation.errors);
        fail('設定が無効です');
      }
    });

    it('必要なDEX設定が存在すること', async () => {
      const dexes = await configLoader.getActiveDexes();
      
      expect(Object.keys(dexes).length).toBeGreaterThan(0);
      
      // HyperSwap V2は最低限動作することを確認
      expect(dexes.hyperswap_v2).toBeDefined();
      expect(dexes.hyperswap_v2?.status).toBe('active');
    });

    it('必要なトークン設定が存在すること', async () => {
      const tokens = await configLoader.getTokenConfig();
      
      expect(tokens.WHYPE).toBeDefined();
      expect(tokens.UBTC).toBeDefined();
      expect(tokens.WHYPE?.decimals).toBe(18);
      expect(tokens.UBTC?.decimals).toBe(8);
    });
  });

  describe('実ネットワーク接続テスト', () => {
    it('少なくとも1つのDEXから正常にクォートを取得できること', async () => {
      const configInfo = await dexManager.getConfigInfo();
      
      expect(configInfo.dexCount).toBeGreaterThan(0);
      expect(configInfo.tokenCount).toBeGreaterThan(0);
      
      // 実際のクォート取得テスト
      const results = await dexManager.getAllQuotes({
        tokenIn: 'WHYPE',
        tokenOut: 'UBTC',
        amountIn: '1000000000000000000' // 1 WHYPE
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // 少なくとも1つは成功することを期待
      const successfulQuotes = results.filter(r => r.success);
      expect(successfulQuotes.length).toBeGreaterThan(0);

      // 成功したクォートの妥当性チェック
      successfulQuotes.forEach(quote => {
        expect(quote.rate).toBeGreaterThan(0);
        expect(quote.rate).toBeLessThan(1); // WHYPE/UBTCの想定範囲
        expect(quote.gasEstimate).toBeGreaterThan(0);
        expect(quote.timestamp).toBeTruthy();
      });

      console.log('成功したDEX:', successfulQuotes.map(q => q.dexName));
    }, 30000);

    it('レスポンス時間が妥当な範囲内であること', async () => {
      const startTime = Date.now();
      
      const quote = await dexManager.getQuote('hyperswap_v2', {
        tokenIn: 'WHYPE',
        tokenOut: 'UBTC',
        amountIn: '1000000000000000000'
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(5000); // 5秒以内
      
      console.log(`HyperSwap V2レスポンス時間: ${responseTime}ms`);
      console.log(`結果: ${quote.success ? '成功' : `失敗 - ${quote.error}`}`);
    }, 10000);
  });

  describe('監視スクリプト統合テスト', () => {
    it('監視スクリプトが正常に実行できること', (done) => {
      const child = spawn('node', [
        'temp/custom/monitoring/flexible-dex-monitor.js',
        '--tokens=WHYPE,UBTC',
        '--amount=1',
        '--output=json'
      ], {
        cwd: process.cwd(),
        timeout: 15000
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
        try {
          expect(code).toBe(0);
          
          // JSON出力の検証
          const lines = stdout.split('\n');
          const jsonLine = lines.find(line => line.trim().startsWith('['));
          
          if (jsonLine) {
            const data = JSON.parse(jsonLine);
            expect(Array.isArray(data)).toBe(true);
            
            if (data.length > 0) {
              expect(data[0]).toHaveProperty('dexName');
              expect(data[0]).toHaveProperty('success');
              expect(data[0]).toHaveProperty('timestamp');
            }
          }

          console.log('監視スクリプト実行成功');
          done();
        } catch (error) {
          console.error('監視スクリプトエラー:', stderr);
          console.error('出力:', stdout);
          done(error);
        }
      });

      child.on('error', (error) => {
        done(error);
      });
    }, 20000);

    it('設定情報表示が正常に動作すること', (done) => {
      const child = spawn('node', [
        'temp/custom/monitoring/flexible-dex-monitor.js',
        '--config'
      ], {
        cwd: process.cwd(),
        timeout: 10000
      });

      let stdout = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.on('close', (code) => {
        try {
          expect(code).toBe(0);
          expect(stdout).toContain('設定情報');
          expect(stdout).toContain('ネットワーク:');
          expect(stdout).toContain('DEX数:');
          expect(stdout).toContain('アクティブDEX:');
          
          console.log('設定情報表示成功');
          done();
        } catch (error) {
          done(error);
        }
      });

      child.on('error', (error) => {
        done(error);
      });
    }, 15000);
  });

  describe('エラーハンドリング統合テスト', () => {
    it('存在しないトークンペアで適切にエラーを処理すること', async () => {
      const result = await dexManager.getQuote('hyperswap_v2', {
        tokenIn: 'WHYPE',
        tokenOut: 'NON_EXISTENT_TOKEN',
        amountIn: '1000000000000000000'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.rate).toBe(0);
    });

    it('存在しないDEXで適切にエラーを処理すること', async () => {
      const result = await dexManager.getQuote('non_existent_dex', {
        tokenIn: 'WHYPE',
        tokenOut: 'UBTC',
        amountIn: '1000000000000000000'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('設定が見つかりません');
    });
  });

  describe('パフォーマンステスト', () => {
    it('複数DEX同時クォートが合理的な時間で完了すること', async () => {
      const startTime = Date.now();
      
      const results = await dexManager.getAllQuotes({
        tokenIn: 'WHYPE',
        tokenOut: 'UBTC',
        amountIn: '1000000000000000000'
      });
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(15000); // 15秒以内
      expect(results.length).toBeGreaterThan(0);
      
      console.log(`全DEXクォート時間: ${totalTime}ms`);
      console.log(`結果数: ${results.length}`);
      console.log(`成功数: ${results.filter(r => r.success).length}`);
    }, 20000);

    it('メモリ使用量が異常でないこと', async () => {
      const initialMemory = process.memoryUsage();
      
      // 複数回クォート取得を実行
      for (let i = 0; i < 5; i++) {
        await dexManager.getAllQuotes({
          tokenIn: 'WHYPE',
          tokenOut: 'UBTC',
          amountIn: '1000000000000000000'
        });
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // メモリ増加が100MB以下であることを確認
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      console.log(`メモリ増加: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    }, 30000);
  });

  describe('設定システム拡張性テスト', () => {
    it('新しいネットワーク設定に切り替えできること', () => {
      dexManager.switchNetwork('hyperevm-testnet');
      expect((dexManager as any).network).toBe('hyperevm-testnet');
      
      // 元に戻す
      dexManager.switchNetwork('hyperevm-mainnet');
      expect((dexManager as any).network).toBe('hyperevm-mainnet');
    });

    it('プロトコル別フィルタリングが正常に動作すること', async () => {
      const v2Quotes = await dexManager.getQuotesByProtocol('uniswap-v2', {
        tokenIn: 'WHYPE',
        tokenOut: 'UBTC',
        amountIn: '1000000000000000000'
      });

      const v3Quotes = await dexManager.getQuotesByProtocol('uniswap-v3', {
        tokenIn: 'WHYPE',
        tokenOut: 'UBTC',
        amountIn: '1000000000000000000'
      });

      expect(Array.isArray(v2Quotes)).toBe(true);
      expect(Array.isArray(v3Quotes)).toBe(true);
      
      // V2とV3で異なる結果になることを確認
      if (v2Quotes.length > 0 && v3Quotes.length > 0) {
        const v2DexNames = v2Quotes.map(q => q.dexId);
        const v3DexNames = v3Quotes.map(q => q.dexId);
        
        // 完全に重複しないことを確認
        const overlap = v2DexNames.filter(name => v3DexNames.includes(name));
        expect(overlap.length).toBe(0);
      }
    });
  });

  describe('実用性テスト', () => {
    it('実際のトレーダーが使用する金額でテストできること', async () => {
      const testAmounts = ['0.1', '1', '10'];
      
      for (const amount of testAmounts) {
        const amountWei = require('ethers').utils.parseEther(amount).toString();
        
        const result = await dexManager.getBestQuote({
          tokenIn: 'WHYPE',
          tokenOut: 'UBTC',
          amountIn: amountWei
        });

        if (result?.success) {
          expect(result.rate).toBeGreaterThan(0);
          console.log(`${amount} WHYPE → ${result.rate.toFixed(8)} UBTC/WHYPE (${result.dexName})`);
        }
      }
    }, 45000);
  });
});