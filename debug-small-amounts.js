const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * 小額投入でのBUDDY価格テスト
 */

async function debugSmallAmounts() {
  console.log('🔍 小額投入での BUDDY 価格テスト\n');
  
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
  
  // 複数の投入量でテスト
  const testAmounts = [
    { amount: ethers.utils.parseEther('0.001'), desc: '0.001 BUDDY' },
    { amount: ethers.utils.parseEther('0.01'), desc: '0.01 BUDDY' },
    { amount: ethers.utils.parseEther('0.1'), desc: '0.1 BUDDY' },
    { amount: ethers.utils.parseEther('1'), desc: '1 BUDDY' },
  ];
  
  console.log('📊 BUDDY → WHYPE（異なる投入量）\n');
  
  for (const testAmount of testAmounts) {
    console.log(`🔍 投入量: ${testAmount.desc}`);
    
    for (const fee of [500, 3000, 10000]) {
      try {
        const result = await v1Contract.callStatic.quoteExactInputSingle(
          tokens.BUDDY,
          tokens.WHYPE,
          fee,
          testAmount.amount,
          0
        );
        
        const whypeReceived = parseFloat(ethers.utils.formatEther(result));
        const buddyInput = parseFloat(ethers.utils.formatEther(testAmount.amount));
        const rate = whypeReceived / buddyInput; // 1 BUDDY あたりの WHYPE
        
        console.log(`   ${fee}bps: ${rate.toFixed(6)} WHYPE per BUDDY`);
        
      } catch (error) {
        console.log(`   ${fee}bps: ❌ 失敗`);
      }
    }
    console.log('');
  }
  
  console.log('📊 WHYPE → BUDDY（逆方向、小額）\n');
  
  const whypeTestAmounts = [
    { amount: ethers.utils.parseEther('1'), desc: '1 WHYPE' },
    { amount: ethers.utils.parseEther('10'), desc: '10 WHYPE' },
    { amount: ethers.utils.parseEther('100'), desc: '100 WHYPE' },
  ];
  
  for (const testAmount of whypeTestAmounts) {
    console.log(`🔍 投入量: ${testAmount.desc}`);
    
    for (const fee of [500, 3000, 10000]) {
      try {
        const result = await v1Contract.callStatic.quoteExactInputSingle(
          tokens.WHYPE,
          tokens.BUDDY,
          fee,
          testAmount.amount,
          0
        );
        
        const buddyReceived = parseFloat(ethers.utils.formatEther(result));
        const whypeInput = parseFloat(ethers.utils.formatEther(testAmount.amount));
        const rate = buddyReceived / whypeInput; // 1 WHYPE あたりの BUDDY
        
        console.log(`   ${fee}bps: ${rate.toFixed(9)} BUDDY per WHYPE`);
        console.log(`   逆算: ${(1/rate).toFixed(6)} WHYPE per BUDDY`);
        
      } catch (error) {
        console.log(`   ${fee}bps: ❌ 失敗`);
      }
    }
    console.log('');
  }
  
  console.log('💡 UIとの比較:');
  console.log('UI期待値: 1 BUDDY = 0.000324 WHYPE (500bps)');
  console.log('');
  console.log('📋 分析:');
  console.log('- 投入量による価格変動をチェック');
  console.log('- 流動性の少ないプールでは大きな価格影響あり');
  console.log('- UIが表示している値が実際の取引可能価格か確認必要');
}

if (require.main === module) {
  debugSmallAmounts().catch(console.error);
}

module.exports = { debugSmallAmounts };