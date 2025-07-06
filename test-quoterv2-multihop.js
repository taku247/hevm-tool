const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * QuoterV2のマルチホップ機能テスト
 */

async function testQuoterV2Multihop() {
  console.log('🔍 HyperSwap V3 QuoterV2 マルチホップテスト\n');
  
  const quoterV2Address = '0x03A918028f22D9E1473B7959C927AD7425A45C7C';
  
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463',
    UETH: '0xBe6727B535545C67d5cAa73dEa54865B92CF7907'
  };
  
  const amount = ethers.utils.parseEther('1').toString();
  
  // QuoterV2のquoteExactInput ABI
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
  
  // V3のpath encoding（シングルホップでもテスト）
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
  
  console.log('🧪 1. シングルホップテスト (WHYPE → UBTC)\n');
  
  try {
    const quoterContract = new ethers.Contract(quoterV2Address, quoterV2ABI, provider);
    
    // シングルホップパス: WHYPE → UBTC (3000 bps)
    const singlePath = encodePath([tokens.WHYPE, tokens.UBTC], [3000]);
    console.log(`Path: ${singlePath}`);
    
    const singleResult = await quoterContract.callStatic.quoteExactInput(singlePath, amount);
    
    console.log(`✅ シングルホップ成功!`);
    console.log(`   AmountOut: ${singleResult[0].toString()}`);
    console.log(`   📊 Price: ${ethers.utils.formatUnits(singleResult[0], 8)} UBTC per WHYPE`);
    console.log(`   Gas Estimate: ${singleResult[3].toString()}`);
    
  } catch (error) {
    console.log(`❌ シングルホップ失敗: ${error.message.substring(0, 100)}...`);
  }
  
  console.log('\n🧪 2. マルチホップテスト (WHYPE → UETH → UBTC)\n');
  
  try {
    const quoterContract = new ethers.Contract(quoterV2Address, quoterV2ABI, provider);
    
    // マルチホップパス: WHYPE → UETH → UBTC
    const multiPath = encodePath([tokens.WHYPE, tokens.UETH, tokens.UBTC], [3000, 3000]);
    console.log(`Path: ${multiPath}`);
    
    const multiResult = await quoterContract.callStatic.quoteExactInput(multiPath, amount);
    
    console.log(`✅ マルチホップ成功!`);
    console.log(`   AmountOut: ${multiResult[0].toString()}`);
    console.log(`   📊 Price: ${ethers.utils.formatUnits(multiResult[0], 8)} UBTC per WHYPE (via UETH)`);
    console.log(`   Gas Estimate: ${multiResult[3].toString()}`);
    
  } catch (error) {
    console.log(`❌ マルチホップ失敗: ${error.message.substring(0, 100)}...`);
  }
  
  console.log('\n🧪 3. 異なるfee tierでのテスト\n');
  
  const feeTiers = [500, 3000, 10000];
  
  for (const fee of feeTiers) {
    try {
      const quoterContract = new ethers.Contract(quoterV2Address, quoterV2ABI, provider);
      
      const path = encodePath([tokens.WHYPE, tokens.UBTC], [fee]);
      const result = await quoterContract.callStatic.quoteExactInput(path, amount);
      
      console.log(`✅ ${fee}bps: ${ethers.utils.formatUnits(result[0], 8)} UBTC per WHYPE`);
      
    } catch (error) {
      console.log(`❌ ${fee}bps: ${error.message.substring(0, 50)}...`);
    }
  }
  
  console.log('\n🔍 4. QuoterV2の他の可能な関数を探索\n');
  
  // 他の可能な関数名でテスト
  const alternativeMethods = [
    'quoteExactInputSingle',
    'getQuoteExactInputSingle', 
    'quoteSingle',
    'quote',
    'getAmountOut'
  ];
  
  for (const methodName of alternativeMethods) {
    try {
      // 基本的な関数シグネチャでテスト
      const testABI = [{
        "name": methodName,
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
      
      const contract = new ethers.Contract(quoterV2Address, testABI, provider);
      const result = await contract.callStatic[methodName](
        tokens.WHYPE, tokens.UBTC, 3000, amount, 0
      );
      
      console.log(`✅ ${methodName}: ${result.toString()}`);
      console.log(`   📊 Price: ${ethers.utils.formatUnits(result, 8)} UBTC per WHYPE`);
      
    } catch (error) {
      console.log(`❌ ${methodName}: not found or failed`);
    }
  }
  
  return true;
}

if (require.main === module) {
  testQuoterV2Multihop().catch(console.error);
}

module.exports = { testQuoterV2Multihop };