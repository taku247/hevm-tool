#!/usr/bin/env node

/**
 * V3プール詳細状態調査
 * プールの初期化状態、流動性量、現在価格を詳細調査
 */

const { ethers } = require('ethers');

async function investigatePoolDetails() {
  console.log('🔍 V3プール詳細状態調査\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
  
  // コントラクトアドレス
  const contracts = {
    factory: '0xB1c0fa0B789320044A6F623cFe5eBda9562602E3'
  };
  
  // テストトークン
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463',
    UETH: '0xBe6727B535545C67d5cAa73dEa54865B92CF7907'
  };
  
  // Factory ABI
  const factoryABI = [
    {
      "name": "getPool",
      "type": "function",
      "stateMutability": "view",
      "inputs": [
        {"name": "tokenA", "type": "address"},
        {"name": "tokenB", "type": "address"},
        {"name": "fee", "type": "uint24"}
      ],
      "outputs": [
        {"name": "pool", "type": "address"}
      ]
    }
  ];
  
  // V3プール基本ABI
  const poolABI = [
    {
      "name": "slot0",
      "type": "function",
      "stateMutability": "view",
      "inputs": [],
      "outputs": [
        {"name": "sqrtPriceX96", "type": "uint160"},
        {"name": "tick", "type": "int24"},
        {"name": "observationIndex", "type": "uint16"},
        {"name": "observationCardinality", "type": "uint16"},
        {"name": "observationCardinalityNext", "type": "uint16"},
        {"name": "feeProtocol", "type": "uint8"},
        {"name": "unlocked", "type": "bool"}
      ]
    },
    {
      "name": "liquidity",
      "type": "function",
      "stateMutability": "view",
      "inputs": [],
      "outputs": [
        {"name": "", "type": "uint128"}
      ]
    },
    {
      "name": "token0",
      "type": "function",
      "stateMutability": "view",
      "inputs": [],
      "outputs": [
        {"name": "", "type": "address"}
      ]
    },
    {
      "name": "token1",
      "type": "function",
      "stateMutability": "view",
      "inputs": [],
      "outputs": [
        {"name": "", "type": "address"}
      ]
    },
    {
      "name": "fee",
      "type": "function",
      "stateMutability": "view",
      "inputs": [],
      "outputs": [
        {"name": "", "type": "uint24"}
      ]
    }
  ];
  
  const factoryContract = new ethers.Contract(contracts.factory, factoryABI, provider);
  
  // トークンソート
  function sortTokens(tokenA, tokenB) {
    return tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
  }
  
  // プール詳細調査関数
  async function investigatePool(tokenA, tokenB, fee) {
    const tokenASymbol = Object.keys(tokens).find(key => tokens[key] === tokenA);
    const tokenBSymbol = Object.keys(tokens).find(key => tokens[key] === tokenB);
    const pairName = `${tokenASymbol}/${tokenBSymbol}`;
    
    console.log(`📊 ${pairName} (${fee}bps) 詳細調査:`);
    
    try {
      // 1. プールアドレス取得
      const [token0, token1] = sortTokens(tokenA, tokenB);
      const poolAddress = await factoryContract.getPool(token0, token1, fee);
      
      if (poolAddress === '0x0000000000000000000000000000000000000000') {
        console.log(`   ❌ プールなし\n`);
        return { exists: false };
      }
      
      console.log(`   📍 プールアドレス: ${poolAddress}`);
      
      // 2. プールコード確認
      const poolCode = await provider.getCode(poolAddress);
      const hasCode = poolCode !== '0x' && poolCode.length > 2;
      console.log(`   💾 コード: ${hasCode ? '✅ 存在' : '❌ なし'} (${(poolCode.length - 2) / 2} bytes)`);
      
      if (!hasCode) {
        console.log(`   ⚠️  プールが未デプロイ\n`);
        return { exists: true, address: poolAddress, hasCode: false };
      }
      
      // 3. プールコントラクト作成
      const poolContract = new ethers.Contract(poolAddress, poolABI, provider);
      
      // 4. 基本情報取得
      console.log(`   🔍 基本情報取得中...`);
      
      const [poolToken0, poolToken1, poolFee] = await Promise.all([
        poolContract.token0(),
        poolContract.token1(), 
        poolContract.fee()
      ]);
      
      console.log(`      token0: ${poolToken0}`);
      console.log(`      token1: ${poolToken1}`);
      console.log(`      fee: ${poolFee}`);
      
      // 5. slot0取得（プール状態）
      console.log(`   📈 slot0（プール状態）取得中...`);
      
      const slot0 = await poolContract.slot0();
      console.log(`      sqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
      console.log(`      tick: ${slot0.tick}`);
      console.log(`      unlocked: ${slot0.unlocked}`);
      
      // sqrtPriceX96から実際の価格を計算
      const price = parseFloat(slot0.sqrtPriceX96.toString()) ** 2 / (2 ** 192);
      console.log(`      実際の価格: ${price.toExponential(6)}`);
      
      // 6. 流動性取得
      console.log(`   💧 流動性取得中...`);
      
      const liquidity = await poolContract.liquidity();
      console.log(`      現在の流動性: ${liquidity.toString()}`);
      
      const hasLiquidity = !liquidity.isZero();
      console.log(`      流動性状態: ${hasLiquidity ? '✅ あり' : '❌ ゼロ'}`);
      
      // 7. 初期化状態判定
      const isInitialized = !slot0.sqrtPriceX96.isZero();
      console.log(`   🚀 初期化状態: ${isInitialized ? '✅ 初期化済み' : '❌ 未初期化'}`);
      
      // 8. 総合判定
      console.log(`   📋 総合判定:`);
      
      if (!isInitialized) {
        console.log(`      🔴 未初期化プール - Quoteは不可能`);
      } else if (!hasLiquidity) {
        console.log(`      🟡 初期化済みだが流動性ゼロ - Quote不可能`);
      } else {
        console.log(`      🟢 完全に動作可能 - Quote取得可能のはず`);
      }
      
      console.log('');
      
      return {
        exists: true,
        address: poolAddress,
        hasCode: true,
        token0: poolToken0,
        token1: poolToken1,
        fee: poolFee.toString(),
        sqrtPriceX96: slot0.sqrtPriceX96.toString(),
        tick: slot0.tick,
        unlocked: slot0.unlocked,
        liquidity: liquidity.toString(),
        price: price,
        isInitialized: isInitialized,
        hasLiquidity: hasLiquidity,
        status: !isInitialized ? 'uninitialized' : !hasLiquidity ? 'no_liquidity' : 'operational'
      };
      
    } catch (error) {
      console.log(`   ❌ 調査エラー: ${error.message.substring(0, 100)}`);
      console.log('');
      
      return {
        exists: true,
        address: poolAddress,
        hasCode: false,
        error: error.message,
        status: 'error'
      };
    }
  }
  
  // テスト実行
  console.log('🎯 プール詳細調査開始\n');
  
  const testCases = [
    // 主要ペア - 3000bps
    { tokenA: tokens.WHYPE, tokenB: tokens.UBTC, fee: 3000 },
    { tokenA: tokens.WHYPE, tokenB: tokens.UETH, fee: 3000 },
    { tokenA: tokens.UBTC, tokenB: tokens.UETH, fee: 3000 },
    
    // WHYPE/UBTC - 全fee tier
    { tokenA: tokens.WHYPE, tokenB: tokens.UBTC, fee: 100 },
    { tokenA: tokens.WHYPE, tokenB: tokens.UBTC, fee: 500 },
    { tokenA: tokens.WHYPE, tokenB: tokens.UBTC, fee: 10000 }
  ];
  
  const results = {
    operational: [],
    noLiquidity: [],
    uninitialized: [],
    noCode: [],
    errors: []
  };
  
  for (const testCase of testCases) {
    const result = await investigatePool(testCase.tokenA, testCase.tokenB, testCase.fee);
    
    if (!result.exists) {
      continue;
    }
    
    switch (result.status) {
      case 'operational':
        results.operational.push(result);
        break;
      case 'no_liquidity':
        results.noLiquidity.push(result);
        break;
      case 'uninitialized':
        results.uninitialized.push(result);
        break;
      case 'error':
        results.errors.push(result);
        break;
      default:
        if (!result.hasCode) {
          results.noCode.push(result);
        }
    }
  }
  
  // 結果サマリー
  console.log('📋 調査結果サマリー\n');
  
  console.log(`🟢 動作可能プール: ${results.operational.length}個`);
  console.log(`🟡 流動性ゼロプール: ${results.noLiquidity.length}個`);
  console.log(`🔴 未初期化プール: ${results.uninitialized.length}個`);
  console.log(`⚫ コードなしプール: ${results.noCode.length}個`);
  console.log(`❌ エラープール: ${results.errors.length}個`);
  
  if (results.operational.length > 0) {
    console.log('\n🟢 動作可能プール一覧:');
    results.operational.forEach(pool => {
      const token0Symbol = Object.keys(tokens).find(key => tokens[key] === pool.token0);
      const token1Symbol = Object.keys(tokens).find(key => tokens[key] === pool.token1);
      console.log(`   ${token0Symbol}/${token1Symbol} (${pool.fee}bps): ${pool.address}`);
      console.log(`      流動性: ${pool.liquidity}`);
      console.log(`      価格: ${pool.price.toExponential(6)}`);
    });
  }
  
  if (results.noLiquidity.length > 0) {
    console.log('\n🟡 流動性ゼロプール:');
    results.noLiquidity.forEach(pool => {
      console.log(`   ${pool.address}: 初期化済みだが流動性なし`);
    });
  }
  
  if (results.uninitialized.length > 0) {
    console.log('\n🔴 未初期化プール:');
    results.uninitialized.forEach(pool => {
      console.log(`   ${pool.address}: プール作成済みだが未初期化`);
    });
  }
  
  // 推奨事項
  console.log('\n💡 推奨事項:');
  
  if (results.operational.length > 0) {
    console.log('   ✅ 動作可能なV3プールが存在');
    console.log('   🔍 Quoterの問題を再調査する必要がある');
    console.log('   💰 実際の取引をテストして確認');
  } else {
    console.log('   ❌ 動作可能なV3プールがない');
    console.log('   📋 V2の使用を継続推奨');
    console.log('   ⏳ V3の流動性提供を待つ');
  }
  
  return results;
}

if (require.main === module) {
  investigatePoolDetails()
    .then((results) => {
      console.log('\n🏁 V3プール詳細調査完了');
    })
    .catch(error => console.error('❌ 調査エラー:', error));
}

module.exports = { investigatePoolDetails };