const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * 修正されたMultiSwap コントラクトテスト
 * V3のみ使用 & 正しい手数料設定
 */

async function testFixedMultiSwap() {
  console.log('🔧 修正版MultiSwap テスト');
  console.log('============================\n');

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

    // 1. 修正版MultiSwapデプロイ
    console.log('🚀 1. 修正版MultiSwap デプロイ:');
    
    const artifactPath = path.join(__dirname, 'artifacts/contracts/MultiSwap.sol/MultiSwap.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    
    const contractFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    
    console.log('   📤 デプロイ中...');
    const multiSwap = await contractFactory.deploy({
      gasLimit: 2000000
    });
    
    await multiSwap.waitForDeployment();
    const multiSwapAddress = await multiSwap.getAddress();
    
    console.log(`   ✅ デプロイ成功: ${multiSwapAddress}`);
    console.log('');

    // 2. WETH Approve
    console.log('🔐 2. WETH Approve:');
    
    const wethAddress = await multiSwap.WETH();
    const wethContract = new ethers.Contract(wethAddress, [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)"
    ], wallet);
    
    const testAmount = ethers.parseEther('0.0001');
    const currentAllowance = await wethContract.allowance(wallet.address, multiSwapAddress);
    
    if (currentAllowance < testAmount) {
      console.log('   📝 Approve実行中...');
      const approveTx = await wethContract.approve(multiSwapAddress, ethers.parseEther('1'));
      await approveTx.wait();
      console.log('   ✅ Approve完了');
    } else {
      console.log('   ✅ 十分なAllowance');
    }
    console.log('');

    // 3. 修正版マルチスワップ実行
    console.log('🧪 3. 修正版マルチスワップ実行:');
    console.log('   ※ 1段目: V3 (500bps), 2段目: V3 (10000bps)');
    console.log('');
    
    const swapParams = {
      wethAmount: testAmount,
      minPurrOutput: ethers.parseEther('0.0001'),
      minHfunOutput: ethers.parseEther('0.00001'), // 低いレートに対応
      slippageBps: 1000, // 10%
      useV3ForFirst: true
    };
    
    console.log('   パラメータ:');
    console.log(`     WETH入力: ${ethers.formatEther(swapParams.wethAmount)}`);
    console.log(`     最低PURR: ${ethers.formatEther(swapParams.minPurrOutput)}`);
    console.log(`     最低HFUN: ${ethers.formatEther(swapParams.minHfunOutput)}`);
    console.log(`     Slippage: ${swapParams.slippageBps / 100}%`);
    console.log(`     V3使用: ${swapParams.useV3ForFirst}`);
    console.log('');

    try {
      // callStatic でエラー箇所特定
      console.log('   🔍 callStatic実行（修正版テスト）:');
      
      const result = await multiSwap.executeWethToPurrToHfun.staticCall(
        swapParams.wethAmount,
        swapParams.minPurrOutput,
        swapParams.minHfunOutput,
        swapParams.slippageBps,
        swapParams.useV3ForFirst
      );
      
      console.log(`   ✅ callStatic成功: ${ethers.formatEther(result)} HFUN`);
      console.log('   💡 修正版では問題なし!');
      
      // 実際の実行
      console.log('\n   🚀 実際のマルチスワップ実行:');
      const swapTx = await multiSwap.executeWethToPurrToHfun(
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
      console.log('\n📋 4. イベントログ解析:');
      for (const log of receipt.logs) {
        try {
          const parsedLog = multiSwap.interface.parseLog(log);
          if (parsedLog) {
            console.log(`   🎯 ${parsedLog.name}:`);
            if (parsedLog.name === 'SwapStepCompleted') {
              console.log(`      ${parsedLog.args.tokenIn} → ${parsedLog.args.tokenOut}`);
              console.log(`      入力: ${ethers.formatEther(parsedLog.args.amountIn)}`);
              console.log(`      出力: ${ethers.formatEther(parsedLog.args.amountOut)}`);
              console.log(`      Router: ${parsedLog.args.routerType}`);
            } else if (parsedLog.name === 'MultiSwapExecuted') {
              console.log(`      最終出力: ${ethers.formatEther(parsedLog.args.finalAmount)}`);
            }
          }
        } catch (e) {
          // 他のコントラクトのログはスキップ
        }
      }
      
      console.log('\n🎉 結論: 修正版MultiSwapが正常動作!');
      console.log('💡 V3 + 正しい手数料設定で問題解決');
      
    } catch (error) {
      console.log(`   ❌ 修正版でも失敗: ${error.message}`);
      
      if (error.reason) {
        console.log(`   リバート理由: ${error.reason}`);
      }
    }

    console.log('\n🎯 修正版テスト結果サマリー:');
    console.log(`   デプロイアドレス: ${multiSwapAddress}`);
    console.log('   修正内容: 2段目をV2→V3 & 10000bps手数料');
    console.log('   元の問題: V2制約 & 手数料設定ミス');

  } catch (error) {
    console.error('❌ 修正版テスト中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  testFixedMultiSwap()
    .then(() => {
      console.log('\n🔧 修正版MultiSwap テスト完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { testFixedMultiSwap };