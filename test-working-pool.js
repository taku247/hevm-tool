const { UniversalContractUtils } = require('./dist/templates/contract-utils');
const { ethers } = require('ethers');

/**
 * 動作確認済みプールでのレート取得テスト
 */
async function testWorkingPool() {
  console.log('🎯 動作確認済みWETH/UBTCプールレート取得テスト\n');
  
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  const utils = new UniversalContractUtils(rpcUrl);
  
  // 確認済み情報
  const POOL_ADDRESS = '0x3a36b04bcc1d5e2e303981ef643d2668e00b43e7';
  const WETH = '0x5555555555555555555555555555555555555555'; // Token0
  const UBTC = '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463'; // Token1
  const FEE = 3000; // 30bps
  
  console.log('📍 確認済み情報:');
  console.log(`   プール: ${POOL_ADDRESS} (V3, 30bps手数料)`);
  console.log(`   WETH: ${WETH}`);
  console.log(`   UBTC: ${UBTC}\n`);
  
  const results = { successful: [], failed: [] };
  
  // 1. V2ルーター経由でのレート取得
  console.log('🔄 1. V2ルーター経由レート取得:');
  const v2TestAmounts = ['0.001', '0.01', '0.1', '1'];
  
  for (const amountStr of v2TestAmounts) {
    try {
      const amountIn = ethers.utils.parseEther(amountStr);
      const path = [WETH, UBTC];
      
      const result = await utils.callReadFunction({
        abiPath: './abi/UniV2Router.json',
        contractAddress: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A', // HyperSwap V2
        functionName: 'getAmountsOut',
        args: [amountIn.toString(), path]
      });
      
      if (result.success && result.result) {
        const amounts = result.result;
        const amountOut = amounts[1];
        const ubtcOut = ethers.utils.formatUnits(amountOut, 8);
        const rate = parseFloat(ubtcOut) / parseFloat(amountStr);
        
        console.log(`   ✅ ${amountStr} WETH → ${parseFloat(ubtcOut).toFixed(8)} UBTC (Rate: ${rate.toFixed(6)})`);
        
        results.successful.push({
          type: 'v2_router',
          dex: 'HyperSwap V2',
          amountIn: amountStr,
          amountOut: ubtcOut,
          rate,
          pair: 'WETH/UBTC'
        });
      } else {
        console.log(`   ⚠️  ${amountStr} WETH: ${result.error?.substring(0, 50)}...`);
        results.failed.push({
          type: 'v2_router',
          amount: amountStr,
          error: result.error
        });
      }
    } catch (error) {
      console.log(`   ❌ ${amountStr} WETH: ${error.message.substring(0, 50)}...`);
    }
  }
  
  // 2. V3Quoter経由でのレート取得
  console.log('\n📊 2. V3Quoter経由レート取得:');
  for (const amountStr of v2TestAmounts) {
    try {
      const amountIn = ethers.utils.parseEther(amountStr);
      
      const result = await utils.callReadFunction({
        abiPath: './abi/KittenQuoterV2.json',
        contractAddress: '0x03A918028f22D9E1473B7959C927AD7425A45C7C', // HyperSwap V3 Quoter
        functionName: 'quoteExactInputSingle',
        args: [
          WETH,
          UBTC,
          FEE,
          amountIn.toString(),
          0
        ]
      });
      
      if (result.success && result.result) {
        const amountOut = result.result;
        const ubtcOut = ethers.utils.formatUnits(amountOut, 8);
        const rate = parseFloat(ubtcOut) / parseFloat(amountStr);
        
        console.log(`   ✅ ${amountStr} WETH → ${parseFloat(ubtcOut).toFixed(8)} UBTC (Rate: ${rate.toFixed(6)}) [V3]`);
        
        results.successful.push({
          type: 'v3_quoter',
          dex: 'HyperSwap V3',
          amountIn: amountStr,
          amountOut: ubtcOut,
          rate,
          fee: FEE,
          pair: 'WETH/UBTC'
        });
      } else {
        console.log(`   ⚠️  ${amountStr} WETH: ${result.error?.substring(0, 50)}...`);
      }
    } catch (error) {
      console.log(`   ❌ ${amountStr} WETH: ${error.message.substring(0, 50)}...`);
    }
  }
  
  // 3. 逆方向（UBTC → WETH）
  console.log('\n🔄 3. 逆方向レート取得 (UBTC → WETH):');
  const ubtcTestAmounts = ['0.001', '0.01', '0.1'];
  
  for (const amountStr of ubtcTestAmounts) {
    try {
      const amountIn = ethers.utils.parseUnits(amountStr, 8); // UBTC is 8 decimals
      const path = [UBTC, WETH];
      
      const result = await utils.callReadFunction({
        abiPath: './abi/UniV2Router.json',
        contractAddress: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A',
        functionName: 'getAmountsOut',
        args: [amountIn.toString(), path]
      });
      
      if (result.success && result.result) {
        const amounts = result.result;
        const amountOut = amounts[1];
        const wethOut = ethers.utils.formatEther(amountOut);
        const rate = parseFloat(wethOut) / parseFloat(amountStr);
        
        console.log(`   ✅ ${amountStr} UBTC → ${parseFloat(wethOut).toFixed(6)} WETH (Rate: ${rate.toFixed(4)})`);
        
        results.successful.push({
          type: 'v2_router_reverse',
          dex: 'HyperSwap V2',
          amountIn: amountStr,
          amountOut: wethOut,
          rate,
          pair: 'UBTC/WETH'
        });
      } else {
        console.log(`   ⚠️  ${amountStr} UBTC: ${result.error?.substring(0, 50)}...`);
      }
    } catch (error) {
      console.log(`   ❌ ${amountStr} UBTC: ${error.message.substring(0, 50)}...`);
    }
  }
  
  // 4. ガス価格分析
  console.log('\n⛽ 4. ガス価格分析:');
  try {
    const gasAnalysis = await utils.analyzeCurrentGasPrices();
    const currentGasGwei = (parseInt(gasAnalysis.currentBaseFee) / 1e9).toFixed(2);
    
    console.log(`   現在のガス価格: ${currentGasGwei} Gwei`);
    console.log(`   ネットワーク混雑度: ${gasAnalysis.networkCongestion}`);
    console.log(`   推奨戦略: ${gasAnalysis.recommendations.strategy}`);
  } catch (error) {
    console.log(`   ガス分析エラー: ${error.message}`);
  }
  
  // 5. 結果サマリーと監視設定
  console.log('\n📋 テスト結果サマリー:');
  console.log(`   成功したレート取得: ${results.successful.length}`);
  console.log(`   失敗したテスト: ${results.failed.length}`);
  
  if (results.successful.length > 0) {
    console.log('\n✅ 成功したレート取得:');
    results.successful.forEach((r, i) => {
      console.log(`   ${i+1}. ${r.dex} (${r.type}): ${r.amountIn} → ${parseFloat(r.amountOut).toFixed(8)} (Rate: ${r.rate.toFixed(6)})`);
    });
    
    // 平均レート計算
    const wethToUbtcRates = results.successful
      .filter(r => r.pair === 'WETH/UBTC')
      .map(r => r.rate);
    
    const ubtcToWethRates = results.successful
      .filter(r => r.pair === 'UBTC/WETH')
      .map(r => r.rate);
    
    if (wethToUbtcRates.length > 0) {
      const avgWethToUbtc = wethToUbtcRates.reduce((a, b) => a + b, 0) / wethToUbtcRates.length;
      console.log(`\n📊 平均レート:`);
      console.log(`   1 WETH = ${avgWethToUbtc.toFixed(6)} UBTC`);
    }
    
    if (ubtcToWethRates.length > 0) {
      const avgUbtcToWeth = ubtcToWethRates.reduce((a, b) => a + b, 0) / ubtcToWethRates.length;
      console.log(`   1 UBTC = ${avgUbtcToWeth.toFixed(4)} WETH`);
    }
    
    console.log('\n🚀 監視ツール起動コマンド:');
    console.log('   以下のコマンドでリアルタイム監視を開始できます:');
    console.log('');
    console.log('   ```bash');
    console.log('   # WETH/UBTCペア監視');
    console.log('   node custom/monitoring/dex-rate-monitor.js \\');
    console.log('     --tokenA 0x5555555555555555555555555555555555555555 \\');
    console.log('     --tokenB 0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463 \\');
    console.log('     --monitor --interval 10');
    console.log('   ```');
    
    console.log('\n📝 設定ファイル更新:');
    console.log('   custom/monitoring/dex-rate-monitor.ts の DEX_CONFIG を以下で更新:');
    console.log('   - WETH アドレス: 0x5555555555555555555555555555555555555555');
    console.log('   - UBTC アドレス: 0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463');
    console.log('   - 動作するペア: WETH/UBTC');
    
  } else {
    console.log('\n❌ レート取得に失敗しました');
  }
  
  return {
    success: results.successful.length > 0,
    totalSuccess: results.successful.length,
    totalFailed: results.failed.length,
    workingPair: 'WETH/UBTC',
    poolAddress: POOL_ADDRESS,
    tokens: { WETH, UBTC }
  };
}

// テスト実行
if (require.main === module) {
  testWorkingPool()
    .then(result => {
      console.log('\n🎯 最終結果:', {
        success: result.success,
        workingPair: result.workingPair,
        successfulRates: result.totalSuccess,
        failedTests: result.totalFailed
      });
    })
    .catch(error => {
      console.error('❌ テスト実行エラー:', error);
    });
}

module.exports = { testWorkingPool };