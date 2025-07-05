#!/usr/bin/env ts-node

/**
 * HyperSwap & KittenSwap レート監視ツール
 * 
 * 使用例:
 * ts-node custom/monitoring/dex-rate-monitor.ts --tokens=HYPE,USDC --amount=1
 * ts-node custom/monitoring/dex-rate-monitor.ts --tokens=USDC,HYPE --amount=1000 --monitor --interval=30
 * ts-node custom/monitoring/dex-rate-monitor.ts --config=./config/tokens.json --alert-threshold=0.05
 */

import { UniversalContractUtils } from '../../templates/contract-utils';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config();

// DEX設定（2024年7月確認済みアドレス）
const DEX_CONFIG = {
  hyperswap_v2: {
    name: 'HyperSwap V2',
    router: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A',
    abi: './abi/UniV2Router.json',
    type: 'v2'
  },
  hyperswap_v3: {
    name: 'HyperSwap V3',
    quoter: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
    abi: './abi/KittenQuoterV2.json',
    type: 'v3'
  },
  kittenswap_v2: {
    name: 'KittenSwap V2', 
    router: '0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802',
    abi: './abi/UniV2Router.json',
    type: 'v2'
  },
  kittenswap_cl: {
    name: 'KittenSwap CL (V3)',
    quoter: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF',
    abi: './abi/KittenQuoterV2.json',
    type: 'v3'
  }
};

// 主要トークンアドレス（2024年7月確認済み）
const TOKEN_ADDRESSES: Record<string, string> = {
  'HYPE': '0x0000000000000000000000000000000000000000', // ネイティブHYPE（DEXでは使用困難）
  'WHYPE': '0x5555555555555555555555555555555555555555', // Wrapped HYPE（DEX対応）
  'UBTC': '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463', // UBTC（確認済み）
  'WETH': '0x5555555555555555555555555555555555555555', // HyperEVM WETH = WHYPE
  'USDC': '0x8ae93f5E9d3c77C78372C3Cc86e8E9cAce2AD6A6', // 例：USDCアドレス（未確認）
  // 注意: WHYPE = WETH（HyperEVMでは同じアドレス）
};

// フィー設定（V3用）
const FEE_TIERS = [100, 500, 2500, 10000]; // 1bps, 5bps, 25bps, 100bps

interface ParsedArgs {
  tokens?: string;
  amount?: number;
  monitor?: boolean;
  interval?: number;
  config?: string;
  alertThreshold?: number;
  help?: boolean;
  output?: string;
  dex?: string;
}

interface RateResult {
  dex: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  rate: number;
  timestamp: string;
  fee?: number;
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

    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      
      switch (key) {
        case 'tokens':
          parsed.tokens = value;
          break;
        case 'amount':
          parsed.amount = parseFloat(value || '1') || 1;
          break;
        case 'interval':
          parsed.interval = parseInt(value || '30') || 30;
          break;
        case 'config':
          parsed.config = value;
          break;
        case 'alert-threshold':
          parsed.alertThreshold = parseFloat(value || '0.05') || 0.05;
          break;
        case 'output':
          parsed.output = value;
          break;
        case 'dex':
          parsed.dex = value;
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
HyperSwap & KittenSwap レート監視ツール

使用方法:
  ts-node custom/monitoring/dex-rate-monitor.ts [options]

必須オプション:
  --tokens=<pair>              取引ペア (例: HYPE,USDC または USDC,HYPE)
  --amount=<amount>            取引量 (デフォルト: 1)

監視オプション:
  --monitor                    継続監視モード
  --interval=<seconds>         監視間隔（秒、デフォルト: 30）
  --alert-threshold=<percent>  アラート閾値（デフォルト: 0.05 = 5%）

フィルターオプション:
  --dex=<name>                 特定DEXのみ監視 (hyperswap|kittenswap_v2|kittenswap_cl)
  --config=<path>              設定ファイルパス

出力オプション:
  --output=<format>            出力形式 (table|json|csv)
  --help, -h                   このヘルプを表示

使用例:
  # 1 HYPE → USDC のレート取得
  ts-node custom/monitoring/dex-rate-monitor.ts --tokens=HYPE,USDC --amount=1

  # 1000 USDC → HYPE のレート取得
  ts-node custom/monitoring/dex-rate-monitor.ts --tokens=USDC,HYPE --amount=1000

  # 30秒間隔でレート監視
  ts-node custom/monitoring/dex-rate-monitor.ts --tokens=HYPE,USDC --amount=1 --monitor --interval=30

  # HyperSwapのみ監視
  ts-node custom/monitoring/dex-rate-monitor.ts --tokens=HYPE,USDC --dex=hyperswap --monitor

  # 5%以上の価格差でアラート
  ts-node custom/monitoring/dex-rate-monitor.ts --tokens=HYPE,USDC --monitor --alert-threshold=0.05

環境変数:
  HYPEREVM_RPC_URL            HyperevmチェーンのRPC URL
  `);
}

/**
 * V2系DEX（HyperSwap, KittenSwap V2）のレート取得
 */
async function getV2Rate(
  utils: UniversalContractUtils,
  dexConfig: any,
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): Promise<RateResult | null> {
  try {
    const path = [TOKEN_ADDRESSES[tokenIn], TOKEN_ADDRESSES[tokenOut]];
    
    const result = await utils.callReadFunction({
      abiPath: dexConfig.abi,
      contractAddress: dexConfig.router,
      functionName: 'getAmountsOut',
      args: [amountIn, path]
    });

    if (!result.success) {
      throw new Error(result.error || 'Unknown error');
    }

    const amounts = result.result as string[];
    const amountOut = amounts[1];
    const rate = parseFloat(ethers.utils.formatEther(amountOut)) / parseFloat(ethers.utils.formatEther(amountIn));

    return {
      dex: dexConfig.name,
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      rate,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.warn(`❌ ${dexConfig.name} エラー:`, error.message);
    return null;
  }
}

/**
 * V3系DEX（KittenSwap CL）のレート取得
 */
async function getV3Rate(
  utils: UniversalContractUtils,
  dexConfig: any,
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): Promise<RateResult[]> {
  const results: RateResult[] = [];

  for (const fee of FEE_TIERS) {
    try {
      const result = await utils.callReadFunction({
        abiPath: dexConfig.abi,
        contractAddress: dexConfig.quoter,
        functionName: 'quoteExactInputSingle',
        args: [
          TOKEN_ADDRESSES[tokenIn],
          TOKEN_ADDRESSES[tokenOut],
          fee,
          amountIn,
          0 // sqrtPriceLimitX96 = 0 (制限なし)
        ]
      });

      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      const amountOut = result.result as string;
      const rate = parseFloat(ethers.utils.formatEther(amountOut)) / parseFloat(ethers.utils.formatEther(amountIn));

      results.push({
        dex: `${dexConfig.name} (${fee/100}bps)`,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        rate,
        timestamp: new Date().toISOString(),
        fee
      });
    } catch (error: any) {
      // 流動性がないプールは無視
      console.warn(`⚠️  ${dexConfig.name} ${fee/100}bps プール: 流動性なし`);
    }
  }

  return results;
}

/**
 * 全DEXのレートを取得
 */
async function getAllRates(
  utils: UniversalContractUtils,
  tokenIn: string,
  tokenOut: string,
  amount: number,
  targetDex?: string
): Promise<RateResult[]> {
  const amountIn = ethers.utils.parseEther(amount.toString());
  const results: RateResult[] = [];

  console.log(`🔍 ${amount} ${tokenIn} → ${tokenOut} のレートを取得中...`);

  for (const [dexKey, dexConfig] of Object.entries(DEX_CONFIG)) {
    if (targetDex && dexKey !== targetDex) continue;

    console.log(`   📊 ${dexConfig.name} を確認中...`);

    if (dexConfig.type === 'v2') {
      const result = await getV2Rate(utils, dexConfig, tokenIn, tokenOut, amountIn.toString());
      if (result) results.push(result);
    } else if (dexConfig.type === 'v3') {
      const v3Results = await getV3Rate(utils, dexConfig, tokenIn, tokenOut, amountIn.toString());
      results.push(...v3Results);
    }
  }

  return results;
}

/**
 * レート結果を表示
 */
function displayRates(results: RateResult[], format: string = 'table'): void {
  if (results.length === 0) {
    console.log('❌ レートデータを取得できませんでした');
    return;
  }

  console.log('\n💱 DEX レート比較結果');
  console.log('========================\n');

  if (format === 'json') {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (format === 'csv') {
    console.log('DEX,TokenIn,TokenOut,AmountIn,AmountOut,Rate,Timestamp,Fee');
    results.forEach(r => {
      console.log(`${r.dex},${r.tokenIn},${r.tokenOut},${r.amountIn},${r.amountOut},${r.rate},${r.timestamp},${r.fee || ''}`);
    });
    return;
  }

  // Table format (default)
  console.log('┌─────────────────────────┬─────────────────┬──────────────┬─────────────┐');
  console.log('│ DEX                     │ レート          │ 出力量       │ ガス予想    │');
  console.log('├─────────────────────────┼─────────────────┼──────────────┼─────────────┤');

  // レート順にソート（高い順）
  const sortedResults = [...results].sort((a, b) => b.rate - a.rate);

  sortedResults.forEach((result, index) => {
    const rateStr = result.rate.toFixed(6);
    const amountOutFormatted = parseFloat(ethers.utils.formatEther(result.amountOut)).toFixed(4);
    const gasEstimate = result.dex.includes('V3') ? '~200k' : '~150k';
    const isHighest = index === 0 ? '🏆' : '  ';
    
    console.log(`│ ${isHighest} ${result.dex.padEnd(20)} │ ${rateStr.padStart(13)} │ ${amountOutFormatted.padStart(10)} │ ${gasEstimate.padStart(9)} │`);
  });

  console.log('└─────────────────────────┴─────────────────┴──────────────┴─────────────┘');

  // 最良レートをハイライト
  const bestRate = sortedResults[0];
  const worstRate = sortedResults[sortedResults.length - 1];
  const spread = ((bestRate.rate - worstRate.rate) / worstRate.rate * 100);

  console.log(`\n🏆 最良レート: ${bestRate.dex} (${bestRate.rate.toFixed(6)})`);
  if (sortedResults.length > 1) {
    console.log(`📊 価格差: ${spread.toFixed(2)}%`);
  }
  console.log(`⏰ 更新時刻: ${new Date().toLocaleString()}\n`);
}

/**
 * アラート条件をチェック
 */
function checkAlerts(results: RateResult[], threshold: number): void {
  if (results.length < 2) return;

  const sortedResults = [...results].sort((a, b) => b.rate - a.rate);
  const bestRate = sortedResults[0];
  const worstRate = sortedResults[sortedResults.length - 1];
  const spread = (bestRate.rate - worstRate.rate) / worstRate.rate;

  if (spread > threshold) {
    console.log(`🚨 アラート: ${(spread * 100).toFixed(2)}% の価格差を検出!`);
    console.log(`   最良: ${bestRate.dex} (${bestRate.rate.toFixed(6)})`);
    console.log(`   最悪: ${worstRate.dex} (${worstRate.rate.toFixed(6)})`);
    console.log(`   アービトラージ機会あり!`);
  }
}

/**
 * 監視モードを開始
 */
async function startMonitoring(
  utils: UniversalContractUtils,
  tokenIn: string,
  tokenOut: string,
  amount: number,
  interval: number,
  alertThreshold: number,
  targetDex?: string,
  outputFormat: string = 'table'
): Promise<void> {
  console.log(`\n🔄 DEXレート監視を開始`);
  console.log(`監視ペア: ${amount} ${tokenIn} → ${tokenOut}`);
  console.log(`監視間隔: ${interval}秒`);
  console.log(`アラート閾値: ${(alertThreshold * 100)}%`);
  if (targetDex) console.log(`対象DEX: ${targetDex}`);
  console.log('Ctrl+Cで停止\n');

  let monitoring = true;

  // Ctrl+C ハンドラー
  process.on('SIGINT', () => {
    console.log('\n🛑 監視を停止します...');
    monitoring = false;
    process.exit(0);
  });

  while (monitoring) {
    try {
      if (outputFormat === 'table') {
        console.clear();
        console.log('🔄 リアルタイムDEXレート監視');
        console.log('=============================\n');
      }

      const results = await getAllRates(utils, tokenIn, tokenOut, amount, targetDex);
      
      if (results.length > 0) {
        displayRates(results, outputFormat);
        checkAlerts(results, alertThreshold);
      }

      await new Promise(resolve => setTimeout(resolve, interval * 1000));

    } catch (error: any) {
      console.error(`❌ 監視エラー: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // エラー時は5秒待機
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

  if (!args.tokens) {
    console.error('❌ --tokens オプションが必要です');
    console.error('使用例: --tokens=HYPE,USDC');
    process.exit(1);
  }

  const [tokenIn, tokenOut] = args.tokens.split(',');
  
  if (!TOKEN_ADDRESSES[tokenIn] || !TOKEN_ADDRESSES[tokenOut]) {
    console.error(`❌ サポートされていないトークン: ${tokenIn}, ${tokenOut}`);
    console.error(`サポート済み: ${Object.keys(TOKEN_ADDRESSES).join(', ')}`);
    process.exit(1);
  }

  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  const amount = args.amount || 1;
  const outputFormat = args.output || 'table';

  try {
    const utils = new UniversalContractUtils(rpcUrl);

    if (args.monitor) {
      await startMonitoring(
        utils,
        tokenIn,
        tokenOut,
        amount,
        args.interval || 30,
        args.alertThreshold || 0.05,
        args.dex,
        outputFormat
      );
    } else {
      const results = await getAllRates(utils, tokenIn, tokenOut, amount, args.dex);
      displayRates(results, outputFormat);
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

export { getAllRates, RateResult };