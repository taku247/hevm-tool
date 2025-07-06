const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

async function testAlternativeQuoter() {
  console.log('🔍 Alternative Quoter Test\n');
  
  // Alternative quoter addresses to try
  const possibleQuoters = [
    '0x03A918028f22D9E1473B7959C927AD7425A45C7C', // Original
    '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a', // Alternative 1
    '0x5EFE1e9B6B0E4d0A0B5c0f05E5d4b9e4f5a4B3E4', // Alternative 2
  ];
  
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463',
  };
  
  const amount = ethers.utils.parseEther('1').toString();
  
  // Test different function signatures
  const testFunctions = [
    {
      name: 'quoteExactInputSingle (individual args)',
      abi: [{
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
      args: [tokens.WHYPE, tokens.UBTC, 3000, amount, 0]
    },
    {
      name: 'quoteExactInputSingle (struct)',
      abi: [{
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
      args: [{
        tokenIn: tokens.WHYPE,
        tokenOut: tokens.UBTC,
        fee: 3000,
        amountIn: amount,
        sqrtPriceLimitX96: 0
      }]
    },
    {
      name: 'getAmountOut (like V2)',
      abi: [{
        "name": "getAmountOut",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
          { "name": "amountIn", "type": "uint256" },
          { "name": "tokenIn", "type": "address" },
          { "name": "tokenOut", "type": "address" },
          { "name": "fee", "type": "uint24" }
        ],
        "outputs": [
          { "name": "amountOut", "type": "uint256" }
        ]
      }],
      args: [amount, tokens.WHYPE, tokens.UBTC, 3000]
    }
  ];
  
  // Test each quoter address with each function
  for (const quoterAddress of possibleQuoters) {
    console.log(`\n📍 Testing quoter: ${quoterAddress}`);
    
    try {
      const code = await provider.getCode(quoterAddress);
      if (code === '0x') {
        console.log('   ❌ No code at this address');
        continue;
      }
      
      console.log('   ✅ Code exists');
      
      for (const testFunc of testFunctions) {
        console.log(`   🔍 Testing: ${testFunc.name}`);
        
        try {
          const contract = new ethers.Contract(quoterAddress, testFunc.abi, provider);
          const result = await contract.callStatic.quoteExactInputSingle(...testFunc.args);
          
          console.log(`      ✅ Success: ${result.toString()}`);
          
          // If it's an array result, log each element
          if (Array.isArray(result)) {
            result.forEach((value, index) => {
              console.log(`         [${index}]: ${value.toString()}`);
            });
          }
          
        } catch (error) {
          console.log(`      ❌ Failed: ${error.message.substring(0, 60)}...`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Error checking address: ${error.message}`);
    }
  }
}

testAlternativeQuoter().catch(console.error);