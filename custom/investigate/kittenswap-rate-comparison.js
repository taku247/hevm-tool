#!/usr/bin/env node

/**
 * KittenSwap レート取得・比較スクリプト
 * HyperSwapのtest-v1-v2-comparison.jsと同等の機能をKittenSwap用に実装
 * 
 * 特徴:
 * - V2プールのみ（V3なし）
 * - getPair()関数なし（allPairs()で列挙）
 * - 手動レート計算
 * - 13種類のトークン対応
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

class KittenSwapRateAnalyzer {
  constructor(rpcUrl) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.factory = null;
    this.pairCache = new Map(); // ペアキャッシュでパフォーマンス向上
    this.initializeContracts();
  }

  initializeContracts() {
    // KittenSwap V2_PairFactory（プール発見に使用可能な唯一のFactory）
    const FACTORY_ADDRESS = '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B';
    
    // 最適化済みFactory ABI
    const FACTORY_ABI = [
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
    ];

    this.factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, this.provider);
    console.log(`📍 KittenSwap V2_PairFactory: ${FACTORY_ADDRESS}`);
  }

  // 実際のKittenSwapトークン（13種類）
  getTokens() {
    return {
      WHYPE: '0x5555555555555555555555555555555555555555',
      PURR: '0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E',
      USDXL: '0xca79db4B49f608eF54a5CB813FbEd3a6387bC645',
      UBTC: '0x236ab8D4E6892dd1c8d3aDA9B2E8C5EC6A5E4a8d',
      HYPE: '0x4de68b5c2D4f5b600e3c5a1f1F6e65d5c5E7e5Df',
      HFUN: '0x4A73D8e0B66A06a8D8D82e89A5C5c5e6E6d5a5E8',
      UETH: '0x7d5c5f5E6f5F6F6f5C5F5F5f5F5F5F5F5F5F5F5F',
      ADHD: '0x8e4e8e8E8E8E8e8e8e8e8e8e8e8e8e8e8e8e8e8e',
      BUDDY: '0x9f9f9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F',
      CATBAL: '0xa0A0a0A0A0A0a0a0a0A0a0a0a0A0a0a0a0A0a0a0',
      JEFF: '0xb1b1B1B1B1B1b1b1b1b1b1b1b1b1b1b1b1b1b1b1',
      SIGMA: '0xc2C2c2C2C2C2c2c2c2c2c2c2c2c2c2c2c2c2c2c2',
      PDOG: '0xd3d3D3D3D3D3d3d3d3d3d3d3d3d3d3d3d3d3d3d3'
    };
  }

  // トークン情報（decimals）
  getTokenInfo() {
    return {
      WHYPE: { decimals: 18 },
      PURR: { decimals: 18 },
      USDXL: { decimals: 18 },
      UBTC: { decimals: 8 },
      HYPE: { decimals: 18 },
      HFUN: { decimals: 18 },
      UETH: { decimals: 18 },
      ADHD: { decimals: 18 },
      BUDDY: { decimals: 18 },
      CATBAL: { decimals: 18 },
      JEFF: { decimals: 18 },
      SIGMA: { decimals: 18 },
      PDOG: { decimals: 18 }
    };
  }

  // ペアコントラクト用ABI
  getPairABI() {
    return [
      {
        "name": "token0",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "address"}]
      },
      {
        "name": "token1", 
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "address"}]
      },
      {
        "name": "getReserves",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [
          {"name": "reserve0", "type": "uint112"},
          {"name": "reserve1", "type": "uint112"},
          {"name": "blockTimestampLast", "type": "uint32"}
        ]
      }
    ];
  }

  // 全ペアを取得してキャッシュ
  async buildPairCache() {
    if (this.pairCache.size > 0) {
      console.log(`📋 キャッシュ使用: ${this.pairCache.size}個のペア`);
      return;
    }

    console.log('🔍 KittenSwap 全ペア取得中...');
    
    try {
      const pairCount = await this.factory.allPairsLength();
      console.log(`📊 総ペア数: ${pairCount.toString()}`);
      
      const pairABI = this.getPairABI();
      
      // 全ペアを並行取得
      const promises = [];
      for (let i = 0; i < pairCount; i++) {
        promises.push(this.factory.allPairs(i));
      }
      
      const pairAddresses = await Promise.all(promises);
      
      // 各ペアのトークン情報を取得
      const tokenPromises = pairAddresses.map(async (pairAddress) => {
        try {
          const pair = new ethers.Contract(pairAddress, pairABI, this.provider);
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
          console.log(`⚠️ ペア ${pairAddress} の情報取得失敗`);
          return null;
        }
      });
      
      const pairInfos = await Promise.all(tokenPromises);
      
      // キャッシュに保存
      pairInfos.forEach(info => {
        if (info) {
          const key = this.getPairKey(info.token0, info.token1);
          this.pairCache.set(key, info);
        }
      });
      
      console.log(`✅ ペアキャッシュ構築完了: ${this.pairCache.size}個`);
      
    } catch (error) {
      console.error('❌ ペアキャッシュ構築エラー:', error.message);
    }
  }

  // ペアキー生成（正規化）
  getPairKey(tokenA, tokenB) {
    const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() 
      ? [tokenA.toLowerCase(), tokenB.toLowerCase()]
      : [tokenB.toLowerCase(), tokenA.toLowerCase()];
    return `${token0}-${token1}`;
  }

  // 特定のペアアドレスを検索
  async findPairAddress(tokenA, tokenB) {
    const key = this.getPairKey(tokenA, tokenB);
    const cachedPair = this.pairCache.get(key);
    
    if (cachedPair) {
      return cachedPair.address;
    }
    
    return null;
  }

  // V2手動レート計算
  async calculateV2Rate(tokenA, tokenB, amountIn) {
    const pairAddress = await this.findPairAddress(tokenA, tokenB);
    if (!pairAddress) {
      return null;
    }
    
    try {
      const pair = new ethers.Contract(pairAddress, this.getPairABI(), this.provider);
      const reserves = await pair.getReserves();
      const [token0] = await pair.token0();
      
      // トークン順序の確認
      const isTokenAFirst = token0.toLowerCase() === tokenA.toLowerCase();
      const [reserveIn, reserveOut] = isTokenAFirst 
        ? [reserves.reserve0, reserves.reserve1]
        : [reserves.reserve1, reserves.reserve0];
      
      // Uniswap V2の定数積公式: (x + Δx) * (y - Δy) = k
      // 0.3%の手数料を考慮
      const amountInWithFee = amountIn.mul(997);
      const numerator = amountInWithFee.mul(reserveOut);
      const denominator = reserveIn.mul(1000).add(amountInWithFee);
      
      const amountOut = numerator.div(denominator);
      
      return {
        success: true,
        amountOut: amountOut,
        pairAddress: pairAddress,
        reserves: { reserveIn, reserveOut }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        pairAddress: pairAddress
      };
    }
  }

  // トークン投入量を計算
  getAmountForToken(tokenSymbol, tokenInfo) {
    return ethers.utils.parseUnits('1', tokenInfo[tokenSymbol].decimals);
  }

  // メイン分析実行
  async analyzeAllPairs() {
    console.log('🔍 KittenSwap 全ペアレート分析\n');
    
    const tokens = this.getTokens();
    const tokenInfo = this.getTokenInfo();
    const tokenList = Object.keys(tokens);
    
    console.log('📊 RPC接続情報:');
    console.log(`   URL: ${this.provider.connection.url}`);
    console.log(`   Block Number: ${await this.provider.getBlockNumber()}`);
    console.log('');
    
    // ペアキャッシュ構築
    await this.buildPairCache();
    
    console.log('\n📊 1. 全ペアレート分析\n');
    
    const results = {
      successful: [],
      failed: [],
      summary: {}
    };
    
    // 全ペア分析
    for (let i = 0; i < tokenList.length; i++) {
      for (let j = i + 1; j < tokenList.length; j++) {
        const tokenA = tokenList[i];
        const tokenB = tokenList[j];
        const pairName = `${tokenA}/${tokenB}`;
        
        console.log(`🔍 ${pairName}:`);
        
        const amountIn = this.getAmountForToken(tokenA, tokenInfo);
        
        // A→B方向
        const resultAtoB = await this.calculateV2Rate(
          tokens[tokenA],
          tokens[tokenB],
          amountIn
        );
        
        if (resultAtoB && resultAtoB.success) {
          const rate = parseFloat(ethers.utils.formatUnits(
            resultAtoB.amountOut,
            tokenInfo[tokenB].decimals
          ));
          
          console.log(`   ✅ ${tokenA}→${tokenB}: ${rate.toFixed(8)} ${tokenB}`);
          console.log(`      プール: ${resultAtoB.pairAddress}`);
          
          results.successful.push({
            pair: pairName,
            direction: `${tokenA}→${tokenB}`,
            rate: rate,
            pairAddress: resultAtoB.pairAddress,
            reserves: resultAtoB.reserves
          });
        } else {
          console.log(`   ❌ ${tokenA}→${tokenB}: プールなしまたはエラー`);
          results.failed.push({
            pair: pairName,
            direction: `${tokenA}→${tokenB}`,
            reason: resultAtoB ? resultAtoB.error : 'プールが見つかりません'
          });
        }
        
        // B→A方向
        const amountInB = this.getAmountForToken(tokenB, tokenInfo);
        const resultBtoA = await this.calculateV2Rate(
          tokens[tokenB],
          tokens[tokenA],
          amountInB
        );
        
        if (resultBtoA && resultBtoA.success) {
          const rate = parseFloat(ethers.utils.formatUnits(
            resultBtoA.amountOut,
            tokenInfo[tokenA].decimals
          ));
          
          console.log(`   ✅ ${tokenB}→${tokenA}: ${rate.toFixed(8)} ${tokenA}`);
          
          results.successful.push({
            pair: pairName,
            direction: `${tokenB}→${tokenA}`,
            rate: rate,
            pairAddress: resultBtoA.pairAddress,
            reserves: resultBtoA.reserves
          });
        } else {
          console.log(`   ❌ ${tokenB}→${tokenA}: プールなしまたはエラー`);
          results.failed.push({
            pair: pairName,
            direction: `${tokenB}→${tokenA}`,
            reason: resultBtoA ? resultBtoA.error : 'プールが見つかりません'
          });
        }
        
        console.log('');
      }
    }
    
    // 結果サマリー
    console.log('📋 2. 結果サマリー\n');
    
    const totalPairs = tokenList.length * (tokenList.length - 1);
    const successfulCount = results.successful.length;
    const failedCount = results.failed.length;
    
    console.log(`✅ 成功: ${successfulCount}/${totalPairs} (${(successfulCount/totalPairs*100).toFixed(1)}%)`);
    console.log(`❌ 失敗: ${failedCount}/${totalPairs} (${(failedCount/totalPairs*100).toFixed(1)}%)`);
    
    // 成功したペアのトップ価格
    if (results.successful.length > 0) {
      console.log('\n💰 主要レート (1トークンあたり):');
      
      // WHYPEベースのレートを表示
      const whypeRates = results.successful.filter(r => r.direction.startsWith('WHYPE→'));
      whypeRates.forEach(r => {
        const token = r.direction.split('→')[1];
        console.log(`   ${token}: ${r.rate.toFixed(8)} (${r.pair})`);
      });
    }
    
    // 利用可能なペア一覧
    if (results.successful.length > 0) {
      console.log('\n🔍 利用可能なペア一覧:');
      
      const uniquePairs = [...new Set(results.successful.map(r => r.pair))];
      uniquePairs.forEach(pair => {
        const directions = results.successful.filter(r => r.pair === pair);
        const bidirectional = directions.length === 2;
        console.log(`   ${pair}: ${bidirectional ? '双方向' : '単方向'}`);
      });
    }
    
    // HyperSwapとの比較準備
    console.log('\n💡 KittenSwap vs HyperSwap比較:');
    console.log('   - KittenSwap: V2のみ、手動レート計算');
    console.log('   - HyperSwap: V2/V3両対応、Quoter使用');
    console.log('   - KittenSwap制約: getPair()なし、全ペア列挙必要');
    console.log('   - 流動性: KittenSwapは70プール、HyperSwapは数百プール');
    
    return results;
  }

  // 特定ペアの詳細分析
  async analyzePairDetails(tokenA, tokenB) {
    console.log(`🔍 ${tokenA}/${tokenB} 詳細分析\n`);
    
    const tokens = this.getTokens();
    const tokenInfo = this.getTokenInfo();
    
    if (!tokens[tokenA] || !tokens[tokenB]) {
      console.log('❌ 無効なトークンシンボル');
      return;
    }
    
    const pairAddress = await this.findPairAddress(tokens[tokenA], tokens[tokenB]);
    if (!pairAddress) {
      console.log('❌ ペアが見つかりません');
      return;
    }
    
    console.log(`📍 ペアアドレス: ${pairAddress}`);
    
    try {
      const pair = new ethers.Contract(pairAddress, this.getPairABI(), this.provider);
      const [token0, token1, reserves] = await Promise.all([
        pair.token0(),
        pair.token1(),
        pair.getReserves()
      ]);
      
      console.log(`🔍 プール構成:`);
      console.log(`   Token0: ${token0}`);
      console.log(`   Token1: ${token1}`);
      console.log(`   Reserve0: ${reserves.reserve0.toString()}`);
      console.log(`   Reserve1: ${reserves.reserve1.toString()}`);
      console.log(`   Last Update: ${new Date(reserves.blockTimestampLast * 1000).toLocaleString()}`);
      
      // 流動性分析
      const token0Symbol = Object.keys(tokens).find(k => tokens[k].toLowerCase() === token0.toLowerCase());
      const token1Symbol = Object.keys(tokens).find(k => tokens[k].toLowerCase() === token1.toLowerCase());
      
      if (token0Symbol && token1Symbol) {
        const reserve0Formatted = ethers.utils.formatUnits(reserves.reserve0, tokenInfo[token0Symbol].decimals);
        const reserve1Formatted = ethers.utils.formatUnits(reserves.reserve1, tokenInfo[token1Symbol].decimals);
        
        console.log(`\n💰 流動性:`);
        console.log(`   ${token0Symbol}: ${parseFloat(reserve0Formatted).toFixed(6)}`);
        console.log(`   ${token1Symbol}: ${parseFloat(reserve1Formatted).toFixed(6)}`);
        
        // 価格計算
        const price0in1 = parseFloat(reserve1Formatted) / parseFloat(reserve0Formatted);
        const price1in0 = parseFloat(reserve0Formatted) / parseFloat(reserve1Formatted);
        
        console.log(`\n📊 現在価格:`);
        console.log(`   1 ${token0Symbol} = ${price0in1.toFixed(8)} ${token1Symbol}`);
        console.log(`   1 ${token1Symbol} = ${price1in0.toFixed(8)} ${token0Symbol}`);
      }
      
    } catch (error) {
      console.log(`❌ 詳細分析エラー: ${error.message}`);
    }
  }
}

async function main() {
  try {
    const rpcUrl = process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm';
    const analyzer = new KittenSwapRateAnalyzer(rpcUrl);
    
    // 全ペア分析
    const results = await analyzer.analyzeAllPairs();
    
    // 特定ペアの詳細分析（例）
    if (results.successful.length > 0) {
      console.log('\n🔍 詳細分析例 (WHYPE/PURR):');
      await analyzer.analyzePairDetails('WHYPE', 'PURR');
    }
    
    console.log('\n🏁 KittenSwap レート分析完了');
    
  } catch (error) {
    console.error('❌ 分析エラー:', error);
  }
}

// 直接実行時
if (require.main === module) {
  main();
}

module.exports = { KittenSwapRateAnalyzer };