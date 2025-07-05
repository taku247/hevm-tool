#!/usr/bin/env ts-node

/**
 * ガス価格分析・監視ツール
 * 
 * 使用例:
 * ts-node templates/gas-analyzer.ts --analyze
 * ts-node templates/gas-analyzer.ts --strategy=fast
 * ts-node templates/gas-analyzer.ts --monitor --interval=30
 */

import { UniversalContractUtils } from './contract-utils';
import { GasStrategy } from '../src/gas-price-utils';
import dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config();

interface ParsedArgs {
  analyze?: boolean;
  strategy?: GasStrategy;
  monitor?: boolean;
  interval?: number;
  help?: boolean;
}

/**
 * コマンドライン引数をパース
 */
function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const parsed: any = {};

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg === '--analyze') {
      parsed.analyze = true;
      continue;
    }

    if (arg === '--monitor') {
      parsed.monitor = true;
      continue;
    }

    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      
      if (key === 'strategy') {
        if (['safe', 'standard', 'fast', 'instant'].includes(value)) {
          parsed.strategy = value as GasStrategy;
        } else {
          console.error(`無効な戦略: ${value}. 有効な値: safe, standard, fast, instant`);
          process.exit(1);
        }
      } else if (key === 'interval') {
        parsed.interval = parseInt(value) || 30;
      }
    }
  }

  return parsed;
}

/**
 * ヘルプメッセージを表示
 */
function showHelp(): void {
  console.log(`
ガス価格分析・監視ツール

使用方法:
  ts-node templates/gas-analyzer.ts [options]

オプション:
  --analyze                    現在のネットワークガス価格を分析
  --strategy=<strategy>        指定戦略のガス価格を表示 (safe|standard|fast|instant)
  --monitor                    ガス価格を継続監視
  --interval=<seconds>         監視間隔（秒、デフォルト: 30）
  --help, -h                   このヘルプを表示

使用例:
  # 現在のガス価格分析
  ts-node templates/gas-analyzer.ts --analyze

  # 高速実行用のガス価格を取得
  ts-node templates/gas-analyzer.ts --strategy=fast

  # 30秒間隔でガス価格を監視
  ts-node templates/gas-analyzer.ts --monitor --interval=30

環境変数:
  HYPEREVM_RPC_URL            HyperevmチェーンのRPC URL
  `);
}

/**
 * ガス価格分析結果を表示
 */
function displayGasAnalysis(analysis: any): void {
  console.log('\n📊 ネットワークガス価格分析');
  console.log('================================');
  
  console.log(`🔷 現在のベースフィー: ${(parseInt(analysis.currentBaseFee) / 1e9).toFixed(2)} Gwei`);
  console.log(`🌐 ネットワーク混雑度: ${getNetworkStatusEmoji(analysis.networkCongestion)} ${analysis.networkCongestion}`);
  
  console.log('\n💰 推奨ガス価格戦略:');
  console.log('┌──────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
  console.log('│ 戦略     │ ガス価格    │ MaxFee      │ Priority    │ 確認時間    │');
  console.log('├──────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
  
  Object.entries(analysis.suggestedGasPrices).forEach(([strategy, price]: [string, any]) => {
    const gasPrice = (parseInt(price.gasPrice) / 1e9).toFixed(1);
    const maxFee = (parseInt(price.maxFeePerGas) / 1e9).toFixed(1);
    const priority = (parseInt(price.maxPriorityFeePerGas) / 1e9).toFixed(1);
    const time = getEstimatedTime(strategy);
    
    console.log(`│ ${strategy.padEnd(8)} │ ${gasPrice.padStart(9)} Gwei │ ${maxFee.padStart(9)} Gwei │ ${priority.padStart(9)} Gwei │ ${time.padEnd(11)} │`);
  });
  
  console.log('└──────────┴─────────────┴─────────────┴─────────────┴─────────────┘');
  
  console.log(`\n💡 推奨: ${analysis.recommendations.strategy} - ${analysis.recommendations.reason}`);
  console.log(`⏱️  予想確認時間: ${analysis.recommendations.estimatedConfirmationTime}`);
  
  if (analysis.recentBlocks.length > 0) {
    console.log('\n📈 最近のブロック情報:');
    analysis.recentBlocks.slice(0, 5).forEach((block: any) => {
      const gasUsedPercent = (block.gasUsedRatio * 100).toFixed(1);
      const baseFee = (parseInt(block.baseFeePerGas) / 1e9).toFixed(2);
      console.log(`   Block ${block.blockNumber}: ${gasUsedPercent}% 使用, ベースフィー ${baseFee} Gwei`);
    });
  }
  
  console.log(`\n⏰ 分析時刻: ${new Date().toLocaleString()}\n`);
}

/**
 * 戦略別ガス価格を表示
 */
function displayStrategyPrice(strategy: GasStrategy, optimalGas: any): void {
  console.log(`\n🎯 ${strategy.toUpperCase()} 戦略のガス価格設定`);
  console.log('================================');
  
  if (optimalGas.recommended === 'eip1559') {
    const maxFee = (parseInt(optimalGas.eip1559.maxFeePerGas) / 1e9).toFixed(2);
    const priority = (parseInt(optimalGas.eip1559.maxPriorityFeePerGas) / 1e9).toFixed(2);
    
    console.log('🆕 EIP-1559 (推奨):');
    console.log(`   --max-fee-per-gas=${optimalGas.eip1559.maxFeePerGas} (${maxFee} Gwei)`);
    console.log(`   --max-priority-fee-per-gas=${optimalGas.eip1559.maxPriorityFeePerGas} (${priority} Gwei)`);
  }
  
  const legacyPrice = (parseInt(optimalGas.legacy.gasPrice) / 1e9).toFixed(2);
  console.log('\n🔄 Legacy方式:');
  console.log(`   --gas-price=${optimalGas.legacy.gasPrice} (${legacyPrice} Gwei)`);
  
  console.log(`\n⏰ 取得時刻: ${new Date().toLocaleString()}\n`);
}

/**
 * ネットワーク状態の絵文字を取得
 */
function getNetworkStatusEmoji(status: string): string {
  switch (status) {
    case 'low': return '🟢';
    case 'medium': return '🟡';
    case 'high': return '🟠';
    case 'very_high': return '🔴';
    default: return '⚪';
  }
}

/**
 * 戦略別の推定時間を取得
 */
function getEstimatedTime(strategy: string): string {
  switch (strategy) {
    case 'safe': return '1-2分';
    case 'standard': return '30秒-1分';
    case 'fast': return '15-30秒';
    case 'instant': return '5-15秒';
    default: return '不明';
  }
}

/**
 * ガス価格監視を開始
 */
async function startMonitoring(utils: UniversalContractUtils, interval: number): Promise<void> {
  console.log(`\n🔄 ガス価格監視を開始 (${interval}秒間隔)`);
  console.log('Ctrl+Cで停止\n');
  
  const monitor = async () => {
    try {
      console.clear();
      console.log('🔄 リアルタイムガス価格監視');
      console.log('============================\n');
      
      const analysis = await utils.analyzeCurrentGasPrices();
      displayGasAnalysis(analysis);
      
    } catch (error: any) {
      console.error(`❌ 監視エラー: ${error.message}`);
    }
    
    setTimeout(monitor, interval * 1000);
  };
  
  await monitor();
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  
  try {
    const utils = new UniversalContractUtils(rpcUrl);

    if (args.monitor) {
      await startMonitoring(utils, args.interval || 30);
      return;
    }

    if (args.strategy) {
      console.log('⏳ ガス価格を計算中...');
      const optimalGas = await utils.getOptimalGasPrice(args.strategy);
      displayStrategyPrice(args.strategy, optimalGas);
      return;
    }

    if (args.analyze) {
      console.log('⏳ ネットワークを分析中...');
      const analysis = await utils.analyzeCurrentGasPrices();
      displayGasAnalysis(analysis);
      return;
    }

    // デフォルト: 簡単な分析を表示
    console.log('⏳ ガス価格を分析中...');
    const analysis = await utils.analyzeCurrentGasPrices();
    displayGasAnalysis(analysis);

  } catch (error: any) {
    console.error(`❌ エラー: ${error.message}`);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmainを呼び出し
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  });
}