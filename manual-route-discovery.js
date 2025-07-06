#!/usr/bin/env node

/**
 * 手動ルーティング探索システム
 * HyperEVMで利用可能な全経路を体系的に発見
 */

const { UniversalContractUtils } = require('./temp/templates/contract-utils');
const { ethers } = require('ethers');

async function discoverAllRoutes() {
  console.log('🔍 HyperEVM手動ルーティング探索\n');
  
  const utils = new UniversalContractUtils('https://rpc.hyperliquid.xyz/evm');
  const quoterV2 = '0x03A918028f22D9E1473B7959C927AD7425A45C7C';
  
  // 利用可能トークン
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463',
    UETH: '0xBe6727B535545C67d5cAa73dEa54865B92CF7907'
  };
  
  const tokenInfo = {
    WHYPE: { decimals: 18 },
    UBTC: { decimals: 8 },
    UETH: { decimals: 18 }
  };
  
  const amount = ethers.utils.parseEther('1').toString();
  const feeTiers = [100, 500, 3000, 10000]; // 1bps, 5bps, 30bps, 100bps
  
  console.log('📊 トークン情報:');
  Object.entries(tokens).forEach(([symbol, address]) => {
    console.log(`  ${symbol}: ${address}`);
  });
  console.log('');
  
  // 1. 直接ペア探索
  console.log('🎯 1. 直接ペア探索');
  console.log('==================');
  
  const directPairs = [];
  const tokenList = Object.keys(tokens);
  
  for (let i = 0; i < tokenList.length; i++) {
    for (let j = i + 1; j < tokenList.length; j++) {
      const tokenA = tokenList[i];
      const tokenB = tokenList[j];
      
      console.log(`\\n${tokenA}/${tokenB} ペア:`);
      
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
            console.log(`  ✅ ${fee}bps: ${rate.toFixed(8)} ${tokenB}`);
            
            directPairs.push({
              from: tokenA,
              to: tokenB,
              fee: fee,
              rate: rate,
              available: true
            });
          } else {
            console.log(`  ❌ ${fee}bps: No liquidity`);
          }
        } catch (error) {
          console.log(`  ❌ ${fee}bps: Error`);
        }
      }
    }
  }
  
  // 2. マルチホップ探索（2ホップ）
  console.log('\\n\\n🔄 2. マルチホップ探索（2ホップ）');
  console.log('===============================');
  
  const multiHopRoutes = [];
  
  for (let i = 0; i < tokenList.length; i++) {
    for (let j = 0; j < tokenList.length; j++) {
      for (let k = 0; k < tokenList.length; k++) {
        if (i === j || j === k || i === k) continue;
        
        const tokenA = tokenList[i];
        const tokenB = tokenList[j]; // 中間トークン
        const tokenC = tokenList[k];
        
        console.log(`\\n${tokenA} → ${tokenB} → ${tokenC}:`);
        
        // 各fee tierの組み合わせをテスト
        for (const fee1 of [500, 3000]) { // 主要なfee tierのみ
          for (const fee2 of [500, 3000]) {
            try {
              const path = ethers.utils.solidityPack(
                ['address', 'uint24', 'address', 'uint24', 'address'],
                [tokens[tokenA], fee1, tokens[tokenB], fee2, tokens[tokenC]]
              );
              
              const result = await utils.callReadFunction({
                abiPath: './abi/KittenQuoterV2.json',
                contractAddress: quoterV2,
                functionName: 'quoteExactInput',
                args: [path, amount]
              });
              
              if (result.success) {
                const amountOut = result.result[0] || result.result;
                const rate = parseFloat(ethers.utils.formatUnits(amountOut, tokenInfo[tokenC].decimals));
                console.log(`  ✅ ${fee1}bps→${fee2}bps: ${rate.toFixed(8)} ${tokenC}`);
                
                multiHopRoutes.push({
                  path: `${tokenA} → ${tokenB} → ${tokenC}`,
                  fees: [fee1, fee2],
                  rate: rate,
                  available: true
                });
              } else {
                console.log(`  ❌ ${fee1}bps→${fee2}bps: Failed`);
              }
            } catch (error) {
              console.log(`  ❌ ${fee1}bps→${fee2}bps: Error`);
            }
          }
        }
      }
    }
  }
  
  // 3. 結果サマリー
  console.log('\\n\\n📋 探索結果サマリー');
  console.log('==================');
  
  console.log(`\\n✅ 利用可能な直接ペア: ${directPairs.length}件`);
  directPairs.forEach(pair => {
    console.log(`  ${pair.from}/${pair.to} (${pair.fee}bps): ${pair.rate.toFixed(8)}`);
  });
  
  console.log(`\\n✅ 利用可能なマルチホップ: ${multiHopRoutes.length}件`);
  multiHopRoutes.forEach(route => {
    console.log(`  ${route.path} (${route.fees.join('→')}bps): ${route.rate.toFixed(8)}`);
  });
  
  // 4. ルーティングテーブル生成
  console.log('\\n\\n🗺️  ルーティングテーブル');
  console.log('======================');
  
  const routingTable = {};
  
  // 直接ペアを追加
  directPairs.forEach(pair => {
    const key = `${pair.from}-${pair.to}`;
    if (!routingTable[key] || routingTable[key].rate < pair.rate) {
      routingTable[key] = {
        type: 'direct',
        path: [pair.from, pair.to],
        fees: [pair.fee],
        rate: pair.rate
      };
    }
  });
  
  // マルチホップを追加
  multiHopRoutes.forEach(route => {
    const tokens = route.path.split(' → ');
    const key = `${tokens[0]}-${tokens[2]}`;
    if (!routingTable[key] || routingTable[key].rate < route.rate) {
      routingTable[key] = {
        type: 'multihop',
        path: tokens,
        fees: route.fees,
        rate: route.rate
      };
    }
  });
  
  Object.entries(routingTable).forEach(([pair, route]) => {
    console.log(`\\n${pair}:`);
    console.log(`  最適ルート: ${route.path.join(' → ')}`);
    console.log(`  手数料: ${route.fees.join('→')}bps`);
    console.log(`  レート: ${route.rate.toFixed(8)}`);
    console.log(`  タイプ: ${route.type}`);
  });
  
  // 5. 設定ファイル用データ生成
  console.log('\\n\\n⚙️  設定ファイル用ルートデータ');
  console.log('=============================');
  
  const routeConfig = {
    metadata: {
      lastUpdated: new Date().toISOString(),
      totalRoutes: Object.keys(routingTable).length,
      chainId: 999
    },
    routes: routingTable
  };
  
  console.log(JSON.stringify(routeConfig, null, 2));
  
  return routingTable;
}

if (require.main === module) {
  discoverAllRoutes()
    .then((routes) => {
      console.log('\\n🏁 ルーティング探索完了');
      console.log(`発見されたルート数: ${Object.keys(routes).length}`);
    })
    .catch(error => console.error('❌ 探索エラー:', error));
}

module.exports = { discoverAllRoutes };