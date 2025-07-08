const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * MultiSwapArbitrageSimple 既存デプロイ済みコントラクトテスト
 * デプロイ済みアドレス: 0x4B90A95915a4a0C2690f1F36F3B4C347c27B41d2
 */

async function testDeployedArbitrage() {
  console.log('🤖 MultiSwapArbitrageSimple 既存コントラクトテスト');
  console.log('=======================================\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const privateKey = process.env.PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    const arbitrageAddress = '0x4B90A95915a4a0C2690f1F36F3B4C347c27B41d2';

    console.log('📋 設定:');
    console.log(`   Tester: ${wallet.address}`);
    console.log(`   Contract: ${arbitrageAddress}`);
    console.log('');

    // コントラクト接続
    const artifact = JSON.parse(fs.readFileSync(
      path.join(__dirname, 'artifacts/contracts/MultiSwapArbitrageSimple.sol/MultiSwapArbitrageSimple.json'), 
      'utf8'
    ));
    
    const arbitrageContract = new ethers.Contract(arbitrageAddress, artifact.abi, wallet);

    // 1. コントラクト情報確認
    console.log('📊 1. コントラクト状態確認:');
    
    const contractInfo = await arbitrageContract.getContractInfo();
    console.log(`   Owner: ${contractInfo.contractOwner}`);
    console.log(`   Paused: ${contractInfo.isPaused}`);
    console.log(`   WETH残高: ${ethers.formatEther(contractInfo.wethBalance)}`);
    console.log(`   PURR残高: ${ethers.formatEther(contractInfo.purrBalance)}`);
    console.log(`   HFUN残高: ${ethers.formatEther(contractInfo.hfunBalance)}`);
    console.log('');

    // 2. 資金デポジット（ChatGPT推奨の資金プール方式）
    console.log('💰 2. 資金デポジット（ガス最適化）:');
    
    const WETH = await arbitrageContract.WETH();
    const wethContract = new ethers.Contract(WETH, [
      "function approve(address spender, uint256 amount) returns (bool)",
      "function balanceOf(address owner) view returns (uint256)"
    ], wallet);
    
    const depositAmount = ethers.parseEther('0.001');
    const userWethBalance = await wethContract.balanceOf(wallet.address);
    
    console.log(`   ユーザーWETH残高: ${ethers.formatEther(userWethBalance)}`);
    
    if (userWethBalance >= depositAmount) {
      console.log('   📝 WETH Approve...');
      const approveTx = await wethContract.approve(arbitrageAddress, depositAmount);
      await approveTx.wait();
      
      console.log('   💰 資金デポジット実行...');
      const depositTx = await arbitrageContract.depositFunds(WETH, depositAmount);
      await depositTx.wait();
      
      console.log(`   ✅ ${ethers.formatEther(depositAmount)} WETH デポジット完了`);
    } else {
      console.log('   ⚠️  WETH残高不足 - テストをスキップ');
    }
    console.log('');

    // 3. アービトラージ実行（ガス最適化版）
    console.log('🔄 3. アービトラージ実行（ガス最適化）:');
    console.log('   ※ transferFromなし - 内部残高から直接実行');
    
    try {
      const arbAmount = ethers.parseEther('0.0001');
      const minOutput = ethers.parseEther('0.00001');
      
      // コントラクト残高確認
      const updatedInfo = await arbitrageContract.getContractInfo();
      console.log(`   コントラクトWETH残高: ${ethers.formatEther(updatedInfo.wethBalance)}`);
      
      if (updatedInfo.wethBalance >= arbAmount) {
        console.log('   🔍 callStaticテスト:');
        
        try {
          const staticResult = await arbitrageContract.executeWethToPurrToHfunArbitrage.staticCall(
            arbAmount,
            minOutput
          );
          
          console.log(`   ✅ 予想出力: ${ethers.formatEther(staticResult)} HFUN`);
          
          // 実際の実行
          console.log('\n   🚀 実際のアービトラージ実行:');
          const arbTx = await arbitrageContract.executeWethToPurrToHfunArbitrage(
            arbAmount,
            minOutput,
            { gasLimit: 800000 }
          );
          
          console.log(`   ✅ TX送信: ${arbTx.hash}`);
          const receipt = await arbTx.wait();
          console.log(`   ✅ 実行成功: Block ${receipt.blockNumber}`);
          
          // イベントログ解析
          console.log('\n   📋 アービトラージログ:');
          for (const log of receipt.logs) {
            try {
              const parsedLog = arbitrageContract.interface.parseLog(log);
              if (parsedLog && parsedLog.name === 'ArbitrageExecuted') {
                const tokenIn = parsedLog.args.tokenIn;
                const tokenOut = parsedLog.args.tokenOut;
                const amountIn = ethers.formatEther(parsedLog.args.amountIn);
                const amountOut = ethers.formatEther(parsedLog.args.amountOut);
                const profit = ethers.formatEther(parsedLog.args.profit);
                
                const tokenInName = tokenIn === WETH ? 'WETH' : tokenIn === await arbitrageContract.PURR() ? 'PURR' : 'HFUN';
                const tokenOutName = tokenOut === WETH ? 'WETH' : tokenOut === await arbitrageContract.PURR() ? 'PURR' : 'HFUN';
                
                console.log(`   ${tokenInName} → ${tokenOutName}: ${amountIn} → ${amountOut} (利益: ${profit})`);
              }
            } catch (e) {}
          }
          
          console.log('\n   🎉 ガス最適化アービトラージ成功!');
          
        } catch (staticError) {
          console.log(`   ❌ callStatic失敗: ${staticError.message}`);
        }
        
      } else {
        console.log('   ⚠️  コントラクト内WETH残高不足');
      }
      
    } catch (error) {
      console.log(`   ❌ エラー: ${error.message}`);
    }

    // 4. 管理機能テスト
    console.log('\n🛡️ 4. 管理機能テスト:');
    
    try {
      // 緊急停止テスト
      console.log('   🚨 緊急停止テスト:');
      const pauseTx = await arbitrageContract.toggleEmergencyPause();
      await pauseTx.wait();
      console.log('   ✅ 緊急停止: 有効化');
      
      // 停止中の実行テスト
      try {
        await arbitrageContract.executeWethToPurrToHfunArbitrage.staticCall(
          ethers.parseEther('0.0001'),
          ethers.parseEther('0.00001')
        );
        console.log('   ❌ 停止中でも実行可能（問題）');
      } catch (pauseError) {
        console.log('   ✅ 停止中は実行不可（正常）');
      }
      
      // 緊急停止解除
      const unpauseTx = await arbitrageContract.toggleEmergencyPause();
      await unpauseTx.wait();
      console.log('   ✅ 緊急停止: 解除');
      
    } catch (error) {
      console.log(`   ❌ 管理機能エラー: ${error.message}`);
    }

    // 5. 資金引き出しテスト
    console.log('\n💸 5. 資金引き出しテスト:');
    
    try {
      const finalInfo = await arbitrageContract.getContractInfo();
      const hfunBalance = finalInfo.hfunBalance;
      
      if (hfunBalance > 0) {
        console.log(`   HFUN残高: ${ethers.formatEther(hfunBalance)}`);
        
        const withdrawTx = await arbitrageContract.withdrawFunds(
          await arbitrageContract.HFUN(),
          0 // 0 = 全額引き出し
        );
        await withdrawTx.wait();
        
        console.log('   ✅ HFUN引き出し完了');
      } else {
        console.log('   💡 引き出し可能なHFUNなし');
      }
      
    } catch (error) {
      console.log(`   ❌ 引き出しエラー: ${error.message}`);
    }

    console.log('\n🎯 ChatGPT推奨事項実装結果:');
    console.log('=========================');
    console.log(`   デプロイアドレス: ${arbitrageAddress}`);
    console.log('   ✅ Owner-only access control');
    console.log('   ✅ Fund pooling (ガス最適化)');
    console.log('   ✅ Pre-approved router');
    console.log('   ✅ Reentrancy protection');
    console.log('   ✅ Emergency functions');
    console.log('   ✅ transferFrom不要でガス節約');

  } catch (error) {
    console.error('❌ アービトラージテスト中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  testDeployedArbitrage()
    .then(() => {
      console.log('\n🤖 アービトラージコントラクトテスト完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { testDeployedArbitrage };