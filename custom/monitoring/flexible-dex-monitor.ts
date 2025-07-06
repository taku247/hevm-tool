#!/usr/bin/env ts-node

/**
 * 設定ベース柔軟DEX監視ツール
 * 
 * 使用例:
 * ts-node custom/monitoring/flexible-dex-monitor.ts --tokens=WHYPE,UBTC --amount=1
 * ts-node custom/monitoring/flexible-dex-monitor.ts --protocol=uniswap-v2 --tokens=WHYPE,UBTC
 * ts-node custom/monitoring/flexible-dex-monitor.ts --dex=hyperswap_v2 --tokens=WHYPE,UBTC --monitor
 */

import { DexManager, QuoteParams } from '../../src/dex/dex-manager';
import { configLoader } from '../../src/config/config-loader';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

interface ParsedArgs {
  tokens?: string;
  amount?: number;
  protocol?: string;
  dex?: string;
  network?: string;
  monitor?: boolean;
  interval?: number;
  arbitrage?: boolean;
  minSpread?: number;
  help?: boolean;
  output?: string;
  config?: boolean;
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

    if (arg === '--monitor') {
      parsed.monitor = true;
      continue;
    }

    if (arg === '--arbitrage') {
      parsed.arbitrage = true;
      continue;
    }

    if (arg === '--config') {
      parsed.config = true;
      continue;
    }

    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      
      switch (key) {
        case 'tokens':
          parsed.tokens = value;
          break;
        case 'amount':
          parsed.amount = parseFloat(value || '1') || 1;
          break;
        case 'protocol':
          parsed.protocol = value;
          break;
        case 'dex':
          parsed.dex = value;
          break;
        case 'network':
          parsed.network = value;
          break;
        case 'interval':
          parsed.interval = parseInt(value || '30') || 30;
          break;
        case 'min-spread':
          parsed.minSpread = parseFloat(value || '0.01') || 0.01;
          break;
        case 'output':
          parsed.output = value;
          break;
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
設定ベース柔軟DEX監視ツール

使用方法:
  ts-node custom/monitoring/flexible-dex-monitor.ts [options]

基本オプション:
  --tokens=<pair>              取引ペア (例: WHYPE,UBTC)
  --amount=<amount>            取引量 (デフォルト: 1)
  --network=<network>          ネットワーク (デフォルト: hyperevm-mainnet)

フィルターオプション:
  --protocol=<protocol>        特定プロトコルのみ (uniswap-v2|uniswap-v3)
  --dex=<dexId>               特定DEXのみ (hyperswap_v2|kittenswap_v2|etc)

監視オプション:
  --monitor                    継続監視モード
  --interval=<seconds>         監視間隔（秒、デフォルト: 30）
  --arbitrage                  アービトラージ機会を検索
  --min-spread=<percent>       最小スプレッド (デフォルト: 0.01 = 1%)

情報オプション:
  --config                     設定情報を表示
  --output=<format>            出力形式 (table|json|csv)
  --help, -h                   このヘルプを表示

使用例:
  # 基本的なレート取得
  ts-node custom/monitoring/flexible-dex-monitor.ts --tokens=WHYPE,UBTC --amount=1

  # V2プロトコルのみ
  ts-node custom/monitoring/flexible-dex-monitor.ts --protocol=uniswap-v2 --tokens=WHYPE,UBTC

  # 特定DEXのみ監視
  ts-node custom/monitoring/flexible-dex-monitor.ts --dex=hyperswap_v2 --tokens=WHYPE,UBTC --monitor

  # アービトラージ機会検索
  ts-node custom/monitoring/flexible-dex-monitor.ts --tokens=WHYPE,UBTC --arbitrage --min-spread=0.02

  # 設定情報確認
  ts-node custom/monitoring/flexible-dex-monitor.ts --config

環境変数:
  HYPEREVM_RPC_URL            HyperEVMチェーンのRPC URL
  `);
}

/**
 * 設定情報を表示
 */
async function showConfig(dexManager: DexManager): Promise<void> {
  console.log('📋 設定情報');
  console.log('================\\n');

  try {
    const configInfo = await dexManager.getConfigInfo();
    console.log(`ネットワーク: ${configInfo.network}`);
    console.log(`DEX数: ${configInfo.dexCount}`);
    console.log(`トークン数: ${configInfo.tokenCount}`);
    console.log(`サポートプロトコル: ${configInfo.protocols.join(', ')}\\n`);

    // DEX一覧
    const dexes = await configLoader.getActiveDexes();
    console.log('🔄 アクティブDEX:');
    for (const [dexId, dexConfig] of Object.entries(dexes)) {
      console.log(`  ${dexConfig.name} (${dexConfig.type.toUpperCase()}) - ${dexConfig.protocol}`);
    }

    // トークン一覧
    const tokens = await configLoader.getTokenConfig();
    console.log('\\n💰 利用可能トークン:');
    for (const [symbol, tokenConfig] of Object.entries(tokens)) {
      console.log(`  ${symbol} (${tokenConfig.name}) - ${tokenConfig.decimals} decimals`);
    }

    // 一般的なペア
    const commonPairs = await configLoader.getCommonPairs();
    console.log('\\n📊 推奨取引ペア:');
    commonPairs.forEach(pair => {
      console.log(`  ${pair[0]}/${pair[1]}`);
    });

    // 設定検証
    console.log('\\n🔍 設定検証:');
    const validation = await configLoader.validateConfig();
    if (validation.valid) {
      console.log('  ✅ すべての設定が有効です');
    } else {
      console.log('  ❌ 設定エラー:');
      validation.errors.forEach(error => {
        console.log(`    - ${error}`);
      });
    }

  } catch (error: any) {
    console.error(`❌ 設定取得エラー: ${error.message}`);
  }
}

/**
 * クォート結果を表示
 */
function displayQuotes(quotes: any[], format: string = 'table'): void {
  const successfulQuotes = quotes.filter(q => q.success);
  
  if (successfulQuotes.length === 0) {
    console.log('❌ 有効なクォートを取得できませんでした');
    
    // エラー情報表示
    const failedQuotes = quotes.filter(q => !q.success);
    if (failedQuotes.length > 0) {
      console.log('\\n⚠️  エラー詳細:');
      failedQuotes.forEach(quote => {
        console.log(`  ${quote.dexName}: ${quote.error}`);
      });
    }
    return;
  }

  console.log('\\n💱 DEX レート比較結果');
  console.log('========================\\n');

  if (format === 'json') {
    console.log(JSON.stringify(successfulQuotes, null, 2));
    return;
  }

  if (format === 'csv') {
    console.log('DEX,TokenIn,TokenOut,AmountIn,AmountOut,Rate,Fee,GasEstimate,Timestamp');
    successfulQuotes.forEach(q => {
      console.log(`${q.dexName},${q.tokenIn},${q.tokenOut},${q.amountIn},${q.amountOut},${q.rate},${q.fee || ''},${q.gasEstimate},${q.timestamp}`);
    });
    return;
  }

  // Table format (default)
  console.log('┌─────────────────────────────┬─────────────────┬──────────────┬─────────────┬─────────────┐');
  console.log('│ DEX                         │ レート          │ 出力量       │ 手数料      │ ガス予想    │');
  console.log('├─────────────────────────────┼─────────────────┼──────────────┼─────────────┼─────────────┤');

  // レート順にソート（高い順）
  const sortedQuotes = [...successfulQuotes].sort((a, b) => b.rate - a.rate);

  sortedQuotes.forEach((quote, index) => {
    const rateStr = quote.rate.toFixed(8);
    const amountOutFormatted = parseFloat(quote.amountOut).toExponential(4);
    const feeStr = quote.fee ? `${quote.fee/100}bps` : 'V2';
    const gasStr = `~${Math.round(quote.gasEstimate/1000)}k`;
    const isHighest = index === 0 ? '🏆' : '  ';
    
    console.log(`│ ${isHighest} ${quote.dexName.padEnd(25)} │ ${rateStr.padStart(13)} │ ${amountOutFormatted.padStart(10)} │ ${feeStr.padStart(9)} │ ${gasStr.padStart(9)} │`);
  });

  console.log('└─────────────────────────────┴─────────────────┴──────────────┴─────────────┴─────────────┘');

  if (sortedQuotes.length > 1) {
    const bestRate = sortedQuotes[0];
    const worstRate = sortedQuotes[sortedQuotes.length - 1];
    const spread = ((bestRate.rate - worstRate.rate) / worstRate.rate * 100);

    console.log(`\\n🏆 最良レート: ${bestRate.dexName} (${bestRate.rate.toFixed(8)})`);
    console.log(`📊 価格差: ${spread.toFixed(2)}%`);
  }
  
  console.log(`⏰ 更新時刻: ${new Date().toLocaleString()}\\n`);
}

/**
 * アービトラージ機会を表示
 */
function displayArbitrageOpportunities(opportunities: any[]): void {
  if (opportunities.length === 0) {
    console.log('🔍 アービトラージ機会は見つかりませんでした');
    return;
  }

  console.log(`\\n🚀 アービトラージ機会 (${opportunities.length}件)`);
  console.log('=============================================\\n');

  opportunities.forEach((opp, index) => {
    console.log(`💡 機会 #${index + 1}:`);
    console.log(`   購入: ${opp.buyDex.dexName} - レート ${opp.buyDex.rate.toFixed(8)}`);
    console.log(`   売却: ${opp.sellDex.dexName} - レート ${opp.sellDex.rate.toFixed(8)}`);
    console.log(`   スプレッド: ${(opp.spread * 100).toFixed(2)}%`);
    console.log(`   予想利益: ${opp.profit.toFixed(6)} ${opp.sellDex.tokenOut}`);
    console.log(`   ガス合計: ~${(opp.buyDex.gasEstimate + opp.sellDex.gasEstimate)/1000}k\\n`);
  });
}

/**
 * 監視モードを開始
 */
async function startMonitoring(
  dexManager: DexManager,
  params: QuoteParams,
  interval: number,
  arbitrage: boolean = false,
  minSpread: number = 0.01,
  outputFormat: string = 'table'
): Promise<void> {
  console.log(`\\n🔄 柔軟DEX監視を開始`);
  console.log(`監視ペア: ${params.amountIn} ${params.tokenIn} → ${params.tokenOut}`);
  console.log(`監視間隔: ${interval}秒`);
  if (arbitrage) {
    console.log(`アービトラージ検索: ON (最小スプレッド: ${minSpread * 100}%)`);
  }
  console.log('Ctrl+Cで停止\\n');

  let monitoring = true;

  // Ctrl+C ハンドラー
  process.on('SIGINT', () => {
    console.log('\\n🛑 監視を停止します...');
    monitoring = false;
    process.exit(0);
  });

  while (monitoring) {
    try {
      if (outputFormat === 'table') {
        console.clear();
        console.log('🔄 リアルタイム柔軟DEX監視');
        console.log('==============================\\n');
      }

      const quotes = await dexManager.getAllQuotes(params);
      
      if (quotes.length > 0) {
        displayQuotes(quotes, outputFormat);
        
        if (arbitrage) {
          const opportunities = await dexManager.findArbitrageOpportunities(
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            minSpread
          );
          displayArbitrageOpportunities(opportunities);
        }
      }

      await new Promise(resolve => setTimeout(resolve, interval * 1000));

    } catch (error: any) {
      console.error(`❌ 監視エラー: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
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

  // RPC URL取得
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  const dexManager = new DexManager(rpcUrl, args.network);

  if (args.config) {
    await showConfig(dexManager);
    return;
  }

  if (!args.tokens) {
    console.error('❌ --tokens オプションが必要です');
    console.error('使用例: --tokens=WHYPE,UBTC');
    console.error('設定確認: --config');
    process.exit(1);
  }

  const tokens = args.tokens.split(',');
  const tokenIn = tokens[0];
  const tokenOut = tokens[1];

  if (!tokenIn || !tokenOut) {
    console.error(`❌ 無効なトークンペア: ${args.tokens}`);
    console.error('使用例: --tokens=WHYPE,UBTC');
    process.exit(1);
  }

  const amount = args.amount || 1;
  const outputFormat = args.output || 'table';

  try {
    // パラメータ準備
    const params: QuoteParams = {
      tokenIn,
      tokenOut,
      amountIn: ethers.utils.parseUnits(amount.toString(), 18).toString()
    };

    if (args.monitor) {
      await startMonitoring(
        dexManager,
        params,
        args.interval || 30,
        args.arbitrage || false,
        args.minSpread || 0.01,
        outputFormat
      );
    } else {
      // 単発実行
      let quotes;
      
      if (args.dex) {
        // 特定DEXのみ
        const quote = await dexManager.getQuote(args.dex, params);
        quotes = [quote];
      } else if (args.protocol) {
        // プロトコル別
        quotes = await dexManager.getQuotesByProtocol(args.protocol, params);
      } else {
        // 全DEX
        quotes = await dexManager.getAllQuotes(params);
      }

      displayQuotes(quotes, outputFormat);

      if (args.arbitrage) {
        const opportunities = await dexManager.findArbitrageOpportunities(
          tokenIn,
          tokenOut,
          params.amountIn,
          args.minSpread || 0.01
        );
        displayArbitrageOpportunities(opportunities);
      }
    }

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

export { main };