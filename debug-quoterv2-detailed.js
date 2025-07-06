const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * QuoterV2詳細分析 - HyperSwap固有実装を特定
 */

async function debugQuoterV2() {
  console.log('🔍 HyperSwap V3 QuoterV2 詳細分析\n');
  
  const quoterV2Address = '0x03A918028f22D9E1473B7959C927AD7425A45C7C';
  const quoterV1Address = '0xF865716B90f09268fF12B6B620e14bEC390B8139'; // 動作確認済み
  
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463'
  };
  
  const amount = ethers.utils.parseEther('1').toString();
  
  // V1 (動作確認済み) のABI
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
  
  // V2用に試す様々なABIパターン
  const quoterV2Patterns = {
    // 標準的なUniswap V3 QuoterV2 (tuple)
    standardV2: [{
      "name": "quoteExactInputSingle",
      "type": "function",
      "stateMutability": "payable",
      "inputs": [{
        "components": [
          { "name": "tokenIn", "type": "address" },
          { "name": "tokenOut", "type": "address" },
          { "name": "fee", "type": "uint24" },
          { "name": "amountIn", "type": "uint256" },
          { "name": "sqrtPriceLimitX96", "type": "uint160" }
        ],
        "internalType": "struct IQuoterV2.QuoteExactInputSingleParams",
        "name": "params",
        "type": "tuple"
      }],
      "outputs": [
        { "name": "amountOut", "type": "uint256" },
        { "name": "sqrtPriceX96After", "type": "uint160" },
        { "name": "initializedTicksCrossed", "type": "uint32" },
        { "name": "gasEstimate", "type": "uint256" }
      ]
    }],
    
    // View stateMutability版
    standardV2View: [{
      "name": "quoteExactInputSingle",
      "type": "function",
      "stateMutability": "view",
      "inputs": [{
        "components": [
          { "name": "tokenIn", "type": "address" },
          { "name": "tokenOut", "type": "address" },
          { "name": "fee", "type": "uint24" },
          { "name": "amountIn", "type": "uint256" },
          { "name": "sqrtPriceLimitX96", "type": "uint160" }
        ],
        "internalType": "struct IQuoterV2.QuoteExactInputSingleParams",
        "name": "params",
        "type": "tuple"
      }],
      "outputs": [
        { "name": "amountOut", "type": "uint256" },
        { "name": "sqrtPriceX96After", "type": "uint160" },
        { "name": "initializedTicksCrossed", "type": "uint32" },
        { "name": "gasEstimate", "type": "uint256" }
      ]
    }],
    
    // HyperSwap固有の可能性1: 個別引数だが複数出力
    hyperswapIndividual: [{
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
        { "name": "amountOut", "type": "uint256" },
        { "name": "sqrtPriceX96After", "type": "uint160" },
        { "name": "initializedTicksCrossed", "type": "uint32" },
        { "name": "gasEstimate", "type": "uint256" }
      ]
    }],
    
    // HyperSwap固有の可能性2: 異なるstruct名
    hyperswapCustomStruct: [{
      "name": "quoteExactInputSingle",
      "type": "function",
      "stateMutability": "payable",
      "inputs": [{
        "components": [
          { "name": "tokenIn", "type": "address" },
          { "name": "tokenOut", "type": "address" },
          { "name": "fee", "type": "uint24" },
          { "name": "amountIn", "type": "uint256" },
          { "name": "sqrtPriceLimitX96", "type": "uint160" }
        ],
        "internalType": "struct QuoteExactInputSingleParams",
        "name": "params",
        "type": "tuple"
      }],
      "outputs": [
        { "name": "amountOut", "type": "uint256" },
        { "name": "sqrtPriceX96After", "type": "uint160" },
        { "name": "initializedTicksCrossed", "type": "uint32" },
        { "name": "gasEstimate", "type": "uint256" }
      ]
    }],
    
    // 異なるメソッド名の可能性
    alternativeMethodName: [{
      "name": "getQuoteExactInputSingle",
      "type": "function",
      "stateMutability": "view",
      "inputs": [{
        "components": [
          { "name": "tokenIn", "type": "address" },
          { "name": "tokenOut", "type": "address" },
          { "name": "fee", "type": "uint24" },
          { "name": "amountIn", "type": "uint256" },
          { "name": "sqrtPriceLimitX96", "type": "uint160" }
        ],
        "internalType": "struct IQuoterV2.QuoteExactInputSingleParams",
        "name": "params",
        "type": "tuple"
      }],
      "outputs": [
        { "name": "amountOut", "type": "uint256" },
        { "name": "sqrtPriceX96After", "type": "uint160" },
        { "name": "initializedTicksCrossed", "type": "uint32" },
        { "name": "gasEstimate", "type": "uint256" }
      ]
    }],
    
    // 引数順序が異なる可能性
    differentOrder: [{
      "name": "quoteExactInputSingle",
      "type": "function",
      "stateMutability": "payable",
      "inputs": [{
        "components": [
          { "name": "amountIn", "type": "uint256" },
          { "name": "tokenIn", "type": "address" },
          { "name": "tokenOut", "type": "address" },
          { "name": "fee", "type": "uint24" },
          { "name": "sqrtPriceLimitX96", "type": "uint160" }
        ],
        "internalType": "struct IQuoterV2.QuoteExactInputSingleParams",
        "name": "params",
        "type": "tuple"
      }],
      "outputs": [
        { "name": "amountOut", "type": "uint256" },
        { "name": "sqrtPriceX96After", "type": "uint160" },
        { "name": "initializedTicksCrossed", "type": "uint32" },
        { "name": "gasEstimate", "type": "uint256" }
      ]
    }]
  };
  
  console.log('🔍 V1での動作確認（ベースライン）\n');
  
  try {
    const v1Contract = new ethers.Contract(quoterV1Address, quoterV1ABI, provider);
    const v1Result = await v1Contract.callStatic.quoteExactInputSingle(
      tokens.WHYPE, tokens.UBTC, 3000, amount, 0
    );
    
    console.log(`✅ V1成功: ${v1Result.toString()}`);
    console.log(`📊 V1価格: ${ethers.utils.formatUnits(v1Result, 8)} UBTC per WHYPE\n`);
    
  } catch (error) {
    console.log(`❌ V1エラー（予期しない）: ${error.message}\n`);
  }
  
  console.log('🔍 V2での様々なパターンテスト\n');
  
  for (const [patternName, abi] of Object.entries(quoterV2Patterns)) {
    console.log(`🧪 Testing pattern: ${patternName}`);
    
    try {
      const v2Contract = new ethers.Contract(quoterV2Address, abi, provider);
      
      let result;
      const methodName = abi[0].name;
      
      if (patternName === 'hyperswapIndividual') {
        // 個別引数パターン
        result = await v2Contract.callStatic[methodName](
          tokens.WHYPE, tokens.UBTC, 3000, amount, 0
        );
      } else if (patternName === 'differentOrder') {
        // 引数順序違いパターン
        result = await v2Contract.callStatic[methodName]({
          amountIn: amount,
          tokenIn: tokens.WHYPE,
          tokenOut: tokens.UBTC,
          fee: 3000,
          sqrtPriceLimitX96: 0
        });
      } else {
        // 標準tupleパターン
        result = await v2Contract.callStatic[methodName]({
          tokenIn: tokens.WHYPE,
          tokenOut: tokens.UBTC,
          fee: 3000,
          amountIn: amount,
          sqrtPriceLimitX96: 0
        });
      }
      
      console.log(`   ✅ 成功: ${JSON.stringify(result)}`);
      
      // amountOutを抽出
      const amountOut = Array.isArray(result) ? result[0] : result.amountOut || result;
      console.log(`   📊 価格: ${ethers.utils.formatUnits(amountOut, 8)} UBTC per WHYPE`);
      console.log(`   🎯 このパターンが動作します！`);
      
      return {
        success: true,
        pattern: patternName,
        abi: abi,
        result: result,
        amountOut: amountOut.toString()
      };
      
    } catch (error) {
      console.log(`   ❌ 失敗: ${error.message.substring(0, 100)}...`);
    }
    
    console.log('');
  }
  
  console.log('🔍 追加: QuoterV2のメソッド存在確認\n');
  
  // 基本メソッドの存在確認
  const basicMethods = ['factory', 'WETH9', 'uniswapV3SwapCallback'];
  
  for (const methodName of basicMethods) {
    try {
      const basicABI = [{
        "name": methodName,
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{ "name": "", "type": "address" }]
      }];
      
      const contract = new ethers.Contract(quoterV2Address, basicABI, provider);
      const result = await contract.callStatic[methodName]();
      
      console.log(`✅ ${methodName}: ${result}`);
      
    } catch (error) {
      console.log(`❌ ${methodName}: method not found`);
    }
  }
  
  return { success: false, reason: 'no_working_pattern_found' };
}

if (require.main === module) {
  debugQuoterV2()
    .then(result => {
      if (result.success) {
        console.log(`\n🎉 QuoterV2の動作パターンを発見: ${result.pattern}`);
      } else {
        console.log('\n❌ QuoterV2の動作パターンが見つかりませんでした');
      }
    })
    .catch(console.error);
}

module.exports = { debugQuoterV2 };