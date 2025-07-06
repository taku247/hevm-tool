import { ethers } from 'ethers';
import { UniversalContractUtils } from '../../templates/contract-utils';
import { configLoader, DexConfig, TokenConfig } from '../config/config-loader';

export interface QuoteParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  fee?: number;
  slippage?: number;
}

export interface QuoteResult {
  dexId: string;
  dexName: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  rate: number;
  fee?: number;
  gasEstimate: number;
  timestamp: string;
  success: boolean;
  error?: string;
}

export interface SwapParams extends QuoteParams {
  to: string;
  deadline: number;
  minAmountOut: string;
}

export class DexManager {
  private utils: UniversalContractUtils;
  private network: string;

  constructor(rpcUrl: string, network?: string) {
    this.utils = new UniversalContractUtils(rpcUrl);
    this.network = network || 'hyperevm-mainnet';
  }

  /**
   * 指定DEXでのクォート取得
   */
  public async getQuote(dexId: string, params: QuoteParams): Promise<QuoteResult> {
    try {
      const dexConfig = await configLoader.getDexById(dexId, this.network);
      const tokenInConfig = await configLoader.getTokenById(params.tokenIn, this.network);
      const tokenOutConfig = await configLoader.getTokenById(params.tokenOut, this.network);

      // プロトコル別のクォート処理
      switch (dexConfig.type) {
        case 'v2':
          return await this.getV2Quote(dexConfig, tokenInConfig, tokenOutConfig, params);
        case 'v3':
          return await this.getV3Quote(dexConfig, tokenInConfig, tokenOutConfig, params);
        default:
          throw new Error(`サポートされていないDEXタイプ: ${dexConfig.type}`);
      }
    } catch (error: any) {
      return {
        dexId,
        dexName: dexId,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        amountOut: '0',
        rate: 0,
        gasEstimate: 0,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      };
    }
  }

  /**
   * V2 DEXのクォート取得
   */
  private async getV2Quote(
    dexConfig: DexConfig,
    tokenIn: TokenConfig,
    tokenOut: TokenConfig,
    params: QuoteParams
  ): Promise<QuoteResult> {
    if (!dexConfig.router) {
      throw new Error('V2 DEXにrouterアドレスが設定されていません');
    }

    const result = await this.utils.callReadFunction({
      abiPath: dexConfig.abi,
      contractAddress: dexConfig.router,
      functionName: 'getAmountsOut',
      args: [params.amountIn, [tokenIn.address, tokenOut.address]]
    });

    if (!result.success) {
      throw new Error(result.error || 'クォート取得に失敗しました');
    }

    const amounts = result.result as string[];
    const amountOut = amounts[1];

    if (!amountOut) {
      throw new Error('有効な出力量を取得できませんでした');
    }

    // レート計算（適切なdecimalsで）
    const amountInFormatted = parseFloat(ethers.utils.formatUnits(params.amountIn, tokenIn.decimals));
    const amountOutFormatted = parseFloat(ethers.utils.formatUnits(amountOut, tokenOut.decimals));
    const rate = amountOutFormatted / amountInFormatted;

    return {
      dexId: dexConfig.name,
      dexName: dexConfig.name,
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
      amountOut,
      rate,
      gasEstimate: 150000, // V2の典型的なガス使用量
      timestamp: new Date().toISOString(),
      success: true
    };
  }

  /**
   * V3 DEXのクォート取得
   */
  private async getV3Quote(
    dexConfig: DexConfig,
    tokenIn: TokenConfig,
    tokenOut: TokenConfig,
    params: QuoteParams
  ): Promise<QuoteResult> {
    if (!dexConfig.quoter) {
      throw new Error('V3 DEXにquoterアドレスが設定されていません');
    }

    const fee = params.fee || 3000; // デフォルト0.3%
    const results: QuoteResult[] = [];

    // 複数のフィーティアを試行
    const feeTiers = dexConfig.feeTiers || [fee];
    
    for (const feeAmount of feeTiers) {
      try {
        const result = await this.utils.callReadFunction({
          abiPath: dexConfig.abi,
          contractAddress: dexConfig.quoter,
          functionName: 'quoteExactInputSingle',
          args: [
            {
              tokenIn: tokenIn.address,
              tokenOut: tokenOut.address,
              amountIn: params.amountIn,
              fee: feeAmount,
              sqrtPriceLimitX96: 0 // 制限なし
            }
          ]
        });

        if (result.success && result.result) {
          // QuoterV2は [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] を返す
          const quoterResult = result.result as any[];
          const amountOut = quoterResult[0] as string;
          const gasEstimate = quoterResult[3] ? parseInt(quoterResult[3].toString()) : 250000;
          
          // レート計算
          const amountInFormatted = parseFloat(ethers.utils.formatUnits(params.amountIn, tokenIn.decimals));
          const amountOutFormatted = parseFloat(ethers.utils.formatUnits(amountOut, tokenOut.decimals));
          const rate = amountOutFormatted / amountInFormatted;

          results.push({
            dexId: `${dexConfig.name}_${feeAmount}bps`,
            dexName: `${dexConfig.name} (${feeAmount/100}bps)`,
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: params.amountIn,
            amountOut,
            rate,
            fee: feeAmount,
            gasEstimate: gasEstimate, // QuoterV2から取得した実際のガス見積もり
            timestamp: new Date().toISOString(),
            success: true
          });
        }
      } catch (error) {
        // このフィーティアは流動性なし、次を試行
        continue;
      }
    }

    if (results.length === 0) {
      throw new Error('すべてのフィーティアで流動性が見つかりません');
    }

    // 最良レートを返す
    return results.sort((a, b) => b.rate - a.rate)[0];
  }

  /**
   * 全アクティブDEXでのクォート取得
   */
  public async getAllQuotes(params: QuoteParams): Promise<QuoteResult[]> {
    const activeDexes = await configLoader.getActiveDexes(this.network);
    const promises = Object.keys(activeDexes).map(dexId => this.getQuote(dexId, params));
    
    return Promise.all(promises);
  }

  /**
   * プロトコル別クォート取得
   */
  public async getQuotesByProtocol(protocol: string, params: QuoteParams): Promise<QuoteResult[]> {
    const dexes = await configLoader.getDexesByProtocol(protocol, this.network);
    const promises = Object.keys(dexes).map(dexId => this.getQuote(dexId, params));
    
    return Promise.all(promises);
  }

  /**
   * 最良レート検索
   */
  public async getBestQuote(params: QuoteParams): Promise<QuoteResult | null> {
    const quotes = await this.getAllQuotes(params);
    const successfulQuotes = quotes.filter(q => q.success);
    
    if (successfulQuotes.length === 0) {
      return null;
    }

    const sorted = successfulQuotes.sort((a, b) => b.rate - a.rate);
    return sorted.length > 0 ? sorted[0] : null;
  }

  /**
   * アービトラージ機会検索
   */
  public async findArbitrageOpportunities(
    tokenA: string, 
    tokenB: string, 
    amount: string,
    minSpread: number = 0.01 // 1%以上の価格差
  ): Promise<{
    buyDex: QuoteResult;
    sellDex: QuoteResult;
    spread: number;
    profit: number;
  }[]> {
    const buyParams: QuoteParams = { tokenIn: tokenA, tokenOut: tokenB, amountIn: amount };
    const quotes = await this.getAllQuotes(buyParams);
    const successfulQuotes = quotes.filter(q => q.success);
    
    if (successfulQuotes.length < 2) {
      return [];
    }

    const opportunities: any[] = [];
    
    // 全ペアの組み合わせをチェック
    for (let i = 0; i < successfulQuotes.length; i++) {
      for (let j = i + 1; j < successfulQuotes.length; j++) {
        const quote1 = successfulQuotes[i];
        const quote2 = successfulQuotes[j];
        
        if (!quote1 || !quote2) continue;
        
        const spread = Math.abs(quote1.rate - quote2.rate) / Math.min(quote1.rate, quote2.rate);
        
        if (spread >= minSpread) {
          const buyDex = quote1.rate > quote2.rate ? quote2 : quote1;
          const sellDex = quote1.rate > quote2.rate ? quote1 : quote2;
          
          if (buyDex && sellDex) {
            opportunities.push({
              buyDex,
              sellDex,
              spread,
              profit: (sellDex.rate - buyDex.rate) * parseFloat(ethers.utils.formatUnits(amount, 18))
            });
          }
        }
      }
    }

    return opportunities.sort((a, b) => b.profit - a.profit);
  }

  /**
   * ネットワーク切り替え
   */
  public switchNetwork(network: string): void {
    this.network = network;
  }

  /**
   * 設定情報取得
   */
  public async getConfigInfo(): Promise<{
    network: string;
    dexCount: number;
    tokenCount: number;
    protocols: string[];
  }> {
    const dexes = await configLoader.getDexConfig(this.network);
    const tokens = await configLoader.getTokenConfig(this.network);
    const protocols = await configLoader.getSupportedProtocols();
    
    return {
      network: this.network,
      dexCount: Object.keys(dexes).length,
      tokenCount: Object.keys(tokens).length,
      protocols
    };
  }
}