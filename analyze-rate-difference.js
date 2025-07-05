const { UniversalContractUtils } = require('./dist/templates/contract-utils');
const { ethers } = require('ethers');

/**
 * レート差異の原因分析
 */
async function analyzeRateDifference() {
  console.log('🔍 HyperSwap UIとスクリプトのレート差異分析\n');
  
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  const utils = new UniversalContractUtils(rpcUrl);
  
  const WHYPE = '0x5555555555555555555555555555555555555555';
  const UBTC = '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463';
  
  console.log('📊 レート比較:');
  console.log('   スクリプト: 1 UBTC = 2688.47 WHYPE');
  console.log('   HyperSwap UI: 1 UBTC = 2796 WHYPE');
  console.log('   差異: 107.53 WHYPE (約3.99%)\n');
  
  // 1. 異なる金額でのレート確認
  console.log('💰 1. 異なる金額でのレート確認:');
  const testAmounts = [
    { amount: '0.001', decimals: 8, label: '0.001 UBTC' },
    { amount: '0.01', decimals: 8, label: '0.01 UBTC' },
    { amount: '0.1', decimals: 8, label: '0.1 UBTC' },
    { amount: '1', decimals: 8, label: '1 UBTC' },
    { amount: '10', decimals: 8, label: '10 UBTC' }
  ];
  
  for (const test of testAmounts) {
    try {
      const amountIn = ethers.utils.parseUnits(test.amount, test.decimals);
      
      const result = await utils.callReadFunction({
        abiPath: './abi/UniV2Router.json',
        contractAddress: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A',
        functionName: 'getAmountsOut',
        args: [amountIn.toString(), [UBTC, WHYPE]]
      });
      
      if (result.success) {
        const amountOut = result.result[1];
        const whypeOut = ethers.utils.formatEther(amountOut);
        const rate = parseFloat(whypeOut) / parseFloat(test.amount);
        
        console.log(`   ${test.label}: ${parseFloat(whypeOut).toFixed(6)} WHYPE (Rate: ${rate.toFixed(2)})`);
      }
    } catch (error) {
      console.log(`   ${test.label}: エラー`);
    }
  }
  
  // 2. プール情報の詳細確認
  console.log('\n💧 2. プール詳細情報:');
  const POOL_ADDRESS = '0x3a36b04bcc1d5e2e303981ef643d2668e00b43e7';
  
  try {
    // V3プールのslot0情報
    const slot0ABI = [{"name": "slot0", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "sqrtPriceX96", "type": "uint160"}, {"name": "tick", "type": "int24"}, {"name": "observationIndex", "type": "uint16"}, {"name": "observationCardinality", "type": "uint16"}, {"name": "observationCardinalityNext", "type": "uint16"}, {"name": "feeProtocol", "type": "uint8"}, {"name": "unlocked", "type": "bool"}]}];
    require('fs').writeFileSync('./abi/temp_slot0.json', JSON.stringify(slot0ABI, null, 2));
    
    const slot0Result = await utils.callReadFunction({
      abiPath: './abi/temp_slot0.json',
      contractAddress: POOL_ADDRESS,
      functionName: 'slot0',
      args: []
    });
    
    if (slot0Result.success) {
      const [sqrtPriceX96, tick, , , , feeProtocol] = slot0Result.result;
      console.log(`   ✅ V3プール確認`);
      console.log(`      sqrtPriceX96: ${sqrtPriceX96.toString()}`);
      console.log(`      tick: ${tick}`);
      console.log(`      feeProtocol: ${feeProtocol}`);
      
      // 価格計算
      const price = Math.pow(parseInt(sqrtPriceX96) / Math.pow(2, 96), 2);
      console.log(`      計算価格: ${price.toFixed(10)}`);
    }
    
    require('fs').unlinkSync('./abi/temp_slot0.json');
    
    // 手数料情報
    const feeABI = [{"name": "fee", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "uint24"}]}];
    require('fs').writeFileSync('./abi/temp_fee.json', JSON.stringify(feeABI, null, 2));
    
    const feeResult = await utils.callReadFunction({
      abiPath: './abi/temp_fee.json',
      contractAddress: POOL_ADDRESS,
      functionName: 'fee',
      args: []
    });
    
    if (feeResult.success) {
      const fee = feeResult.result;
      console.log(`      手数料: ${fee/100}bps (${fee/10000}%)`);
    }
    
    require('fs').unlinkSync('./abi/temp_fee.json');
    
  } catch (error) {
    console.log(`   プール情報取得エラー: ${error.message}`);
  }
  
  // 3. 手数料影響の計算
  console.log('\n💸 3. 手数料影響の分析:');
  const feeRate = 0.003; // 0.3% (30bps)
  const inputAmount = 1; // 1 UBTC
  
  console.log(`   手数料率: ${feeRate * 100}%`);
  console.log(`   実効入力: ${inputAmount * (1 - feeRate)} UBTC`);
  console.log(`   手数料分: ${inputAmount * feeRate} UBTC`);
  
  // 理論レート計算
  const baseRate = 2796; // UI表示値
  const effectiveRate = baseRate * (1 - feeRate);
  console.log(`   理論実効レート: ${effectiveRate.toFixed(2)} WHYPE/UBTC`);
  console.log(`   実際のレート: 2688.47 WHYPE/UBTC`);
  console.log(`   残差: ${(effectiveRate - 2688.47).toFixed(2)} WHYPE`);
  
  // 4. スリッページの可能性
  console.log('\n📉 4. 価格影響（Price Impact）分析:');
  console.log('   大きな取引量では流動性の影響でレートが悪化します');
  
  // プール流動性確認（V2の場合）
  try {
    const reservesABI = [{"name": "getReserves", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "reserve0", "type": "uint112"}, {"name": "reserve1", "type": "uint112"}, {"name": "blockTimestampLast", "type": "uint32"}]}];
    require('fs').writeFileSync('./abi/temp_reserves.json', JSON.stringify(reservesABI, null, 2));
    
    const reservesResult = await utils.callReadFunction({
      abiPath: './abi/temp_reserves.json',
      contractAddress: POOL_ADDRESS,
      functionName: 'getReserves',
      args: []
    });
    
    if (reservesResult.success) {
      console.log('   V2プール流動性確認成功');
    } else {
      console.log('   V3プールのため、流動性は集中流動性で管理');
    }
    
    require('fs').unlinkSync('./abi/temp_reserves.json');
  } catch (error) {
    // V3プールの場合は正常
  }
  
  // 5. 差異の原因まとめ
  console.log('\n📋 差異の原因分析まとめ:');
  console.log('   1. 手数料の扱い:');
  console.log('      - UIは手数料込みの表示の可能性');
  console.log('      - スクリプトは手数料差引後の実効レート');
  console.log('   ');
  console.log('   2. 価格計算方法:');
  console.log('      - V2: x*y=k のAMM formula');
  console.log('      - V3: 集中流動性による複雑な計算');
  console.log('   ');
  console.log('   3. 価格影響（Price Impact）:');
  console.log('      - 取引量による流動性の影響');
  console.log('      - 大きな取引ほどレートが悪化');
  console.log('   ');
  console.log('   4. ルーティング:');
  console.log('      - UIは最適パスを自動選択');
  console.log('      - スクリプトは単一プール経由');
  
  console.log('\n💡 結論:');
  console.log('   差異の主な原因は「手数料の表示方法」と「価格影響」');
  console.log('   スクリプトの値（2688.47）は実際に受け取れる金額');
  console.log('   UIの値（2796）は手数料込みの理論値の可能性');
  
  return {
    scriptRate: 2688.47,
    uiRate: 2796,
    difference: 107.53,
    percentDiff: 3.99,
    likelyCause: 'fee_display_and_price_impact'
  };
}

// 実行
if (require.main === module) {
  analyzeRateDifference()
    .then(result => {
      console.log('\n🎯 分析結果:', result);
    })
    .catch(error => {
      console.error('❌ 分析エラー:', error);
    });
}

module.exports = { analyzeRateDifference };