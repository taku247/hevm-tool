#!/usr/bin/env node

/**
 * KittenSwap FeeRate分析
 * HyperSwapと同様にFeeRateの指定問題を検証
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function analyzeKittenSwapFeeRates() {
  console.log('🔍 KittenSwap FeeRate分析\n');
  
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm'
  );
  
  console.log('📊 RPC接続情報:');
  console.log(`   URL: ${provider.connection.url}`);
  console.log(`   Block Number: ${await provider.getBlockNumber()}`);
  
  const CONTRACTS = {
    QuoterV2: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF',
    CLFactory: '0x2E08F5Ff603E4343864B14599CAeDb19918BDCaF'
  };
  
  // QuoterV2 ABI読み込み
  const abiPath = path.join(__dirname, '../../abi/KittenQuoterV2.json');
  const quoterABI = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  const quoter = new ethers.Contract(CONTRACTS.QuoterV2, quoterABI, provider);
  
  // 主要なトークンペア
  const TOKEN_PAIRS = [
    {
      name: 'WHYPE/PAWS',
      token0: '0x5555555555555555555555555555555555555555',
      token1: '0xe3C80b7A1A8631E8cFd59c61E2a74Eb497dB28F6'
    },
    {
      name: 'WHYPE/wstHYPE',
      token0: '0x5555555555555555555555555555555555555555',
      token1: '0x94e8396e0869c9F2200760aF0621aFd240E1CF38'
    },
    {
      name: 'WHYPE/Unknown',
      token0: '0x5555555555555555555555555555555555555555',
      token1: '0xdAbB040c428436d41CECd0Fb06bCFDBAaD3a9AA8'
    }
  ];
  
  // HyperSwapとKittenSwapの両方で使用されるFeeRates
  const FEE_RATES = [
    { bps: 100, percent: '0.01%' },
    { bps: 200, percent: '0.02%' },
    { bps: 500, percent: '0.05%' },
    { bps: 2500, percent: '0.25%' },
    { bps: 3000, percent: '0.30%' },
    { bps: 7500, percent: '0.75%' },
    { bps: 10000, percent: '1.00%' }
  ];
  
  console.log('\n1. 各トークンペアのFeeRate分析:');
  
  const testAmount = ethers.utils.parseEther('0.001');
  const results = [];
  
  for (const pair of TOKEN_PAIRS) {
    console.log(`\n🔍 ${pair.name}:`);
    console.log(`   Token0: ${pair.token0}`);
    console.log(`   Token1: ${pair.token1}`);
    
    const pairResults = {
      name: pair.name,
      token0: pair.token0,
      token1: pair.token1,
      workingFees: [],
      failedFees: []
    };
    
    // 各FeeRateでテスト
    for (const feeRate of FEE_RATES) {
      console.log(`\n   💰 Fee ${feeRate.percent} (${feeRate.bps} bps):`);
      
      // V3パスエンコード
      function encodePath(tokens, fees) {
        let path = '0x';
        for (let i = 0; i < tokens.length; i++) {
          path += tokens[i].slice(2);
          if (i < fees.length) {
            path += fees[i].toString(16).padStart(6, '0');
          }
        }
        return path;
      }
      
      const path = encodePath([pair.token0, pair.token1], [feeRate.bps]);
      
      try {
        // quoteExactInputSingle テスト
        const singleResult = await quoter.callStatic.quoteExactInputSingle(
          pair.token0,
          pair.token1,
          feeRate.bps,
          testAmount,
          0
        );
        
        console.log(`      ✅ quoteExactInputSingle: ${ethers.utils.formatEther(singleResult)} tokens`);
        
        pairResults.workingFees.push({
          ...feeRate,
          function: 'quoteExactInputSingle',
          result: singleResult
        });
        
      } catch (error) {
        console.log(`      ❌ quoteExactInputSingle失敗: ${error.message.includes('missing revert data') ? 'missing revert data' : error.message.substring(0, 30)}...`);
      }
      
      try {
        // quoteExactInput テスト
        const inputResult = await quoter.callStatic.quoteExactInput(path, testAmount);
        
        console.log(`      ✅ quoteExactInput: ${ethers.utils.formatEther(inputResult)} tokens`);
        
        const rate = parseFloat(ethers.utils.formatEther(inputResult)) / parseFloat(ethers.utils.formatEther(testAmount));
        console.log(`      📊 レート: 1 input = ${rate.toFixed(8)} output`);
        
        pairResults.workingFees.push({
          ...feeRate,
          function: 'quoteExactInput',
          result: inputResult,
          rate: rate
        });
        
      } catch (error) {
        console.log(`      ❌ quoteExactInput失敗: ${error.message.includes('missing revert data') ? 'missing revert data' : error.message.substring(0, 30)}...`);
        
        pairResults.failedFees.push({
          ...feeRate,
          error: error.message.includes('missing revert data') ? 'missing revert data' : 'other error'
        });
      }
    }
    
    results.push(pairResults);
  }
  
  // 2. 結果サマリー
  console.log('\n2. FeeRate分析結果サマリー:');
  
  for (const result of results) {
    console.log(`\n📊 ${result.name}:`);
    console.log(`   成功したFeeRate: ${result.workingFees.length}個`);
    console.log(`   失敗したFeeRate: ${result.failedFees.length}個`);
    
    if (result.workingFees.length > 0) {
      console.log('   ✅ 動作するFeeRate:');
      const uniqueWorkingFees = [...new Set(result.workingFees.map(f => f.bps))];
      uniqueWorkingFees.forEach(bps => {
        const feeInfo = FEE_RATES.find(f => f.bps === bps);
        console.log(`      ${feeInfo.percent} (${bps} bps)`);
      });
    }
  }
  
  // 3. HyperSwapとの比較
  console.log('\n3. HyperSwapとの比較:');
  console.log('   HyperSwapで動作するFeeRate:');
  console.log('   - 100 bps (0.01%) ✅');
  console.log('   - 500 bps (0.05%) ✅');
  console.log('   - 3000 bps (0.30%) ✅');
  console.log('   - 10000 bps (1.00%) ✅');
  
  console.log('\n   KittenSwapで動作するFeeRate:');
  const allWorkingFees = results.flatMap(r => r.workingFees);
  const uniqueKittenFees = [...new Set(allWorkingFees.map(f => f.bps))];
  
  if (uniqueKittenFees.length > 0) {
    uniqueKittenFees.forEach(bps => {
      const feeInfo = FEE_RATES.find(f => f.bps === bps);
      console.log(`   - ${bps} bps (${feeInfo.percent}) ✅`);
    });
  } else {
    console.log('   - 限定的な動作のみ');
  }
  
  // 4. 実際のプール存在確認
  console.log('\n4. 実際のプール存在確認:');
  
  const factoryABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
  ];
  
  const factory = new ethers.Contract(CONTRACTS.CLFactory, factoryABI, provider);
  
  for (const pair of TOKEN_PAIRS) {
    console.log(`\n🏊 ${pair.name}のプール存在状況:`);
    
    for (const feeRate of FEE_RATES) {
      try {
        const poolAddress = await factory.getPool(pair.token0, pair.token1, feeRate.bps);
        
        if (poolAddress !== ethers.constants.AddressZero) {
          console.log(`   ✅ ${feeRate.percent}: ${poolAddress}`);
        } else {
          console.log(`   ❌ ${feeRate.percent}: プールなし`);
        }
        
      } catch (error) {
        console.log(`   ❌ ${feeRate.percent}: エラー`);
      }
    }
  }
  
  // 5. 結論
  console.log('\n5. 結論:');
  
  const totalWorking = allWorkingFees.length;
  const totalTested = results.length * FEE_RATES.length * 2; // 2 functions per test
  
  console.log(`   📊 総テスト数: ${totalTested}`);
  console.log(`   📊 成功: ${totalWorking}個 (${(totalWorking/totalTested*100).toFixed(1)}%)`);
  
  if (totalWorking > 0) {
    console.log('\n   💡 発見:');
    console.log('   - FeeRate指定は重要な要素');
    console.log('   - 特定のFeeRateでのみ動作');
    console.log('   - HyperSwapと同様のパターンが存在');
    console.log('   - プール存在≠Quote動作');
  } else {
    console.log('\n   💡 発見:');
    console.log('   - 主要ペアでは動作しない');
    console.log('   - マイナーペアでのみ動作');
    console.log('   - 流動性が限定的');
  }
  
  console.log('\n🏁 KittenSwap FeeRate分析完了');
}

if (require.main === module) {
  analyzeKittenSwapFeeRates().catch(console.error);
}

module.exports = { analyzeKittenSwapFeeRates };