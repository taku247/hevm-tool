const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * 実際のHyperSwap V3 Quoterを探す
 */

async function findRealQuoter() {
  console.log('🔍 実際のHyperSwap V3 Quoterを探索\n');
  
  // Known addresses to check
  const possibleQuoters = [
    '0x03A918028f22D9E1473B7959C927AD7425A45C7C', // Current quoter
    '0x6D99e7f6747AF2cDbB5164b6DD50e40D4fDe1e77', // SwapRouter02
    '0x6eDA206207c09e5428F281761DdC0D300851fBC8', // Position Manager
  ];
  
  // Also try to derive some common Quoter addresses based on factory
  const factoryAddress = '0xB1c0fa0B789320044A6F623cFe5eBda9562602E3';
  
  // Add some calculated addresses (common patterns)
  const factoryBN = ethers.BigNumber.from(factoryAddress);
  possibleQuoters.push(
    ethers.utils.getAddress('0x' + factoryBN.add(1).toHexString().slice(2).padStart(40, '0')),
    ethers.utils.getAddress('0x' + factoryBN.add(2).toHexString().slice(2).padStart(40, '0')),
    ethers.utils.getAddress('0x' + factoryBN.sub(1).toHexString().slice(2).padStart(40, '0')),
    ethers.utils.getAddress('0x' + factoryBN.sub(2).toHexString().slice(2).padStart(40, '0'))
  );
  
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463'
  };
  
  const amount = ethers.utils.parseEther('0.01').toString(); // Smaller amount for testing
  
  // Standard quoter ABI to test
  const quoterABI = [{
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
  
  // Alternative approach: use SwapRouter for estimation
  const swapRouterABI = [{
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
  }];
  
  console.log('📍 Testing possible Quoter addresses:\n');
  
  for (const quoterAddr of possibleQuoters) {
    console.log(`🔍 Testing: ${quoterAddr}`);
    
    try {
      const code = await provider.getCode(quoterAddr);
      if (code === '0x') {
        console.log('   ❌ No code at address');
        continue;
      }
      
      console.log('   ✅ Code exists');
      
      // Test as Quoter
      try {
        const quoterContract = new ethers.Contract(quoterAddr, quoterABI, provider);
        const result = await quoterContract.callStatic.quoteExactInputSingle(
          tokens.WHYPE, tokens.UBTC, 3000, amount, 0
        );
        
        console.log(`   🎯 QUOTER SUCCESS: ${result.toString()}`);
        console.log(`   📊 Rate: ${ethers.utils.formatUnits(result, 8)} UBTC per 0.01 WHYPE`);
        
        return { 
          address: quoterAddr, 
          type: 'quoter',
          result: result.toString(),
          rate: ethers.utils.formatUnits(result, 8)
        };
        
      } catch (quoterError) {
        console.log(`   ❌ Quoter failed: ${quoterError.message.substring(0, 50)}...`);
      }
      
      // Test as SwapRouter (estimation)
      try {
        const routerContract = new ethers.Contract(quoterAddr, swapRouterABI, provider);
        const result = await routerContract.callStatic.exactInputSingle({
          tokenIn: tokens.WHYPE,
          tokenOut: tokens.UBTC,
          fee: 3000,
          recipient: '0x0000000000000000000000000000000000000000',
          deadline: Math.floor(Date.now() / 1000) + 3600,
          amountIn: amount,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0
        });
        
        console.log(`   🎯 ROUTER SUCCESS: ${result.toString()}`);
        console.log(`   📊 Rate: ${ethers.utils.formatUnits(result, 8)} UBTC per 0.01 WHYPE`);
        
        return { 
          address: quoterAddr, 
          type: 'router',
          result: result.toString(),
          rate: ethers.utils.formatUnits(result, 8)
        };
        
      } catch (routerError) {
        console.log(`   ❌ Router failed: ${routerError.message.substring(0, 50)}...`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message.substring(0, 50)}...`);
    }
    
    console.log('');
  }
  
  console.log('🔄 Trying alternative Quoter patterns...\n');
  
  // Try the original quoter with different patterns
  const originalQuoter = '0x03A918028f22D9E1473B7959C927AD7425A45C7C';
  
  // Try V1 style quoter
  const v1QuoterABI = [{
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
      { "name": "", "type": "uint256" }
    ]
  }];
  
  console.log(`🔍 Testing V1 style on original quoter: ${originalQuoter}`);
  
  try {
    const v1Contract = new ethers.Contract(originalQuoter, v1QuoterABI, provider);
    const result = await v1Contract.callStatic.quoteExactInputSingle(
      tokens.WHYPE, tokens.UBTC, 3000, amount, 0
    );
    
    console.log(`   🎯 V1 SUCCESS: ${result.toString()}`);
    console.log(`   📊 Rate: ${ethers.utils.formatUnits(result, 8)} UBTC per 0.01 WHYPE`);
    
    return { 
      address: originalQuoter, 
      type: 'v1_quoter',
      result: result.toString(),
      rate: ethers.utils.formatUnits(result, 8)
    };
    
  } catch (error) {
    console.log(`   ❌ V1 failed: ${error.message.substring(0, 50)}...`);
  }
  
  console.log('\n❌ No working Quoter found');
  return null;
}

if (require.main === module) {
  findRealQuoter()
    .then(result => {
      if (result) {
        console.log('\n✅ Found working solution:', result);
      } else {
        console.log('\n❌ No working solution found');
      }
    })
    .catch(console.error);
}

module.exports = { findRealQuoter };