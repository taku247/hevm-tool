const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * HyperSwap V3 Quoterのメソッドを詳細調査
 */

async function debugQuoterMethods() {
  console.log('🔍 HyperSwap V3 Quoter詳細調査\n');
  
  const quoterAddress = '0x03A918028f22D9E1473B7959C927AD7425A45C7C';
  
  // 様々なメソッド名パターンを試す
  const methodPatterns = [
    // Standard Uniswap V3 patterns
    'quoteExactInputSingle',
    'quoteExactInput',
    'quoteExactOutputSingle',
    'quoteExactOutput',
    
    // Alternative naming patterns
    'getAmountOut',
    'getAmountsOut',
    'quote',
    'getQuote',
    'estimateAmountOut',
    'calculateAmountOut',
    
    // HyperSwap specific
    'hyperQuote',
    'exactInputSingleQuote',
    'swapQuote',
    'priceQuote',
    
    // Simplified patterns
    'exactInput',
    'exactOutput',
    'singleQuote',
    
    // Factory pattern
    'factory',
    'WETH9',
    'uniswapV3SwapCallback'
  ];
  
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463'
  };
  
  const amount = ethers.utils.parseEther('1').toString();
  
  // Test each method pattern with different ABIs
  for (const methodName of methodPatterns) {
    console.log(`🔍 Testing method: ${methodName}`);
    
    // Try different function signatures
    const signatures = [
      // No arguments (for discovery)
      {
        name: methodName,
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }]
      },
      // Single argument
      {
        name: methodName,
        type: "function", 
        stateMutability: "view",
        inputs: [{ name: "amount", type: "uint256" }],
        outputs: [{ name: "", type: "uint256" }]
      },
      // Two arguments
      {
        name: methodName,
        type: "function",
        stateMutability: "view", 
        inputs: [
          { name: "tokenA", type: "address" },
          { name: "tokenB", type: "address" }
        ],
        outputs: [{ name: "", type: "uint256" }]
      },
      // Three arguments
      {
        name: methodName,
        type: "function",
        stateMutability: "view",
        inputs: [
          { name: "amountIn", type: "uint256" },
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" }
        ],
        outputs: [{ name: "", type: "uint256" }]
      },
      // Four arguments
      {
        name: methodName,
        type: "function",
        stateMutability: "view",
        inputs: [
          { name: "amountIn", type: "uint256" },
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" }
        ],
        outputs: [{ name: "", type: "uint256" }]
      },
      // Five arguments (standard)
      {
        name: methodName,
        type: "function",
        stateMutability: "view",
        inputs: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "amountIn", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" }
        ],
        outputs: [{ name: "amountOut", type: "uint256" }]
      }
    ];
    
    for (let i = 0; i < signatures.length; i++) {
      try {
        const contract = new ethers.Contract(quoterAddress, [signatures[i]], provider);
        
        let result;
        const inputs = signatures[i].inputs;
        
        if (inputs.length === 0) {
          result = await contract.callStatic[methodName]();
        } else if (inputs.length === 1) {
          result = await contract.callStatic[methodName](amount);
        } else if (inputs.length === 2) {
          result = await contract.callStatic[methodName](tokens.WHYPE, tokens.UBTC);
        } else if (inputs.length === 3) {
          result = await contract.callStatic[methodName](amount, tokens.WHYPE, tokens.UBTC);
        } else if (inputs.length === 4) {
          result = await contract.callStatic[methodName](amount, tokens.WHYPE, tokens.UBTC, 3000);
        } else if (inputs.length === 5) {
          result = await contract.callStatic[methodName](tokens.WHYPE, tokens.UBTC, 3000, amount, 0);
        }
        
        console.log(`  ✅ ${methodName}(${inputs.length} args): ${result.toString()}`);
        
        // If we found a working method, test it more thoroughly
        if (methodName !== 'factory' && methodName !== 'WETH9') {
          console.log(`  🎯 Found working method: ${methodName} with ${inputs.length} arguments`);
          console.log(`     Signature: ${JSON.stringify(signatures[i], null, 2)}`);
        }
        
      } catch (error) {
        // Silent continue for non-existent methods
        continue;
      }
    }
  }
}

debugQuoterMethods().catch(console.error);