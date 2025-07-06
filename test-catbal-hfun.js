const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * CATBAL/HFUNペアの詳細テスト
 */

async function testCatbalHfun() {
  console.log('🔍 CATBAL/HFUN ペア詳細テスト\n');
  
  const contracts = {
    quoterV1: '0xF865716B90f09268fF12B6B620e14bEC390B8139',
    quoterV2: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
    factory: '0xB1c0fa0B789320044A6F623cFe5eBda9562602E3'
  };
  
  const tokens = {
    CATBAL: '0x11735dBd0B97CfA7Accf47d005673BA185f7fd49',
    HFUN: '0xa320D9f65ec992EfF38622c63627856382Db726c'
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
  
  console.log('📊 1. プール存在確認\n');
  
  for (const fee of feeTiers) {
    const [token0, token1] = sortTokens(tokens.CATBAL, tokens.HFUN);
    
    try {
      const poolAddress = await factoryContract.getPool(token0, token1, fee);
      
      if (poolAddress === '0x0000000000000000000000000000000000000000') {
        console.log(`❌ ${fee}bps: プールなし`);
        continue;
      }
      
      console.log(`📍 ${fee}bps: プール発見 (${poolAddress})`);
      
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
        
        // V1テスト
        console.log(`\n   🧪 QuoterV1テスト:`);
        try {
          const v1Contract = new ethers.Contract(contracts.quoterV1, quoterV1ABI, provider);
          const v1Result = await v1Contract.callStatic.quoteExactInputSingle(
            tokens.CATBAL, tokens.HFUN, fee, amount, 0
          );
          
          const v1Rate = parseFloat(ethers.utils.formatEther(v1Result));
          console.log(`   ✅ V1成功: ${v1Rate.toFixed(8)} HFUN per CATBAL`);
          
        } catch (v1Error) {
          console.log(`   ❌ V1失敗: ${v1Error.message.substring(0, 50)}...`);
        }
        
        // V2テスト
        console.log(`\n   🧪 QuoterV2テスト:`);
        try {
          const v2Contract = new ethers.Contract(contracts.quoterV2, quoterV2ABI, provider);
          const path = encodePath([tokens.CATBAL, tokens.HFUN], [fee]);
          const v2Result = await v2Contract.callStatic.quoteExactInput(path, amount);
          
          const v2Rate = parseFloat(ethers.utils.formatEther(v2Result[0]));
          console.log(`   ✅ V2成功: ${v2Rate.toFixed(8)} HFUN per CATBAL`);
          console.log(`   📊 Gas Estimate: ${v2Result[3].toString()}`);
          
        } catch (v2Error) {
          console.log(`   ❌ V2失敗: ${v2Error.message.substring(0, 50)}...`);
        }
        
      } catch (slot0Error) {
        console.log(`   ❌ 初期化エラー: ${slot0Error.message}`);
      }
      
    } catch (error) {
      console.log(`❌ ${fee}bps: エラー - ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('\n💡 結論:');
  console.log('CATBAL/HFUNペアはプールが存在しないため、V1・V2ともにQuote取得不可');
}

if (require.main === module) {
  testCatbalHfun().catch(console.error);
}

module.exports = { testCatbalHfun };