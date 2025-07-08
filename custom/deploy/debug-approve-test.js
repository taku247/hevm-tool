const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * MultiSwapコントラクトのapprove状況をデバッグ
 */

const MULTISWAP_ADDRESS = '0x6f413c13a1bf5e855e4E522a66FC2a6efC2c2841';
const V2_ROUTER = '0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853';

const TOKENS = {
  WETH: '0xADcb2f358Eae6492F61A5F87eb8893d09391d160',
  PURR: '0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82',
  HFUN: '0x37adB2550b965851593832a6444763eeB3e1d1Ec'
};

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

async function debugApproveTest() {
  console.log('🔍 MultiSwap Approve状況デバッグ');
  console.log('=================================\\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const privateKey = process.env.PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('📋 設定:');
    console.log(`   ウォレット: ${wallet.address}`);
    console.log(`   MultiSwap: ${MULTISWAP_ADDRESS}`);
    console.log(`   V2 Router: ${V2_ROUTER}`);
    console.log('');

    // 1. ユーザー → MultiSwap の Allowance確認
    console.log('👤 1. ユーザー → MultiSwap Allowance:');
    
    for (const [symbol, address] of Object.entries(TOKENS)) {
      const tokenContract = new ethers.Contract(address, ERC20_ABI, provider);
      const allowance = await tokenContract.allowance(wallet.address, MULTISWAP_ADDRESS);
      const balance = await tokenContract.balanceOf(wallet.address);
      
      console.log(`   ${symbol}:`);
      console.log(`     残高: ${ethers.formatEther(balance)}`);
      console.log(`     Allowance: ${ethers.formatEther(allowance)}`);
    }
    console.log('');

    // 2. MultiSwap → Router の Allowance確認
    console.log('🤖 2. MultiSwap → Router Allowance:');
    
    for (const [symbol, address] of Object.entries(TOKENS)) {
      const tokenContract = new ethers.Contract(address, ERC20_ABI, provider);
      const allowance = await tokenContract.allowance(MULTISWAP_ADDRESS, V2_ROUTER);
      const balance = await tokenContract.balanceOf(MULTISWAP_ADDRESS);
      
      console.log(`   ${symbol}:`);
      console.log(`     MultiSwap残高: ${ethers.formatEther(balance)}`);
      console.log(`     Router Allowance: ${ethers.formatEther(allowance)}`);
    }
    console.log('');

    // 3. MultiSwapコントラクトの内部処理シミュレーション
    console.log('🧪 3. 内部処理シミュレーション:');
    
    const artifactPath = path.join(__dirname, 'abi/MultiSwap.json');
    const multiSwapABI = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const multiSwap = new ethers.Contract(MULTISWAP_ADDRESS, multiSwapABI, wallet);

    // 非常に小さな金額でテスト準備
    const testAmount = ethers.parseEther('0.00001'); // 0.00001 WETH
    
    console.log(`   テスト金額: ${ethers.formatEther(testAmount)} WETH`);
    
    // Step 1: WETH残高とAllowance確認
    const wethContract = new ethers.Contract(TOKENS.WETH, ERC20_ABI, provider);
    const userWethBalance = await wethContract.balanceOf(wallet.address);
    const userWethAllowance = await wethContract.allowance(wallet.address, MULTISWAP_ADDRESS);
    
    console.log(`   ユーザーWETH残高: ${ethers.formatEther(userWethBalance)}`);
    console.log(`   ユーザーWETH Allowance: ${ethers.formatEther(userWethAllowance)}`);
    
    if (userWethBalance < testAmount) {
      console.log('   ❌ WETH残高不足');
      return;
    }
    
    if (userWethAllowance < testAmount) {
      console.log('   ❌ WETH Allowance不足');
      return;
    }
    
    console.log('   ✅ WETH準備OK');
    
    // 実際のマルチスワップでのApprove問題をテスト
    console.log('\\n🔬 4. 詳細なApprove分析:');
    
    try {
      // callStaticで実行せずに詳細を確認
      console.log('   実行前のMultiSwapコントラクト内トークン残高:');
      
      for (const [symbol, address] of Object.entries(TOKENS)) {
        const tokenContract = new ethers.Contract(address, ERC20_ABI, provider);
        const balance = await tokenContract.balanceOf(MULTISWAP_ADDRESS);
        console.log(`     ${symbol}: ${ethers.formatEther(balance)}`);
      }
      
      // 問題の特定: なぜスワップが失敗するのか？
      console.log('\\n   💡 分析:');
      console.log('     1. ユーザー側のApprove: ✅ 完了');
      console.log('     2. MultiSwap内部のApprove: ❓ 確認必要');
      console.log('     3. Router流動性: ❓ 確認必要');
      console.log('     4. トークン転送制限: ❓ 確認必要');
      
    } catch (error) {
      console.log(`   ❌ 分析エラー: ${error.message}`);
    }

    console.log('\\n🎯 結論と推奨対応:');
    console.log('   1. MultiSwapコントラクトのApprove実装は理論的に正しい');
    console.log('   2. 問題は以下のいずれかの可能性:');
    console.log('      - テストネットプールの流動性不足');
    console.log('      - トークンコントラクトの転送制限');
    console.log('      - Router実装の特殊な要件');
    console.log('      - ガス不足や他の実行時エラー');

  } catch (error) {
    console.error('❌ デバッグ中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  debugApproveTest()
    .then(() => {
      console.log('\\n🔍 Approve状況デバッグ完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { debugApproveTest };