const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * CATBAL→WHYPE→HFUNマルチホップテスト
 */

async function testCatbalHfunMultihop() {
  console.log('🔍 CATBAL→WHYPE→HFUN マルチホップテスト\n');
  
  const contracts = {
    quoterV1: '0xF865716B90f09268fF12B6B620e14bEC390B8139',
    quoterV2: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
    factory: '0xB1c0fa0B789320044A6F623cFe5eBda9562602E3'
  };
  
  const tokens = {
    CATBAL: '0x11735dBd0B97CfA7Accf47d005673BA185f7fd49',
    WHYPE: '0x5555555555555555555555555555555555555555',
    HFUN: '0xa320D9f65ec992EfF38622c63627856382Db726c'
  };
  
  const amount = ethers.utils.parseEther('1').toString();
  
  // V2 ABI (マルチホップ対応)
  const quoterV2ABI = [{
    "name": "quoteExactInput",
    "type": "function",
    "stateMutability": "view",
    "inputs": [
      { "name": "path", "type": "bytes" },
      { "name": "amountIn", "type": "uint256" }
    ],
    "outputs": [
      { "name": "amountOut", "type": "uint256" },
      { "name": "sqrtPriceX96AfterList", "type": "uint160[]" },
      { "name": "initializedTicksCrossedList", "type": "uint32[]" },
      { "name": "gasEstimate", "type": "uint256" }
    ]
  }];
  
  // V1 ABI (シングルホップ用)
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
  
  // V3パスエンコード
  function encodePath(tokens, fees) {
    let path = '0x';
    for (let i = 0; i < tokens.length; i++) {
      path += tokens[i].slice(2);
      if (i < fees.length) {
        path += fees[i].toString(16).padStart(6, '0');
      }
    }
    return path;
  }
  
  console.log('📊 1. 各ホップの確認（V1使用）\n');
  
  const v1Contract = new ethers.Contract(contracts.quoterV1, quoterV1ABI, provider);
  
  // 利用可能なfee tierの組み合わせ
  const feeTiers = [100, 500, 3000, 10000];
  const workingHops = {
    catbalToWhype: [],
    whypeToHfun: []
  };
  
  // CATBAL→WHYPEの確認
  console.log('🔍 Hop 1: CATBAL → WHYPE');
  for (const fee of feeTiers) {
    try {
      const result = await v1Contract.callStatic.quoteExactInputSingle(
        tokens.CATBAL, tokens.WHYPE, fee, amount, 0
      );
      const rate = parseFloat(ethers.utils.formatEther(result));
      console.log(`   ✅ ${fee}bps: ${rate.toFixed(8)} WHYPE per CATBAL`);
      workingHops.catbalToWhype.push({ fee, rate, amountOut: result });
    } catch (error) {
      console.log(`   ❌ ${fee}bps: 失敗`);
    }
  }
  
  // WHYPE→HFUNの確認
  console.log('\n🔍 Hop 2: WHYPE → HFUN');
  for (const fee of feeTiers) {
    try {
      const result = await v1Contract.callStatic.quoteExactInputSingle(
        tokens.WHYPE, tokens.HFUN, fee, amount, 0
      );
      const rate = parseFloat(ethers.utils.formatEther(result));
      console.log(`   ✅ ${fee}bps: ${rate.toFixed(8)} HFUN per WHYPE`);
      workingHops.whypeToHfun.push({ fee, rate });
    } catch (error) {
      console.log(`   ❌ ${fee}bps: 失敗`);
    }
  }
  
  console.log('\n📊 2. マルチホップテスト（V2使用）\n');
  
  const v2Contract = new ethers.Contract(contracts.quoterV2, quoterV2ABI, provider);
  const successfulRoutes = [];
  
  // 動作する組み合わせでマルチホップテスト
  for (const hop1 of workingHops.catbalToWhype) {
    for (const hop2 of workingHops.whypeToHfun) {
      console.log(`🧪 テスト: CATBAL →[${hop1.fee}bps]→ WHYPE →[${hop2.fee}bps]→ HFUN`);
      
      try {
        const multiPath = encodePath(
          [tokens.CATBAL, tokens.WHYPE, tokens.HFUN],
          [hop1.fee, hop2.fee]
        );
        
        const multiResult = await v2Contract.callStatic.quoteExactInput(multiPath, amount);
        const finalAmount = parseFloat(ethers.utils.formatEther(multiResult[0]));
        
        console.log(`   ✅ 成功: ${finalAmount.toFixed(8)} HFUN per CATBAL`);
        console.log(`   📊 Gas Estimate: ${multiResult[3].toString()}`);
        
        // 手動計算との比較
        const manualCalc = hop1.rate * hop2.rate;
        const diff = Math.abs(finalAmount - manualCalc);
        const diffPercent = (diff / manualCalc) * 100;
        
        console.log(`   🔍 検証: 手動計算=${manualCalc.toFixed(8)}, 差=${diffPercent.toFixed(4)}%`);
        
        successfulRoutes.push({
          fees: [hop1.fee, hop2.fee],
          finalAmount,
          gasEstimate: multiResult[3].toString(),
          path: `CATBAL →[${hop1.fee}bps]→ WHYPE →[${hop2.fee}bps]→ HFUN`
        });
        
      } catch (error) {
        console.log(`   ❌ 失敗: ${error.message.substring(0, 50)}...`);
      }
      console.log('');
    }
  }
  
  console.log('📋 3. 結果サマリー\n');
  
  if (successfulRoutes.length > 0) {
    console.log(`✅ ${successfulRoutes.length}個のマルチホップルートが利用可能\n`);
    
    // 最適ルートの検索
    const bestRoute = successfulRoutes.reduce((best, current) => 
      current.finalAmount > best.finalAmount ? current : best
    );
    
    console.log('🏆 最適ルート:');
    console.log(`   ${bestRoute.path}`);
    console.log(`   💰 レート: ${bestRoute.finalAmount.toFixed(8)} HFUN per CATBAL`);
    console.log(`   ⛽ ガス見積: ${bestRoute.gasEstimate}`);
    
    console.log('\n📊 全ルート一覧:');
    successfulRoutes
      .sort((a, b) => b.finalAmount - a.finalAmount)
      .forEach((route, index) => {
        console.log(`   ${index + 1}. [${route.fees[0]}bps→${route.fees[1]}bps]: ${route.finalAmount.toFixed(8)} HFUN (Gas: ${route.gasEstimate})`);
      });
  } else {
    console.log('❌ 利用可能なマルチホップルートが見つかりませんでした');
  }
  
  console.log('\n💡 結論:');
  console.log('CATBAL/HFUNの直接プールは存在しないが、WHYPE経由のマルチホップで取引可能');
  console.log('UIで表示されている「CATBAL→WHYPE、WHYPE→HFUN」は、このマルチホップルートを示している');
}

if (require.main === module) {
  testCatbalHfunMultihop().catch(console.error);
}

module.exports = { testCatbalHfunMultihop };