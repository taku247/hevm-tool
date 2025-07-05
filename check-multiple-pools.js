const { UniversalContractUtils } = require('./dist/templates/contract-utils');
const { ethers } = require('ethers');

/**
 * 複数のHYPE/UBTCプールを調査
 */
async function checkMultiplePools() {
  console.log('🏊 HyperSwapの複数HYPE/UBTCプール調査\n');
  
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  const utils = new UniversalContractUtils(rpcUrl);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  
  // 既知のトークンアドレス
  const tokens = {
    'Native HYPE': '0x0000000000000000000000000000000000000000',
    'WHYPE': '0x5555555555555555555555555555555555555555',
    'UBTC': '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463'
  };
  
  console.log('📍 複数プールが存在する理由:');
  console.log('   1. 異なる手数料ティア（V3）: 1bps, 5bps, 30bps, 100bps');
  console.log('   2. 異なるDEX: HyperSwap vs KittenSwap');
  console.log('   3. 異なるバージョン: V2 vs V3');
  console.log('   4. 異なるペア: Native HYPE vs Wrapped HYPE\n');
  
  // 確認済みプール
  const knownPool = {
    address: '0x3a36b04bcc1d5e2e303981ef643d2668e00b43e7',
    type: 'V3',
    fee: 3000,
    token0: 'WHYPE',
    token1: 'UBTC'
  };
  
  console.log('✅ 確認済みプール:');
  console.log(`   アドレス: ${knownPool.address}`);
  console.log(`   タイプ: ${knownPool.type} (${knownPool.fee/100}bps)`);
  console.log(`   ペア: ${knownPool.token0}/${knownPool.token1}\n`);
  
  // V3の異なる手数料ティアをテスト
  console.log('🔍 V3の異なる手数料ティアでレート確認:');
  const feeTiers = [
    { fee: 100, name: '1bps (超低手数料)' },
    { fee: 500, name: '5bps (低手数料)' },
    { fee: 3000, name: '30bps (標準)' },
    { fee: 10000, name: '100bps (高手数料)' }
  ];
  
  const testAmount = ethers.utils.parseUnits('0.01', 8); // 0.01 UBTC
  const results = [];
  
  for (const tier of feeTiers) {
    try {
      // HyperSwap V3 Quoter
      const result = await utils.callReadFunction({
        abiPath: './abi/KittenQuoterV2.json',
        contractAddress: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
        functionName: 'quoteExactInputSingle',
        args: [
          tokens.UBTC,
          tokens.WHYPE,
          tier.fee,
          testAmount.toString(),
          0
        ]
      });
      
      if (result.success && result.result) {
        const amountOut = ethers.utils.formatEther(result.result);
        const rate = parseFloat(amountOut) / 0.01;
        console.log(`   ✅ ${tier.name}: 1 UBTC = ${rate.toFixed(2)} WHYPE`);
        results.push({ fee: tier.fee, rate, name: tier.name });
      } else {
        console.log(`   ❌ ${tier.name}: プールなし`);
      }
    } catch (error) {
      console.log(`   ❌ ${tier.name}: エラー`);
    }
  }
  
  // KittenSwap CLでも試行
  console.log('\n🐱 KittenSwap CLでのレート確認:');
  for (const tier of feeTiers) {
    try {
      const result = await utils.callReadFunction({
        abiPath: './abi/KittenQuoterV2.json',
        contractAddress: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF',
        functionName: 'quoteExactInputSingle',
        args: [
          tokens.UBTC,
          tokens.WHYPE,
          tier.fee,
          testAmount.toString(),
          0
        ]
      });
      
      if (result.success && result.result) {
        const amountOut = ethers.utils.formatEther(result.result);
        const rate = parseFloat(amountOut) / 0.01;
        console.log(`   ✅ ${tier.name}: 1 UBTC = ${rate.toFixed(2)} WHYPE`);
      } else {
        console.log(`   ❌ ${tier.name}: プールなし`);
      }
    } catch (error) {
      console.log(`   ❌ ${tier.name}: エラー`);
    }
  }
  
  // 最適ルーティングの説明
  console.log('\n🚀 HyperSwap UIの最適ルーティング:');
  console.log('   UIは以下を自動的に行います:');
  console.log('   1. 全プールのレートを比較');
  console.log('   2. 手数料を考慮した最適パスを選択');
  console.log('   3. 必要に応じて複数プールを経由（スプリット）');
  console.log('   4. 価格影響を最小化');
  
  if (results.length > 0) {
    console.log('\n📊 レート比較結果:');
    const sortedResults = results.sort((a, b) => b.rate - a.rate);
    sortedResults.forEach((r, i) => {
      console.log(`   ${i+1}. ${r.name}: ${r.rate.toFixed(2)} WHYPE/UBTC`);
    });
    
    const bestRate = sortedResults[0].rate;
    console.log(`\n   最良レート: ${bestRate.toFixed(2)} WHYPE/UBTC`);
    console.log(`   UIレート: 2796 WHYPE/UBTC`);
    
    if (Math.abs(bestRate - 2796) < 50) {
      console.log('   ✅ 最良レートはUIに近い値です！');
    }
  }
  
  console.log('\n💡 結論:');
  console.log('   複数プールの存在がレート差異の主要因です:');
  console.log('   - スクリプト: 単一プール（V2ルーター経由）を使用');
  console.log('   - UI: 全プールから最適なものを自動選択');
  console.log('   - 解決策: スマートルーティング実装が必要');
  
  console.log('\n🔧 改善案:');
  console.log('   1. 全手数料ティアをチェック');
  console.log('   2. 最良レートのプールを選択');
  console.log('   3. アグリゲーター的な実装');
  
  return {
    multiplePoolsExist: true,
    bestRateFound: results.length > 0 ? Math.max(...results.map(r => r.rate)) : 0,
    uiRate: 2796,
    scriptRate: 2688.47,
    conclusion: 'multiple_pools_cause_difference'
  };
}

// 実行
if (require.main === module) {
  checkMultiplePools()
    .then(result => {
      console.log('\n🎯 調査結果:', result);
    })
    .catch(error => {
      console.error('❌ 調査エラー:', error);
    });
}

module.exports = { checkMultiplePools };