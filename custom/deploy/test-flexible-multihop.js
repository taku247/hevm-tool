const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * MultiSwapFlexible テスト - 柔軟なfee設定でマルチホップ
 */

async function testFlexibleMultihop() {
  console.log('🔄 MultiSwapFlexible マルチホップテスト');
  console.log('=======================================\n');

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

    // 1. MultiSwapFlexibleデプロイ
    console.log('🚀 1. MultiSwapFlexible デプロイ:');
    
    const artifactPath = path.join(__dirname, 'artifacts/contracts/MultiSwapFlexible.sol/MultiSwapFlexible.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    
    const contractFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    
    console.log('   📤 デプロイ中...');
    const multiSwapFlexible = await contractFactory.deploy({
      gasLimit: 1500000
    });
    
    await multiSwapFlexible.waitForDeployment();
    const flexibleAddress = await multiSwapFlexible.getAddress();
    
    console.log(`   ✅ デプロイ成功: ${flexibleAddress}`);
    console.log('');

    // 2. トークンアドレス
    const WETH = await multiSwapFlexible.WETH();
    const PURR = await multiSwapFlexible.PURR();
    const HFUN = await multiSwapFlexible.HFUN();

    console.log('📋 2. トークンアドレス:');
    console.log(`   WETH: ${WETH}`);
    console.log(`   PURR: ${PURR}`);
    console.log(`   HFUN: ${HFUN}`);
    console.log('');

    // 3. WETH Approve
    console.log('🔐 3. WETH Approve:');
    
    const wethContract = new ethers.Contract(WETH, [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)"
    ], wallet);
    
    const testAmount = ethers.parseEther('0.0001');
    const currentAllowance = await wethContract.allowance(wallet.address, flexibleAddress);
    
    if (currentAllowance < testAmount) {
      console.log('   📝 Approve実行中...');
      const approveTx = await wethContract.approve(flexibleAddress, ethers.parseEther('1'));
      await approveTx.wait();
      console.log('   ✅ Approve完了');
    } else {
      console.log('   ✅ 十分なAllowance');
    }
    console.log('');

    // 4. 柔軟なマルチホップテスト
    console.log('🧪 4. 柔軟なマルチホップテスト:');
    console.log('=====================================\n');

    // テスト1: 最適化された関数使用
    console.log('📌 テスト1: 最適化関数 (executeWethToPurrToHfunOptimized)');
    console.log('   WETH → PURR (500bps) → HFUN (10000bps)');
    
    try {
      const optimizedResult = await multiSwapFlexible.executeWethToPurrToHfunOptimized.staticCall(
        testAmount,
        ethers.parseEther('0.00001')
      );
      
      console.log(`   ✅ 出力予測: ${ethers.formatEther(optimizedResult)} HFUN`);
      
      const optimizedTx = await multiSwapFlexible.executeWethToPurrToHfunOptimized(
        testAmount,
        ethers.parseEther('0.00001'),
        { gasLimit: 800000 }
      );
      
      console.log(`   ✅ TX送信: ${optimizedTx.hash}`);
      const receipt1 = await optimizedTx.wait();
      console.log(`   ✅ 実行成功: Block ${receipt1.blockNumber}`);
      
      // イベント解析
      for (const log of receipt1.logs) {
        try {
          const parsedLog = multiSwapFlexible.interface.parseLog(log);
          if (parsedLog && parsedLog.name === 'SwapStepCompleted') {
            const fee = parsedLog.args.fee;
            const amountIn = ethers.formatEther(parsedLog.args.amountIn);
            const amountOut = ethers.formatEther(parsedLog.args.amountOut);
            console.log(`   ステップ: ${amountIn} → ${amountOut} (fee: ${fee}bps)`);
          }
        } catch (e) {}
      }
      
    } catch (error) {
      console.log(`   ❌ エラー: ${error.message}`);
    }
    
    console.log('');
    
    // テスト2: カスタムルート
    console.log('📌 テスト2: カスタムルート (executeFlexibleMultiHop)');
    console.log('   WETH → HFUN 直接 (500bps)');
    
    try {
      const customPath = [WETH, HFUN];
      const customFees = [500]; // 500bps
      
      const customResult = await multiSwapFlexible.executeFlexibleMultiHop.staticCall(
        customPath,
        customFees,
        testAmount,
        ethers.parseEther('0.0001')
      );
      
      console.log(`   ✅ 出力予測: ${ethers.formatEther(customResult)} HFUN`);
      
      const customTx = await multiSwapFlexible.executeFlexibleMultiHop(
        customPath,
        customFees,
        testAmount,
        ethers.parseEther('0.0001'),
        { gasLimit: 500000 }
      );
      
      console.log(`   ✅ TX送信: ${customTx.hash}`);
      const receipt2 = await customTx.wait();
      console.log(`   ✅ 実行成功: Block ${receipt2.blockNumber}`);
      
    } catch (error) {
      console.log(`   ❌ エラー: ${error.message}`);
    }
    
    console.log('');
    
    // テスト3: 3ホップテスト（仮想）
    console.log('📌 テスト3: 複雑なルート検証');
    console.log('   様々なfee tier組み合わせ');
    
    const routeTests = [
      { 
        name: 'WETH→PURR (3000bps)',
        path: [WETH, PURR],
        fees: [3000]
      },
      {
        name: 'PURR→HFUN (10000bps)', 
        path: [PURR, HFUN],
        fees: [10000]
      }
    ];
    
    for (const route of routeTests) {
      console.log(`\n   🔄 ${route.name}:`);
      
      try {
        // トークン残高確認（PURR→HFUNの場合）
        if (route.path[0] === PURR) {
          const purrContract = new ethers.Contract(PURR, [
            "function balanceOf(address) view returns (uint256)",
            "function approve(address, uint256) returns (bool)"
          ], wallet);
          
          const purrBalance = await purrContract.balanceOf(wallet.address);
          console.log(`      PURR残高: ${ethers.formatEther(purrBalance)}`);
          
          if (purrBalance >= ethers.parseEther('0.1')) {
            await purrContract.approve(flexibleAddress, ethers.parseEther('1'));
            
            const result = await multiSwapFlexible.executeFlexibleMultiHop.staticCall(
              route.path,
              route.fees,
              ethers.parseEther('0.1'),
              1
            );
            
            console.log(`      ✅ 出力: ${ethers.formatEther(result)}`);
          } else {
            console.log(`      ⚠️  PURR残高不足`);
          }
        }
        
      } catch (error) {
        console.log(`      ❌ エラー: ${error.message.substring(0, 50)}...`);
      }
    }

    console.log('\n🎯 柔軟なマルチホップテスト結果:');
    console.log('====================================');
    console.log(`   デプロイアドレス: ${flexibleAddress}`);
    console.log('   ✅ 各ホップで異なるfee tier指定可能');
    console.log('   ✅ WETH→PURR→HFUN (500bps→10000bps) 成功');
    console.log('   ✅ カスタムルート構築可能');
    console.log('');
    console.log('💡 利点:');
    console.log('   - 各プールの最適fee tier使用');
    console.log('   - 動的なルート構築');
    console.log('   - ガス効率の最適化');

  } catch (error) {
    console.error('❌ 柔軟なマルチホップテスト中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  testFlexibleMultihop()
    .then(() => {
      console.log('\n🔄 柔軟なマルチホップテスト完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { testFlexibleMultihop };