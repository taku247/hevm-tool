const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * MultiSwap コントラクトの実際のスワップテスト
 * WETH → PURR → HFUN のマルチスワップを実行
 */

// デプロイ済みコントラクトアドレス
const MULTISWAP_ADDRESS = '0x6f413c13a1bf5e855e4E522a66FC2a6efC2c2841';

// トークンアドレス
const TOKENS = {
  WETH: '0xADcb2f358Eae6492F61A5F87eb8893d09391d160',
  PURR: '0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82',
  HFUN: '0x37adB2550b965851593832a6444763eeB3e1d1Ec'
};

// ERC20 ABI (最小限)
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

async function executeMultiSwapTest() {
  console.log('🧪 MultiSwap 実際のスワップテスト');
  console.log('=====================================\\n');

  try {
    // 環境設定
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const privateKey = process.env.PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    
    if (!privateKey) {
      console.log('❌ 秘密鍵が設定されていません');
      return;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('📋 設定情報:');
    console.log(`   ウォレット: ${wallet.address}`);
    console.log(`   MultiSwap: ${MULTISWAP_ADDRESS}`);
    console.log('');

    // MultiSwap コントラクト読み込み
    const artifactPath = path.join(__dirname, 'abi/MultiSwap.json');
    const multiSwapABI = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const multiSwap = new ethers.Contract(MULTISWAP_ADDRESS, multiSwapABI, wallet);

    // Step 1: 残高確認
    console.log('💰 1. 現在の残高確認:');
    
    const tokens = [
      { symbol: 'WETH', address: TOKENS.WETH },
      { symbol: 'PURR', address: TOKENS.PURR },
      { symbol: 'HFUN', address: TOKENS.HFUN }
    ];

    const balances = {};
    for (const token of tokens) {
      const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const balance = await tokenContract.balanceOf(wallet.address);
      const decimals = await tokenContract.decimals();
      const formattedBalance = ethers.formatUnits(balance, decimals);
      balances[token.symbol] = { raw: balance, formatted: formattedBalance, decimals };
      
      console.log(`   ${token.symbol}: ${formattedBalance}`);
    }
    console.log('');

    // Step 2: スワップ設定
    console.log('⚙️  2. スワップパラメータ設定:');
    
    const swapAmount = ethers.parseEther('0.001'); // 0.001 WETH
    const minPurrOutput = ethers.parseEther('0.5'); // 最低 0.5 PURR
    const minHfunOutput = ethers.parseEther('0.8'); // 最低 0.8 HFUN
    const slippageBps = 300; // 3% slippage
    const useV3ForFirst = true; // V3使用
    
    console.log(`   入力WETH: ${ethers.formatEther(swapAmount)}`);
    console.log(`   最低PURR: ${ethers.formatEther(minPurrOutput)}`);
    console.log(`   最低HFUN: ${ethers.formatEther(minHfunOutput)}`);
    console.log(`   スリッページ: ${slippageBps / 100}%`);
    console.log(`   V3使用: ${useV3ForFirst ? 'Yes' : 'No'}`);
    console.log('');

    // WETHが十分にあるかチェック
    if (balances.WETH.raw < swapAmount) {
      console.log('❌ WETH残高が不足しています');
      console.log(`   必要: ${ethers.formatEther(swapAmount)} WETH`);
      console.log(`   現在: ${balances.WETH.formatted} WETH`);
      return;
    }

    // Step 3: Approve確認/実行
    console.log('🔐 3. WETH Approve確認:');
    
    const wethContract = new ethers.Contract(TOKENS.WETH, ERC20_ABI, wallet);
    const currentAllowance = await wethContract.allowance(wallet.address, MULTISWAP_ADDRESS);
    
    console.log(`   現在のAllowance: ${ethers.formatEther(currentAllowance)} WETH`);
    
    if (currentAllowance < swapAmount) {
      console.log('   📝 Approve実行中...');
      
      const approveTx = await wethContract.approve(MULTISWAP_ADDRESS, ethers.parseEther('1')); // 1 WETH approve
      console.log(`   ✅ Approve TX: ${approveTx.hash}`);
      
      await approveTx.wait();
      console.log('   ✅ Approve完了');
      
      const newAllowance = await wethContract.allowance(wallet.address, MULTISWAP_ADDRESS);
      console.log(`   新しいAllowance: ${ethers.formatEther(newAllowance)} WETH`);
    } else {
      console.log('   ✅ 十分なAllowanceあり');
    }
    console.log('');

    // Step 4: 見積もり取得
    console.log('📊 4. スワップ見積もり:');
    
    try {
      const [estimatedHfun, estimatedPurr] = await multiSwap.getEstimatedOutput(swapAmount, useV3ForFirst);
      console.log(`   推定PURR出力: ${ethers.formatEther(estimatedPurr)}`);
      console.log(`   推定HFUN出力: ${ethers.formatEther(estimatedHfun)}`);
    } catch (error) {
      console.log(`   ⚠️  見積もり取得失敗: ${error.message}`);
    }
    console.log('');

    // Step 5: マルチスワップ実行
    console.log('🚀 5. マルチスワップ実行:');
    console.log('   WETH → PURR → HFUN');
    
    try {
      // ガス見積もり
      const gasEstimate = await multiSwap.executeWethToPurrToHfun.estimateGas(
        swapAmount,
        minPurrOutput,
        minHfunOutput,
        slippageBps,
        useV3ForFirst
      );
      
      console.log(`   推定ガス: ${gasEstimate.toString()}`);
      
      // Small Block制限チェック
      const SMALL_BLOCK_LIMIT = 2000000n;
      if (gasEstimate <= SMALL_BLOCK_LIMIT) {
        console.log('   ✅ Small Block対応');
      } else {
        console.log('   ⚠️  Big Block必要');
      }
      
      // 実行
      console.log('   📤 トランザクション送信中...');
      
      const swapTx = await multiSwap.executeWethToPurrToHfun(
        swapAmount,
        minPurrOutput,
        minHfunOutput,
        slippageBps,
        useV3ForFirst,
        {
          gasLimit: gasEstimate + 50000n // 余裕を持たせる
        }
      );
      
      console.log(`   ✅ TX送信: ${swapTx.hash}`);
      console.log('   ⏳ 確認待機中...');
      
      const receipt = await swapTx.wait();
      
      if (receipt.status === 1) {
        console.log('   🎉 マルチスワップ成功!');
        console.log(`   ⛽ ガス使用: ${receipt.gasUsed.toString()}`);
        console.log(`   🧱 ブロック: ${receipt.blockNumber}`);
        
        // イベントログ解析
        console.log('\\n📋 イベントログ:');
        for (const log of receipt.logs) {
          try {
            const parsedLog = multiSwap.interface.parseLog(log);
            if (parsedLog) {
              console.log(`   🎯 ${parsedLog.name}:`);
              console.log(`      ${JSON.stringify(parsedLog.args, null, 6)}`);
            }
          } catch (e) {
            // 他のコントラクトのログの場合はスキップ
          }
        }
        
      } else {
        console.log('   ❌ マルチスワップ失敗');
        return;
      }
      
    } catch (error) {
      console.log(`   ❌ マルチスワップエラー: ${error.message}`);
      
      // Revert理由を詳しく解析
      if (error.reason) {
        console.log(`   💡 Revert理由: ${error.reason}`);
      }
      if (error.code) {
        console.log(`   💡 エラーコード: ${error.code}`);
      }
      return;
    }
    
    console.log('');

    // Step 6: 残高変化確認
    console.log('📊 6. スワップ後残高確認:');
    
    for (const token of tokens) {
      const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const newBalance = await tokenContract.balanceOf(wallet.address);
      const decimals = await tokenContract.decimals();
      const formattedNewBalance = ethers.formatUnits(newBalance, decimals);
      
      const oldFormatted = parseFloat(balances[token.symbol].formatted);
      const newFormatted = parseFloat(formattedNewBalance);
      const change = newFormatted - oldFormatted;
      const changeStr = change > 0 ? `+${change.toFixed(6)}` : change.toFixed(6);
      
      console.log(`   ${token.symbol}: ${formattedNewBalance} (${changeStr})`);
    }
    
    console.log('');
    console.log('🎯 マルチスワップテスト完了!');

  } catch (error) {
    console.error('❌ テスト中にエラーが発生しました:', error.message);
    if (error.code) {
      console.error(`   エラーコード: ${error.code}`);
    }
  }
}

// スクリプト実行
if (require.main === module) {
  executeMultiSwapTest()
    .then(() => {
      console.log('\\n✅ MultiSwap実際のスワップテスト完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { executeMultiSwapTest };