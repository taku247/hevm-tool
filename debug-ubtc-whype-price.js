const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * UBTC/WHYPE価格の詳細デバッグ
 */

async function debugUbtcWhypePrice() {
  console.log('🔍 UBTC/WHYPE 価格詳細デバッグ\n');
  
  const contracts = {
    quoterV1: '0xF865716B90f09268fF12B6B620e14bEC390B8139',
    quoterV2: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
  };
  
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463'
  };
  
  const tokenInfo = {
    WHYPE: { decimals: 18, symbol: 'WHYPE' },
    UBTC: { decimals: 8, symbol: 'UBTC' }
  };
  
  // QuoterV1 ABI
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
  
  const amount = ethers.utils.parseUnits('1', 8); // 1 UBTC (8 decimals)
  console.log(`📊 投入量: 1 UBTC = ${amount.toString()} (raw)`);
  console.log(`📊 投入量確認: ${ethers.utils.formatUnits(amount, 8)} UBTC\n`);
  
  const v1Contract = new ethers.Contract(contracts.quoterV1, quoterV1ABI, provider);
  
  const feeTiers = [100, 500, 3000, 10000];
  
  for (const fee of feeTiers) {
    console.log(`🔍 ${fee}bps fee tier:`);
    
    try {
      // UBTC → WHYPE
      const result = await v1Contract.callStatic.quoteExactInputSingle(
        tokens.UBTC,  // tokenIn (8 decimals)
        tokens.WHYPE, // tokenOut (18 decimals)
        fee,
        amount,       // 1 UBTC
        0
      );
      
      console.log(`   Raw result: ${result.toString()}`);
      
      // WHYPE は 18 decimals
      const whypeAmount = ethers.utils.formatUnits(result, 18);
      console.log(`   WHYPE amount: ${whypeAmount}`);
      
      // レート計算: 1 UBTC あたり何 WHYPE か
      const rate = parseFloat(whypeAmount);
      console.log(`   レート: 1 UBTC = ${rate.toFixed(6)} WHYPE`);
      
      // 逆算: 1 WHYPE あたり何 UBTC か（UIで表示される値）
      const inverseRate = 1 / rate;
      console.log(`   逆レート: 1 WHYPE = ${inverseRate.toFixed(8)} UBTC`);
      console.log(`   UI想定値との比較: ${inverseRate.toFixed(2)} vs 2756 (期待値)`);
      
    } catch (error) {
      console.log(`   ❌ エラー: ${error.message.substring(0, 100)}...`);
    }
    
    console.log('');
  }
  
  // 逆方向もテスト（WHYPE → UBTC）
  console.log('🔄 逆方向テスト (WHYPE → UBTC)\n');
  
  const whypeAmount = ethers.utils.parseEther('1'); // 1 WHYPE
  console.log(`📊 投入量: 1 WHYPE = ${whypeAmount.toString()} (raw)`);
  
  for (const fee of feeTiers) {
    console.log(`🔍 ${fee}bps fee tier:`);
    
    try {
      const result = await v1Contract.callStatic.quoteExactInputSingle(
        tokens.WHYPE, // tokenIn (18 decimals)
        tokens.UBTC,  // tokenOut (8 decimals)
        fee,
        whypeAmount,  // 1 WHYPE
        0
      );
      
      console.log(`   Raw result: ${result.toString()}`);
      
      // UBTC は 8 decimals
      const ubtcAmount = ethers.utils.formatUnits(result, 8);
      console.log(`   UBTC amount: ${ubtcAmount}`);
      
      // レート: 1 WHYPE あたり何 UBTC か
      const rate = parseFloat(ubtcAmount);
      console.log(`   レート: 1 WHYPE = ${rate.toFixed(8)} UBTC`);
      console.log(`   UI期待値との比較: ${rate.toFixed(8)} vs ~0.00036 (期待値)`);
      
    } catch (error) {
      console.log(`   ❌ エラー: ${error.message.substring(0, 100)}...`);
    }
    
    console.log('');
  }
  
  console.log('💡 分析:');
  console.log('前回のスクリプトでは WHYPE (18 decimals) を UBTC (8 decimals) として');
  console.log('フォーマットしていた可能性があります。');
  console.log('正しくは UBTC=8decimals, WHYPE=18decimals で計算する必要があります。');
}

if (require.main === module) {
  debugUbtcWhypePrice().catch(console.error);
}

module.exports = { debugUbtcWhypePrice };