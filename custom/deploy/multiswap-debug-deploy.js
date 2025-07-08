const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * MultiSwapDebug コントラクトデプロイ & 詳細ログテスト
 */

async function deployAndTestDebugMultiSwap() {
  console.log('🔧 MultiSwapDebug デプロイ & ログテスト');
  console.log('=====================================\\n');

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

    // 1. デバッグコントラクトデプロイ
    console.log('🚀 1. MultiSwapDebug デプロイ:');
    
    const artifactPath = path.join(__dirname, 'artifacts/contracts/MultiSwapDebug.sol/MultiSwapDebug.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    
    const contractFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    
    console.log('   📤 デプロイ中...');
    const multiSwapDebug = await contractFactory.deploy({
      gasLimit: 2000000
    });
    
    await multiSwapDebug.waitForDeployment();
    const debugAddress = await multiSwapDebug.getAddress();
    
    console.log(`   ✅ デプロイ成功: ${debugAddress}`);
    console.log('');

    // 2. 残高確認
    console.log('💰 2. 残高確認:');
    
    try {
      const balances = await multiSwapDebug.debugBalances(wallet.address);
      console.log(`   ユーザーWETH: ${ethers.formatEther(balances.userWeth)}`);
      console.log(`   ユーザーPURR: ${ethers.formatEther(balances.userPurr)}`);
      console.log(`   ユーザーHFUN: ${ethers.formatEther(balances.userHfun)}`);
      console.log(`   WETH Allowance: ${ethers.formatEther(balances.wethAllowance)}`);
    } catch (error) {
      console.log(`   ❌ 残高確認エラー: ${error.message}`);
    }
    console.log('');

    // 3. WETH Approve (必要に応じて)
    console.log('🔐 3. WETH Approve 確認:');
    
    const wethAddress = await multiSwapDebug.WETH();
    const wethContract = new ethers.Contract(wethAddress, [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)"
    ], wallet);
    
    const currentAllowance = await wethContract.allowance(wallet.address, debugAddress);
    const testAmount = ethers.parseEther('0.0001');
    
    console.log(`   現在のAllowance: ${ethers.formatEther(currentAllowance)}`);
    console.log(`   必要な金額: ${ethers.formatEther(testAmount)}`);
    
    if (currentAllowance < testAmount) {
      console.log('   📝 Approve実行中...');
      const approveTx = await wethContract.approve(debugAddress, ethers.parseEther('1'));
      await approveTx.wait();
      console.log('   ✅ Approve完了');
    } else {
      console.log('   ✅ 十分なAllowance');
    }
    console.log('');

    // 4. デバッグマルチスワップ実行
    console.log('🧪 4. デバッグマルチスワップ実行:');
    console.log('   ※ 詳細ログでどこで失敗するかを特定');
    console.log('');
    
    const swapParams = {
      wethAmount: testAmount,
      minPurrOutput: ethers.parseEther('0.0001'),
      minHfunOutput: ethers.parseEther('0.0001'),
      slippageBps: 1000, // 10%
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
      
      const result = await multiSwapDebug.executeWethToPurrToHfunDebug.staticCall(
        swapParams.wethAmount,
        swapParams.minPurrOutput,
        swapParams.minHfunOutput,
        swapParams.slippageBps,
        swapParams.useV3ForFirst
      );
      
      console.log(`   ✅ callStatic成功: ${ethers.formatEther(result)} HFUN`);
      console.log('   💡 問題なし - 実際の実行も試行可能');
      
      // 実際の実行
      console.log('\\n   🚀 実際のスワップ実行:');
      const swapTx = await multiSwapDebug.executeWethToPurrToHfunDebug(
        swapParams.wethAmount,
        swapParams.minPurrOutput,
        swapParams.minHfunOutput,
        swapParams.slippageBps,
        swapParams.useV3ForFirst,
        {
          gasLimit: 1000000
        }
      );
      
      console.log(`   ✅ TX送信: ${swapTx.hash}`);
      const receipt = await swapTx.wait();
      console.log(`   ✅ 実行成功: Block ${receipt.blockNumber}`);
      
      // イベントログ解析
      console.log('\\n📋 5. イベントログ解析:');
      for (const log of receipt.logs) {
        try {
          const parsedLog = multiSwapDebug.interface.parseLog(log);
          if (parsedLog) {
            console.log(`   🎯 ${parsedLog.name}: ${JSON.stringify(parsedLog.args, null, 2)}`);
          }
        } catch (e) {
          // 他のコントラクトのログはスキップ
        }
      }
      
    } catch (error) {
      console.log(`   ❌ callStatic失敗: ${error.message}`);
      
      // エラー詳細分析
      console.log('\\n🔍 エラー分析:');
      if (error.data) {
        console.log(`     エラーデータ: ${error.data}`);
      }
      if (error.reason) {
        console.log(`     リバート理由: ${error.reason}`);
      }
      
      // 可能な原因
      console.log('\\n💡 考えられる原因:');
      console.log('     1. WETH transferFrom 失敗');
      console.log('     2. V3 Router approve 失敗');
      console.log('     3. V3 exactInputSingle 失敗');
      console.log('     4. V2 Router approve 失敗 (2段目)');
      console.log('     5. V2 swapExactTokensForTokens 失敗 (2段目)');
      console.log('     6. HFUN transfer 失敗');
    }

    console.log('\\n🎯 デバッグ結果サマリー:');
    console.log(`   デプロイアドレス: ${debugAddress}`);
    console.log('   詳細ログで失敗箇所が特定可能');
    console.log('   イベントログで実行状況を追跡可能');

  } catch (error) {
    console.error('❌ デバッグテスト中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  deployAndTestDebugMultiSwap()
    .then(() => {
      console.log('\\n🔧 MultiSwapDebug テスト完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { deployAndTestDebugMultiSwap };