#!/usr/bin/env node

/**
 * 改良版V3テスト - ChatGPTアドバイスを反映
 * プール存在確認、トークンソート、callStatic実装
 */

const { UniversalContractUtils } = require('../../temp/templates/contract-utils');
const { ethers } = require('ethers');

async function improvedV3Test() {
  console.log('🔍 改良版V3テスト（プール存在確認付き）\n');
  
  const utils = new UniversalContractUtils('https://rpc.hyperliquid.xyz/evm');
  
  // V3コントラクトアドレス（HyperSwap公式ドキュメント）
  const contracts = {
    quoterV1: '0xF865716B90f09268fF12B6B620e14bEC390B8139',
    quoterV2: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
    factory: '0xB1c0fa0B789320044A6F623cFe5eBda9562602E3',
    swapRouter01: '0x4E2960a8cd19B467b82d26D83fAcb0fAE26b094D',
    swapRouter02: '0x6D99e7f6747AF2cDbB5164b6DD50e40D4fDe1e77',
    positionManager: '0x6eDA206207c09e5428F281761DdC0D300851fBC8'
  };
  
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
  
  // V3 Factory ABI（基本的なgetPool関数）
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
  
  // 1. V3 Factory確認
  console.log('🔍 1. V3 Factory確認\n');
  
  const workingFactory = contracts.factory;
  console.log(`📍 HyperSwap V3 Factory: ${workingFactory}`);
  
  try {
    const factoryContract = new ethers.Contract(
      workingFactory,
      factoryABI,
      utils.provider
    );
    
    // Factory動作テスト
    const testResult = await factoryContract.getPool(
      tokens.WHYPE,
      tokens.UBTC,
      3000
    );
    
    console.log(`✅ Factory動作確認: ${testResult}`);
    console.log('🎯 正式なFactoryアドレスで進行\n');
    
  } catch (error) {
    console.log(`❌ Factoryエラー: ${error.message}`);
    console.log('📋 HyperSwap V3が正常にデプロイされていない可能性があります\n');
    return;
  }
  
  // 2. トークンソート関数
  function sortTokens(tokenA, tokenB) {
    return tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
  }
  
  // 3. V3パスエンコード関数（QuoterV2用）
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
  
  // Pool ABI for slot0 check
  const poolABI = [
    {
      "name": "slot0",
      "type": "function",
      "stateMutability": "view",
      "inputs": [],
      "outputs": [
        { "name": "sqrtPriceX96", "type": "uint160" },
        { "name": "tick", "type": "int24" },
        { "name": "observationIndex", "type": "uint16" },
        { "name": "observationCardinality", "type": "uint16" },
        { "name": "observationCardinalityNext", "type": "uint16" },
        { "name": "feeProtocol", "type": "uint8" },
        { "name": "unlocked", "type": "bool" }
      ]
    }
  ];

  // 3. プール存在確認関数（初期化状態もチェック）
  async function checkPoolExists(tokenA, tokenB, fee) {
    const [token0, token1] = sortTokens(tokenA, tokenB);
    
    try {
      const factoryContract = new ethers.Contract(
        workingFactory,
        factoryABI,
        utils.provider
      );
      
      const poolAddress = await factoryContract.getPool(token0, token1, fee);
      
      if (poolAddress === '0x0000000000000000000000000000000000000000') {
        return { exists: false, address: null };
      }
      
      // プールにコードが存在するか確認
      const poolCode = await utils.provider.getCode(poolAddress);
      if (poolCode === '0x' || poolCode.length <= 2) {
        return { exists: false, address: poolAddress, reason: 'no_code' };
      }
      
      // プールが初期化されているか確認
      try {
        const poolContract = new ethers.Contract(
          poolAddress,
          poolABI,
          utils.provider
        );
        
        const slot0 = await poolContract.slot0();
        
        if (slot0.sqrtPriceX96.toString() === '0') {
          return { 
            exists: false, 
            address: poolAddress, 
            reason: 'not_initialized',
            sqrtPriceX96: slot0.sqrtPriceX96.toString()
          };
        }
        
        return { 
          exists: true, 
          address: poolAddress, 
          sqrtPriceX96: slot0.sqrtPriceX96.toString(),
          tick: slot0.tick.toString()
        };
      } catch (slot0Error) {
        return { 
          exists: false, 
          address: poolAddress, 
          reason: 'slot0_error',
          error: slot0Error.message
        };
      }
      
    } catch (error) {
      return { exists: false, error: error.message };
    }
  }
  
  // Test multiple HyperSwap V3 Quoter ABIs (V1 and V2)
  const quoterABIs = {
    // QuoterV1 (simple individual arguments)
    quoterV1: [{
      "name": "quoteExactInputSingle",
      "type": "function",
      "stateMutability": "view",
      "inputs": [
        { "name": "tokenIn", "type": "address" },
        { "name": "tokenOut", "type": "address" },
        { "name": "fee", "type": "uint24" },
        { "name": "amountIn", "type": "uint256" },
        { "name": "sqrtPriceLimitX96", "type": "uint160" }
      ],
      "outputs": [
        { "name": "amountOut", "type": "uint256" }
      ]
    }],
    
    // QuoterV2 (マルチホップ - シングルホップとしても使用可能)
    quoterV2: [{
      "name": "quoteExactInput",
      "type": "function",
      "stateMutability": "view",
      "inputs": [
        { "name": "path", "type": "bytes" },
        { "name": "amountIn", "type": "uint256" }
      ],
      "outputs": [
        { "name": "amountOut", "type": "uint256" },
        { "name": "sqrtPriceX96AfterList", "type": "uint160[]" },
        { "name": "initializedTicksCrossedList", "type": "uint32[]" },
        { "name": "gasEstimate", "type": "uint256" }
      ]
    }],
    
    // SwapRouter01 simulation
    swapRouter01: [{
      "name": "exactInputSingle",
      "type": "function",
      "stateMutability": "payable",
      "inputs": [{
        "components": [
          { "name": "tokenIn", "type": "address" },
          { "name": "tokenOut", "type": "address" },
          { "name": "fee", "type": "uint24" },
          { "name": "recipient", "type": "address" },
          { "name": "deadline", "type": "uint256" },
          { "name": "amountIn", "type": "uint256" },
          { "name": "amountOutMinimum", "type": "uint256" },
          { "name": "sqrtPriceLimitX96", "type": "uint160" }
        ],
        "internalType": "struct ISwapRouter.ExactInputSingleParams",
        "name": "params",
        "type": "tuple"
      }],
      "outputs": [
        { "name": "amountOut", "type": "uint256" }
      ]
    }],
    
    // SwapRouter02 simulation
    swapRouter02: [{
      "name": "exactInputSingle",
      "type": "function",
      "stateMutability": "payable",
      "inputs": [{
        "components": [
          { "name": "tokenIn", "type": "address" },
          { "name": "tokenOut", "type": "address" },
          { "name": "fee", "type": "uint24" },
          { "name": "recipient", "type": "address" },
          { "name": "deadline", "type": "uint256" },
          { "name": "amountIn", "type": "uint256" },
          { "name": "amountOutMinimum", "type": "uint256" },
          { "name": "sqrtPriceLimitX96", "type": "uint160" }
        ],
        "internalType": "struct ISwapRouter.ExactInputSingleParams",
        "name": "params",
        "type": "tuple"
      }],
      "outputs": [
        { "name": "amountOut", "type": "uint256" }
      ]
    }]
  };

  // 4. 改良版Quote取得関数（全パターンテスト）
  async function getQuoteSafely(tokenA, tokenB, fee, amount) {
    // まずプール存在確認
    const poolCheck = await checkPoolExists(tokenA, tokenB, fee);
    
    if (!poolCheck.exists) {
      return {
        success: false,
        reason: 'pool_not_exists',
        details: poolCheck
      };
    }
    
    // プールが存在する場合、全パターンでquoteをテスト
    const [token0, token1] = sortTokens(tokenA, tokenB);
    
    // Test all possible Quoter patterns with correct addresses
    const testConfigs = [
      {
        name: 'QuoterV1',
        abi: quoterABIs.quoterV1,
        method: 'quoteExactInputSingle',
        contractAddress: contracts.quoterV1,
        args: [token0, token1, fee, amount, 0]
      },
      {
        name: 'QuoterV2',
        abi: quoterABIs.quoterV2,
        method: 'quoteExactInput',
        contractAddress: contracts.quoterV2,
        args: [encodePath([token0, token1], [fee]), amount]
      },
      {
        name: 'SwapRouter01',
        abi: quoterABIs.swapRouter01,
        method: 'exactInputSingle',
        contractAddress: contracts.swapRouter01,
        args: [{
          tokenIn: token0,
          tokenOut: token1,
          fee: fee,
          recipient: '0x0000000000000000000000000000000000000000',
          deadline: Math.floor(Date.now() / 1000) + 3600,
          amountIn: amount,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0
        }]
      },
      {
        name: 'SwapRouter02',
        abi: quoterABIs.swapRouter02,
        method: 'exactInputSingle',
        contractAddress: contracts.swapRouter02,
        args: [{
          tokenIn: token0,
          tokenOut: token1,
          fee: fee,
          recipient: '0x0000000000000000000000000000000000000000',
          deadline: Math.floor(Date.now() / 1000) + 3600,
          amountIn: amount,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0
        }]
      }
    ];
    
    console.log(`        🔍 全パターンテスト開始`);
    
    for (const config of testConfigs) {
      try {
        console.log(`        ⚡ ${config.name}でテスト中...`);
        
        const contractAddress = config.contractAddress;
        const quoterContract = new ethers.Contract(
          contractAddress,
          config.abi,
          utils.provider
        );
        
        const result = await quoterContract.callStatic[config.method](...config.args);
        
        console.log(`        ✅ ${config.name}で成功: ${result.toString()}`);
        
        return {
          success: true,
          result: result,
          poolAddress: poolCheck.address,
          sortedTokens: { token0, token1 },
          method: config.name
        };
        
      } catch (error) {
        console.log(`        ❌ ${config.name}失敗: ${error.message.substring(0, 50)}...`);
        continue;
      }
    }
    
    // 全パターン失敗
    return {
      success: false,
      reason: 'all_patterns_failed',
      error: '全てのQuoterパターンが失敗しました'
    };
  }
  
  // 5. システマティックテスト
  console.log('🎯 2. システマティックV3テスト\n');
  
  const amount = ethers.utils.parseEther('1').toString();
  const feeTiers = [100, 500, 3000, 10000];
  const tokenList = Object.keys(tokens);
  
  const results = {
    poolsFound: [],
    workingQuotes: [],
    failures: []
  };
  
  // 全ペアテスト
  for (let i = 0; i < tokenList.length; i++) {
    for (let j = i + 1; j < tokenList.length; j++) {
      const tokenA = tokenList[i];
      const tokenB = tokenList[j];
      const pairName = `${tokenA}/${tokenB}`;
      
      console.log(`📊 ${pairName} テスト:`);
      
      let foundAnyPool = false;
      
      for (const fee of feeTiers) {
        const poolCheck = await checkPoolExists(tokens[tokenA], tokens[tokenB], fee);
        
        if (poolCheck.exists) {
          console.log(`   ✅ ${fee}bps: プール存在 (${poolCheck.address})`);
          if (poolCheck.sqrtPriceX96) {
            console.log(`      ✅ 初期化済み - sqrtPriceX96: ${poolCheck.sqrtPriceX96}, tick: ${poolCheck.tick}`);
          }
          foundAnyPool = true;
          
          results.poolsFound.push({
            pair: pairName,
            fee: fee,
            address: poolCheck.address
          });
          
          // Quote取得テスト
          const quoteResult = await getQuoteSafely(
            tokens[tokenA],
            tokens[tokenB],
            fee,
            amount
          );
          
          if (quoteResult.success) {
            // V1とV2で結果形式が異なるため適切に処理
            let amountOut;
            if (quoteResult.method === 'QuoterV2') {
              // V2は[amountOut, sqrtPriceX96AfterList, initializedTicksCrossedList, gasEstimate]
              amountOut = Array.isArray(quoteResult.result) ? quoteResult.result[0] : quoteResult.result.amountOut;
            } else {
              // V1は単純なamountOut
              amountOut = quoteResult.result;
            }
            
            const rate = parseFloat(ethers.utils.formatUnits(amountOut, tokenInfo[tokenB].decimals));
            
            console.log(`      💰 Quote: ${rate.toFixed(8)} ${tokenB} (${quoteResult.method})`);
            
            results.workingQuotes.push({
              pair: pairName,
              fee: fee,
              rate: rate,
              poolAddress: quoteResult.poolAddress,
              method: quoteResult.method,
              amountOut: amountOut.toString()
            });
          } else {
            console.log(`      ❌ Quote失敗: ${quoteResult.reason}`);
            results.failures.push({
              pair: pairName,
              fee: fee,
              reason: quoteResult.reason,
              error: quoteResult.error
            });
          }
        } else {
          console.log(`   ❌ ${fee}bps: プールなし`);
          if (poolCheck.reason === 'no_code') {
            console.log(`      (アドレス ${poolCheck.address} にコードなし)`);
          } else if (poolCheck.reason === 'not_initialized') {
            console.log(`      (アドレス ${poolCheck.address} は未初期化: sqrtPriceX96=${poolCheck.sqrtPriceX96})`);
          } else if (poolCheck.reason === 'slot0_error') {
            console.log(`      (アドレス ${poolCheck.address} slot0エラー: ${poolCheck.error})`);
          }
        }
      }
      
      if (!foundAnyPool) {
        console.log(`   ⚠️  ${pairName}: 全fee tierでプールなし`);
      }
      
      console.log('');
    }
  }
  
  // 6. 結果サマリー
  console.log('📋 3. 結果サマリー\n');
  
  console.log(`プール発見数: ${results.poolsFound.length}`);
  console.log(`動作するQuote: ${results.workingQuotes.length}`);
  console.log(`失敗数: ${results.failures.length}`);
  
  if (results.poolsFound.length > 0) {
    console.log('\n✅ 発見されたプール:');
    results.poolsFound.forEach(pool => {
      console.log(`   ${pool.pair} (${pool.fee}bps): ${pool.address}`);
    });
  }
  
  if (results.workingQuotes.length > 0) {
    console.log('\n💰 動作するQuote:');
    results.workingQuotes.forEach(quote => {
      console.log(`   ${quote.pair} (${quote.fee}bps): ${quote.rate.toFixed(8)}`);
    });
  }
  
  if (results.failures.length > 0) {
    console.log('\n❌ 失敗したQuote:');
    results.failures.forEach(failure => {
      console.log(`   ${failure.pair} (${failure.fee}bps): ${failure.reason}`);
      if (failure.error) {
        console.log(`      エラー: ${failure.error.substring(0, 100)}`);
      }
    });
  }
  
  // 7. 推奨事項
  console.log('\n💡 推奨事項:');
  
  if (results.poolsFound.length === 0) {
    console.log('   - V3プールが存在しないため、V2を使用することを推奨');
    console.log('   - HyperSwapのV3が実際にメインネットにデプロイされているか確認');
  } else {
    console.log('   - 発見されたプールを使用してV3取引が可能');
    console.log('   - プール存在確認を必ず行ってからQuoteを取得');
  }
  
  return results;
}

if (require.main === module) {
  improvedV3Test()
    .then((results) => {
      console.log('\n🏁 改良版V3テスト完了');
    })
    .catch(error => console.error('❌ テストエラー:', error));
}

module.exports = { improvedV3Test };