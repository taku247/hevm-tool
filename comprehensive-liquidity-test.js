#!/usr/bin/env node

/**
 * 包括的流動性テスト
 * V2とV3の両方で全トークンペアを検証
 */

const { UniversalContractUtils } = require('./temp/templates/contract-utils');
const { ethers } = require('ethers');

async function comprehensiveLiquidityTest() {
  console.log('🔍 HyperEVM 包括的流動性テスト\n');
  
  const utils = new UniversalContractUtils('https://rpc.hyperliquid.xyz/evm');
  
  // コントラクトアドレス
  const quoterV2 = '0x03A918028f22D9E1473B7959C927AD7425A45C7C'; // V3 Quoter
  const routerV2 = '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A'; // HyperSwap V2 Router
  
  // 全トークン
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463',
    UETH: '0xBe6727B535545C67d5cAa73dEa54865B92CF7907',
    ADHD: '0xE3D5F45d97fee83B48c85E00c8359A2E07D68Fee',
    BUDDY: '0x47bb061C0204Af921F43DC73C7D7768d2672DdEE',
    CATBAL: '0x11735dBd0B97CfA7Accf47d005673BA185f7fd49',
    HFUN: '0xa320D9f65ec992EfF38622c63627856382Db726c'
  };
  
  const tokenInfo = {
    WHYPE: { decimals: 18 },
    UBTC: { decimals: 8 },
    UETH: { decimals: 18 },
    ADHD: { decimals: 18 },
    BUDDY: { decimals: 18 },
    CATBAL: { decimals: 18 },
    HFUN: { decimals: 18 }
  };
  
  const amount = ethers.utils.parseEther('1').toString();
  const tokenList = Object.keys(tokens);
  
  console.log('📊 テスト対象トークン:');
  tokenList.forEach(token => {
    console.log(`  ${token}: ${tokens[token]}`);
  });
  console.log('');
  
  // 結果格納
  const v2Results = [];
  const v3DirectResults = [];
  const v3MultiHopResults = [];
  
  // 1. V2テスト（全ペア）
  console.log('=== 🔄 V2流動性テスト ===\n');
  
  for (let i = 0; i < tokenList.length; i++) {
    for (let j = 0; j < tokenList.length; j++) {
      if (i === j) continue;
      
      const tokenA = tokenList[i];
      const tokenB = tokenList[j];
      const pair = `${tokenA} → ${tokenB}`;
      
      try {
        const result = await utils.callReadFunction({
          abiPath: './abi/UniV2Router.json',
          contractAddress: routerV2,
          functionName: 'getAmountsOut',
          args: [amount, [tokens[tokenA], tokens[tokenB]]]
        });
        
        if (result.success && result.result && result.result[1]) {
          const amountOut = result.result[1];
          const rate = parseFloat(ethers.utils.formatUnits(amountOut, tokenInfo[tokenB].decimals));
          
          if (rate > 0) {
            console.log(`✅ ${pair}: ${rate.toFixed(6)} ${tokenB}`);
            v2Results.push({ pair, rate, tokenA, tokenB });
          }
        }
      } catch (error) {
        // エラーは無視
      }
    }
  }
  
  if (v2Results.length === 0) {
    console.log('❌ V2で利用可能なペアなし');
  }
  
  // 2. V3直接ペアテスト
  console.log('\n\n=== 🎯 V3直接ペアテスト ===\n');
  
  const feeTiers = [100, 500, 3000, 10000];
  
  for (let i = 0; i < tokenList.length; i++) {
    for (let j = 0; j < tokenList.length; j++) {
      if (i === j) continue;
      
      const tokenA = tokenList[i];
      const tokenB = tokenList[j];
      const pair = `${tokenA} → ${tokenB}`;
      
      for (const fee of feeTiers) {
        try {
          const result = await utils.callReadFunction({
            abiPath: './abi/KittenQuoterV2.json',
            contractAddress: quoterV2,
            functionName: 'quoteExactInputSingle',
            args: [tokens[tokenA], tokens[tokenB], fee, amount, 0]
          });
          
          if (result.success) {
            const amountOut = result.result[0] || result.result;
            const rate = parseFloat(ethers.utils.formatUnits(amountOut, tokenInfo[tokenB].decimals));
            
            if (rate > 0) {
              console.log(`✅ ${pair} (${fee}bps): ${rate.toFixed(6)} ${tokenB}`);
              v3DirectResults.push({ pair, rate, tokenA, tokenB, fee });
            }
          }
        } catch (error) {
          // エラーは無視
        }
      }
    }
  }
  
  if (v3DirectResults.length === 0) {
    console.log('❌ V3で利用可能な直接ペアなし');
  }
  
  // 3. V3マルチホップテスト（2ホップ）
  console.log('\n\n=== 🔀 V3マルチホップテスト ===\n');
  
  for (let i = 0; i < tokenList.length; i++) {
    for (let j = 0; j < tokenList.length; j++) {
      for (let k = 0; k < tokenList.length; k++) {
        if (i === j || j === k || i === k) continue;
        
        const tokenA = tokenList[i];
        const tokenB = tokenList[j]; // 中間トークン
        const tokenC = tokenList[k];
        const path = `${tokenA} → ${tokenB} → ${tokenC}`;
        
        // 主要fee tierの組み合わせのみテスト
        for (const fees of [[500, 500], [3000, 3000], [500, 3000], [3000, 500]]) {
          try {
            const packedPath = ethers.utils.solidityPack(
              ['address', 'uint24', 'address', 'uint24', 'address'],
              [tokens[tokenA], fees[0], tokens[tokenB], fees[1], tokens[tokenC]]
            );
            
            const result = await utils.callReadFunction({
              abiPath: './abi/KittenQuoterV2.json',
              contractAddress: quoterV2,
              functionName: 'quoteExactInput',
              args: [packedPath, amount]
            });
            
            if (result.success) {
              const amountOut = result.result[0] || result.result;
              const rate = parseFloat(ethers.utils.formatUnits(amountOut, tokenInfo[tokenC].decimals));
              
              if (rate > 0.00000001) {
                console.log(`✅ ${path} (${fees[0]}→${fees[1]}bps): ${rate.toFixed(8)} ${tokenC}`);
                v3MultiHopResults.push({ path, rate, tokenA, tokenB, tokenC, fees });
              }
            }
          } catch (error) {
            // エラーは無視
          }
        }
      }
    }
  }
  
  if (v3MultiHopResults.length === 0) {
    console.log('❌ V3で利用可能なマルチホップなし');
  }
  
  // 4. 結果サマリー
  console.log('\n\n=== 📊 結果サマリー ===\n');
  
  console.log(`V2利用可能ペア: ${v2Results.length}個`);
  console.log(`V3直接ペア: ${v3DirectResults.length}個`);
  console.log(`V3マルチホップ: ${v3MultiHopResults.length}個`);
  
  // 5. トークン別分析
  console.log('\n\n=== 💰 トークン別流動性分析 ===\n');
  
  for (const token of tokenList) {
    console.log(`【${token}】`);
    
    // V2
    const v2From = v2Results.filter(r => r.tokenA === token);
    const v2To = v2Results.filter(r => r.tokenB === token);
    console.log(`  V2: 売却${v2From.length}ペア, 購入${v2To.length}ペア`);
    
    // V3
    const v3From = v3DirectResults.filter(r => r.tokenA === token);
    const v3To = v3DirectResults.filter(r => r.tokenB === token);
    console.log(`  V3: 売却${v3From.length}ペア, 購入${v3To.length}ペア`);
    
    // 最良レート
    if (v2From.length > 0) {
      const best = v2From.sort((a, b) => b.rate - a.rate)[0];
      console.log(`  最良売却: ${best.pair} = ${best.rate.toFixed(6)} (V2)`);
    }
  }
  
  // 6. 最高流動性ペア
  console.log('\n\n=== 🏆 最高流動性ペア（Top 10） ===\n');
  
  const allResults = [
    ...v2Results.map(r => ({...r, protocol: 'V2'})),
    ...v3DirectResults.map(r => ({...r, protocol: 'V3'}))
  ];
  
  const topPairs = allResults
    .filter(r => r.rate > 0.001)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10);
  
  topPairs.forEach((result, index) => {
    console.log(`${index + 1}. ${result.pair}: ${result.rate.toFixed(6)} (${result.protocol})`);
  });
  
  // 7. 推奨ルート
  console.log('\n\n=== 🚀 推奨取引ルート ===\n');
  
  // WHYPE関連の最適ルート
  console.log('【WHYPE売却の推奨ルート】');
  
  for (const targetToken of tokenList.filter(t => t !== 'WHYPE')) {
    // V2で直接取引可能か
    const v2Direct = v2Results.find(r => r.tokenA === 'WHYPE' && r.tokenB === targetToken);
    
    // V3マルチホップ
    const v3Multi = v3MultiHopResults.filter(r => r.tokenA === 'WHYPE' && r.tokenC === targetToken);
    
    if (v2Direct || v3Multi.length > 0) {
      console.log(`\nWHYPE → ${targetToken}:`);
      if (v2Direct) {
        console.log(`  V2直接: ${v2Direct.rate.toFixed(6)} ${targetToken}`);
      }
      if (v3Multi.length > 0) {
        const best = v3Multi.sort((a, b) => b.rate - a.rate)[0];
        console.log(`  V3マルチ: ${best.path} = ${best.rate.toFixed(8)} ${targetToken}`);
      }
    }
  }
  
  return {
    v2Results,
    v3DirectResults,
    v3MultiHopResults
  };
}

if (require.main === module) {
  comprehensiveLiquidityTest()
    .then((results) => {
      console.log('\n\n🏁 包括的流動性テスト完了');
    })
    .catch(error => console.error('❌ テストエラー:', error));
}

module.exports = { comprehensiveLiquidityTest };