const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * Raw値から価格計算の検証
 */

async function checkRawValues() {
  console.log('🔍 Raw値検証\n');
  
  const quoterV1Address = '0xF865716B90f09268fF12B6B620e14bEC390B8139';
  
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463'
  };
  
  const quoterV1ABI = [{
    name: "quoteExactInputSingle",
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
  }];
  
  const v1Contract = new ethers.Contract(quoterV1Address, quoterV1ABI, provider);
  const amount = ethers.utils.parseEther('1'); // 1 ETH = 10^18
  
  console.log(`📊 投入量: ${amount.toString()} (1 ETH worth)`);
  console.log(`📊 UBTC decimals: 8`);
  console.log(`📊 WHYPE decimals: 18\n`);
  
  // UBTC → WHYPE（スクリプトで異常値が出るパターン）
  console.log('🔍 UBTC → WHYPE (異常値パターン)');
  
  try {
    const result = await v1Contract.callStatic.quoteExactInputSingle(
      tokens.UBTC,
      tokens.WHYPE,
      3000,
      amount, // 1 ETH worth (10^18) を UBTC として投入（これが問題の可能性）
      0
    );
    
    console.log(`Raw result: ${result.toString()}`);
    console.log(`Format as WHYPE (18 decimals): ${ethers.utils.formatUnits(result, 18)}`);
    console.log(`Format as UBTC (8 decimals): ${ethers.utils.formatUnits(result, 8)}`);
    
  } catch (error) {
    console.log(`エラー: ${error.message}`);
  }
  
  console.log('\n🔍 正しい投入量での UBTC → WHYPE');
  
  const correctUbtcAmount = ethers.utils.parseUnits('1', 8); // 1 UBTC = 10^8
  console.log(`正しいUBTC投入量: ${correctUbtcAmount.toString()}`);
  
  try {
    const result = await v1Contract.callStatic.quoteExactInputSingle(
      tokens.UBTC,
      tokens.WHYPE,
      3000,
      correctUbtcAmount, // 正しい 1 UBTC
      0
    );
    
    console.log(`Raw result: ${result.toString()}`);
    console.log(`Format as WHYPE (18 decimals): ${ethers.utils.formatUnits(result, 18)}`);
    console.log(`価格: 1 UBTC = ${ethers.utils.formatUnits(result, 18)} WHYPE`);
    
  } catch (error) {
    console.log(`エラー: ${error.message}`);
  }
}

if (require.main === module) {
  checkRawValues().catch(console.error);
}

module.exports = { checkRawValues };