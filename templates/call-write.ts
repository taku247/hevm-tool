#!/usr/bin/env ts-node

/**
 * 汎用コントラクトWRITE関数実行スクリプト
 * 
 * 使用例:
 * ts-node templates/call-write.ts --abi=./abi/ERC20.json --address=0x1234... --function=transfer --args=0xabcd...,1000000000000000000
 * ts-node templates/call-write.ts --abi=./abi/ERC20.json --address=0x1234... --function=approve --args=0xabcd...,1000000000000000000 --gas-limit=100000 --gas-price=30000000000
 */

import { UniversalContractUtils } from './contract-utils';
import { WriteCallConfig, ContractCallOptions } from '../src/contract-template-types';
import { GasStrategy } from '../src/gas-price-utils';
import dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config();

interface ParsedArgs {
  abi?: string;
  address: string;
  function: string;
  args?: string[];
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  value?: string;
  noWait?: boolean;
  confirmations?: string;
  estimate?: boolean;
  dynamicGas?: GasStrategy;
  analyzeCost?: boolean;
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

    if (arg === '--no-wait') {
      parsed.noWait = true;
      continue;
    }

    if (arg === '--estimate') {
      parsed.estimate = true;
      continue;
    }

    if (arg === '--analyze-cost') {
      parsed.analyzeCost = true;
      continue;
    }

    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      
      if (key === 'args') {
        // 引数をカンマ区切りでパース、JSON配列もサポート
        try {
          parsed.args = JSON.parse(value);
        } catch {
          parsed.args = value.split(',').map((v: string) => {
            // 数値型の場合は変換
            if (/^\d+$/.test(v.trim())) {
              return v.trim(); // 大きな数値はそのまま文字列で渡す
            }
            // 真偽値の場合は変換
            if (v.trim() === 'true') return true;
            if (v.trim() === 'false') return false;
            // その他は文字列として扱う
            return v.trim();
          });
        }
      } else if (key === 'dynamic-gas') {
        if (['safe', 'standard', 'fast', 'instant'].includes(value)) {
          parsed.dynamicGas = value as GasStrategy;
        } else {
          console.error(`無効な動的ガス戦略: ${value}. 有効な値: safe, standard, fast, instant`);
          process.exit(1);
        }
      } else {
        // ケバブケースをキャメルケースに変換
        const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        parsed[camelKey] = value;
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
汎用コントラクトWRITE関数実行ツール

使用方法:
  ts-node templates/call-write.ts [options]

必須オプション:
  --abi=<path>                 ABI JSONファイルのパス
  --address=<address>          コントラクトアドレス
  --function=<name>            実行する関数名
  --args=<args>                関数の引数 (カンマ区切りまたはJSON配列)

ガスオプション:
  --gas-limit=<amount>         ガス制限 (デフォルト: 自動推定)
  --gas-price=<price>          ガス価格 (wei単位)
  --max-fee-per-gas=<fee>      最大ガス料金 (EIP-1559)
  --max-priority-fee-per-gas=<fee>  優先ガス料金 (EIP-1559)
  --value=<amount>             送金額 (ETH単位、payable関数用)

🚀 動的ガス価格オプション:
  --dynamic-gas=<strategy>     動的ガス価格を使用 (safe|standard|fast|instant)
  --analyze-cost               トランザクション手数料を分析

実行オプション:
  --no-wait                    トランザクション確認を待機しない
  --confirmations=<num>        必要な確認数 (デフォルト: 1)
  --estimate                   ガス見積もりのみ実行
  --help, -h                   このヘルプを表示

使用例:
  # ERC20トークンの転送
  ts-node templates/call-write.ts \\
    --abi=./abi/ERC20.json \\
    --address=0x1234567890123456789012345678901234567890 \\
    --function=transfer \\
    --args=0xabcdef1234567890123456789012345678901234,1000000000000000000

  # 承認設定（ガス制限付き）
  ts-node templates/call-write.ts \\
    --abi=./abi/ERC20.json \\
    --address=0x1234567890123456789012345678901234567890 \\
    --function=approve \\
    --args=0xabcdef1234567890123456789012345678901234,1000000000000000000 \\
    --gas-limit=100000 \\
    --gas-price=30000000000

  # EIP-1559ガス設定
  ts-node templates/call-write.ts \\
    --abi=./abi/MyContract.json \\
    --address=0x1234567890123456789012345678901234567890 \\
    --function=setValue \\
    --args=42 \\
    --max-fee-per-gas=30000000000 \\
    --max-priority-fee-per-gas=2000000000

  # payable関数の実行
  ts-node templates/call-write.ts \\
    --abi=./abi/PayableContract.json \\
    --address=0x1234567890123456789012345678901234567890 \\
    --function=deposit \\
    --value=0.1

  # ガス見積もりのみ
  ts-node templates/call-write.ts \\
    --abi=./abi/ERC20.json \\
    --address=0x1234567890123456789012345678901234567890 \\
    --function=transfer \\
    --args=0xabcdef1234567890123456789012345678901234,1000000000000000000 \\
    --estimate

  # 🚀 動的ガス価格使用例:
  # 高速実行（ネットワーク混雑時に推奨）
  ts-node templates/call-write.ts \\
    --abi=./abi/ERC20.json \\
    --address=0x1234567890123456789012345678901234567890 \\
    --function=transfer \\
    --args=0xabcdef1234567890123456789012345678901234,1000000000000000000 \\
    --dynamic-gas=fast

  # トランザクション手数料の事前分析
  ts-node templates/call-write.ts \\
    --abi=./abi/ERC20.json \\
    --address=0x1234567890123456789012345678901234567890 \\
    --function=transfer \\
    --args=0xabcdef1234567890123456789012345678901234,1000000000000000000 \\
    --analyze-cost

環境変数:
  HYPEREVM_RPC_URL      RPCエンドポイント (デフォルト: https://rpc.hyperliquid.xyz/evm)
  PRIVATE_KEY           秘密鍵 (必須)
`);
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
 * メイン処理
 */
async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  // 必須パラメータの検証
  if (!args.abi || !args.address || !args.function) {
    console.error('❌ エラー: 必須パラメータが不足しています');
    console.error('   --abi, --address, --function は必須です');
    console.error('   詳細は --help を参照してください');
    process.exit(1);
  }

  // 秘密鍵の確認
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ エラー: 環境変数 PRIVATE_KEY が設定されていません');
    console.error('   WRITE操作には秘密鍵が必要です');
    process.exit(1);
  }

  try {
    // コントラクトユーティリティを初期化
    const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
    const contractUtils = new UniversalContractUtils(rpcUrl, process.env.PRIVATE_KEY);

    console.log('📋 実行設定:');
    console.log(`   ABI: ${args.abi}`);
    console.log(`   コントラクト: ${args.address}`);
    console.log(`   関数: ${args.function}`);
    console.log(`   引数: ${JSON.stringify(args.args || [])}`);
    
    // ガスオプションの表示
    const gasOptions: ContractCallOptions = {};
    if (args.gasLimit) {
      gasOptions.gasLimit = args.gasLimit;
      console.log(`   ガス制限: ${args.gasLimit}`);
    }
    if (args.gasPrice) {
      gasOptions.gasPrice = args.gasPrice;
      console.log(`   ガス価格: ${args.gasPrice} wei`);
    }
    if (args.maxFeePerGas) {
      gasOptions.maxFeePerGas = args.maxFeePerGas;
      console.log(`   最大ガス料金: ${args.maxFeePerGas} wei`);
    }
    if (args.maxPriorityFeePerGas) {
      gasOptions.maxPriorityFeePerGas = args.maxPriorityFeePerGas;
      console.log(`   優先ガス料金: ${args.maxPriorityFeePerGas} wei`);
    }
    if (args.value) {
      gasOptions.value = args.value;
      console.log(`   送金額: ${args.value} ETH`);
    }
    
    if (args.dynamicGas) {
      console.log(`🚀 動的ガス戦略: ${args.dynamicGas}`);
    }
    
    console.log('');

    // トランザクション手数料分析の場合
    if (args.analyzeCost) {
      console.log('💰 トランザクション手数料を分析中...');
      const config: WriteCallConfig = {
        abiPath: args.abi,
        contractAddress: args.address,
        functionName: args.function,
        args: args.args || [],
        options: gasOptions
      };

      try {
        const costAnalysis = await contractUtils.estimateTransactionCost(
          config, 
          args.dynamicGas || 'standard'
        );
        
        console.log('✅ 手数料分析完了!');
        console.log('');
        console.log('📊 詳細分析結果:');
        console.log(`   推定ガス使用量: ${costAnalysis.gasLimit}`);
        console.log(`   推奨ガス価格: ${(parseInt(costAnalysis.gasPrice) / 1e9).toFixed(2)} Gwei`);
        console.log(`   ネットワーク状況: ${getNetworkStatusEmoji(costAnalysis.networkStatus)} ${costAnalysis.networkStatus}`);
        console.log(`   使用戦略: ${costAnalysis.strategy}`);
        console.log('');
        console.log('💸 予想手数料:');
        console.log(`   Wei: ${costAnalysis.totalCostWei}`);
        console.log(`   Gwei: ${costAnalysis.totalCostGwei}`);
        console.log(`   ETH: ${costAnalysis.totalCostEth}`);
        
        return;
      } catch (error: any) {
        console.error('❌ 手数料分析失敗:', error.message);
        process.exit(1);
      }
    }

    // ガス見積もりのみの場合
    if (args.estimate) {
      console.log('⛽ ガス見積もり中...');
      const config: WriteCallConfig = {
        abiPath: args.abi,
        contractAddress: args.address,
        functionName: args.function,
        args: args.args || [],
        options: gasOptions
      };

      try {
        const gasEstimate = await contractUtils.estimateGas(config);
        console.log('✅ ガス見積もり完了!');
        console.log(`   推定ガス使用量: ${gasEstimate}`);
        
        // 現在のガス価格も取得して概算コストを表示
        console.log('');
        console.log('💰 概算コスト情報:');
        console.log(`   推定ガス使用量: ${gasEstimate}`);
        if (args.gasPrice) {
          const totalCost = BigInt(gasEstimate) * BigInt(args.gasPrice);
          console.log(`   指定ガス価格: ${args.gasPrice} wei`);
          console.log(`   概算コスト: ${totalCost.toString()} wei`);
        }
        return;
      } catch (error: any) {
        console.error('❌ ガス見積もり失敗:', error.message);
        process.exit(1);
      }
    }

    // WRITE関数を実行
    const config: WriteCallConfig = {
      abiPath: args.abi,
      contractAddress: args.address,
      functionName: args.function,
      args: args.args || [],
      options: gasOptions,
      waitForConfirmation: !args.noWait,
      confirmations: args.confirmations ? parseInt(args.confirmations) : 1
    };

    console.log('🔄 トランザクション送信中...');
    
    // 動的ガス価格を使用する場合
    let result;
    if (args.dynamicGas) {
      console.log(`🚀 動的ガス価格戦略「${args.dynamicGas}」を適用中...`);
      result = await contractUtils.callWriteFunctionWithDynamicGas(config, args.dynamicGas);
    } else {
      result = await contractUtils.callWriteFunction(config);
    }

    if (result.success) {
      console.log('✅ トランザクション送信成功!');
      console.log('');
      console.log('📊 結果:');
      console.log(`   関数: ${result.functionName}`);
      console.log(`   引数: ${JSON.stringify(result.args)}`);
      console.log(`   トランザクションハッシュ: ${result.transactionHash}`);
      
      if (result.blockNumber) {
        console.log(`   ブロック番号: ${result.blockNumber}`);
      }
      if (result.gasUsed) {
        console.log(`   使用ガス: ${result.gasUsed}`);
      }
      if (result.effectiveGasPrice) {
        console.log(`   実効ガス価格: ${result.effectiveGasPrice} wei`);
      }
      console.log(`   実行時刻: ${result.timestamp}`);
      
      if (!args.noWait) {
        console.log('');
        console.log('✅ トランザクション確認完了!');
      } else {
        console.log('');
        console.log('ℹ️  注意: --no-wait が指定されているため、確認を待機していません');
        console.log('   トランザクションの状態を確認してください');
      }
      
      // 結果をJSONでも出力
      console.log('');
      console.log('📋 JSON出力:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('❌ トランザクション失敗:');
      console.error(`   エラー: ${result.error}`);
      console.error(`   関数: ${result.functionName}`);
      console.error(`   引数: ${JSON.stringify(result.args)}`);
      console.error(`   実行時刻: ${result.timestamp}`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ 予期しないエラーが発生しました:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error('');
      console.error('スタックトレース:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * CLI実行判定
 */
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 致命的エラー:', error);
    process.exit(1);
  });
}

export { main as callWriteFunction };