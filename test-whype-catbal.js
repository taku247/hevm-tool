const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * WHYPE/CATBALペアの詳細テスト（動作するペアの例）
 */

async function testWhypeCatbal() {
  console.log('🔍 WHYPE/CATBAL ペア詳細テスト（V1 vs V2）\n');
  
  const contracts = {
    quoterV1: '0xF865716B90f09268fF12B6B620e14bEC390B8139',
    quoterV2: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
    factory: '0xB1c0fa0B789320044A6F623cFe5eBda9562602E3'
  };
  
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    CATBAL: '0x11735dBd0B97CfA7Accf47d005673BA185f7fd49'
  };
  
  const amount = ethers.utils.parseEther('1').toString();
  
  // Factory ABI
  const factoryABI = [{
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
  }];
  
  // V1 ABI
  const quoterV1ABI = [{
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
  }];
  
  // V2 ABI
  const quoterV2ABI = [{
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
  }];
  
  // Pool ABI for slot0
  const poolABI = [{
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
  }];
  
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
  
  // トークンソート
  function sortTokens(tokenA, tokenB) {
    return tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
  }
  
  const feeTiers = [100, 500, 3000, 10000];
  const factoryContract = new ethers.Contract(contracts.factory, factoryABI, provider);
  
  console.log('📊 1. プール存在確認と価格取得\n');
  
  const results = {
    poolsFound: 0,
    v1Success: 0,
    v2Success: 0,
    priceComparison: []
  };
  
  for (const fee of feeTiers) {
    const [token0, token1] = sortTokens(tokens.WHYPE, tokens.CATBAL);
    
    try {
      const poolAddress = await factoryContract.getPool(token0, token1, fee);
      
      if (poolAddress === '0x0000000000000000000000000000000000000000') {
        console.log(`❌ ${fee}bps: プールなし`);
        continue;
      }
      
      console.log(`📍 ${fee}bps: プール発見 (${poolAddress})`);
      results.poolsFound++;
      
      // プール初期化チェック
      const poolCode = await provider.getCode(poolAddress);
      if (poolCode === '0x' || poolCode.length <= 2) {
        console.log(`   ❌ プールコードなし`);
        continue;
      }
      
      const poolContract = new ethers.Contract(poolAddress, poolABI, provider);
      try {
        const slot0 = await poolContract.slot0();
        console.log(`   ✅ 初期化済み - sqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
        
        let v1Result = null;
        let v2Result = null;
        
        // V1テスト
        console.log(`\n   🧪 QuoterV1テスト:`);
        try {
          const v1Contract = new ethers.Contract(contracts.quoterV1, quoterV1ABI, provider);
          const v1Quote = await v1Contract.callStatic.quoteExactInputSingle(
            tokens.WHYPE, tokens.CATBAL, fee, amount, 0
          );
          
          v1Result = parseFloat(ethers.utils.formatEther(v1Quote));
          console.log(`   ✅ V1成功: ${v1Result.toFixed(8)} CATBAL per WHYPE`);
          results.v1Success++;
          
        } catch (v1Error) {
          console.log(`   ❌ V1失敗: ${v1Error.message.substring(0, 50)}...`);
        }
        
        // V2テスト
        console.log(`\n   🧪 QuoterV2テスト:`);
        try {
          const v2Contract = new ethers.Contract(contracts.quoterV2, quoterV2ABI, provider);
          const path = encodePath([tokens.WHYPE, tokens.CATBAL], [fee]);
          const v2Quote = await v2Contract.callStatic.quoteExactInput(path, amount);
          
          v2Result = parseFloat(ethers.utils.formatEther(v2Quote[0]));
          console.log(`   ✅ V2成功: ${v2Result.toFixed(8)} CATBAL per WHYPE`);
          console.log(`   📊 Gas Estimate: ${v2Quote[3].toString()}`);
          results.v2Success++;
          
        } catch (v2Error) {
          console.log(`   ❌ V2失敗: ${v2Error.message.substring(0, 50)}...`);
        }
        
        // 価格比較
        if (v1Result !== null && v2Result !== null) {
          const priceDiff = Math.abs(v1Result - v2Result);
          const priceDiffPercent = (priceDiff / v1Result) * 100;
          
          console.log(`\n   📈 価格比較:`);
          console.log(`   価格差: ${priceDiff.toFixed(10)} CATBAL (${priceDiffPercent.toFixed(4)}%)`);
          
          if (priceDiffPercent < 0.01) {
            console.log(`   🎯 完全一致！`);
          } else if (priceDiffPercent < 0.1) {
            console.log(`   ✅ ほぼ同一価格`);
          } else {
            console.log(`   ⚠️  価格差あり`);
          }
          
          results.priceComparison.push({
            fee,
            v1: v1Result,
            v2: v2Result,
            diffPercent: priceDiffPercent
          });
        }
        
      } catch (slot0Error) {
        console.log(`   ❌ 初期化エラー: ${slot0Error.message}`);
      }
      
    } catch (error) {
      console.log(`❌ ${fee}bps: エラー - ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
  }
  
  // サマリー
  console.log('📋 2. 結果サマリー\n');
  console.log(`🔍 プール発見数: ${results.poolsFound}`);
  console.log(`✅ V1成功数: ${results.v1Success}`);
  console.log(`✅ V2成功数: ${results.v2Success}`);
  
  if (results.priceComparison.length > 0) {
    console.log('\n💰 価格比較結果:');
    results.priceComparison.forEach(comp => {
      console.log(`   ${comp.fee}bps: V1=${comp.v1.toFixed(8)}, V2=${comp.v2.toFixed(8)} (差=${comp.diffPercent.toFixed(4)}%)`);
    });
  }
  
  console.log('\n💡 結論:');
  if (results.v1Success > 0 && results.v2Success > 0) {
    console.log('✅ V1とV2の両方が動作し、価格も一致しています');
  } else if (results.v1Success > 0) {
    console.log('⚠️  V1のみ動作、V2は動作しません');
  } else if (results.v2Success > 0) {
    console.log('⚠️  V2のみ動作、V1は動作しません');
  } else {
    console.log('❌ V1・V2ともに動作しません');
  }
}

if (require.main === module) {
  testWhypeCatbal().catch(console.error);
}

module.exports = { testWhypeCatbal };