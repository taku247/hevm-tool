const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * MultiSwapArbitrageSimple 詳細ログ付きテスト
 * ChatGPT推奨: ブロック内順位・競合Tx分析・ログファイル保存
 */

// ログファイル設定
const logFile = fs.createWriteStream(path.join(__dirname, 'arbitrage_detailed_log.txt'), { flags: 'a' });

function log(msg, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const fullMsg = `[${timestamp}] [${level}] ${msg}`;
  console.log(fullMsg);
  logFile.write(fullMsg + '\n');
}

function logSection(title) {
  const separator = '='.repeat(50);
  log(separator);
  log(`  ${title}`);
  log(separator);
}

async function testArbitrageWithDetailedLogs() {
  logSection('MultiSwapArbitrageSimple 詳細分析テスト開始');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const privateKey = process.env.PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    const arbitrageAddress = '0x4B90A95915a4a0C2690f1F36F3B4C347c27B41d2';

    log(`Tester: ${wallet.address}`);
    log(`Contract: ${arbitrageAddress}`);

    // コントラクト接続
    const artifact = JSON.parse(fs.readFileSync(
      path.join(__dirname, 'artifacts/contracts/MultiSwapArbitrageSimple.sol/MultiSwapArbitrageSimple.json'), 
      'utf8'
    ));
    
    const arbitrageContract = new ethers.Contract(arbitrageAddress, artifact.abi, wallet);

    // 1. 事前ブロック状態確認 (ChatGPT推奨)
    logSection('1. 事前ブロック状態確認');
    
    const preLatestBlock = await provider.getBlockNumber();
    const preBlock = await provider.getBlock(preLatestBlock);
    
    log(`Current block: ${preLatestBlock}`);
    log(`Block transactions: ${preBlock.transactions.length}`);
    log(`Block gas used: ${preBlock.gasUsed.toString()}`);
    log(`Block gas limit: ${preBlock.gasLimit.toString()}`);
    log(`Network congestion: ${(Number(preBlock.gasUsed) / Number(preBlock.gasLimit) * 100).toFixed(2)}%`);
    
    // 候補ブロック番号を記録
    const candidateBlocks = [preLatestBlock + 1, preLatestBlock + 2, preLatestBlock + 3];
    log(`Expected target blocks: [${candidateBlocks.join(', ')}]`);

    // 2. ガス価格分析
    logSection('2. ガス価格戦略分析');
    
    const currentGasPrice = await provider.getFeeData();
    log(`Current gasPrice: ${ethers.formatUnits(currentGasPrice.gasPrice || 0, 'gwei')} Gwei`);
    log(`Current maxFeePerGas: ${ethers.formatUnits(currentGasPrice.maxFeePerGas || 0, 'gwei')} Gwei`);
    
    // 戦略的ガス価格設定
    const strategicGasPrice = currentGasPrice.gasPrice ? 
      currentGasPrice.gasPrice * BigInt(120) / BigInt(100) : // 20%増し
      ethers.parseUnits('0.15', 'gwei'); // デフォルト
    
    log(`Strategic gasPrice: ${ethers.formatUnits(strategicGasPrice, 'gwei')} Gwei (+20%)`);

    // 3. コントラクト残高確認
    logSection('3. 資金状況確認');
    
    const contractInfo = await arbitrageContract.getContractInfo();
    log(`WETH残高: ${ethers.formatEther(contractInfo.wethBalance)}`);
    log(`PURR残高: ${ethers.formatEther(contractInfo.purrBalance)}`);
    log(`HFUN残高: ${ethers.formatEther(contractInfo.hfunBalance)}`);

    // 4. アービトラージ実行準備
    logSection('4. アービトラージ実行準備');
    
    const arbAmount = ethers.parseEther('0.0001');
    const minOutput = ethers.parseEther('0.00001');
    
    log(`Input amount: ${ethers.formatEther(arbAmount)} WETH`);
    log(`Min output: ${ethers.formatEther(minOutput)} HFUN`);

    if (contractInfo.wethBalance < arbAmount) {
      log('❌ コントラクト内WETH残高不足', 'ERROR');
      return;
    }

    // callStatic事前確認
    try {
      const staticResult = await arbitrageContract.executeWethToPurrToHfunArbitrage.staticCall(
        arbAmount,
        minOutput
      );
      log(`callStatic予想出力: ${ethers.formatEther(staticResult)} HFUN`);
    } catch (staticError) {
      log(`callStatic失敗: ${staticError.message}`, 'ERROR');
      return;
    }

    // 5. トランザクション送信 & 詳細追跡
    logSection('5. トランザクション送信・追跡');
    
    const preTxBlock = await provider.getBlockNumber();
    const preTxTimestamp = Date.now();
    
    log(`Tx送信前ブロック: ${preTxBlock}`);
    log(`Tx送信時刻: ${new Date(preTxTimestamp).toISOString()}`);

    // トランザクション送信
    log('🚀 アービトラージ実行開始...');
    const arbTx = await arbitrageContract.executeWethToPurrToHfunArbitrage(
      arbAmount,
      minOutput,
      { 
        gasLimit: 800000,
        gasPrice: strategicGasPrice
      }
    );

    const postTxTimestamp = Date.now();
    log(`✅ TX送信完了: ${arbTx.hash}`);
    log(`送信時間: ${postTxTimestamp - preTxTimestamp}ms`);

    // 6. 詳細な完了待機・分析 (ChatGPT核心部分)
    logSection('6. ブロック確定・競合分析');
    
    log('⏳ トランザクション確定待機中...');
    const receipt = await arbTx.wait();
    const confirmTimestamp = Date.now();
    
    log(`✅ 確定完了: Block ${receipt.blockNumber}`);
    log(`確定時間: ${confirmTimestamp - postTxTimestamp}ms`);
    log(`総実行時間: ${confirmTimestamp - preTxTimestamp}ms`);

    // 7. ブロック内詳細分析 (ChatGPT推奨のコア機能)
    logSection('7. ブロック内競合分析');
    
    const confirmBlock = await provider.getBlock(receipt.blockNumber, true);
    const txIndex = confirmBlock.transactions.findIndex(tx => tx.hash === receipt.transactionHash);
    
    log(`ブロック内Tx総数: ${confirmBlock.transactions.length}`);
    log(`自分のTx順位: ${txIndex + 1} / ${confirmBlock.transactions.length}`);
    log(`ブロックガス使用量: ${confirmBlock.gasUsed.toString()}`);
    log(`ブロック作成時刻: ${new Date(Number(confirmBlock.timestamp) * 1000).toISOString()}`);

    // 先行トランザクション分析
    const precedingTxs = confirmBlock.transactions.slice(0, txIndex);
    if (txIndex > 0) {
      logSection('7.1. 先行トランザクション分析');
      log(`先行Tx数: ${precedingTxs.length}`);
      
      for (let i = 0; i < Math.min(precedingTxs.length, 10); i++) { // 最大10件
        const tx = precedingTxs[i];
        const txGasPrice = tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : 'unknown';
        
        log(`  ${i + 1}. Hash: ${tx.hash}`);
        log(`     From: ${tx.from}`);
        log(`     To: ${tx.to || 'Contract Creation'}`);
        log(`     Gas Price: ${txGasPrice} Gwei`);
        log(`     Gas Limit: ${tx.gasLimit?.toString() || 'unknown'}`);
        log(`     Value: ${ethers.formatEther(tx.value || 0)} ETH`);
        
        // HyperSwap関連のTxかチェック
        const HYPERSWAP_V3_ROUTER = '0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990';
        if (tx.to && tx.to.toLowerCase() === HYPERSWAP_V3_ROUTER.toLowerCase()) {
          log(`     ⚠️  競合可能性: HyperSwap V3 Router呼び出し`, 'WARN');
        }
        
        log(''); // 空行
      }
    } else {
      log('🥇 ブロック内1番目のトランザクション！');
    }

    // 8. 後続トランザクション分析
    if (txIndex < confirmBlock.transactions.length - 1) {
      logSection('7.2. 後続トランザクション分析');
      
      const followingTxs = confirmBlock.transactions.slice(txIndex + 1);
      log(`後続Tx数: ${followingTxs.length}`);
      
      // 同じコントラクトへの後続呼び出しチェック
      let sameContractCalls = 0;
      for (const tx of followingTxs) {
        if (tx.to && tx.to.toLowerCase() === arbitrageAddress.toLowerCase()) {
          sameContractCalls++;
        }
      }
      
      if (sameContractCalls > 0) {
        log(`⚠️  同じコントラクトへの後続呼び出し: ${sameContractCalls}件`, 'WARN');
      }
    }

    // 9. イベントログ詳細分析
    logSection('8. イベントログ詳細分析');
    
    log(`Tx status: ${receipt.status === 1 ? 'SUCCESS' : 'FAILED'}`);
    log(`実際のガス使用量: ${receipt.gasUsed.toString()}`);
    log(`ガス効率: ${(Number(receipt.gasUsed) / 800000 * 100).toFixed(2)}%`);
    
    for (const log_ of receipt.logs) {
      try {
        const parsedLog = arbitrageContract.interface.parseLog(log_);
        if (parsedLog && parsedLog.name === 'ArbitrageExecuted') {
          const tokenIn = parsedLog.args.tokenIn;
          const tokenOut = parsedLog.args.tokenOut;
          const amountIn = ethers.formatEther(parsedLog.args.amountIn);
          const amountOut = ethers.formatEther(parsedLog.args.amountOut);
          const profit = ethers.formatEther(parsedLog.args.profit);
          
          log(`📊 スワップ実行: ${amountIn} → ${amountOut}`);
          log(`💰 利益: ${profit} tokens`);
        }
      } catch (e) {
        // 他のイベントは無視
      }
    }

    // 10. パフォーマンス総合評価
    logSection('9. パフォーマンス総合評価');
    
    const efficiency = {
      blockPosition: `${txIndex + 1}/${confirmBlock.transactions.length}`,
      gasEfficiency: `${(Number(receipt.gasUsed) / 800000 * 100).toFixed(2)}%`,
      totalTime: `${confirmTimestamp - preTxTimestamp}ms`,
      competitionLevel: precedingTxs.length
    };
    
    log(`ブロック内順位: ${efficiency.blockPosition}`);
    log(`ガス効率: ${efficiency.gasEfficiency}`);
    log(`総実行時間: ${efficiency.totalTime}`);
    log(`競合レベル: ${efficiency.competitionLevel}件の先行Tx`);
    
    // 戦略的評価
    if (txIndex === 0) {
      log('🏆 最優先実行達成 - 完璧な戦略', 'SUCCESS');
    } else if (txIndex < 5) {
      log('🥈 高優先度実行 - 良好な戦略', 'SUCCESS');
    } else if (txIndex < 10) {
      log('🥉 中程度優先度 - 改善余地あり', 'WARN');
    } else {
      log('📉 低優先度実行 - 戦略見直し推奨', 'WARN');
    }

    logSection('✅ 詳細分析完了');
    log('すべてのデータをログファイルに保存しました');

  } catch (error) {
    log(`❌ エラー発生: ${error.message}`, 'ERROR');
    if (error.transaction) {
      log(`Failed transaction: ${JSON.stringify(error.transaction)}`, 'ERROR');
    }
  }
}

// スクリプト実行
if (require.main === module) {
  testArbitrageWithDetailedLogs()
    .then(() => {
      log('🤖 詳細ログ付きテスト完了!', 'SUCCESS');
      logFile.end(); // ログファイルを閉じる
    })
    .catch((error) => {
      log(`❌ 致命的エラー: ${error.message}`, 'ERROR');
      logFile.end();
      process.exit(1);
    });
}

module.exports = { testArbitrageWithDetailedLogs };