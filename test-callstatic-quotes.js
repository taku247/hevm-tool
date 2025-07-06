#!/usr/bin/env node

/**
 * callStatic実装でV3 Quote取得テスト
 * より安全なQuote取得方法を検証
 */

const { ethers } = require('ethers');

async function testCallStaticQuotes() {
  console.log('🔍 callStatic実装でV3 Quote取得テスト\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
  
  // HyperSwap V3コントラクト
  const contracts = {
    quoter: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
    factory: '0xB1c0fa0B789320044A6F623cFe5eBda9562602E3'
  };
  
  // テストトークン
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
  
  // QuoterV2 ABI（基本的な関数のみ）
  const quoterABI = [
    {
      "name": "quoteExactInputSingle",
      "type": "function",
      "stateMutability": "view",
      "inputs": [
        {"name": "tokenIn", "type": "address"},
        {"name": "tokenOut", "type": "address"},
        {"name": "fee", "type": "uint24"},
        {"name": "amountIn", "type": "uint256"},
        {"name": "sqrtPriceLimitX96", "type": "uint256"}
      ],
      "outputs": [
        {"name": "amountOut", "type": "uint256"},
        {"name": "sqrtPriceX96After", "type": "uint256"},
        {"name": "initializedTicksCrossed", "type": "uint32"},
        {"name": "gasEstimate", "type": "uint256"}
      ]
    }
  ];
  
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
  
  const quoterContract = new ethers.Contract(contracts.quoter, quoterABI, provider);
  const factoryContract = new ethers.Contract(contracts.factory, factoryABI, provider);
  
  // トークンソート関数
  function sortTokens(tokenA, tokenB) {
    return tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
  }
  
  // callStatic実装のQuote取得
  async function getQuoteWithCallStatic(tokenIn, tokenOut, fee, amountIn) {
    console.log(`📊 ${tokenIn === tokens.WHYPE ? 'WHYPE' : tokenIn === tokens.UBTC ? 'UBTC' : 'UETH'} → ${tokenOut === tokens.WHYPE ? 'WHYPE' : tokenOut === tokens.UBTC ? 'UBTC' : 'UETH'} (${fee}bps)`);
    
    try {
      // 1. プール存在確認
      const [token0, token1] = sortTokens(tokenIn, tokenOut);
      const poolAddress = await factoryContract.getPool(token0, token1, fee);
      
      if (poolAddress === '0x0000000000000000000000000000000000000000') {
        console.log(`   ❌ プールなし`);
        return { success: false, reason: 'no_pool' };
      }
      
      console.log(`   ✅ プール: ${poolAddress}`);
      
      // 2. callStaticでQuote取得
      const result = await quoterContract.callStatic.quoteExactInputSingle(
        tokenIn,
        tokenOut, 
        fee,
        amountIn,
        0
      );
      
      console.log(`   ✅ callStatic成功`);
      console.log(`      amountOut: ${result.amountOut.toString()}`);
      console.log(`      sqrtPriceX96After: ${result.sqrtPriceX96After.toString()}`);
      console.log(`      initializedTicksCrossed: ${result.initializedTicksCrossed}`);
      console.log(`      gasEstimate: ${result.gasEstimate.toString()}`);
      
      // レート計算
      const tokenOutSymbol = tokenOut === tokens.WHYPE ? 'WHYPE' : tokenOut === tokens.UBTC ? 'UBTC' : 'UETH';
      const decimals = tokenInfo[tokenOutSymbol].decimals;
      const rate = parseFloat(ethers.utils.formatUnits(result.amountOut, decimals));
      
      console.log(`      📈 レート: ${rate.toFixed(8)} ${tokenOutSymbol}`);
      
      return {
        success: true,
        amountOut: result.amountOut,
        rate: rate,
        poolAddress: poolAddress,
        gasEstimate: result.gasEstimate.toString()
      };
      
    } catch (error) {
      console.log(`   ❌ callStaticエラー: ${error.message.substring(0, 100)}`);
      
      // エラーの詳細分析
      if (error.message.includes('missing revert data')) {
        console.log(`      → プールにコードなしまたは初期化未完了`);
        return { success: false, reason: 'missing_revert_data', error: error.message };
      } else if (error.message.includes('revert')) {
        console.log(`      → revertエラー（流動性不足の可能性）`);
        return { success: false, reason: 'revert_error', error: error.message };
      } else {
        console.log(`      → その他のエラー`);
        return { success: false, reason: 'other_error', error: error.message };
      }
    }
  }
  
  // テスト実行
  console.log('🎯 callStatic Quote取得テスト開始\n');
  
  const amount = ethers.utils.parseEther('1').toString();
  const testCases = [
    // 主要ペア
    { tokenIn: tokens.WHYPE, tokenOut: tokens.UBTC, fee: 3000 },
    { tokenIn: tokens.WHYPE, tokenOut: tokens.UETH, fee: 3000 },
    { tokenIn: tokens.UBTC, tokenOut: tokens.UETH, fee: 3000 },
    
    // 異なるfee tier
    { tokenIn: tokens.WHYPE, tokenOut: tokens.UBTC, fee: 500 },
    { tokenIn: tokens.WHYPE, tokenOut: tokens.UBTC, fee: 10000 },
    
    // 逆方向
    { tokenIn: tokens.UBTC, tokenOut: tokens.WHYPE, fee: 3000 },
    { tokenIn: tokens.UETH, tokenOut: tokens.WHYPE, fee: 3000 }
  ];
  
  const results = {
    successful: [],
    failed: []
  };
  
  for (const testCase of testCases) {
    const result = await getQuoteWithCallStatic(
      testCase.tokenIn,
      testCase.tokenOut,
      testCase.fee,
      amount
    );
    
    if (result.success) {
      results.successful.push({...testCase, ...result});
    } else {
      results.failed.push({...testCase, ...result});
    }
    
    console.log(''); // 空行
  }
  
  // 結果サマリー
  console.log('📋 結果サマリー\n');
  
  console.log(`✅ 成功: ${results.successful.length}件`);
  console.log(`❌ 失敗: ${results.failed.length}件`);
  
  if (results.successful.length > 0) {
    console.log('\n✅ 成功したQuote:');
    results.successful.forEach(result => {
      const tokenInSymbol = result.tokenIn === tokens.WHYPE ? 'WHYPE' : result.tokenIn === tokens.UBTC ? 'UBTC' : 'UETH';
      const tokenOutSymbol = result.tokenOut === tokens.WHYPE ? 'WHYPE' : result.tokenOut === tokens.UBTC ? 'UBTC' : 'UETH';
      console.log(`   ${tokenInSymbol} → ${tokenOutSymbol} (${result.fee}bps): ${result.rate.toFixed(8)}`);
      console.log(`      Gas見積: ${result.gasEstimate}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ 失敗したQuote:');
    const reasonCounts = {};
    results.failed.forEach(result => {
      const tokenInSymbol = result.tokenIn === tokens.WHYPE ? 'WHYPE' : result.tokenIn === tokens.UBTC ? 'UBTC' : 'UETH';
      const tokenOutSymbol = result.tokenOut === tokens.WHYPE ? 'WHYPE' : result.tokenOut === tokens.UBTC ? 'UBTC' : 'UETH';
      console.log(`   ${tokenInSymbol} → ${tokenOutSymbol} (${result.fee}bps): ${result.reason}`);
      
      reasonCounts[result.reason] = (reasonCounts[result.reason] || 0) + 1;
    });
    
    console.log('\n📊 失敗理由の分布:');
    Object.entries(reasonCounts).forEach(([reason, count]) => {
      console.log(`   ${reason}: ${count}件`);
    });
  }
  
  // 分析と推奨事項
  console.log('\n💡 分析と推奨事項:');
  
  if (results.successful.length > 0) {
    console.log('   ✅ V3プールは動作している');
    console.log('   ✅ callStaticによるQuote取得が可能');
    console.log('   💰 実際の取引が実行可能');
  } else {
    console.log('   ⚠️  全てのQuoteが失敗');
    console.log('   🔍 プールは存在するが流動性が不足している可能性');
    console.log('   📋 プールの初期化状態を詳細調査が必要');
  }
  
  return results;
}

if (require.main === module) {
  testCallStaticQuotes()
    .then((results) => {
      console.log('\n🏁 callStatic Quote取得テスト完了');
    })
    .catch(error => console.error('❌ エラー:', error));
}

module.exports = { testCallStaticQuotes };