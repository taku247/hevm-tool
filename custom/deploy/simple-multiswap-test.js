const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * 簡単なMultiSwapテスト
 * 問題の特定のため、より小さな金額とV2のみでテスト
 */

const MULTISWAP_ADDRESS = '0x6f413c13a1bf5e855e4E522a66FC2a6efC2c2841';

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

async function simpleMultiSwapTest() {
  console.log('🧪 簡単な MultiSwap テスト');
  console.log('============================\\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const privateKey = process.env.PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // MultiSwap コントラクト
    const artifactPath = path.join(__dirname, 'abi/MultiSwap.json');
    const multiSwapABI = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const multiSwap = new ethers.Contract(MULTISWAP_ADDRESS, multiSwapABI, wallet);

    console.log('📋 テスト設定:');
    console.log(`   ウォレット: ${wallet.address}`);
    console.log(`   MultiSwap: ${MULTISWAP_ADDRESS}`);
    console.log('');

    // 非常に小さな金額でテスト
    console.log('⚙️  テストパラメータ:');
    const swapAmount = ethers.parseEther('0.0001'); // 0.0001 WETH (非常に小さく)
    const minPurrOutput = ethers.parseEther('0.0001'); // 非常に低い最小値
    const minHfunOutput = ethers.parseEther('0.0001'); // 非常に低い最小値
    const slippageBps = 1000; // 10% スリッページ (寛容に)
    const useV3ForFirst = true; // V3使用 (V3の方が動作確認済み)
    
    console.log(`   入力WETH: ${ethers.formatEther(swapAmount)}`);
    console.log(`   最低PURR: ${ethers.formatEther(minPurrOutput)}`);
    console.log(`   最低HFUN: ${ethers.formatEther(minHfunOutput)}`);
    console.log(`   スリッページ: ${slippageBps / 100}%`);
    console.log(`   V3使用: ${useV3ForFirst ? 'Yes' : 'No'} (V3で動作テスト)`);
    console.log('');

    // WETH残高確認
    const wethAddress = await multiSwap.WETH();
    const wethContract = new ethers.Contract(wethAddress, ERC20_ABI, wallet);
    const wethBalance = await wethContract.balanceOf(wallet.address);
    
    console.log('💰 WETH残高確認:');
    console.log(`   現在残高: ${ethers.formatEther(wethBalance)} WETH`);
    console.log(`   必要量: ${ethers.formatEther(swapAmount)} WETH`);
    
    if (wethBalance < swapAmount) {
      console.log('❌ WETH残高不足');
      return;
    }
    console.log('   ✅ 残高十分');
    console.log('');

    // Allowance確認
    const allowance = await wethContract.allowance(wallet.address, MULTISWAP_ADDRESS);
    console.log('🔐 Allowance確認:');
    console.log(`   現在: ${ethers.formatEther(allowance)} WETH`);
    
    if (allowance >= swapAmount) {
      console.log('   ✅ 十分なAllowance');
    } else {
      console.log('   ❌ Allowance不足、追加が必要');
      return;
    }
    console.log('');

    // 見積もりテスト
    console.log('📊 見積もりテスト:');
    try {
      const [estimatedHfun, estimatedPurr] = await multiSwap.getEstimatedOutput(swapAmount, useV3ForFirst);
      console.log(`   ✅ 推定PURR: ${ethers.formatEther(estimatedPurr)}`);
      console.log(`   ✅ 推定HFUN: ${ethers.formatEther(estimatedHfun)}`);
    } catch (error) {
      console.log(`   ❌ 見積もり失敗: ${error.message}`);
    }
    console.log('');

    // スワップ実行テスト (ドライラン)
    console.log('🔍 スワップ実行テスト (callStatic):');
    try {
      // callStaticで実際に実行せずに結果確認
      const result = await multiSwap.executeWethToPurrToHfun.staticCall(
        swapAmount,
        minPurrOutput,
        minHfunOutput,
        slippageBps,
        useV3ForFirst
      );
      
      console.log(`   ✅ callStatic成功!`);
      console.log(`   ✅ 予想HFUN出力: ${ethers.formatEther(result)} HFUN`);
      
      // callStaticが成功したら実際に実行
      console.log('');
      console.log('🚀 実際のスワップ実行:');
      
      const gasEstimate = await multiSwap.executeWethToPurrToHfun.estimateGas(
        swapAmount,
        minPurrOutput,
        minHfunOutput,
        slippageBps,
        useV3ForFirst
      );
      
      console.log(`   推定ガス: ${gasEstimate.toString()}`);
      
      const swapTx = await multiSwap.executeWethToPurrToHfun(
        swapAmount,
        minPurrOutput,
        minHfunOutput,
        slippageBps,
        useV3ForFirst,
        {
          gasLimit: gasEstimate + 100000n
        }
      );
      
      console.log(`   ✅ TX送信: ${swapTx.hash}`);
      console.log('   ⏳ 確認待機中...');
      
      const receipt = await swapTx.wait();
      
      if (receipt.status === 1) {
        console.log('   🎉 スワップ成功!');
        console.log(`   ⛽ ガス使用: ${receipt.gasUsed.toString()}`);
        console.log(`   🧱 ブロック: ${receipt.blockNumber}`);
        
        // 簡単なイベント確認
        console.log(`   📋 ログ数: ${receipt.logs.length}`);
        
      } else {
        console.log('   ❌ スワップ失敗');
      }
      
    } catch (error) {
      console.log(`   ❌ callStatic失敗: ${error.message}`);
      
      // エラー詳細分析
      if (error.message.includes('missing revert data')) {
        console.log('   💡 原因分析:');
        console.log('      - V3 Router の問題');
        console.log('      - プール流動性不足');
        console.log('      - テストネット固有の制約');
        console.log('');
        console.log('   🔧 推奨対応:');
        console.log('      - V2のみでテスト');
        console.log('      - より小さな金額');
        console.log('      - 別のトークンペア');
      }
      
      if (error.reason) {
        console.log(`   💡 Revert理由: ${error.reason}`);
      }
    }

    console.log('');
    console.log('🎯 テスト完了!');

  } catch (error) {
    console.error('❌ テスト中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  simpleMultiSwapTest()
    .then(() => {
      console.log('\\n✅ 簡単なMultiSwapテスト完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { simpleMultiSwapTest };