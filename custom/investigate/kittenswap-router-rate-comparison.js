#!/usr/bin/env node

/**
 * KittenSwap Router レート取得・比較スクリプト
 * HyperSwapと同様にRouter.getAmountsOut()を使用してレート取得
 * 
 * 特徴:
 * - Router.getAmountsOut()使用（HyperSwapと同じ方式）
 * - V2プールのみ（V3なし）
 * - 13種類のトークン対応
 * - HyperSwapとの直接比較可能
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

class KittenSwapRouterAnalyzer {
  constructor(rpcUrl) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.initializeContracts();
  }

  initializeContracts() {
    // KittenSwap Router V2 (メインネット)
    const ROUTER_ADDRESS = '0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802';
    
    // 標準的なUniswap V2 Router ABI
    const ROUTER_ABI = [
      {
        "name": "getAmountsOut",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
          {"name": "amountIn", "type": "uint256"},
          {"name": "path", "type": "address[]"}
        ],
        "outputs": [
          {"name": "amounts", "type": "uint256[]"}
        ]
      },
      {
        "name": "getAmountsIn",
        "type": "function", 
        "stateMutability": "view",
        "inputs": [
          {"name": "amountOut", "type": "uint256"},
          {"name": "path", "type": "address[]"}
        ],
        "outputs": [
          {"name": "amounts", "type": "uint256[]"}
        ]
      },
      {
        "name": "factory",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "address"}]
      },
      {
        "name": "WETH",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "address"}]
      }
    ];

    this.router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, this.provider);
    console.log(`📍 KittenSwap Router V2: ${ROUTER_ADDRESS}`);
  }

  // 実際のKittenSwapトークン（token-discovery.jsで確認済み）
  getTokens() {
    return {
      WHYPE: '0x5555555555555555555555555555555555555555',
      PAWS: '0xe3C80b7A1A8631E8cFd59c61E2a74Eb497dB28F6',
      wstHYPE: '0x94e8396e0869c9F2200760aF0621aFd240E1CF38',
      KEI: '0xB5fE77d323d69eB352A02006eA8ecC38D882620C',
      MATE: '0xC697Cfec4d5911961F072396FA997582Dc5851f1',
      wMATE: '0x6C268267b336B6B1C3DfE25c6950EC7c157e012B',
      LHYPE: '0x5748ae796AE46A4F1348a1693de4b50560485562'
    };
  }

  // トークン情報（decimals）
  getTokenInfo() {
    return {
      WHYPE: { decimals: 18 },
      PAWS: { decimals: 18 },
      wstHYPE: { decimals: 18 },
      KEI: { decimals: 18 },
      MATE: { decimals: 18 },
      wMATE: { decimals: 18 },
      LHYPE: { decimals: 18 }
    };
  }

  // Router経由でのレート取得
  async getRouterRate(tokenIn, tokenOut, amountIn) {
    try {
      const path = [tokenIn, tokenOut];
      const amounts = await this.router.callStatic.getAmountsOut(amountIn, path);
      
      return {
        success: true,
        amountOut: amounts[amounts.length - 1],
        path: path,
        method: 'Router getAmountsOut'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'Router getAmountsOut'
      };
    }
  }

  // マルチホップレート取得
  async getMultiHopRate(tokenPath, amountIn) {
    try {
      const amounts = await this.router.callStatic.getAmountsOut(amountIn, tokenPath);
      
      return {
        success: true,
        amountOut: amounts[amounts.length - 1],
        path: tokenPath,
        intermediateAmounts: amounts,
        method: 'Router Multi-hop'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        method: 'Router Multi-hop'
      };
    }
  }

  // トークン投入量を計算
  getAmountForToken(tokenSymbol, tokenInfo) {
    return ethers.utils.parseUnits('1', tokenInfo[tokenSymbol].decimals);
  }

  // メイン分析実行
  async analyzeAllPairs() {
    console.log('🔍 KittenSwap Router レート分析 (HyperSwap形式)\n');
    
    const tokens = this.getTokens();
    const tokenInfo = this.getTokenInfo();
    const tokenList = Object.keys(tokens);
    
    console.log('📊 RPC接続情報:');
    console.log(`   URL: ${this.provider.connection.url}`);
    console.log(`   Block Number: ${await this.provider.getBlockNumber()}`);
    
    // Router基本情報
    try {
      const factory = await this.router.factory();
      console.log(`   Factory: ${factory}`);
    } catch (error) {
      console.log(`   Factory: 取得失敗`);
    }
    
    try {
      const weth = await this.router.WETH();
      console.log(`   WETH: ${weth}`);
    } catch (error) {
      console.log(`   WETH: 取得失敗`);
    }
    
    console.log('');
    
    console.log('📊 1. Router経由 シングルホップレート分析\n');
    
    const results = {
      successful: [],
      failed: [],
      summary: {}
    };
    
    // 全ペア分析（HyperSwap形式）
    for (let i = 0; i < tokenList.length; i++) {
      for (let j = i + 1; j < tokenList.length; j++) {
        const tokenA = tokenList[i];
        const tokenB = tokenList[j];
        const pairName = `${tokenA}/${tokenB}`;
        
        console.log(`🔍 ${pairName}:`);
        
        // A→B方向
        const amountInA = this.getAmountForToken(tokenA, tokenInfo);
        const resultAtoB = await this.getRouterRate(
          tokens[tokenA],
          tokens[tokenB],
          amountInA
        );
        
        if (resultAtoB.success) {
          const rate = parseFloat(ethers.utils.formatUnits(
            resultAtoB.amountOut,
            tokenInfo[tokenB].decimals
          ));
          
          console.log(`   ✅ ${tokenA}→${tokenB}: ${rate.toFixed(8)} ${tokenB} (Router)`);
          
          results.successful.push({
            pair: pairName,
            direction: `${tokenA}→${tokenB}`,
            rate: rate,
            method: 'Router'
          });
        } else {
          console.log(`   ❌ ${tokenA}→${tokenB}: ${resultAtoB.error.substring(0, 50)}...`);
          results.failed.push({
            pair: pairName,
            direction: `${tokenA}→${tokenB}`,
            reason: resultAtoB.error
          });
        }
        
        // B→A方向
        const amountInB = this.getAmountForToken(tokenB, tokenInfo);
        const resultBtoA = await this.getRouterRate(
          tokens[tokenB],
          tokens[tokenA],
          amountInB
        );
        
        if (resultBtoA.success) {
          const rate = parseFloat(ethers.utils.formatUnits(
            resultBtoA.amountOut,
            tokenInfo[tokenA].decimals
          ));
          
          console.log(`   ✅ ${tokenB}→${tokenA}: ${rate.toFixed(8)} ${tokenA} (Router)`);
          
          results.successful.push({
            pair: pairName,
            direction: `${tokenB}→${tokenA}`,
            rate: rate,
            method: 'Router'
          });
        } else {
          console.log(`   ❌ ${tokenB}→${tokenA}: ${resultBtoA.error.substring(0, 50)}...`);
          results.failed.push({
            pair: pairName,
            direction: `${tokenB}→${tokenA}`,
            reason: resultBtoA.error
          });
        }
        
        console.log('');
      }
    }
    
    // マルチホップテスト
    console.log('📊 2. マルチホップレート分析\n');
    
    const multiHopPatterns = [
      {
        name: 'WHYPE → PAWS → wstHYPE',
        path: [tokens.WHYPE, tokens.PAWS, tokens.wstHYPE],
        inputToken: 'WHYPE',
        outputToken: 'wstHYPE'
      },
      {
        name: 'PAWS → WHYPE → KEI', 
        path: [tokens.PAWS, tokens.WHYPE, tokens.KEI],
        inputToken: 'PAWS',
        outputToken: 'KEI'
      },
      {
        name: 'KEI → WHYPE → LHYPE',
        path: [tokens.KEI, tokens.WHYPE, tokens.LHYPE],
        inputToken: 'KEI',
        outputToken: 'LHYPE'
      }
    ];
    
    for (const pattern of multiHopPatterns) {
      console.log(`🔍 ${pattern.name}:`);
      
      const amountIn = this.getAmountForToken(pattern.inputToken, tokenInfo);
      const result = await this.getMultiHopRate(pattern.path, amountIn);
      
      if (result.success) {
        const rate = parseFloat(ethers.utils.formatUnits(
          result.amountOut,
          tokenInfo[pattern.outputToken].decimals
        ));
        
        console.log(`   ✅ 最終レート: ${rate.toFixed(8)} ${pattern.outputToken}`);
        console.log(`   📊 中間量: ${result.intermediateAmounts.map(a => a.toString()).join(' → ')}`);
        
        results.successful.push({
          pair: pattern.name,
          direction: pattern.name,
          rate: rate,
          method: 'Multi-hop Router'
        });
      } else {
        console.log(`   ❌ 失敗: ${result.error.substring(0, 50)}...`);
        results.failed.push({
          pair: pattern.name,
          direction: pattern.name,
          reason: result.error
        });
      }
      
      console.log('');
    }
    
    // 結果サマリー
    console.log('📋 3. 結果サマリー\n');
    
    const totalTests = tokenList.length * (tokenList.length - 1) + multiHopPatterns.length;
    const successfulCount = results.successful.length;
    const failedCount = results.failed.length;
    
    console.log(`✅ 成功: ${successfulCount}/${totalTests} (${(successfulCount/totalTests*100).toFixed(1)}%)`);
    console.log(`❌ 失敗: ${failedCount}/${totalTests} (${(failedCount/totalTests*100).toFixed(1)}%)`);
    
    // 成功したペアの分析
    if (results.successful.length > 0) {
      console.log('\n💰 成功したレート (1トークンあたり):');
      
      const singleHopSuccessful = results.successful.filter(r => r.method === 'Router');
      const multiHopSuccessful = results.successful.filter(r => r.method === 'Multi-hop Router');
      
      console.log(`\n🔹 シングルホップ成功: ${singleHopSuccessful.length}個`);
      singleHopSuccessful.forEach(r => {
        console.log(`   ${r.direction}: ${r.rate.toFixed(8)}`);
      });
      
      console.log(`\n🔸 マルチホップ成功: ${multiHopSuccessful.length}個`);
      multiHopSuccessful.forEach(r => {
        console.log(`   ${r.direction}: ${r.rate.toFixed(8)}`);
      });
    }
    
    // HyperSwapとの比較
    console.log('\n💡 HyperSwap vs KittenSwap Router比較:');
    console.log('   📊 手法: 両DEXともRouter.getAmountsOut()使用');
    console.log('   🔹 HyperSwap: V2 Router + V3 QuoterV2');
    console.log('   🔸 KittenSwap: V2 Router のみ');
    console.log('   📈 マルチホップ: 両DEX対応');
    console.log('   💰 手数料: HyperSwap（複数tier）vs KittenSwap（0.3%固定）');
    
    return results;
  }

  // 特定ペアの詳細比較
  async compareSpecificPair(tokenA, tokenB) {
    console.log(`🔍 ${tokenA}/${tokenB} 詳細比較\n`);
    
    const tokens = this.getTokens();
    const tokenInfo = this.getTokenInfo();
    
    if (!tokens[tokenA] || !tokens[tokenB]) {
      console.log('❌ 無効なトークンシンボル');
      return;
    }
    
    const amountIn = this.getAmountForToken(tokenA, tokenInfo);
    
    // Router方式
    const routerResult = await this.getRouterRate(
      tokens[tokenA],
      tokens[tokenB],
      amountIn
    );
    
    console.log('🔹 Router方式:');
    if (routerResult.success) {
      const rate = parseFloat(ethers.utils.formatUnits(
        routerResult.amountOut,
        tokenInfo[tokenB].decimals
      ));
      console.log(`   ✅ レート: ${rate.toFixed(8)} ${tokenB}`);
      console.log(`   📊 パス: ${routerResult.path.join(' → ')}`);
    } else {
      console.log(`   ❌ 失敗: ${routerResult.error}`);
    }
    
    // 逆方向もテスト
    const amountInB = this.getAmountForToken(tokenB, tokenInfo);
    const reverseResult = await this.getRouterRate(
      tokens[tokenB],
      tokens[tokenA],
      amountInB
    );
    
    console.log('\n🔸 逆方向:');
    if (reverseResult.success) {
      const rate = parseFloat(ethers.utils.formatUnits(
        reverseResult.amountOut,
        tokenInfo[tokenA].decimals
      ));
      console.log(`   ✅ レート: ${rate.toFixed(8)} ${tokenA}`);
    } else {
      console.log(`   ❌ 失敗: ${reverseResult.error}`);
    }
  }
}

async function main() {
  try {
    const rpcUrl = process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm';
    const analyzer = new KittenSwapRouterAnalyzer(rpcUrl);
    
    // 全ペア分析
    const results = await analyzer.analyzeAllPairs();
    
    // 特定ペアの詳細比較（成功例）
    if (results.successful.length > 0) {
      console.log('\n🔍 詳細比較例:');
      await analyzer.compareSpecificPair('WHYPE', 'PAWS');
    }
    
    console.log('\n🏁 KittenSwap Router レート分析完了');
    
  } catch (error) {
    console.error('❌ 分析エラー:', error);
  }
}

// 直接実行時
if (require.main === module) {
  main();
}

module.exports = { KittenSwapRouterAnalyzer };