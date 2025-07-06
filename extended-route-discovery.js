#!/usr/bin/env node

/**
 * 拡張ルーティング探索システム
 * HyperSwapで扱われている新しいトークンを含めた全ペア検証
 */

const { UniversalContractUtils } = require('./temp/templates/contract-utils');
const { ethers } = require('ethers');

async function discoverExtendedRoutes() {
  console.log('🔍 HyperSwap拡張ルーティング探索\n');
  
  const utils = new UniversalContractUtils('https://rpc.hyperliquid.xyz/evm');
  const quoterV2 = '0x03A918028f22D9E1473B7959C927AD7425A45C7C';
  
  // 全トークン（新規追加分含む）
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463',
    UETH: '0xBe6727B535545C67d5cAa73dEa54865B92CF7907',
    ADHD: '0xE3D5F45d97fee83B48c85E00c8359A2E07D68Fee',
    BUDDY: '0x47bb061C0204Af921F43DC73C7D7768d2672DdEE',
    CATBAL: '0x11735dBd0B97CfA7Accf47d005673BA185f7fd49',
    HFUN: '0xa320D9f65ec992EfF38622c63627856382Db726c'
  };
  
  // 全トークン18 decimalsと仮定（必要に応じて修正）
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
  const feeTiers = [100, 500, 3000, 10000];
  
  console.log('📊 検証対象トークン:');
  console.log('- 基本トークン: WHYPE, UBTC, UETH');
  console.log('- 新規トークン: ADHD, BUDDY, CATBAL, HFUN');
  console.log(`合計: ${Object.keys(tokens).length}トークン\n`);
  
  // 結果格納
  const directPools = [];
  const multiHopRoutes = [];
  const successfulPairs = new Set();
  
  // 1. 直接ペア探索（1ホップ）
  console.log('🎯 1. 直接ペア探索（全組み合わせ）');
  console.log('==================================');
  
  const tokenList = Object.keys(tokens);
  let directPairCount = 0;
  
  for (let i = 0; i < tokenList.length; i++) {
    for (let j = 0; j < tokenList.length; j++) {
      if (i === j) continue;
      
      const tokenA = tokenList[i];
      const tokenB = tokenList[j];
      const pairName = `${tokenA}/${tokenB}`;
      
      // 重要なペアのみ詳細表示
      const isImportantPair = tokenA === 'WHYPE' || tokenB === 'WHYPE';
      
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
            
            if (isImportantPair || rate > 0.00000001) {
              console.log(`✅ ${pairName} (${fee}bps): ${rate.toFixed(8)} ${tokenB}`);
            }
            
            directPools.push({
              from: tokenA,
              to: tokenB,
              fee: fee,
              rate: rate,
              pair: pairName
            });
            
            successfulPairs.add(`${tokenA}-${tokenB}`);
            directPairCount++;
          }
        } catch (error) {
          // エラーは無視
        }
      }
    }
  }
  
  console.log(`\n直接ペア発見数: ${directPairCount}`);
  
  // 2. 主要トークンペアのマルチホップ探索
  console.log('\n\n🔄 2. 主要マルチホップ探索（WHYPE関連）');
  console.log('=====================================');
  
  // WHYPEから各トークンへの最適ルート探索
  for (const targetToken of tokenList) {
    if (targetToken === 'WHYPE') continue;
    
    console.log(`\nWHYPE → ${targetToken} ルート探索:`);
    
    // 直接ペアが存在するか確認
    if (successfulPairs.has(`WHYPE-${targetToken}`)) {
      console.log(`  ✅ 直接ペア存在`);
      continue;
    }
    
    // マルチホップ探索
    let foundRoute = false;
    
    for (const middleToken of tokenList) {
      if (middleToken === 'WHYPE' || middleToken === targetToken) continue;
      
      // 主要fee tierのみテスト
      for (const fee1 of [500, 3000]) {
        for (const fee2 of [500, 3000]) {
          try {
            const path = ethers.utils.solidityPack(
              ['address', 'uint24', 'address', 'uint24', 'address'],
              [tokens.WHYPE, fee1, tokens[middleToken], fee2, tokens[targetToken]]
            );
            
            const result = await utils.callReadFunction({
              abiPath: './abi/KittenQuoterV2.json',
              contractAddress: quoterV2,
              functionName: 'quoteExactInput',
              args: [path, amount]
            });
            
            if (result.success) {
              const amountOut = result.result[0] || result.result;
              const rate = parseFloat(ethers.utils.formatUnits(amountOut, tokenInfo[targetToken].decimals));
              
              if (rate > 0.00000001) {
                console.log(`  ✅ WHYPE → ${middleToken} → ${targetToken} (${fee1}→${fee2}bps): ${rate.toFixed(8)}`);
                
                multiHopRoutes.push({
                  path: `WHYPE → ${middleToken} → ${targetToken}`,
                  fees: [fee1, fee2],
                  rate: rate
                });
                
                foundRoute = true;
              }
            }
          } catch (error) {
            // エラーは無視
          }
        }
      }
    }
    
    if (!foundRoute) {
      console.log(`  ❌ 利用可能なルートなし`);
    }
  }
  
  // 3. 流動性マップ生成
  console.log('\n\n📊 3. 流動性マップ');
  console.log('=================');
  
  const liquidityMap = {};
  
  // 直接ペアの集計
  directPools.forEach(pool => {
    if (!liquidityMap[pool.from]) liquidityMap[pool.from] = {};
    if (!liquidityMap[pool.from][pool.to]) liquidityMap[pool.from][pool.to] = [];
    liquidityMap[pool.from][pool.to].push({
      fee: pool.fee,
      rate: pool.rate
    });
  });
  
  // 各トークンの接続状況
  console.log('\nトークン接続状況:');
  for (const token of tokenList) {
    const outgoing = liquidityMap[token] ? Object.keys(liquidityMap[token]).length : 0;
    const incoming = Object.values(liquidityMap).filter(map => map[token]).length;
    console.log(`${token}: 出方向 ${outgoing}個, 入方向 ${incoming}個`);
  }
  
  // 4. 重要な発見
  console.log('\n\n💡 4. 重要な発見');
  console.log('================');
  
  // WHYPE関連の直接ペア
  const whypePairs = directPools.filter(p => p.from === 'WHYPE' || p.to === 'WHYPE');
  console.log(`\nWHYPE関連の直接ペア: ${whypePairs.length}個`);
  whypePairs.forEach(pair => {
    console.log(`  ${pair.pair} (${pair.fee}bps): ${pair.rate.toFixed(8)}`);
  });
  
  // 新トークンの流動性
  console.log('\n新トークンの流動性状況:');
  for (const newToken of ['ADHD', 'BUDDY', 'CATBAL', 'HFUN']) {
    const pairs = directPools.filter(p => p.from === newToken || p.to === newToken);
    console.log(`${newToken}: ${pairs.length}個のアクティブペア`);
    if (pairs.length > 0) {
      console.log(`  主要ペア: ${pairs.slice(0, 3).map(p => p.pair).join(', ')}`);
    }
  }
  
  // 5. ルーティング推奨
  console.log('\n\n🚀 5. ルーティング推奨');
  console.log('=====================');
  
  // 最高流動性ペア
  const topPairs = directPools
    .filter(p => p.rate > 0.001)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10);
  
  console.log('\n最高流動性ペア（Top 10）:');
  topPairs.forEach((pair, index) => {
    console.log(`${index + 1}. ${pair.pair} (${pair.fee}bps): ${pair.rate.toFixed(8)}`);
  });
  
  return {
    directPools,
    multiHopRoutes,
    liquidityMap,
    successfulPairs: Array.from(successfulPairs)
  };
}

if (require.main === module) {
  discoverExtendedRoutes()
    .then((results) => {
      console.log('\n\n🏁 拡張ルーティング探索完了');
      console.log(`直接プール: ${results.directPools.length}個`);
      console.log(`マルチホップルート: ${results.multiHopRoutes.length}個`);
      console.log(`成功ペア: ${results.successfulPairs.length}個`);
    })
    .catch(error => console.error('❌ 探索エラー:', error));
}

module.exports = { discoverExtendedRoutes };