import { ethers } from 'ethers';

/**
 * ガス価格戦略の種類
 */
export type GasStrategy = 'safe' | 'standard' | 'fast' | 'instant';

/**
 * ガス価格情報
 */
export interface GasPriceInfo {
  // Legacy (Type 0) transaction
  gasPrice: string;
  
  // EIP-1559 (Type 2) transaction
  baseFee: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  
  // 追加情報
  blockNumber: number;
  timestamp: string;
  strategy: GasStrategy;
}

/**
 * ネットワークガス価格分析結果
 */
export interface NetworkGasAnalysis {
  currentBaseFee: string;
  suggestedGasPrices: {
    safe: GasPriceInfo;
    standard: GasPriceInfo;
    fast: GasPriceInfo;
    instant: GasPriceInfo;
  };
  recentBlocks: {
    blockNumber: number;
    baseFeePerGas: string;
    gasUsedRatio: number;
    priorityFeePerGas: string[];
  }[];
  networkCongestion: 'low' | 'medium' | 'high' | 'very_high';
  recommendations: {
    strategy: GasStrategy;
    reason: string;
    estimatedConfirmationTime: string;
  };
}

/**
 * 動的ガス価格計算ユーティリティ
 */
export class GasPriceCalculator {
  private provider: ethers.providers.Provider;
  private cacheTimeout = 30000; // 30秒キャッシュ
  private cache: { data: NetworkGasAnalysis; timestamp: number } | null = null;

  constructor(provider: ethers.providers.Provider) {
    this.provider = provider;
  }

  /**
   * 現在のネットワークガス価格を分析
   */
  async analyzeNetworkGasPrices(): Promise<NetworkGasAnalysis> {
    // キャッシュチェック
    if (this.cache && Date.now() - this.cache.timestamp < this.cacheTimeout) {
      return this.cache.data;
    }

    try {
      // 最新ブロック情報を取得
      const latestBlock = await this.provider.getBlock('latest');
      const blockNumber = latestBlock.number;
      
      // 過去数ブロックのガス価格データを分析
      const recentBlocks = await this.analyzeRecentBlocks(blockNumber, 10);
      
      // 現在のベースフィー
      const currentBaseFee = latestBlock.baseFeePerGas?.toString() || '0';
      
      // 優先手数料の統計を計算
      const priorityFeeStats = this.calculatePriorityFeeStats(recentBlocks);
      
      // ネットワーク混雑度を判定
      const congestion = this.assessNetworkCongestion(recentBlocks);
      
      // 戦略別ガス価格を計算
      const suggestedGasPrices = this.calculateStrategyPrices(
        currentBaseFee,
        priorityFeeStats,
        congestion
      );

      // 推奨戦略を決定
      const recommendations = this.generateRecommendations(congestion, suggestedGasPrices);

      const analysis: NetworkGasAnalysis = {
        currentBaseFee,
        suggestedGasPrices,
        recentBlocks,
        networkCongestion: congestion,
        recommendations
      };

      // キャッシュに保存
      this.cache = {
        data: analysis,
        timestamp: Date.now()
      };

      return analysis;
    } catch (error: any) {
      throw new Error(`Failed to analyze network gas prices: ${error.message}`);
    }
  }

  /**
   * 指定された戦略でガス価格を取得
   */
  async getGasPriceForStrategy(strategy: GasStrategy): Promise<GasPriceInfo> {
    const analysis = await this.analyzeNetworkGasPrices();
    return analysis.suggestedGasPrices[strategy];
  }

  /**
   * トランザクション用の最適なガス設定を取得
   */
  async getOptimalGasSettings(strategy: GasStrategy = 'standard'): Promise<{
    legacy: { gasPrice: string; gasLimit?: string };
    eip1559: { maxFeePerGas: string; maxPriorityFeePerGas: string; gasLimit?: string };
    recommended: 'legacy' | 'eip1559';
  }> {
    const gasPriceInfo = await this.getGasPriceForStrategy(strategy);
    
    return {
      legacy: {
        gasPrice: gasPriceInfo.gasPrice
      },
      eip1559: {
        maxFeePerGas: gasPriceInfo.maxFeePerGas,
        maxPriorityFeePerGas: gasPriceInfo.maxPriorityFeePerGas
      },
      recommended: 'eip1559' // Hyperevmでは基本的にEIP-1559を推奨
    };
  }

  /**
   * 過去ブロックのガス価格データを分析
   */
  private async analyzeRecentBlocks(latestBlockNumber: number, count: number) {
    const blocks = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const blockNumber = latestBlockNumber - i;
        const block = await this.provider.getBlock(blockNumber);
        
        if (!block) continue;

        // ブロック内のトランザクションの優先手数料を分析
        const priorityFees = await this.getBlockPriorityFees(block);
        
        blocks.push({
          blockNumber: block.number,
          baseFeePerGas: block.baseFeePerGas?.toString() || '0',
          gasUsedRatio: block.gasUsed.toNumber() / block.gasLimit.toNumber(),
          priorityFeePerGas: priorityFees
        });
      } catch (error) {
        console.warn(`Failed to analyze block ${latestBlockNumber - i}:`, error);
      }
    }
    
    return blocks;
  }

  /**
   * ブロック内のトランザクションの優先手数料を取得
   */
  private async getBlockPriorityFees(block: ethers.providers.Block): Promise<string[]> {
    const fees: string[] = [];
    
    try {
      // トランザクション数が多い場合はサンプリング
      const txHashes = block.transactions.slice(0, 20);
      
      for (const txHash of txHashes) {
        try {
          const tx = await this.provider.getTransaction(txHash);
          if (tx && tx.maxPriorityFeePerGas) {
            fees.push(tx.maxPriorityFeePerGas.toString());
          }
        } catch (error) {
          // 個別トランザクションのエラーは無視
        }
      }
    } catch (error) {
      console.warn('Failed to get priority fees:', error);
    }
    
    return fees;
  }

  /**
   * 優先手数料の統計を計算
   */
  private calculatePriorityFeeStats(blocks: any[]) {
    const allFees: number[] = [];
    
    blocks.forEach(block => {
      block.priorityFeePerGas.forEach((fee: string) => {
        allFees.push(parseInt(fee));
      });
    });
    
    if (allFees.length === 0) {
      return {
        min: 1000000000, // 1 gwei
        max: 5000000000, // 5 gwei
        median: 2000000000, // 2 gwei
        p25: 1500000000,
        p75: 3000000000,
        average: 2000000000
      };
    }
    
    allFees.sort((a, b) => a - b);
    
    return {
      min: allFees[0],
      max: allFees[allFees.length - 1],
      median: allFees[Math.floor(allFees.length / 2)],
      p25: allFees[Math.floor(allFees.length * 0.25)],
      p75: allFees[Math.floor(allFees.length * 0.75)],
      average: allFees.reduce((sum, fee) => sum + fee, 0) / allFees.length
    };
  }

  /**
   * ネットワーク混雑度を判定
   */
  private assessNetworkCongestion(blocks: any[]): 'low' | 'medium' | 'high' | 'very_high' {
    if (blocks.length === 0) return 'medium';
    
    const avgGasUsedRatio = blocks.reduce((sum, block) => sum + block.gasUsedRatio, 0) / blocks.length;
    
    if (avgGasUsedRatio < 0.3) return 'low';
    if (avgGasUsedRatio < 0.6) return 'medium';
    if (avgGasUsedRatio < 0.9) return 'high';
    return 'very_high';
  }

  /**
   * 戦略別ガス価格を計算
   */
  private calculateStrategyPrices(
    baseFee: string,
    priorityStats: any,
    congestion: string
  ) {
    const baseFeeNum = parseInt(baseFee) || 1000000000; // 1 gwei fallback
    const timestamp = new Date().toISOString();
    
    // 混雑度による倍率調整
    const congestionMultiplier = {
      low: 1.0,
      medium: 1.2,
      high: 1.5,
      very_high: 2.0
    }[congestion] || 1.2;

    const strategies: Record<GasStrategy, GasPriceInfo> = {
      safe: {
        gasPrice: (baseFeeNum * 1.2 + priorityStats.p25).toString(),
        baseFee,
        maxFeePerGas: (baseFeeNum * 1.5 + priorityStats.p25).toString(),
        maxPriorityFeePerGas: priorityStats.p25.toString(),
        blockNumber: 0,
        timestamp,
        strategy: 'safe'
      },
      standard: {
        gasPrice: (baseFeeNum * 1.3 + priorityStats.median).toString(),
        baseFee,
        maxFeePerGas: (baseFeeNum * 2 + priorityStats.median * congestionMultiplier).toString(),
        maxPriorityFeePerGas: (priorityStats.median * congestionMultiplier).toString(),
        blockNumber: 0,
        timestamp,
        strategy: 'standard'
      },
      fast: {
        gasPrice: (baseFeeNum * 1.5 + priorityStats.p75).toString(),
        baseFee,
        maxFeePerGas: (baseFeeNum * 2.5 + priorityStats.p75 * congestionMultiplier).toString(),
        maxPriorityFeePerGas: (priorityStats.p75 * congestionMultiplier).toString(),
        blockNumber: 0,
        timestamp,
        strategy: 'fast'
      },
      instant: {
        gasPrice: (baseFeeNum * 2 + priorityStats.max).toString(),
        baseFee,
        maxFeePerGas: (baseFeeNum * 3 + priorityStats.max * congestionMultiplier).toString(),
        maxPriorityFeePerGas: (priorityStats.max * congestionMultiplier).toString(),
        blockNumber: 0,
        timestamp,
        strategy: 'instant'
      }
    };

    return strategies;
  }

  /**
   * 推奨戦略を生成
   */
  private generateRecommendations(
    congestion: string,
    _gasPrices: Record<GasStrategy, GasPriceInfo>
  ) {
    const recommendations = {
      low: {
        strategy: 'safe' as GasStrategy,
        reason: 'ネットワークが空いているため、低いガス価格で十分です',
        estimatedConfirmationTime: '1-2分'
      },
      medium: {
        strategy: 'standard' as GasStrategy,
        reason: '標準的なガス価格で安定した確認時間が期待できます',
        estimatedConfirmationTime: '30秒-1分'
      },
      high: {
        strategy: 'fast' as GasStrategy,
        reason: 'ネットワークが混雑しているため、高めのガス価格を推奨します',
        estimatedConfirmationTime: '15-30秒'
      },
      very_high: {
        strategy: 'instant' as GasStrategy,
        reason: 'ネットワークが非常に混雑しているため、最高優先度が必要です',
        estimatedConfirmationTime: '5-15秒'
      }
    };

    return recommendations[congestion as keyof typeof recommendations] || recommendations.medium;
  }

  /**
   * ガス価格を人間に読みやすい形式でフォーマット
   */
  formatGasPrice(wei: string): string {
    const gwei = parseInt(wei) / 1000000000;
    return `${gwei.toFixed(2)} Gwei`;
  }

  /**
   * 推定トランザクション手数料を計算
   */
  estimateTransactionCost(gasLimit: number, gasPriceWei: string): {
    costWei: string;
    costEth: string;
    costGwei: string;
  } {
    const costWei = (gasLimit * parseInt(gasPriceWei)).toString();
    const costEth = ethers.utils.formatEther(costWei);
    const costGwei = (parseInt(costWei) / 1000000000).toString();

    return {
      costWei,
      costEth,
      costGwei
    };
  }
}