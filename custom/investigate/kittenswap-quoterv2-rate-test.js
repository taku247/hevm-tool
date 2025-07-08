#!/usr/bin/env node

/**
 * KittenSwap QuoterV2 スワップレート取得テスト
 * 既存のABIを使用してレート取得を試行
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function testKittenSwapQuoterV2() {
  console.log('🔍 KittenSwap QuoterV2 スワップレート取得テスト\n');
  
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm'
  );
  
  console.log('📊 RPC接続情報:');
  console.log(`   URL: ${provider.connection.url}`);
  console.log(`   Block Number: ${await provider.getBlockNumber()}`);
  
  // QuoterV2 ABI読み込み
  const abiPath = path.join(__dirname, '../../abi/KittenQuoterV2.json');
  const quoterABI = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  
  console.log(`\n📁 QuoterV2 ABI読み込み: ${abiPath}`);
  console.log(`   関数数: ${quoterABI.length}個`);
  
  const CONTRACTS = {
    QuoterV2: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF',
    CLFactory: '0x2E08F5Ff603E4343864B14599CAeDb19918BDCaF'
  };
  
  const quoter = new ethers.Contract(CONTRACTS.QuoterV2, quoterABI, provider);
  
  // 1. QuoterV2基本情報確認
  console.log('\n1. QuoterV2基本情報確認:');
  
  try {
    const factory = await quoter.factory();
    console.log(`   ✅ factory(): ${factory}`);
  } catch (error) {
    console.log(`   ❌ factory(): ${error.message}`);
  }
  
  // 2. 実際のプール情報取得
  console.log('\n2. 実際のプール情報取得:');
  
  const factoryABI = [
    "function allPoolsLength() external view returns (uint256)",
    "function allPools(uint256 index) external view returns (address pool)"
  ];
  
  const factory = new ethers.Contract(CONTRACTS.CLFactory, factoryABI, provider);
  const poolCount = await factory.allPoolsLength();
  console.log(`   📊 プール総数: ${poolCount.toString()}`);
  
  // 複数のプールでテスト
  const maxTest = Math.min(poolCount.toNumber(), 10);
  const testResults = [];
  
  for (let i = 0; i < maxTest; i++) {
    try {
      const poolAddress = await factory.allPools(i);
      console.log(`\n   🔍 Pool[${i}]: ${poolAddress}`);
      
      const poolABI = [
        "function token0() external view returns (address)",
        "function token1() external view returns (address)",
        "function fee() external view returns (uint24)"
      ];
      
      const pool = new ethers.Contract(poolAddress, poolABI, provider);
      const [token0, token1, fee] = await Promise.all([
        pool.token0(),
        pool.token1(),
        pool.fee()
      ]);
      
      console.log(`      Token0: ${token0}`);
      console.log(`      Token1: ${token1}`);
      console.log(`      Fee: ${fee} (${fee/10000}%)`);
      
      // 3. quoteExactInputSingle テスト
      console.log(`\n   🧪 quoteExactInputSingle テスト:`);
      
      const testAmount = ethers.utils.parseEther('0.001');
      console.log(`      投入量: ${ethers.utils.formatEther(testAmount)} ETH`);
      
      try {
        const result = await quoter.callStatic.quoteExactInputSingle(
          token0,
          token1,
          fee,
          testAmount,
          0
        );
        
        console.log(`      ✅ 成功! 出力: ${ethers.utils.formatEther(result)} tokens`);
        const rate = parseFloat(ethers.utils.formatEther(result)) / parseFloat(ethers.utils.formatEther(testAmount));
        console.log(`      📊 レート: 1 input = ${rate.toFixed(8)} output`);
        
        testResults.push({
          poolIndex: i,
          poolAddress,
          token0,
          token1,
          fee,
          success: true,
          rate: rate
        });
        
      } catch (error) {
        console.log(`      ❌ 失敗: ${error.message.substring(0, 60)}...`);
        
        testResults.push({
          poolIndex: i,
          poolAddress,
          token0,
          token1,
          fee,
          success: false,
          error: error.message
        });
      }
      
      // 4. quoteExactInput テスト（マルチホップ）
      console.log(`\n   🧪 quoteExactInput テスト:`);
      
      try {
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
        
        const path = encodePath([token0, token1], [fee]);
        console.log(`      Path: ${path}`);
        
        const result = await quoter.callStatic.quoteExactInput(path, testAmount);
        console.log(`      ✅ 成功! 出力: ${ethers.utils.formatEther(result)} tokens`);
        
      } catch (error) {
        console.log(`      ❌ 失敗: ${error.message.substring(0, 60)}...`);
      }
      
    } catch (error) {
      console.log(`   ❌ Pool[${i}]情報取得エラー: ${error.message}`);
    }
  }
  
  // 5. 結果サマリー
  console.log('\n5. 結果サマリー:');
  
  const successfulTests = testResults.filter(r => r.success);
  const failedTests = testResults.filter(r => !r.success);
  
  console.log(`   📊 総テスト数: ${testResults.length}`);
  console.log(`   📊 成功: ${successfulTests.length}個 (${(successfulTests.length/testResults.length*100).toFixed(1)}%)`);
  console.log(`   📊 失敗: ${failedTests.length}個 (${(failedTests.length/testResults.length*100).toFixed(1)}%)`);
  
  if (successfulTests.length > 0) {
    console.log('\n   ✅ 成功したプール:');
    successfulTests.forEach((test, index) => {
      console.log(`      ${index + 1}. Pool[${test.poolIndex}]: レート ${test.rate.toFixed(8)}`);
      console.log(`         Token0: ${test.token0}`);
      console.log(`         Token1: ${test.token1}`);
      console.log(`         Fee: ${test.fee} (${test.fee/10000}%)`);
    });
  }
  
  if (failedTests.length > 0) {
    console.log('\n   ❌ 失敗したプール:');
    const errorTypes = {};
    failedTests.forEach(test => {
      const errorType = test.error.includes('missing revert data') ? 'missing revert data' :
                       test.error.includes('execution reverted') ? 'execution reverted' :
                       'other';
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    });
    
    Object.entries(errorTypes).forEach(([error, count]) => {
      console.log(`      ${error}: ${count}個`);
    });
  }
  
  // 6. 結論
  console.log('\n6. 結論:');
  
  if (successfulTests.length > 0) {
    console.log('   🎉 KittenSwap QuoterV2でスワップレート取得に成功！');
    console.log('   💡 一部のプールでは正常に動作している');
    console.log('   💡 流動性のあるプールが存在する');
    console.log('   💡 実際のスワップも可能な可能性がある');
  } else {
    console.log('   ❌ 全てのプールでスワップレート取得に失敗');
    console.log('   💡 流動性不足または初期化問題');
    console.log('   💡 実際のスワップは困難');
  }
  
  console.log('\n🏁 KittenSwap QuoterV2 スワップレート取得テスト完了');
}

if (require.main === module) {
  testKittenSwapQuoterV2().catch(console.error);
}

module.exports = { testKittenSwapQuoterV2 };