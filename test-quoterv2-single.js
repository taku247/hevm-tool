const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * QuoterV2のquoteExactInputSingleテスト
 */

async function testQuoterV2Single() {
  console.log('🔍 QuoterV2 quoteExactInputSingle テスト\n');
  
  const quoterV2Address = '0x03A918028f22D9E1473B7959C927AD7425A45C7C';
  
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463'
  };
  
  const amount = ethers.utils.parseEther('1').toString();
  
  // UniswapのQuoterV2準拠のquoteExactInputSingle ABI
  const quoterV2SingleABI = [{
    "name": "quoteExactInputSingle",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{
      "components": [
        { "name": "tokenIn", "type": "address" },
        { "name": "tokenOut", "type": "address" },
        { "name": "amountIn", "type": "uint256" },
        { "name": "fee", "type": "uint24" },
        { "name": "sqrtPriceLimitX96", "type": "uint160" }
      ],
      "name": "params",
      "type": "tuple"
    }],
    "outputs": [
      { "name": "amountOut", "type": "uint256" },
      { "name": "sqrtPriceX96After", "type": "uint160" },
      { "name": "initializedTicksCrossed", "type": "uint32" },
      { "name": "gasEstimate", "type": "uint256" }
    ]
  }];
  
  console.log('🧪 1. QuoterV2 quoteExactInputSingle (Struct形式) テスト\n');
  
  const feeTiers = [500, 3000, 10000];
  
  for (const fee of feeTiers) {
    try {
      const quoterContract = new ethers.Contract(quoterV2Address, quoterV2SingleABI, provider);
      
      const params = {
        tokenIn: tokens.WHYPE,
        tokenOut: tokens.UBTC,
        amountIn: amount,
        fee: fee,
        sqrtPriceLimitX96: 0
      };
      
      console.log(`📍 ${fee}bps テスト中...`);
      const result = await quoterContract.callStatic.quoteExactInputSingle(params);
      
      console.log(`✅ 成功!`);
      console.log(`   AmountOut: ${result.amountOut.toString()}`);
      console.log(`   Price: ${ethers.utils.formatUnits(result.amountOut, 8)} UBTC per WHYPE`);
      console.log(`   sqrtPriceX96After: ${result.sqrtPriceX96After.toString()}`);
      console.log(`   initializedTicksCrossed: ${result.initializedTicksCrossed}`);
      console.log(`   Gas Estimate: ${result.gasEstimate.toString()}`);
      
    } catch (error) {
      console.log(`❌ 失敗: ${error.message.substring(0, 100)}...`);
      
      // 別の形式も試す（非Struct形式）
      console.log(`   🔄 非Struct形式で再試行...`);
      try {
        const alternativeABI = [{
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
        
        const altContract = new ethers.Contract(quoterV2Address, alternativeABI, provider);
        const altResult = await altContract.callStatic.quoteExactInputSingle(
          tokens.WHYPE, tokens.UBTC, fee, amount, 0
        );
        
        console.log(`   ✅ 非Struct形式で成功: ${ethers.utils.formatUnits(altResult, 8)} UBTC`);
        
      } catch (altError) {
        console.log(`   ❌ 非Struct形式も失敗`);
      }
    }
    console.log('');
  }
  
  // バイトコードから関数セレクタを確認
  console.log('\n🔍 2. バイトコード分析\n');
  
  const bytecode = await provider.getCode(quoterV2Address);
  console.log(`Contract size: ${bytecode.length / 2} bytes`);
  
  // 関数セレクタの計算
  const selectors = {
    'quoteExactInputSingle((address,address,uint256,uint24,uint160))': ethers.utils.id('quoteExactInputSingle((address,address,uint256,uint24,uint160))').substring(0, 10),
    'quoteExactInputSingle(address,address,uint24,uint256,uint160)': ethers.utils.id('quoteExactInputSingle(address,address,uint24,uint256,uint160)').substring(0, 10),
    'quoteExactInput(bytes,uint256)': ethers.utils.id('quoteExactInput(bytes,uint256)').substring(0, 10)
  };
  
  console.log('📝 関数セレクタ:');
  for (const [sig, selector] of Object.entries(selectors)) {
    const found = bytecode.includes(selector.substring(2));
    console.log(`   ${found ? '✅' : '❌'} ${selector}: ${sig}`);
  }
  
  console.log('\n💡 結論:');
  console.log('HyperSwapのQuoterV2実装を確認中...');
  
  return true;
}

if (require.main === module) {
  testQuoterV2Single().catch(console.error);
}

module.exports = { testQuoterV2Single };