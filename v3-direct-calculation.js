const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * HyperSwap V3 直接計算アプローチ
 * Quoterが動作しない場合の代替として、Poolから直接価格を算出
 */

async function v3DirectCalculation() {
  console.log('🔍 HyperSwap V3 直接計算アプローチ\n');
  
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463',
  };
  
  // Factory ABI
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
  
  // Pool ABI
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
    },
    {
      "name": "liquidity",
      "type": "function",
      "stateMutability": "view",
      "inputs": [],
      "outputs": [
        { "name": "", "type": "uint128" }
      ]
    },
    {
      "name": "token0",
      "type": "function",
      "stateMutability": "view",
      "inputs": [],
      "outputs": [
        { "name": "", "type": "address" }
      ]
    },
    {
      "name": "token1",
      "type": "function",
      "stateMutability": "view",
      "inputs": [],
      "outputs": [
        { "name": "", "type": "address" }
      ]
    },
    {
      "name": "fee",
      "type": "function",
      "stateMutability": "view",
      "inputs": [],
      "outputs": [
        { "name": "", "type": "uint24" }
      ]
    }
  ];
  
  const factoryAddress = '0xB1c0fa0B789320044A6F623cFe5eBda9562602E3';
  const factoryContract = new ethers.Contract(factoryAddress, factoryABI, provider);
  
  // Get pool address
  const [token0, token1] = tokens.WHYPE.toLowerCase() < tokens.UBTC.toLowerCase() 
    ? [tokens.WHYPE, tokens.UBTC] 
    : [tokens.UBTC, tokens.WHYPE];
  
  const poolAddress = await factoryContract.getPool(token0, token1, 3000);
  console.log(`📍 Pool Address: ${poolAddress}`);
  
  if (poolAddress === '0x0000000000000000000000000000000000000000') {
    console.log('❌ Pool does not exist');
    return;
  }
  
  const poolContract = new ethers.Contract(poolAddress, poolABI, provider);
  
  // Get pool data
  const [slot0, liquidity, poolToken0, poolToken1, poolFee] = await Promise.all([
    poolContract.slot0(),
    poolContract.liquidity(),
    poolContract.token0(),
    poolContract.token1(),
    poolContract.fee()
  ]);
  
  console.log(`📊 Pool Data:`);
  console.log(`   Token0: ${poolToken0}`);
  console.log(`   Token1: ${poolToken1}`);
  console.log(`   Fee: ${poolFee}`);
  console.log(`   sqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
  console.log(`   Tick: ${slot0.tick}`);
  console.log(`   Liquidity: ${liquidity.toString()}`);
  
  // Simplified V3 price calculation using math libraries approach
  function calculateSimplePrice(sqrtPriceX96) {
    // sqrtPriceX96 represents sqrt(price) * 2^96
    // For a simple approximation, we can use JavaScript numbers
    
    const Q96 = Math.pow(2, 96);
    const sqrtPrice = parseFloat(sqrtPriceX96.toString()) / Q96;
    const price = sqrtPrice * sqrtPrice;
    
    return price;
  }
  
  // Token decimals (WHYPE: 18, UBTC: 8)
  const whypeDecimals = 18;
  const ubtcDecimals = 8;
  
  console.log(`\n💰 Current Price Analysis:`);
  console.log(`   sqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
  
  // Calculate the basic price first
  const rawPrice = calculateSimplePrice(slot0.sqrtPriceX96);
  console.log(`   Raw price (token1/token0): ${rawPrice}`);
  
  // Calculate what 1 WHYPE would get in UBTC
  let pricePerWhype;
  
  if (poolToken0.toLowerCase() === tokens.WHYPE.toLowerCase()) {
    // WHYPE is token0, UBTC is token1
    // rawPrice = UBTC/WHYPE (already what we want)
    // Adjust for decimals: WHYPE(18) -> UBTC(8)
    pricePerWhype = rawPrice * Math.pow(10, ubtcDecimals - whypeDecimals);
  } else {
    // WHYPE is token1, UBTC is token0
    // rawPrice = WHYPE/UBTC, we want UBTC/WHYPE = 1/rawPrice
    // Adjust for decimals: WHYPE(18) -> UBTC(8)
    pricePerWhype = (1 / rawPrice) * Math.pow(10, ubtcDecimals - whypeDecimals);
  }
  
  console.log(`   Price per WHYPE: ${pricePerWhype} UBTC`);
  
  // Convert to BigNumber for consistent output
  let amountOut;
  try {
    // Handle very small numbers by using scientific notation
    if (pricePerWhype < 1e-10) {
      console.log(`   ⚠️  Price too small: ${pricePerWhype.toExponential()}`);
      amountOut = ethers.BigNumber.from('0');
    } else {
      // Round to avoid precision issues
      const roundedPrice = Math.round(pricePerWhype * Math.pow(10, ubtcDecimals)) / Math.pow(10, ubtcDecimals);
      amountOut = ethers.utils.parseUnits(roundedPrice.toFixed(ubtcDecimals), ubtcDecimals);
    }
  } catch (error) {
    console.log(`   ❌ Error converting price: ${error.message}`);
    amountOut = ethers.BigNumber.from('0');
  }
  
  console.log(`   1 WHYPE = ${ethers.utils.formatUnits(amountOut, ubtcDecimals)} UBTC`);
  console.log(`   Price per WHYPE: ${ethers.utils.formatUnits(amountOut, ubtcDecimals)} UBTC`);
  
  // Test with different amounts
  const testAmounts = ['0.1', '1', '10'];
  
  console.log(`\n🔍 Quote Simulation:`);
  for (const amount of testAmounts) {
    const amountIn = ethers.utils.parseEther(amount);
    const estimatedOut = amountIn.mul(amountOut).div(oneWhype);
    
    console.log(`   ${amount} WHYPE → ${ethers.utils.formatUnits(estimatedOut, ubtcDecimals)} UBTC`);
  }
  
  return {
    poolAddress,
    sqrtPriceX96: slot0.sqrtPriceX96.toString(),
    tick: slot0.tick,
    liquidity: liquidity.toString(),
    pricePerWhype: ethers.utils.formatUnits(amountOut, ubtcDecimals)
  };
}

if (require.main === module) {
  v3DirectCalculation()
    .then(result => {
      console.log('\n✅ Direct calculation completed');
      console.log('Result:', result);
    })
    .catch(error => {
      console.error('❌ Error:', error);
    });
}

module.exports = { v3DirectCalculation };