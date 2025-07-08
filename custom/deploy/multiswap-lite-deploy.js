const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * MultiSwapLite コントラクトデプロイ & テスト
 */

async function deployAndTestLiteMultiSwap() {
  console.log('🔧 MultiSwapLite デプロイ & テスト');
  console.log('=====================================\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const privateKey = process.env.PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('📋 設定:');
    console.log(`   ウォレット: ${wallet.address}`);
    console.log(`   RPC: ${rpcUrl}`);
    
    const balance = await provider.getBalance(wallet.address);
    console.log(`   残高: ${ethers.formatEther(balance)} ETH`);
    console.log('');

    // 1. 軽量コントラクトデプロイ
    console.log('🚀 1. MultiSwapLite デプロイ:');
    
    const artifactPath = path.join(__dirname, 'artifacts/contracts/MultiSwapLite.sol/MultiSwapLite.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    
    const contractFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    
    console.log('   📤 デプロイ中...');
    const multiSwapLite = await contractFactory.deploy({
      gasLimit: 1500000  // 軽量版なので1.5M gasで試行
    });
    
    await multiSwapLite.waitForDeployment();
    const liteAddress = await multiSwapLite.getAddress();
    
    console.log(`   ✅ デプロイ成功: ${liteAddress}`);
    console.log('');

    // 2. WETH Approve 確認
    console.log('🔐 2. WETH Approve 確認:');
    
    const wethAddress = await multiSwapLite.WETH();
    const wethContract = new ethers.Contract(wethAddress, [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)"
    ], wallet);
    
    const currentAllowance = await wethContract.allowance(wallet.address, liteAddress);
    const testAmount = ethers.parseEther('0.0001');
    
    console.log(`   現在のAllowance: ${ethers.formatEther(currentAllowance)}`);
    console.log(`   必要な金額: ${ethers.formatEther(testAmount)}`);
    
    if (currentAllowance < testAmount) {
      console.log('   📝 Approve実行中...');
      const approveTx = await wethContract.approve(liteAddress, ethers.parseEther('1'));
      await approveTx.wait();
      console.log('   ✅ Approve完了');
    } else {
      console.log('   ✅ 十分なAllowance');
    }
    console.log('');

    // 3. 軽量版マルチスワップ実行
    console.log('🧪 3. 軽量版マルチスワップ実行:');
    console.log('   ※ 重要ステップのみログ出力でエラー箇所特定');
    console.log('');
    
    const swapParams = {
      wethAmount: testAmount,
      minPurrOutput: ethers.parseEther('0.0001'),
      minHfunOutput: ethers.parseEther('0.0001'),
      useV3ForFirst: true // V3で1段目テスト
    };
    
    console.log('   パラメータ:');
    console.log(`     WETH入力: ${ethers.formatEther(swapParams.wethAmount)}`);
    console.log(`     最低PURR: ${ethers.formatEther(swapParams.minPurrOutput)}`);
    console.log(`     最低HFUN: ${ethers.formatEther(swapParams.minHfunOutput)}`);
    console.log(`     V3使用: ${swapParams.useV3ForFirst}`);
    console.log('');

    try {
      // callStatic でエラー箇所特定
      console.log('   🔍 callStatic実行（エラー箇所特定）:');
      
      const result = await multiSwapLite.executeWethToPurrToHfun.staticCall(
        swapParams.wethAmount,
        swapParams.minPurrOutput,
        swapParams.minHfunOutput,
        swapParams.useV3ForFirst
      );
      
      console.log(`   ✅ callStatic成功: ${ethers.formatEther(result)} HFUN`);
      console.log('   💡 問題なし - 実際の実行も試行可能');
      
      // 実際の実行
      console.log('\n   🚀 実際のスワップ実行:');
      const swapTx = await multiSwapLite.executeWethToPurrToHfun(
        swapParams.wethAmount,
        swapParams.minPurrOutput,
        swapParams.minHfunOutput,
        swapParams.useV3ForFirst,
        {
          gasLimit: 1000000
        }
      );
      
      console.log(`   ✅ TX送信: ${swapTx.hash}`);
      const receipt = await swapTx.wait();
      console.log(`   ✅ 実行成功: Block ${receipt.blockNumber}`);
      
      // イベントログ解析
      console.log('\n📋 4. イベントログ解析:');
      for (const log of receipt.logs) {
        try {
          const parsedLog = multiSwapLite.interface.parseLog(log);
          if (parsedLog) {
            console.log(`   🎯 ${parsedLog.name}:`);
            if (parsedLog.name === 'StepLog') {
              console.log(`      ステップ: ${parsedLog.args.step}`);
              console.log(`      値: ${ethers.formatEther(parsedLog.args.value)}`);
            } else if (parsedLog.name === 'SwapResult') {
              console.log(`      スワップ: ${parsedLog.args.swap_type}`);
              console.log(`      入力: ${ethers.formatEther(parsedLog.args.input)}`);
              console.log(`      出力: ${ethers.formatEther(parsedLog.args.output)}`);
            }
          }
        } catch (e) {
          // 他のコントラクトのログはスキップ
        }
      }
      
    } catch (error) {
      console.log(`   ❌ callStatic失敗: ${error.message}`);
      
      // エラー詳細分析
      console.log('\n🔍 エラー分析:');
      if (error.data) {
        console.log(`     エラーデータ: ${error.data}`);
      }
      if (error.reason) {
        console.log(`     リバート理由: ${error.reason}`);
      }
      
      // 可能な原因
      console.log('\n💡 考えられる原因:');
      console.log('     1. WETH transferFrom 失敗');
      console.log('     2. V3 Router approve 失敗 (1段目)');
      console.log('     3. V3 exactInputSingle 失敗 (1段目)');
      console.log('     4. V2 Router approve 失敗 (2段目)');
      console.log('     5. V2 swapExactTokensForTokens 失敗 (2段目) ← 最有力');
      console.log('     6. HFUN transfer 失敗');
    }

    console.log('\n🎯 軽量版デバッグ結果サマリー:');
    console.log(`   デプロイアドレス: ${liteAddress}`);
    console.log('   重要ステップのみログ出力');
    console.log('   実際の失敗箇所が特定可能');

  } catch (error) {
    console.error('❌ 軽量版テスト中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  deployAndTestLiteMultiSwap()
    .then(() => {
      console.log('\n🔧 MultiSwapLite テスト完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { deployAndTestLiteMultiSwap };