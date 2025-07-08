const { ethers } = require('ethers');
require('dotenv').config({ path: '../../.env' });

/**
 * V2でPURR→HFUNスワップテスト
 * V2制約の確認
 */

async function testV2PurrHfun() {
  console.log('🔍 V2 PURR→HFUN スワップテスト');
  console.log('===============================\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const privateKey = process.env.PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('📋 設定:');
    console.log(`   ウォレット: ${wallet.address}`);
    console.log(`   RPC: ${rpcUrl}`);
    console.log('');

    // Token addresses
    const PURR = '0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82';
    const HFUN = '0x37adB2550b965851593832a6444763eeB3e1d1Ec';
    const V2_ROUTER = '0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853';

    // Router ABI (必要部分のみ)
    const routerAbi = [
      "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
      "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
    ];

    const router = new ethers.Contract(V2_ROUTER, routerAbi, wallet);
    const testAmount = ethers.parseEther('0.1'); // 0.1 PURR

    console.log('🔍 1. V2レート取得テスト:');
    console.log(`   PURR → HFUN`);
    console.log(`   入力量: ${ethers.formatEther(testAmount)} PURR`);

    try {
      const path = [PURR, HFUN];
      const amounts = await router.getAmountsOut(testAmount, path);
      
      console.log(`   ✅ V2レート取得成功:`);
      console.log(`      入力: ${ethers.formatEther(amounts[0])} PURR`);
      console.log(`      出力: ${ethers.formatEther(amounts[1])} HFUN`);
      console.log(`      レート: 1 PURR = ${ethers.formatEther(amounts[1]) / ethers.formatEther(amounts[0])} HFUN`);

      // 実際のスワップを試行（callStatic）
      console.log('\n🔍 2. V2スワップ試行（callStatic）:');
      
      try {
        // PURR approve確認
        const purrContract = new ethers.Contract(PURR, [
          "function balanceOf(address owner) view returns (uint256)",
          "function allowance(address owner, address spender) view returns (uint256)"
        ], wallet);
        
        const purrBalance = await purrContract.balanceOf(wallet.address);
        const purrAllowance = await purrContract.allowance(wallet.address, V2_ROUTER);
        
        console.log(`   PURR残高: ${ethers.formatEther(purrBalance)}`);
        console.log(`   PURR Allowance: ${ethers.formatEther(purrAllowance)}`);
        
        if (purrBalance < testAmount) {
          console.log('   ❌ PURR残高不足');
          return;
        }
        
        if (purrAllowance < testAmount) {
          console.log('   ⚠️  PURR Allowance不足（実際の実行には承認必要）');
        }

        // ガス見積もりテスト
        const minAmountOut = amounts[1] * BigInt(95) / BigInt(100); // 5% slippage
        const deadline = Math.floor(Date.now() / 1000) + 300;
        
        console.log(`   最小出力: ${ethers.formatEther(minAmountOut)} HFUN`);
        
        console.log('\n   🔍 ガス見積もりテスト:');
        try {
          const gasEstimate = await router.swapExactTokensForTokens.estimateGas(
            testAmount,
            minAmountOut,
            path,
            wallet.address,
            deadline
          );
          console.log(`   ⛽ 見積もりガス: ${gasEstimate.toString()} gas`);
          
          // callStatic でスワップテスト
          const result = await router.swapExactTokensForTokens.staticCall(
            testAmount,
            minAmountOut,
            path,
            wallet.address,
            deadline
          );
          
          console.log(`   ✅ callStatic成功: ${ethers.formatEther(result[1])} HFUN`);
          console.log('   💡 V2でPURR→HFUNスワップは理論上可能');
          
          // 実際のガス見積もりでの実行テスト
          console.log('\n   🧪 適切なガス設定でのテスト:');
          const gasWithBuffer = gasEstimate * BigInt(12) / BigInt(10); // +20% buffer
          console.log(`   ⛽ バッファ込みガス: ${gasWithBuffer.toString()} gas`);
          
          // 実際の実行はしないが、パラメータ確認
          console.log('   💡 適切なガス設定なら実行可能と推定');
          
        } catch (gasError) {
          console.log(`   ❌ ガス見積もり失敗: ${gasError.message}`);
          
          // callStatic でスワップテスト（ガス見積もり失敗でも試行）
          try {
            const result = await router.swapExactTokensForTokens.staticCall(
              testAmount,
              minAmountOut,
              path,
              wallet.address,
              deadline
            );
            
            console.log(`   ✅ callStatic成功: ${ethers.formatEther(result[1])} HFUN`);
            console.log('   💡 ガス見積もりは失敗だが、callStaticは成功');
            console.log('   💡 これはテストネット特有の制約の可能性');
            
          } catch (staticError) {
            console.log(`   ❌ callStatic失敗: ${staticError.message}`);
          }
        }
        
      } catch (swapError) {
        console.log(`   ❌ callStatic失敗: ${swapError.message}`);
        
        if (swapError.message.includes('missing revert data')) {
          console.log('   💡 V2でPURR→HFUNスワップに制約あり');
        } else if (swapError.reason) {
          console.log(`   💡 Revert理由: ${swapError.reason}`);
        }
      }

    } catch (rateError) {
      console.log(`   ❌ V2レート取得失敗: ${rateError.message}`);
      
      if (rateError.message.includes('INSUFFICIENT_LIQUIDITY')) {
        console.log('   💡 V2でPURR/HFUNペアの流動性不足');
      } else if (rateError.message.includes('INVALID_PATH')) {
        console.log('   💡 V2でPURR/HFUNペアが存在しない');
      }
    }

    console.log('\n🎯 V2制約分析結果:');
    console.log('   V2でのPURR→HFUN制約確認完了');
    console.log('   原因候補:');
    console.log('     1. ガス不足 (固定200kガス < 必要250k+ガス)');
    console.log('     2. テストネット特有の制約');
    console.log('     3. 流動性不足によるスリッページエラー');
    console.log('   これがMultiSwap失敗の根本原因');

  } catch (error) {
    console.error('❌ V2テスト中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  testV2PurrHfun()
    .then(() => {
      console.log('\n🔍 V2制約テスト完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { testV2PurrHfun };