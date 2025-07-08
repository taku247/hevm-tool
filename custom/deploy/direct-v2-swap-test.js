const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * V2ルーターを直接使った単純なスワップテスト
 * MultiSwapコントラクトの問題を特定するため
 */

const V2_ROUTER = '0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853';
const TOKENS = {
  WETH: '0xADcb2f358Eae6492F61A5F87eb8893d09391d160',
  PURR: '0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82'
};

const ROUTER_V2_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function WETH() external pure returns (address)"
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

async function directV2SwapTest() {
  console.log('🔧 V2ルーター直接スワップテスト');
  console.log('===============================\\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const privateKey = process.env.PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('📋 設定:');
    console.log(`   ウォレット: ${wallet.address}`);
    console.log(`   V2 Router: ${V2_ROUTER}`);
    console.log('');

    // V2 Router コントラクト
    const routerV2 = new ethers.Contract(V2_ROUTER, ROUTER_V2_ABI, wallet);
    
    // テストパラメータ
    const swapAmount = ethers.parseEther('0.00001'); // 0.00001 WETH (極小)
    const path = [TOKENS.WETH, TOKENS.PURR];
    
    console.log('⚙️  テストパラメータ:');
    console.log(`   入力: ${ethers.formatEther(swapAmount)} WETH`);
    console.log(`   パス: WETH → PURR`);
    console.log('');

    // WETH残高確認
    const wethContract = new ethers.Contract(TOKENS.WETH, ERC20_ABI, wallet);
    const wethBalance = await wethContract.balanceOf(wallet.address);
    
    console.log('💰 残高確認:');
    console.log(`   WETH残高: ${ethers.formatEther(wethBalance)}`);
    
    if (wethBalance < swapAmount) {
      console.log('❌ WETH残高不足');
      return;
    }
    console.log('   ✅ 残高十分');
    console.log('');

    // V2 Router の基本機能テスト
    console.log('🔍 V2 Router 基本機能テスト:');
    
    try {
      // 1. WETH確認
      const routerWETH = await routerV2.WETH();
      console.log(`   WETH(): ${routerWETH}`);
      console.log(`   期待値: ${TOKENS.WETH}`);
      console.log(`   一致: ${routerWETH.toLowerCase() === TOKENS.WETH.toLowerCase() ? '✅' : '❌'}`);
      
      // 2. getAmountsOut テスト
      console.log('\\n   getAmountsOut テスト:');
      const amounts = await routerV2.getAmountsOut(swapAmount, path);
      console.log(`   入力: ${ethers.formatEther(amounts[0])} WETH`);
      console.log(`   出力: ${ethers.formatEther(amounts[1])} PURR`);
      console.log(`   レート: 1 WETH = ${ethers.formatEther(amounts[1]) / ethers.formatEther(amounts[0])} PURR`);
      
      const minAmountOut = amounts[1] * 90n / 100n; // 10% スリッページ
      console.log(`   最低出力: ${ethers.formatEther(minAmountOut)} PURR`);
      
    } catch (error) {
      console.log(`   ❌ 基本機能エラー: ${error.message}`);
      return;
    }
    
    console.log('');

    // Allowance確認
    console.log('🔐 Allowance確認:');
    const allowance = await wethContract.allowance(wallet.address, V2_ROUTER);
    console.log(`   現在: ${ethers.formatEther(allowance)} WETH`);
    
    if (allowance < swapAmount) {
      console.log('   📝 Approve実行中...');
      const approveTx = await wethContract.approve(V2_ROUTER, ethers.parseEther('0.01'));
      await approveTx.wait();
      console.log('   ✅ Approve完了');
    } else {
      console.log('   ✅ 十分なAllowance');
    }
    console.log('');

    // 残高記録 (Before)
    const wethBefore = await wethContract.balanceOf(wallet.address);
    const purrContract = new ethers.Contract(TOKENS.PURR, ERC20_ABI, wallet);
    const purrBefore = await purrContract.balanceOf(wallet.address);
    
    console.log('📊 スワップ前残高:');
    console.log(`   WETH: ${ethers.formatEther(wethBefore)}`);
    console.log(`   PURR: ${ethers.formatEther(purrBefore)}`);
    console.log('');

    // 実際のスワップ実行
    console.log('🚀 V2スワップ実行:');
    
    try {
      // 最新の見積もり取得
      const amounts = await routerV2.getAmountsOut(swapAmount, path);
      const minAmountOut = amounts[1] * 95n / 100n; // 5% スリッページ
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5分後
      
      console.log(`   期待出力: ${ethers.formatEther(amounts[1])} PURR`);
      console.log(`   最低出力: ${ethers.formatEther(minAmountOut)} PURR`);
      console.log(`   Deadline: ${deadline}`);
      
      // ガス見積もり
      const gasEstimate = await routerV2.swapExactTokensForTokens.estimateGas(
        swapAmount,
        minAmountOut,
        path,
        wallet.address,
        deadline
      );
      
      console.log(`   推定ガス: ${gasEstimate.toString()}`);
      
      // 実行
      const swapTx = await routerV2.swapExactTokensForTokens(
        swapAmount,
        minAmountOut,
        path,
        wallet.address,
        deadline,
        {
          gasLimit: gasEstimate + 50000n
        }
      );
      
      console.log(`   ✅ TX送信: ${swapTx.hash}`);
      console.log('   ⏳ 確認待機中...');
      
      const receipt = await swapTx.wait();
      
      if (receipt.status === 1) {
        console.log('   🎉 スワップ成功!');
        console.log(`   ⛽ ガス使用: ${receipt.gasUsed.toString()}`);
        console.log(`   🧱 ブロック: ${receipt.blockNumber}`);
        
        // 残高変化確認
        const wethAfter = await wethContract.balanceOf(wallet.address);
        const purrAfter = await purrContract.balanceOf(wallet.address);
        
        console.log('\\n📊 スワップ後残高:');
        console.log(`   WETH: ${ethers.formatEther(wethAfter)} (変化: ${ethers.formatEther(wethAfter - wethBefore)})`);
        console.log(`   PURR: ${ethers.formatEther(purrAfter)} (変化: ${ethers.formatEther(purrAfter - purrBefore)})`);
        
        console.log('\\n✅ V2ルーター直接スワップ: 完全成功!');
        console.log('💡 結論: MultiSwapコントラクト内に問題あり');
        
      } else {
        console.log('   ❌ スワップ失敗');
      }
      
    } catch (error) {
      console.log(`   ❌ スワップエラー: ${error.message}`);
      
      if (error.reason) {
        console.log(`   理由: ${error.reason}`);
      }
    }

  } catch (error) {
    console.error('❌ テスト中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  directV2SwapTest()
    .then(() => {
      console.log('\\n🔧 V2ルーター直接テスト完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { directV2SwapTest };