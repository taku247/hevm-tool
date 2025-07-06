const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * QuoterV1のquoteExactInputテスト
 */

async function testQuoterV1ExactInput() {
  console.log('🔍 QuoterV1 quoteExactInput テスト\n');
  
  const quoterV1Address = '0xF865716B90f09268fF12B6B620e14bEC390B8139';
  
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463',
    UETH: '0xBe6727B535545C67d5cAa73dEa54865B92CF7907'
  };
  
  const amount = ethers.utils.parseEther('1').toString();
  
  // QuoterV1のquoteExactInput ABI（マルチホップ用）
  const quoterV1MultiABI = [{
    "name": "quoteExactInput",
    "type": "function",
    "stateMutability": "view",
    "inputs": [
      { "name": "path", "type": "bytes" },
      { "name": "amountIn", "type": "uint256" }
    ],
    "outputs": [
      { "name": "amountOut", "type": "uint256" }
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
  
  console.log('🧪 1. QuoterV1 quoteExactInput（マルチホップ）テスト\n');
  
  const quoterContract = new ethers.Contract(quoterV1Address, quoterV1MultiABI, provider);
  
  // シングルホップテスト
  console.log('📍 シングルホップ (WHYPE → UBTC, 3000bps)');
  try {
    const singlePath = encodePath([tokens.WHYPE, tokens.UBTC], [3000]);
    const singleResult = await quoterContract.callStatic.quoteExactInput(singlePath, amount);
    
    console.log(`✅ 成功!`);
    console.log(`   AmountOut: ${singleResult.toString()}`);
    console.log(`   Price: ${ethers.utils.formatUnits(singleResult, 8)} UBTC per WHYPE`);
    
  } catch (error) {
    console.log(`❌ 失敗: ${error.message.substring(0, 100)}...`);
  }
  
  // マルチホップテスト
  console.log('\n📍 マルチホップ (WHYPE → UETH → UBTC)');
  try {
    const multiPath = encodePath(
      [tokens.WHYPE, tokens.UETH, tokens.UBTC],
      [3000, 3000]
    );
    const multiResult = await quoterContract.callStatic.quoteExactInput(multiPath, amount);
    
    console.log(`✅ 成功!`);
    console.log(`   AmountOut: ${multiResult.toString()}`);
    console.log(`   Price: ${ethers.utils.formatUnits(multiResult, 8)} UBTC per WHYPE`);
    
  } catch (error) {
    console.log(`❌ 失敗: ${error.message.substring(0, 100)}...`);
  }
  
  // バイトコード分析
  console.log('\n🔍 2. バイトコード分析\n');
  
  const bytecode = await provider.getCode(quoterV1Address);
  console.log(`Contract size: ${bytecode.length / 2} bytes`);
  
  // 関数セレクタの計算
  const selectors = {
    'quoteExactInput(bytes,uint256)': ethers.utils.id('quoteExactInput(bytes,uint256)').substring(0, 10),
    'quoteExactInputSingle(address,address,uint24,uint256,uint160)': ethers.utils.id('quoteExactInputSingle(address,address,uint24,uint256,uint160)').substring(0, 10)
  };
  
  console.log('📝 関数セレクタ:');
  for (const [sig, selector] of Object.entries(selectors)) {
    const found = bytecode.includes(selector.substring(2));
    console.log(`   ${found ? '✅' : '❌'} ${selector}: ${sig}`);
  }
  
  // 既知の動作する関数でV1/V2比較
  console.log('\n📊 3. V1 quoteExactInputSingle vs quoteExactInput 価格比較\n');
  
  const quoterV1SingleABI = [{
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
  
  try {
    // quoteExactInputSingle（既知の動作）
    const v1SingleContract = new ethers.Contract(quoterV1Address, quoterV1SingleABI, provider);
    const singleResult = await v1SingleContract.callStatic.quoteExactInputSingle(
      tokens.WHYPE, tokens.UBTC, 3000, amount, 0
    );
    
    console.log(`✅ quoteExactInputSingle: ${ethers.utils.formatUnits(singleResult, 8)} UBTC`);
    
    // quoteExactInput（テスト対象）
    try {
      const path = encodePath([tokens.WHYPE, tokens.UBTC], [3000]);
      const multiResult = await quoterContract.callStatic.quoteExactInput(path, amount);
      console.log(`✅ quoteExactInput: ${ethers.utils.formatUnits(multiResult, 8)} UBTC`);
      
      const diff = Math.abs(parseFloat(singleResult.toString()) - parseFloat(multiResult.toString()));
      if (diff === 0) {
        console.log(`🎯 完全一致！`);
      }
    } catch (e) {
      console.log(`❌ quoteExactInput: 未実装または失敗`);
    }
    
  } catch (error) {
    console.log(`エラー: ${error.message}`);
  }
  
  console.log('\n💡 結論:');
  console.log('QuoterV1のquoteExactInput実装状況を確認中...');
  
  return true;
}

if (require.main === module) {
  testQuoterV1ExactInput().catch(console.error);
}

module.exports = { testQuoterV1ExactInput };