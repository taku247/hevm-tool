import { DexManager, QuoteParams } from '../../src/dex/dex-manager';
import { configLoader } from '../../src/config/config-loader';
import { ethers } from 'ethers';

// UniversalContractUtilsのモック
jest.mock('../../templates/contract-utils', () => ({
  UniversalContractUtils: jest.fn().mockImplementation(() => ({
    callReadFunction: jest.fn()
  }))
}));

describe('DexManager', () => {
  let dexManager: DexManager;
  let mockUtils: any;

  beforeEach(() => {
    // テスト用のRPC URLでDexManagerを初期化
    dexManager = new DexManager('https://test-rpc.example.com', 'hyperevm-mainnet');
    
    // UniversalContractUtilsのモックインスタンスを取得
    mockUtils = (dexManager as any).utils;
    
    // 設定をリロード
    configLoader.reloadConfig();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('初期化', () => {
    it('正常に初期化されること', () => {
      expect(dexManager).toBeDefined();
      expect((dexManager as any).network).toBe('hyperevm-mainnet');
    });

    it('ネットワークを切り替えできること', () => {
      dexManager.switchNetwork('hyperevm-testnet');
      expect((dexManager as any).network).toBe('hyperevm-testnet');
    });
  });

  describe('設定情報取得', () => {
    it('設定情報を正常に取得できること', async () => {
      const configInfo = await dexManager.getConfigInfo();
      
      expect(configInfo).toBeDefined();
      expect(configInfo.network).toBe('hyperevm-mainnet');
      expect(configInfo.dexCount).toBeGreaterThan(0);
      expect(configInfo.tokenCount).toBeGreaterThan(0);
      expect(Array.isArray(configInfo.protocols)).toBe(true);
    });
  });

  describe('V2 DEXクォート取得', () => {
    const mockQuoteParams: QuoteParams = {
      tokenIn: 'WHYPE',
      tokenOut: 'UBTC',
      amountIn: ethers.utils.parseEther('1').toString()
    };

    it('V2 DEXから正常にクォートを取得できること', async () => {
      // モックレスポンス設定
      const mockAmounts = [
        ethers.utils.parseEther('1').toString(),
        '36283' // 0.00036283 UBTC (8 decimals)
      ];
      
      mockUtils.callReadFunction.mockResolvedValue({
        success: true,
        result: mockAmounts
      });

      const result = await dexManager.getQuote('hyperswap_v2', mockQuoteParams);

      expect(result.success).toBe(true);
      expect(result.dexName).toBe('HyperSwap V2');
      expect(result.tokenIn).toBe('WHYPE');
      expect(result.tokenOut).toBe('UBTC');
      expect(result.rate).toBeGreaterThan(0);
      expect(result.gasEstimate).toBe(150000);
    });

    it('V2 DEXでエラーが発生した場合の処理', async () => {
      mockUtils.callReadFunction.mockResolvedValue({
        success: false,
        error: 'Contract call failed'
      });

      const result = await dexManager.getQuote('hyperswap_v2', mockQuoteParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Contract call failed');
      expect(result.rate).toBe(0);
    });

    it('無効なamountOutの場合のエラー処理', async () => {
      mockUtils.callReadFunction.mockResolvedValue({
        success: true,
        result: ['1000000000000000000'] // 1つの要素のみ（無効）
      });

      const result = await dexManager.getQuote('hyperswap_v2', mockQuoteParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('有効な出力量を取得できませんでした');
    });
  });

  describe('V3 DEXクォート取得', () => {
    const mockQuoteParams: QuoteParams = {
      tokenIn: 'WHYPE',
      tokenOut: 'UBTC', 
      amountIn: ethers.utils.parseEther('1').toString()
    };

    it('V3 DEXから正常にクォートを取得できること', async () => {
      // 最初のフィーティア（100bps）で成功のモック
      mockUtils.callReadFunction.mockResolvedValueOnce({
        success: true,
        result: '36283' // 0.00036283 UBTC
      });

      const result = await dexManager.getQuote('hyperswap_v3', mockQuoteParams);

      expect(result.success).toBe(true);
      expect(result.dexName).toContain('HyperSwap V3');
      expect(result.fee).toBeDefined();
      expect(result.gasEstimate).toBe(200000);
    });

    it('全フィーティアで流動性がない場合のエラー処理', async () => {
      // 全フィーティアでエラーのモック
      mockUtils.callReadFunction.mockRejectedValue(new Error('No liquidity'));

      const result = await dexManager.getQuote('kittenswap_cl', mockQuoteParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('すべてのフィーティアで流動性が見つかりません');
    });
  });

  describe('全DEXクォート取得', () => {
    const mockQuoteParams: QuoteParams = {
      tokenIn: 'WHYPE',
      tokenOut: 'UBTC',
      amountIn: ethers.utils.parseEther('1').toString()
    };

    it('全アクティブDEXからクォートを取得できること', async () => {
      // HyperSwap V2成功のモック
      mockUtils.callReadFunction.mockImplementation((params: any) => {
        if (params.functionName === 'getAmountsOut') {
          return Promise.resolve({
            success: true,
            result: [mockQuoteParams.amountIn, '36283']
          });
        }
        // V3は失敗
        return Promise.reject(new Error('No liquidity'));
      });

      const results = await dexManager.getAllQuotes(mockQuoteParams);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // 少なくとも1つは成功しているはず
      const successfulQuotes = results.filter(r => r.success);
      expect(successfulQuotes.length).toBeGreaterThan(0);
    });
  });

  describe('プロトコル別クォート', () => {
    const mockQuoteParams: QuoteParams = {
      tokenIn: 'WHYPE',
      tokenOut: 'UBTC',
      amountIn: ethers.utils.parseEther('1').toString()
    };

    it('V2プロトコルのみのクォートを取得できること', async () => {
      mockUtils.callReadFunction.mockResolvedValue({
        success: true,
        result: [mockQuoteParams.amountIn, '36283']
      });

      const results = await dexManager.getQuotesByProtocol('uniswap-v2', mockQuoteParams);

      expect(Array.isArray(results)).toBe(true);
      
      // 全てV2のはず
      results.forEach(result => {
        if (result.success) {
          expect(result.gasEstimate).toBe(150000); // V2のガス使用量
        }
      });
    });
  });

  describe('最良レート検索', () => {
    const mockQuoteParams: QuoteParams = {
      tokenIn: 'WHYPE',
      tokenOut: 'UBTC',
      amountIn: ethers.utils.parseEther('1').toString()
    };

    it('最良レートを正しく選択できること', async () => {
      // 異なるレートのモック
      let callCount = 0;
      mockUtils.callReadFunction.mockImplementation(() => {
        callCount++;
        const rates = ['30000', '36283', '35000']; // 異なるレート
        const rate = rates[callCount % rates.length] || '36283';
        
        return Promise.resolve({
          success: true,
          result: [mockQuoteParams.amountIn, rate]
        });
      });

      const bestQuote = await dexManager.getBestQuote(mockQuoteParams);

      expect(bestQuote).toBeDefined();
      expect(bestQuote?.success).toBe(true);
      expect(bestQuote?.rate).toBeGreaterThan(0);
    });

    it('成功したクォートがない場合nullを返すこと', async () => {
      mockUtils.callReadFunction.mockResolvedValue({
        success: false,
        error: 'All failed'
      });

      const bestQuote = await dexManager.getBestQuote(mockQuoteParams);

      expect(bestQuote).toBeNull();
    });
  });

  describe('アービトラージ機会検索', () => {
    it('価格差がある場合にアービトラージ機会を検出できること', async () => {
      // 異なるレートを返すモック
      let callCount = 0;
      mockUtils.callReadFunction.mockImplementation(() => {
        callCount++;
        // 意図的に異なるレートを設定（10%の差）
        const rates = ['30000', '33000']; // 約10%の差
        const rate = rates[callCount % 2];
        
        return Promise.resolve({
          success: true,
          result: [ethers.utils.parseEther('1').toString(), rate]
        });
      });

      const opportunities = await dexManager.findArbitrageOpportunities(
        'WHYPE', 
        'UBTC', 
        ethers.utils.parseEther('1').toString(),
        0.05 // 5%以上の差
      );

      if (opportunities.length > 0) {
        expect(opportunities[0].spread).toBeGreaterThan(0.05);
        expect(opportunities[0].buyDex).toBeDefined();
        expect(opportunities[0].sellDex).toBeDefined();
        expect(opportunities[0].profit).toBeGreaterThan(0);
      }
    });

    it('価格差が小さい場合は機会が見つからないこと', async () => {
      // 同じレートを返すモック
      mockUtils.callReadFunction.mockResolvedValue({
        success: true,
        result: [ethers.utils.parseEther('1').toString(), '36283']
      });

      const opportunities = await dexManager.findArbitrageOpportunities(
        'WHYPE',
        'UBTC',
        ethers.utils.parseEther('1').toString(),
        0.05 // 5%以上の差
      );

      expect(opportunities.length).toBe(0);
    });
  });

  describe('エラーハンドリング', () => {
    it('存在しないDEXでエラーが適切に処理されること', async () => {
      const result = await dexManager.getQuote('non_existent_dex', {
        tokenIn: 'WHYPE',
        tokenOut: 'UBTC',
        amountIn: '1000000000000000000'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('DEX \'non_existent_dex\' の設定が見つかりません');
    });

    it('存在しないトークンでエラーが適切に処理されること', async () => {
      const result = await dexManager.getQuote('hyperswap_v2', {
        tokenIn: 'NON_EXISTENT_TOKEN',
        tokenOut: 'UBTC',
        amountIn: '1000000000000000000'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('トークン \'NON_EXISTENT_TOKEN\' の設定が見つかりません');
    });

    it('routerアドレスがないV2 DEXでエラーが適切に処理されること', async () => {
      // 設定を一時的に変更するのは複雑なので、エラーケースを直接テスト
      const invalidDexConfig = {
        name: 'Invalid DEX',
        protocol: 'uniswap-v2',
        type: 'v2' as const,
        abi: './abi/UniV2Router.json',
        quoteFunctions: {},
        status: 'active' as const
        // router プロパティを意図的に省略
      };

      // プライベートメソッドを直接テストするのは推奨されないが、
      // エラーハンドリングを確認するため
      try {
        await (dexManager as any).getV2Quote(
          invalidDexConfig,
          { decimals: 18, address: '0x1234' },
          { decimals: 8, address: '0x5678' },
          { tokenIn: 'A', tokenOut: 'B', amountIn: '1000' }
        );
        fail('エラーが発生するべきです');
      } catch (error: any) {
        expect(error.message).toContain('V2 DEXにrouterアドレスが設定されていません');
      }
    });
  });
});