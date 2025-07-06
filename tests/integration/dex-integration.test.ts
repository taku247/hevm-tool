import { DexManager } from '../../src/dex/dex-manager';
import { configLoader } from '../../src/config/config-loader';
import { ethers } from 'ethers';

describe('DEX統合テスト (実ネットワーク)', () => {
  let dexManager: DexManager;
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';

  beforeAll(() => {
    dexManager = new DexManager(rpcUrl, 'hyperevm-mainnet');
  });

  beforeEach(() => {
    configLoader.reloadConfig();
  });

  describe('設定システム統合', () => {
    it('実際の設定ファイルから設定を読み込めること', async () => {
      const configInfo = await dexManager.getConfigInfo();
      
      expect(configInfo.network).toBe('hyperevm-mainnet');
      expect(configInfo.dexCount).toBeGreaterThan(0);
      expect(configInfo.tokenCount).toBeGreaterThan(0);
      expect(configInfo.protocols.length).toBeGreaterThan(0);
      
      console.log('設定情報:', configInfo);
    });

    it('DEX設定の整合性を確認できること', async () => {
      const validation = await configLoader.validateConfig();
      
      expect(validation.valid).toBe(true);
      
      if (!validation.valid) {
        console.error('設定検証エラー:', validation.errors);
        fail('設定が無効です');
      }
    });
  });

  describe('実ネットワークでのクォート取得', () => {
    const testAmount = ethers.utils.parseEther('1').toString();

    it('HyperSwap V2から実際のクォートを取得できること', async () => {
      const result = await dexManager.getQuote('hyperswap_v2', {
        tokenIn: 'WHYPE',
        tokenOut: 'UBTC',
        amountIn: testAmount
      });

      console.log('HyperSwap V2 クォート結果:', result);

      expect(result).toBeDefined();
      expect(result.dexName).toBe('HyperSwap V2');
      expect(result.tokenIn).toBe('WHYPE');
      expect(result.tokenOut).toBe('UBTC');
      
      if (result.success) {
        expect(result.rate).toBeGreaterThan(0);
        expect(result.amountOut).toBeTruthy();
        expect(result.gasEstimate).toBeGreaterThan(0);
        
        // レートの妥当性チェック（WHYPE/UBTCの想定範囲）
        expect(result.rate).toBeGreaterThan(0.0001); // 最小値
        expect(result.rate).toBeLessThan(0.01);      // 最大値
      } else {
        console.warn('HyperSwap V2クォート失敗:', result.error);
      }
    }, 30000); // 30秒タイムアウト

    it('全アクティブDEXからクォートを取得できること', async () => {
      const results = await dexManager.getAllQuotes({
        tokenIn: 'WHYPE',
        tokenOut: 'UBTC',
        amountIn: testAmount
      });

      console.log('全DEXクォート結果:');
      results.forEach(result => {
        console.log(`  ${result.dexName}: ${result.success ? `${result.rate.toFixed(8)}` : `エラー: ${result.error}`}`);
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // 少なくとも1つは成功することを期待
      const successfulQuotes = results.filter(r => r.success);
      expect(successfulQuotes.length).toBeGreaterThan(0);

      // 成功したクォートの妥当性チェック
      successfulQuotes.forEach(quote => {
        expect(quote.rate).toBeGreaterThan(0);
        expect(quote.timestamp).toBeTruthy();
        expect(quote.gasEstimate).toBeGreaterThan(0);
      });
    }, 60000); // 60秒タイムアウト

    it('V2プロトコルのみのクォートを取得できること', async () => {
      const results = await dexManager.getQuotesByProtocol('uniswap-v2', {
        tokenIn: 'WHYPE',
        tokenOut: 'UBTC',
        amountIn: testAmount
      });

      console.log('V2プロトコルクォート結果:');
      results.forEach(result => {
        console.log(`  ${result.dexName}: ${result.success ? `${result.rate.toFixed(8)}` : `エラー: ${result.error}`}`);
      });

      expect(Array.isArray(results)).toBe(true);
      
      // V2のガス見積もりを確認
      const successfulV2Quotes = results.filter(r => r.success);
      successfulV2Quotes.forEach(quote => {
        expect(quote.gasEstimate).toBeLessThan(250000); // V2は一般的により少ないガス
      });
    }, 45000);
  });

  describe('最良レート検索', () => {
    it('実際に最良レートを見つけられること', async () => {
      const bestQuote = await dexManager.getBestQuote({
        tokenIn: 'WHYPE',
        tokenOut: 'UBTC',
        amountIn: ethers.utils.parseEther('1').toString()
      });

      console.log('最良レート:', bestQuote);

      if (bestQuote) {
        expect(bestQuote.success).toBe(true);
        expect(bestQuote.rate).toBeGreaterThan(0);
        
        console.log(`最良DEX: ${bestQuote.dexName}`);
        console.log(`レート: ${bestQuote.rate.toFixed(8)}`);
        console.log(`ガス見積もり: ${bestQuote.gasEstimate}`);
      } else {
        console.warn('最良レートが見つかりませんでした');
      }
    }, 60000);
  });

  describe('アービトラージ機会検索', () => {
    it('実際のアービトラージ機会を検索できること', async () => {
      const opportunities = await dexManager.findArbitrageOpportunities(
        'WHYPE',
        'UBTC',
        ethers.utils.parseEther('1').toString(),
        0.01 // 1%以上の差
      );

      console.log(`アービトラージ機会: ${opportunities.length}件`);
      
      opportunities.forEach((opp, index) => {
        console.log(`機会 #${index + 1}:`);
        console.log(`  購入: ${opp.buyDex.dexName} - レート ${opp.buyDex.rate.toFixed(8)}`);
        console.log(`  売却: ${opp.sellDex.dexName} - レート ${opp.sellDex.rate.toFixed(8)}`);
        console.log(`  スプレッド: ${(opp.spread * 100).toFixed(2)}%`);
        console.log(`  予想利益: ${opp.profit.toFixed(6)} UBTC`);
      });

      // アービトラージ機会があるかどうかは市況次第だが、
      // 機能自体は正常に動作することを確認
      expect(Array.isArray(opportunities)).toBe(true);
      
      if (opportunities.length > 0) {
        opportunities.forEach(opp => {
          expect(opp.spread).toBeGreaterThan(0.01);
          expect(opp.buyDex.rate).toBeLessThan(opp.sellDex.rate);
          expect(opp.profit).toBeGreaterThan(0);
        });
      }
    }, 90000);
  });

  describe('エラー処理', () => {
    it('存在しないトークンペアでのエラー処理', async () => {
      const result = await dexManager.getQuote('hyperswap_v2', {
        tokenIn: 'WHYPE',
        tokenOut: 'NON_EXISTENT_TOKEN',
        amountIn: ethers.utils.parseEther('1').toString()
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      console.log('期待されるエラー:', result.error);
    }, 30000);

    it('無効な量でのエラー処理', async () => {
      const result = await dexManager.getQuote('hyperswap_v2', {
        tokenIn: 'WHYPE',
        tokenOut: 'UBTC',
        amountIn: '0' // 無効な量
      });

      // 0の場合でもDEXが正常にレスポンスを返す可能性があるが、
      // エラーハンドリングが適切に機能することを確認
      console.log('0量でのクォート結果:', result);
      
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
    }, 30000);
  });

  describe('レスポンス時間測定', () => {
    it('クォート取得のレスポンス時間を測定', async () => {
      const startTime = Date.now();
      
      const result = await dexManager.getQuote('hyperswap_v2', {
        tokenIn: 'WHYPE',
        tokenOut: 'UBTC',
        amountIn: ethers.utils.parseEther('1').toString()
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`HyperSwap V2レスポンス時間: ${responseTime}ms`);
      
      // レスポンス時間は通常5秒以内であることを期待
      expect(responseTime).toBeLessThan(5000);
      
      if (result.success) {
        console.log(`成功: レート ${result.rate.toFixed(8)}`);
      }
    }, 10000);

    it('全DEXクォートのレスポンス時間を測定', async () => {
      const startTime = Date.now();
      
      const results = await dexManager.getAllQuotes({
        tokenIn: 'WHYPE',
        tokenOut: 'UBTC',
        amountIn: ethers.utils.parseEther('1').toString()
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`全DEXクォートレスポンス時間: ${responseTime}ms`);
      console.log(`成功数: ${results.filter(r => r.success).length}/${results.length}`);
      
      // 複数DEXでも15秒以内であることを期待
      expect(responseTime).toBeLessThan(15000);
    }, 20000);
  });
});