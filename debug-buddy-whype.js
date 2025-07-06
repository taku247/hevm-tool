const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * BUDDY/WHYPE価格の詳細デバッグ
 */

async function debugBuddyWhype() {
  console.log('🔍 BUDDY/WHYPE 価格詳細デバッグ\n');
  
  const quoterV1Address = '0xF865716B90f09268fF12B6B620e14bEC390B8139';
  
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    BUDDY: '0x47bb061C0204Af921F43DC73C7D7768d2672DdEE'
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
  
  console.log('📊 WHYPE → BUDDY テスト\n');
  
  const whypeAmount = ethers.utils.parseEther('1'); // 1 WHYPE
  console.log(`投入量: 1 WHYPE = ${whypeAmount.toString()}`);
  
  for (const fee of [100, 500, 3000, 10000]) {
    try {
      const result = await v1Contract.callStatic.quoteExactInputSingle(
        tokens.WHYPE,
        tokens.BUDDY,
        fee,
        whypeAmount,
        0
      );
      
      console.log(`${fee}bps:`);
      console.log(`  Raw result: ${result.toString()}`);
      console.log(`  BUDDY amount: ${ethers.utils.formatEther(result)}`);
      console.log(`  価格: 1 WHYPE = ${ethers.utils.formatEther(result)} BUDDY`);
      
      // 逆算：1 BUDDY = ? WHYPE
      const buddyToWhype = parseFloat(ethers.utils.formatEther(result));
      if (buddyToWhype > 0) {
        console.log(`  逆算: 1 BUDDY = ${(1/buddyToWhype).toFixed(6)} WHYPE`);
      }
      
    } catch (error) {
      console.log(`${fee}bps: ❌ ${error.message.substring(0, 50)}...`);
    }
    console.log('');
  }
  
  console.log('📊 BUDDY → WHYPE テスト（確認用）\n');
  
  const buddyAmount = ethers.utils.parseEther('1'); // 1 BUDDY
  console.log(`投入量: 1 BUDDY = ${buddyAmount.toString()}`);
  
  for (const fee of [500, 3000]) {
    try {
      const result = await v1Contract.callStatic.quoteExactInputSingle(
        tokens.BUDDY,
        tokens.WHYPE,
        fee,
        buddyAmount,
        0
      );
      
      console.log(`${fee}bps:`);
      console.log(`  Raw result: ${result.toString()}`);
      console.log(`  WHYPE amount: ${ethers.utils.formatEther(result)}`);
      console.log(`  価格: 1 BUDDY = ${ethers.utils.formatEther(result)} WHYPE`);
      
    } catch (error) {
      console.log(`${fee}bps: ❌ ${error.message.substring(0, 50)}...`);
    }
    console.log('');
  }
  
  console.log('💡 UI表示との比較:');
  console.log('UI: 1 BUDDY ≈ 0.000324 (USD? WHYPE?)');
  console.log('UIの0.05% = 500bps fee tier');
}

if (require.main === module) {
  debugBuddyWhype().catch(console.error);
}

module.exports = { debugBuddyWhype };