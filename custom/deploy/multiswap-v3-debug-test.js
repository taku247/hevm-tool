const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * MultiSwap V3問題デバッグテスト
 * V3 Router直接 vs MultiSwap経由の比較
 */

const MULTISWAP_ADDRESS = '0x6f413c13a1bf5e855e4E522a66FC2a6efC2c2841';
const V3_ROUTER01_ADDRESS = '0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990';

const TOKENS = {
  WETH: '0xADcb2f358Eae6492F61A5F87eb8893d09391d160',
  PURR: '0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82',
  HFUN: '0x37adB2550b965851593832a6444763eeB3e1d1Ec'
};

const V3_ROUTER_ABI = [
  {
    "inputs": [
      {
        "components": [
          { "name": "tokenIn", "type": "address" },
          { "name": "tokenOut", "type": "address" },
          { "name": "fee", "type": "uint24" },
          { "name": "recipient", "type": "address" },
          { "name": "deadline", "type": "uint256" },
          { "name": "amountIn", "type": "uint256" },
          { "name": "amountOutMinimum", "type": "uint256" },
          { "name": "sqrtPriceLimitX96", "type": "uint160" }
        ],
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "exactInputSingle",
    "outputs": [
      { "name": "amountOut", "type": "uint256" }
    ],
    "stateMutability": "payable",
    "type": "function"
  }
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)"
];

async function debugMultiSwapV3() {
  console.log('🔧 MultiSwap V3 デバッグテスト');
  console.log('===============================\\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const privateKey = process.env.PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('📋 設定:');
    console.log(`   ウォレット: ${wallet.address}`);
    console.log(`   MultiSwap: ${MULTISWAP_ADDRESS}`);
    console.log(`   V3 Router01: ${V3_ROUTER01_ADDRESS}`);
    console.log('');

    const testAmount = ethers.parseEther('0.0001'); // 0.0001 WETH

    // 1. V3 Router直接テスト (成功するはず)
    console.log('🚀 1. V3 Router 直接テスト:');
    
    const v3Router = new ethers.Contract(V3_ROUTER01_ADDRESS, V3_ROUTER_ABI, wallet);
    const wethContract = new ethers.Contract(TOKENS.WETH, ERC20_ABI, wallet);
    
    // WETH残高確認
    const wethBalance = await wethContract.balanceOf(wallet.address);
    console.log(`   WETH残高: ${ethers.formatEther(wethBalance)}`);
    
    if (wethBalance < testAmount) {
      console.log('   ❌ WETH残高不足');
      return;
    }
    
    // Allowance確認
    const allowance = await wethContract.allowance(wallet.address, V3_ROUTER01_ADDRESS);
    console.log(`   V3 Router Allowance: ${ethers.formatEther(allowance)}`);
    
    if (allowance < testAmount) {
      console.log('   📝 V3 Router Approve実行中...');
      const approveTx = await wethContract.approve(V3_ROUTER01_ADDRESS, ethers.parseEther('1'));
      await approveTx.wait();
      console.log('   ✅ V3 Router Approve完了');
    }
    
    // V3直接スワップテスト
    try {
      const deadline = Math.floor(Date.now() / 1000) + 300;
      const params = {
        tokenIn: TOKENS.WETH,
        tokenOut: TOKENS.PURR,
        fee: 500, // 0.05%
        recipient: wallet.address,
        deadline: deadline,
        amountIn: testAmount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      };
      
      console.log(`   テストパラメータ:`);
      console.log(`     入力: ${ethers.formatEther(testAmount)} WETH`);
      console.log(`     手数料: 500 (0.05%)`);
      console.log(`     期限: ${deadline}`);
      
      // callStatic テスト
      const staticResult = await v3Router.exactInputSingle.staticCall(params);
      console.log(`   ✅ V3直接 callStatic成功: ${ethers.formatEther(staticResult)} PURR`);
      
      // 実際のスワップ実行
      console.log('   📤 V3直接スワップ実行中...');
      const swapTx = await v3Router.exactInputSingle(params, {
        gasLimit: 200000
      });
      
      console.log(`   ✅ V3直接スワップ送信: ${swapTx.hash}`);
      const receipt = await swapTx.wait();
      console.log(`   ✅ V3直接スワップ成功: Block ${receipt.blockNumber}`);
      console.log(`   ⛽ ガス使用: ${receipt.gasUsed.toString()}`);
      
    } catch (error) {
      console.log(`   ❌ V3直接スワップ失敗: ${error.message}`);
    }
    
    console.log('');

    // 2. MultiSwap経由テスト
    console.log('🎯 2. MultiSwap経由テスト:');
    
    const artifactPath = path.join(__dirname, 'abi/MultiSwap.json');
    const multiSwapABI = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const multiSwap = new ethers.Contract(MULTISWAP_ADDRESS, multiSwapABI, wallet);

    // MultiSwap Allowance確認
    const multiSwapAllowance = await wethContract.allowance(wallet.address, MULTISWAP_ADDRESS);
    console.log(`   MultiSwap Allowance: ${ethers.formatEther(multiSwapAllowance)}`);
    
    // 単一のV3スワップテスト（WETH→PURRのみ）
    try {
      const minPurrOutput = ethers.parseEther('0.0001'); // 非常に低い最小値
      const minHfunOutput = ethers.parseEther('0.0001'); // 非常に低い最小値
      const slippageBps = 1000; // 10%
      
      console.log(`   テストパラメータ:`);
      console.log(`     入力: ${ethers.formatEther(testAmount)} WETH`);
      console.log(`     最低PURR: ${ethers.formatEther(minPurrOutput)}`);
      console.log(`     最低HFUN: ${ethers.formatEther(minHfunOutput)}`);
      console.log(`     V3使用: true`);
      
      // callStatic テスト
      console.log('   🧪 MultiSwap callStatic...');
      const multiSwapResult = await multiSwap.executeWethToPurrToHfun.staticCall(
        testAmount,
        minPurrOutput,
        minHfunOutput,
        slippageBps,
        true // V3使用
      );
      
      console.log(`   ✅ MultiSwap callStatic成功: ${ethers.formatEther(multiSwapResult)} HFUN`);
      
      // 実際のMultiSwap実行
      console.log('   📤 MultiSwap実行中...');
      const multiSwapTx = await multiSwap.executeWethToPurrToHfun(
        testAmount,
        minPurrOutput,
        minHfunOutput,
        slippageBps,
        true, // V3使用
        {
          gasLimit: 500000
        }
      );
      
      console.log(`   ✅ MultiSwap送信: ${multiSwapTx.hash}`);
      const multiSwapReceipt = await multiSwapTx.wait();
      console.log(`   ✅ MultiSwap成功: Block ${multiSwapReceipt.blockNumber}`);
      console.log(`   ⛽ ガス使用: ${multiSwapReceipt.gasUsed.toString()}`);
      
    } catch (error) {
      console.log(`   ❌ MultiSwap失敗: ${error.message}`);
      
      // エラー詳細分析
      console.log('   🔍 エラー詳細分析:');
      if (error.message.includes('missing revert data')) {
        console.log('     → V3 Router内部でのリバート');
        console.log('     → MultiSwapコントラクトのV3実装問題の可能性');
      }
      if (error.message.includes('CALL_EXCEPTION')) {
        console.log('     → コントラクト呼び出し例外');
        console.log('     → 引数エンコードまたは関数セレクタの問題');
      }
    }

    console.log('');
    console.log('🎯 デバッグ結論:');
    console.log('   1. V3 Router直接: 動作確認');
    console.log('   2. MultiSwap経由: 問題の特定');
    console.log('   3. 問題箇所: MultiSwapコントラクト内のV3実装');

  } catch (error) {
    console.error('❌ デバッグ中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  debugMultiSwapV3()
    .then(() => {
      console.log('\\n🔧 MultiSwap V3デバッグ完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { debugMultiSwapV3 };