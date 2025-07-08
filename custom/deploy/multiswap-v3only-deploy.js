const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * MultiSwapV3Only コントラクトデプロイ & テスト
 * V2問題を迂回してV3のみで実行
 */

async function deployAndTestV3OnlyMultiSwap() {
  console.log('🚀 MultiSwapV3Only デプロイ & テスト');
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

    // 1. V3のみコントラクトデプロイ
    console.log('🚀 1. MultiSwapV3Only デプロイ:');
    
    const artifactPath = path.join(__dirname, 'artifacts/contracts/MultiSwapV3Only.sol/MultiSwapV3Only.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    
    const contractFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    
    console.log('   📤 デプロイ中...');
    const multiSwapV3Only = await contractFactory.deploy({
      gasLimit: 1200000  // V3のみなので更に軽量
    });
    
    await multiSwapV3Only.waitForDeployment();
    const v3OnlyAddress = await multiSwapV3Only.getAddress();
    
    console.log(`   ✅ デプロイ成功: ${v3OnlyAddress}`);
    console.log('');

    // 2. WETH Approve
    console.log('🔐 2. WETH Approve:');
    
    const wethAddress = await multiSwapV3Only.WETH();
    const wethContract = new ethers.Contract(wethAddress, [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)"
    ], wallet);
    
    const currentAllowance = await wethContract.allowance(wallet.address, v3OnlyAddress);
    const testAmount = ethers.parseEther('0.0001');
    
    if (currentAllowance < testAmount) {
      console.log('   📝 Approve実行中...');
      const approveTx = await wethContract.approve(v3OnlyAddress, ethers.parseEther('1'));
      await approveTx.wait();
      console.log('   ✅ Approve完了');
    } else {
      console.log('   ✅ 十分なAllowance');
    }
    console.log('');

    // 3. V3のみマルチスワップ実行
    console.log('🧪 3. V3のみマルチスワップ実行:');
    console.log('   ※ V2問題を迂回、両方のスワップでV3使用');
    console.log('');
    
    const swapParams = {
      wethAmount: testAmount,
      minPurrOutput: ethers.parseEther('0.0001'),
      minHfunOutput: ethers.parseEther('0.00001'), // PURR/HFUN レート低いため調整
      firstFee: 500,    // WETH/PURR プール fee
      secondFee: 10000  // PURR/HFUN プール fee (1%が正解!)
    };
    
    console.log('   パラメータ:');
    console.log(`     WETH入力: ${ethers.formatEther(swapParams.wethAmount)}`);
    console.log(`     最低PURR: ${ethers.formatEther(swapParams.minPurrOutput)}`);
    console.log(`     最低HFUN: ${ethers.formatEther(swapParams.minHfunOutput)}`);
    console.log(`     1段目Fee: ${swapParams.firstFee} (0.05%)`);
    console.log(`     2段目Fee: ${swapParams.secondFee} (1%)`);
    console.log('');

    try {
      // callStatic でエラー箇所特定
      console.log('   🔍 callStatic実行（V3のみでテスト）:');
      
      const result = await multiSwapV3Only.executeWethToPurrToHfunV3Only.staticCall(
        swapParams.wethAmount,
        swapParams.minPurrOutput,
        swapParams.minHfunOutput,
        swapParams.firstFee,
        swapParams.secondFee
      );
      
      console.log(`   ✅ callStatic成功: ${ethers.formatEther(result)} HFUN`);
      console.log('   💡 V3のみでは問題なし!');
      
      // 実際の実行
      console.log('\n   🚀 実際のV3スワップ実行:');
      const swapTx = await multiSwapV3Only.executeWethToPurrToHfunV3Only(
        swapParams.wethAmount,
        swapParams.minPurrOutput,
        swapParams.minHfunOutput,
        swapParams.firstFee,
        swapParams.secondFee,
        {
          gasLimit: 800000
        }
      );
      
      console.log(`   ✅ TX送信: ${swapTx.hash}`);
      const receipt = await swapTx.wait();
      console.log(`   ✅ 実行成功: Block ${receipt.blockNumber}`);
      
      // イベントログ解析
      console.log('\n📋 4. イベントログ解析:');
      for (const log of receipt.logs) {
        try {
          const parsedLog = multiSwapV3Only.interface.parseLog(log);
          if (parsedLog) {
            console.log(`   🎯 ${parsedLog.name}:`);
            if (parsedLog.name === 'SwapCompleted') {
              console.log(`      ステージ: ${parsedLog.args.stage}`);
              console.log(`      ${parsedLog.args.tokenIn} → ${parsedLog.args.tokenOut}`);
              console.log(`      入力: ${ethers.formatEther(parsedLog.args.amountIn)}`);
              console.log(`      出力: ${ethers.formatEther(parsedLog.args.amountOut)}`);
            } else if (parsedLog.name === 'MultiSwapExecuted') {
              console.log(`      WETH入力: ${ethers.formatEther(parsedLog.args.wethIn)}`);
              console.log(`      PURR中間: ${ethers.formatEther(parsedLog.args.purrOut)}`);
              console.log(`      HFUN最終: ${ethers.formatEther(parsedLog.args.hfunOut)}`);
            }
          }
        } catch (e) {
          // 他のコントラクトのログはスキップ
        }
      }
      
      console.log('\n🎉 結論: V3のみ使用でマルチスワップ成功!');
      console.log('💡 V2 Router (2段目) が問題の原因と確定');
      
    } catch (error) {
      console.log(`   ❌ V3のみでも失敗: ${error.message}`);
      
      if (error.message.includes('PURR/HFUN')) {
        console.log('   💡 PURR/HFUN V3プールが存在しない可能性');
        console.log('   💡 fee設定 (3000) を調整する必要あり');
      }
    }

    console.log('\n🎯 V3のみテスト結果サマリー:');
    console.log(`   デプロイアドレス: ${v3OnlyAddress}`);
    console.log('   V2問題迂回テスト完了');
    console.log('   実際の失敗原因特定可能');

  } catch (error) {
    console.error('❌ V3のみテスト中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  deployAndTestV3OnlyMultiSwap()
    .then(() => {
      console.log('\n🚀 MultiSwapV3Only テスト完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { deployAndTestV3OnlyMultiSwap };