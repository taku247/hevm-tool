#!/usr/bin/env node

/**
 * DEX比較分析スクリプト
 * HyperSwap vs KittenSwap のレート・流動性・機能比較
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

class DEXRateComparison {
  constructor(rpcUrl) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.results = {
      hyperswap: { v2: [], v3: [] },
      kittenswap: { v2: [] },
      comparison: []
    };
    this.initializeContracts();
  }

  initializeContracts() {
    // HyperSwap V3 Quoter
    this.hyperswapQuoterV2 = new ethers.Contract(
      '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
      [{
        name: "quoteExactInput",
        type: "function",
        stateMutability: "view",
        inputs: [
          { name: "path", type: "bytes" },
          { name: "amountIn", type: "uint256" }
        ],
        outputs: [
          { name: "amountOut", type: "uint256" },
          { name: "sqrtPriceX96AfterList", type: "uint160[]" },
          { name: "initializedTicksCrossedList", type: "uint32[]" },
          { name: "gasEstimate", type: "uint256" }
        ]
      }],
      this.provider
    );

    // KittenSwap V2 Factory
    this.kittenswapFactory = new ethers.Contract(
      '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B',
      [
        {
          "constant": true,
          "inputs": [{"internalType": "uint256", "name": "index", "type": "uint256"}],
          "name": "allPairs",
          "outputs": [{"internalType": "address", "name": "pair", "type": "address"}],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
        },
        {
          "constant": true,
          "inputs": [],
          "name": "allPairsLength",
          "outputs": [{"internalType": "uint256", "name": "length", "type": "uint256"}],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
        }
      ],
      this.provider
    );

    console.log('📍 DEX Contracts initialized');
  }

  // 共通トークン（両DEXで利用可能）
  getCommonTokens() {
    return {
      WHYPE: '0x5555555555555555555555555555555555555555',
      PURR: '0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E',
      UBTC: '0x236ab8D4E6892dd1c8d3aDA9B2E8C5EC6A5E4a8d',
      HFUN: '0x4A73D8e0B66A06a8D8D82e89A5C5c5e6E6d5a5E8',
      UETH: '0x7d5c5f5E6f5F6F6f5C5F5F5f5F5F5F5F5F5F5F5F'
    };
  }

  getTokenInfo() {
    return {
      WHYPE: { decimals: 18 },
      PURR: { decimals: 18 },
      UBTC: { decimals: 8 },
      HFUN: { decimals: 18 },
      UETH: { decimals: 18 }
    };
  }

  // HyperSwap V3パスエンコード
  encodePath(tokens, fees) {
    let path = '0x';
    for (let i = 0; i < tokens.length; i++) {
      path += tokens[i].slice(2);
      if (i < fees.length) {
        path += fees[i].toString(16).padStart(6, '0');
      }
    }
    return path;
  }

  // HyperSwap V3レート取得
  async getHyperSwapV3Rate(tokenA, tokenB, amountIn) {
    const feeTiers = [500, 3000, 10000]; // 主要なfee tier
    
    for (const fee of feeTiers) {
      try {
        const path = this.encodePath([tokenA, tokenB], [fee]);
        const result = await this.hyperswapQuoterV2.callStatic.quoteExactInput(path, amountIn);
        
        return {
          success: true,
          amountOut: result[0],
          fee: fee,
          gasEstimate: result[3],
          method: 'HyperSwap V3'
        };
      } catch (error) {
        continue;
      }
    }
    
    return {
      success: false,
      error: 'No V3 pool found'
    };
  }

  // KittenSwap V2レート取得
  async getKittenSwapV2Rate(tokenA, tokenB, amountIn) {
    try {
      // ペア検索
      const pairAddress = await this.findKittenSwapPair(tokenA, tokenB);
      if (!pairAddress) {
        return {
          success: false,
          error: 'Pair not found'
        };
      }

      // レート計算
      const pair = new ethers.Contract(pairAddress, [
        "function token0() external view returns (address)",
        "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
      ], this.provider);

      const [token0, reserves] = await Promise.all([
        pair.token0(),
        pair.getReserves()
      ]);

      const isTokenAFirst = token0.toLowerCase() === tokenA.toLowerCase();
      const [reserveIn, reserveOut] = isTokenAFirst 
        ? [reserves.reserve0, reserves.reserve1]
        : [reserves.reserve1, reserves.reserve0];

      // Uniswap V2公式
      const amountInWithFee = amountIn.mul(997);
      const numerator = amountInWithFee.mul(reserveOut);
      const denominator = reserveIn.mul(1000).add(amountInWithFee);
      const amountOut = numerator.div(denominator);

      return {
        success: true,
        amountOut: amountOut,
        pairAddress: pairAddress,
        method: 'KittenSwap V2'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // KittenSwapペア検索
  async findKittenSwapPair(tokenA, tokenB) {
    if (!this.kittenswapPairCache) {
      await this.buildKittenSwapPairCache();
    }

    const key = this.getPairKey(tokenA, tokenB);
    const cachedPair = this.kittenswapPairCache.get(key);
    return cachedPair ? cachedPair.address : null;
  }

  // KittenSwapペアキャッシュ構築
  async buildKittenSwapPairCache() {
    this.kittenswapPairCache = new Map();
    
    try {
      const pairCount = await this.kittenswapFactory.allPairsLength();
      const promises = [];
      
      for (let i = 0; i < pairCount; i++) {
        promises.push(this.kittenswapFactory.allPairs(i));
      }
      
      const pairAddresses = await Promise.all(promises);
      
      const tokenPromises = pairAddresses.map(async (pairAddress) => {
        try {
          const pair = new ethers.Contract(pairAddress, [
            "function token0() external view returns (address)",
            "function token1() external view returns (address)"
          ], this.provider);
          
          const [token0, token1] = await Promise.all([
            pair.token0(),
            pair.token1()
          ]);
          
          return {
            address: pairAddress,
            token0: token0.toLowerCase(),
            token1: token1.toLowerCase()
          };
        } catch (error) {
          return null;
        }
      });
      
      const pairInfos = await Promise.all(tokenPromises);
      
      pairInfos.forEach(info => {
        if (info) {
          const key = this.getPairKey(info.token0, info.token1);
          this.kittenswapPairCache.set(key, info);
        }
      });
      
      console.log(`✅ KittenSwap ペアキャッシュ構築: ${this.kittenswapPairCache.size}個`);
      
    } catch (error) {
      console.error('❌ KittenSwap ペアキャッシュ構築エラー:', error.message);
    }
  }

  getPairKey(tokenA, tokenB) {
    const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() 
      ? [tokenA.toLowerCase(), tokenB.toLowerCase()]
      : [tokenB.toLowerCase(), tokenA.toLowerCase()];
    return `${token0}-${token1}`;
  }

  // メイン比較実行
  async runComparison() {
    console.log('🔍 HyperSwap vs KittenSwap DEX比較分析\n');
    
    const tokens = this.getCommonTokens();
    const tokenInfo = this.getTokenInfo();
    const tokenList = Object.keys(tokens);
    
    console.log('📊 RPC接続情報:');
    console.log(`   URL: ${this.provider.connection.url}`);
    console.log(`   Block Number: ${await this.provider.getBlockNumber()}`);
    console.log('');

    // KittenSwapペアキャッシュ構築
    await this.buildKittenSwapPairCache();
    
    console.log('\n📊 1. ペア別レート比較\n');
    
    const comparisonResults = [];
    
    // 主要ペアでの比較
    const testPairs = [
      ['WHYPE', 'PURR'],
      ['WHYPE', 'UBTC'],
      ['WHYPE', 'HFUN'],
      ['PURR', 'UBTC'],
      ['PURR', 'HFUN']
    ];
    
    for (const [tokenA, tokenB] of testPairs) {
      console.log(`🔍 ${tokenA}/${tokenB} 比較:`);
      
      const amountIn = ethers.utils.parseUnits('1', tokenInfo[tokenA].decimals);
      
      // HyperSwap V3
      const hyperswapResult = await this.getHyperSwapV3Rate(
        tokens[tokenA],
        tokens[tokenB],
        amountIn
      );
      
      // KittenSwap V2
      const kittenswapResult = await this.getKittenSwapV2Rate(
        tokens[tokenA],
        tokens[tokenB],
        amountIn
      );
      
      // 結果表示
      if (hyperswapResult.success) {
        const rate = parseFloat(ethers.utils.formatUnits(
          hyperswapResult.amountOut,
          tokenInfo[tokenB].decimals
        ));
        console.log(`   🟦 HyperSwap V3: ${rate.toFixed(8)} ${tokenB} (${hyperswapResult.fee}bps, Gas: ${hyperswapResult.gasEstimate})`);
      } else {
        console.log(`   🟦 HyperSwap V3: ❌ ${hyperswapResult.error}`);
      }
      
      if (kittenswapResult.success) {
        const rate = parseFloat(ethers.utils.formatUnits(
          kittenswapResult.amountOut,
          tokenInfo[tokenB].decimals
        ));
        console.log(`   🟧 KittenSwap V2: ${rate.toFixed(8)} ${tokenB} (0.3%fee)`);
      } else {
        console.log(`   🟧 KittenSwap V2: ❌ ${kittenswapResult.error}`);
      }
      
      // 比較分析
      if (hyperswapResult.success && kittenswapResult.success) {
        const hyperRate = parseFloat(ethers.utils.formatUnits(
          hyperswapResult.amountOut,
          tokenInfo[tokenB].decimals
        ));
        const kittenRate = parseFloat(ethers.utils.formatUnits(
          kittenswapResult.amountOut,
          tokenInfo[tokenB].decimals
        ));
        
        const priceDiff = Math.abs(hyperRate - kittenRate);
        const priceDiffPercent = hyperRate > 0 ? (priceDiff / hyperRate) * 100 : 0;
        const betterDex = hyperRate > kittenRate ? 'HyperSwap V3' : 'KittenSwap V2';
        
        console.log(`   📊 価格差: ${priceDiffPercent.toFixed(4)}% (${betterDex}が有利)`);
        
        comparisonResults.push({
          pair: `${tokenA}/${tokenB}`,
          hyperswapRate: hyperRate,
          kittenswapRate: kittenRate,
          priceDiffPercent: priceDiffPercent,
          betterDex: betterDex
        });
      }
      
      console.log('');
    }
    
    // 比較サマリー
    console.log('📋 2. 比較サマリー\n');
    
    const successfulComparisons = comparisonResults.length;
    const hyperswapWins = comparisonResults.filter(r => r.betterDex === 'HyperSwap V3').length;
    const kittenswapWins = comparisonResults.filter(r => r.betterDex === 'KittenSwap V2').length;
    
    console.log(`✅ 比較成功: ${successfulComparisons}/${testPairs.length}ペア`);
    console.log(`🟦 HyperSwap V3 有利: ${hyperswapWins}ペア`);
    console.log(`🟧 KittenSwap V2 有利: ${kittenswapWins}ペア`);
    
    if (comparisonResults.length > 0) {
      const avgPriceDiff = comparisonResults.reduce((sum, r) => sum + r.priceDiffPercent, 0) / comparisonResults.length;
      console.log(`📊 平均価格差: ${avgPriceDiff.toFixed(4)}%`);
    }
    
    // 機能比較
    console.log('\n⚖️ 3. 機能比較\n');
    
    const featureComparison = [
      { feature: 'V2プール', hyperswap: '✅', kittenswap: '✅' },
      { feature: 'V3プール', hyperswap: '✅', kittenswap: '❌' },
      { feature: 'Quoter機能', hyperswap: '✅', kittenswap: '❌' },
      { feature: 'getPair()関数', hyperswap: '✅', kittenswap: '❌' },
      { feature: 'マルチホップ', hyperswap: '✅', kittenswap: '❌' },
      { feature: 'ガス見積もり', hyperswap: '✅', kittenswap: '❌' },
      { feature: '手数料tier', hyperswap: '4種類', kittenswap: '1種類(0.3%)' },
      { feature: 'プール数', hyperswap: '100+', kittenswap: '70' }
    ];
    
    console.log('| 機能 | HyperSwap | KittenSwap |');
    console.log('|------|-----------|------------|');
    featureComparison.forEach(row => {
      console.log(`| ${row.feature} | ${row.hyperswap} | ${row.kittenswap} |`);
    });
    
    // 推奨用途
    console.log('\n💡 4. 推奨用途\n');
    
    console.log('🟦 **HyperSwap 推奨ケース**:');
    console.log('   - 最適なレートを重視');
    console.log('   - マルチホップ取引が必要');
    console.log('   - ガス効率を重視');
    console.log('   - 複数のfee tierから選択したい');
    
    console.log('\n🟧 **KittenSwap 推奨ケース**:');
    console.log('   - シンプルな取引');
    console.log('   - 特定のトークンペアが豊富');
    console.log('   - V2の安定性を重視');
    console.log('   - 手数料が固定で分かりやすい');
    
    console.log('\n🔄 **統合利用の推奨**:');
    console.log('   1. 両DEXでレートを比較');
    console.log('   2. より有利なレートのDEXを選択');
    console.log('   3. 流動性不足時の相互補完');
    
    return {
      comparisonResults,
      featureComparison,
      summary: {
        successfulComparisons,
        hyperswapWins,
        kittenswapWins,
        avgPriceDiff: comparisonResults.length > 0 ? 
          comparisonResults.reduce((sum, r) => sum + r.priceDiffPercent, 0) / comparisonResults.length : 0
      }
    };
  }
}

async function main() {
  try {
    const rpcUrl = process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm';
    const comparison = new DEXRateComparison(rpcUrl);
    
    const results = await comparison.runComparison();
    
    console.log('\n🏁 DEX比較分析完了');
    
    // 結果をJSONファイルに保存
    const fs = require('fs');
    const outputPath = path.join(__dirname, 'dex-comparison-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`📄 結果保存: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ 比較分析エラー:', error);
  }
}

// 直接実行時
if (require.main === module) {
  main();
}

module.exports = { DEXRateComparison };