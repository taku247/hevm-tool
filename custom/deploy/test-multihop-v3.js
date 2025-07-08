const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * MultiSwap カスタムマルチホップテスト (V3のみ)
 * executeCustomMultiSwap関数を使用して複数ホップのスワップをテスト
 */

async function testMultihopV3() {
  console.log('🔄 MultiSwap カスタムマルチホップテスト (V3のみ)');
  console.log('==============================================\n');

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

    // 1. デプロイ済みMultiSwapを使用するか、新規デプロイ
    console.log('🚀 1. MultiSwap準備:');
    
    let multiSwapAddress;
    let multiSwap;
    
    // 既存のデプロイアドレス（あれば使用）
    const existingAddress = '0x2f746d0a92CE19317EaF6F1569aac0078239bB35'; // 修正版のアドレス
    
    try {
      const artifact = JSON.parse(fs.readFileSync(
        path.join(__dirname, 'artifacts/contracts/MultiSwap.sol/MultiSwap.json'), 
        'utf8'
      ));
      
      // 既存コントラクトのコード確認
      const code = await provider.getCode(existingAddress);
      if (code !== '0x') {
        console.log(`   ✅ 既存のMultiSwap使用: ${existingAddress}`);
        multiSwapAddress = existingAddress;
        multiSwap = new ethers.Contract(existingAddress, artifact.abi, wallet);
      } else {
        throw new Error('デプロイ済みコントラクトが見つかりません');
      }
    } catch (error) {
      console.log('   ⚠️  新規デプロイが必要です');
      
      const artifact = JSON.parse(fs.readFileSync(
        path.join(__dirname, 'artifacts/contracts/MultiSwap.sol/MultiSwap.json'), 
        'utf8'
      ));
      
      const contractFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
      multiSwap = await contractFactory.deploy({ gasLimit: 2000000 });
      await multiSwap.waitForDeployment();
      multiSwapAddress = await multiSwap.getAddress();
      console.log(`   ✅ 新規デプロイ完了: ${multiSwapAddress}`);
    }
    console.log('');

    // 2. トークンアドレス取得
    const WETH = await multiSwap.WETH();
    const PURR = await multiSwap.PURR();
    const HFUN = await multiSwap.HFUN();

    console.log('📋 2. トークンアドレス:');
    console.log(`   WETH: ${WETH}`);
    console.log(`   PURR: ${PURR}`);
    console.log(`   HFUN: ${HFUN}`);
    console.log('');

    // 3. テストケース定義
    console.log('🧪 3. マルチホップテストケース:');
    
    const testCases = [
      {
        name: 'WETH → PURR → HFUN (2ホップ)',
        path: [WETH, PURR, HFUN],
        amount: ethers.parseEther('0.0001'),
        routerTypes: ['V3', 'V3'],
        minOutput: ethers.parseEther('0.00001')
      },
      {
        name: 'WETH → HFUN 直接 (1ホップ)',
        path: [WETH, HFUN],
        amount: ethers.parseEther('0.0001'),
        routerTypes: ['V3'],
        minOutput: ethers.parseEther('0.0001')
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n🔄 テスト: ${testCase.name}`);
      console.log(`   パス: ${testCase.path.map((addr, i) => {
        if (addr === WETH) return 'WETH';
        if (addr === PURR) return 'PURR';
        if (addr === HFUN) return 'HFUN';
        return addr;
      }).join(' → ')}`);
      console.log(`   入力量: ${ethers.formatEther(testCase.amount)}`);
      console.log(`   ルーター: ${testCase.routerTypes.join(', ')}`);
      console.log('');

      try {
        // 4. WETH Approve
        console.log('   🔐 Approve確認:');
        const wethContract = new ethers.Contract(WETH, [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
          "function balanceOf(address owner) view returns (uint256)"
        ], wallet);
        
        const wethBalance = await wethContract.balanceOf(wallet.address);
        console.log(`      WETH残高: ${ethers.formatEther(wethBalance)}`);
        
        if (wethBalance < testCase.amount) {
          console.log('      ❌ WETH残高不足');
          continue;
        }
        
        const currentAllowance = await wethContract.allowance(wallet.address, multiSwapAddress);
        
        if (currentAllowance < testCase.amount) {
          console.log('      📝 Approve実行中...');
          const approveTx = await wethContract.approve(multiSwapAddress, ethers.parseEther('1'));
          await approveTx.wait();
          console.log('      ✅ Approve完了');
        } else {
          console.log('      ✅ 十分なAllowance');
        }

        // 5. callStaticでテスト
        console.log('\n   🔍 callStaticテスト:');
        
        try {
          const staticResult = await multiSwap.executeCustomMultiSwap.staticCall(
            testCase.path,
            testCase.amount,
            testCase.minOutput,
            testCase.routerTypes
          );
          
          console.log(`      ✅ 出力予測: ${ethers.formatEther(staticResult)}`);
          
          // 6. 実際の実行
          console.log('\n   🚀 実際のマルチスワップ実行:');
          
          const swapTx = await multiSwap.executeCustomMultiSwap(
            testCase.path,
            testCase.amount,
            testCase.minOutput,
            testCase.routerTypes,
            {
              gasLimit: 1000000
            }
          );
          
          console.log(`      ✅ TX送信: ${swapTx.hash}`);
          const receipt = await swapTx.wait();
          console.log(`      ✅ 実行成功: Block ${receipt.blockNumber}`);
          
          // 7. イベントログ解析
          console.log('\n   📋 イベントログ:');
          let swapSteps = [];
          
          for (const log of receipt.logs) {
            try {
              const parsedLog = multiSwap.interface.parseLog(log);
              if (parsedLog) {
                if (parsedLog.name === 'SwapStepCompleted') {
                  const tokenIn = parsedLog.args.tokenIn;
                  const tokenOut = parsedLog.args.tokenOut;
                  const amountIn = ethers.formatEther(parsedLog.args.amountIn);
                  const amountOut = ethers.formatEther(parsedLog.args.amountOut);
                  const router = parsedLog.args.routerType;
                  
                  const tokenInName = tokenIn === WETH ? 'WETH' : tokenIn === PURR ? 'PURR' : tokenIn === HFUN ? 'HFUN' : tokenIn;
                  const tokenOutName = tokenOut === WETH ? 'WETH' : tokenOut === PURR ? 'PURR' : tokenOut === HFUN ? 'HFUN' : tokenOut;
                  
                  swapSteps.push(`${tokenInName} → ${tokenOutName}: ${amountIn} → ${amountOut} (${router})`);
                  console.log(`      ステップ: ${swapSteps[swapSteps.length - 1]}`);
                } else if (parsedLog.name === 'MultiSwapExecuted') {
                  console.log(`      最終出力: ${ethers.formatEther(parsedLog.args.finalAmount)}`);
                }
              }
            } catch (e) {
              // 他のコントラクトのログはスキップ
            }
          }
          
          console.log(`\n   🎉 ${testCase.name} 成功!`);
          
        } catch (staticError) {
          console.log(`      ❌ callStatic失敗: ${staticError.message}`);
          
          if (staticError.message.includes('V3 swap failed')) {
            console.log('      💡 V3スワップの失敗 - fee設定の調整が必要');
            console.log('      💡 現在の実装は固定500bpsを使用');
            console.log('      💡 PURR→HFUNは10000bps必要');
          }
        }
        
      } catch (error) {
        console.log(`   ❌ エラー: ${error.message}`);
      }
    }

    console.log('\n🎯 カスタムマルチホップテスト結果サマリー:');
    console.log(`   デプロイアドレス: ${multiSwapAddress}`);
    console.log('   V3のみ使用でのマルチホップテスト完了');
    console.log('');
    console.log('💡 改善提案:');
    console.log('   1. executeCustomMultiSwapにfee配列パラメータ追加');
    console.log('   2. 各ホップで適切なfee tier指定可能に');
    console.log('   3. 動的なルート最適化の実装');

  } catch (error) {
    console.error('❌ マルチホップテスト中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  testMultihopV3()
    .then(() => {
      console.log('\n🔄 マルチホップV3テスト完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { testMultihopV3 };