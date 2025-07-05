#!/usr/bin/env ts-node

/**
 * 汎用コントラクトデプロイスクリプト
 * 
 * 使用例:
 * ts-node templates/contract-deploy.ts --abi=./abi/MyContract.json --bytecode=./bytecode/MyContract.bin
 * ts-node templates/contract-deploy.ts --abi=./abi/ERC20.json --bytecode=./bytecode/ERC20.bin --args="MyToken,MTK,18,1000000000000000000000"
 */

import { UniversalContractUtils } from './contract-utils';
import { ContractDeployConfig, ContractCallOptions } from '../src/contract-template-types';
import fs from 'fs';
import dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config();

interface ParsedArgs {
  abi?: string;
  bytecode?: string;
  args?: string[];
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  value?: string;
  noWait?: boolean;
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
 * バイトコードファイルを読み込む
 */
function loadBytecode(bytecodePath: string): string {
  try {
    const bytecode = fs.readFileSync(bytecodePath, 'utf-8').trim();
    // 0xプレフィックスがない場合は追加
    return bytecode.startsWith('0x') ? bytecode : '0x' + bytecode;
  } catch (error: any) {
    throw new Error(`Failed to load bytecode from ${bytecodePath}: ${error.message}`);
  }
}

/**
 * ヘルプメッセージを表示
 */
function showHelp(): void {
  console.log(`
汎用コントラクトデプロイツール

使用方法:
  ts-node templates/contract-deploy.ts [options]

必須オプション:
  --abi=<path>                 ABI JSONファイルのパス
  --bytecode=<path>            バイトコードファイルのパス

オプション:
  --args=<args>                コンストラクタ引数 (カンマ区切りまたはJSON配列)
  --gas-limit=<amount>         ガス制限 (デフォルト: 自動推定)
  --gas-price=<price>          ガス価格 (wei単位)
  --max-fee-per-gas=<fee>      最大ガス料金 (EIP-1559)
  --max-priority-fee-per-gas=<fee>  優先ガス料金 (EIP-1559)
  --value=<amount>             送金額 (ETH単位、payableコンストラクタ用)
  --no-wait                    デプロイ確認を待機しない
  --help, -h                   このヘルプを表示

使用例:
  # シンプルなコントラクトのデプロイ
  ts-node templates/contract-deploy.ts \\
    --abi=./abi/SimpleStorage.json \\
    --bytecode=./bytecode/SimpleStorage.bin

  # ERC20トークンのデプロイ（コンストラクタ引数付き）
  ts-node templates/contract-deploy.ts \\
    --abi=./abi/ERC20.json \\
    --bytecode=./bytecode/ERC20.bin \\
    --args="MyToken,MTK,18,1000000000000000000000"

  # ガス設定付きデプロイ
  ts-node templates/contract-deploy.ts \\
    --abi=./abi/ComplexContract.json \\
    --bytecode=./bytecode/ComplexContract.bin \\
    --args='["param1","param2",123]' \\
    --gas-limit=3000000 \\
    --gas-price=30000000000

  # payableコンストラクタ付きデプロイ
  ts-node templates/contract-deploy.ts \\
    --abi=./abi/PayableContract.json \\
    --bytecode=./bytecode/PayableContract.bin \\
    --value=0.1

環境変数:
  HYPEREVM_RPC_URL      RPCエンドポイント (デフォルト: https://rpc.hyperliquid.xyz/evm)
  PRIVATE_KEY           秘密鍵 (必須)

ファイル形式:
  ABI: 標準的なJSON形式のABI
  Bytecode: HEXエンコードされたバイトコード（0xプレフィックス有無は問わない）
`);
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
  if (!args.abi || !args.bytecode) {
    console.error('❌ エラー: 必須パラメータが不足しています');
    console.error('   --abi, --bytecode は必須です');
    console.error('   詳細は --help を参照してください');
    process.exit(1);
  }

  // 秘密鍵の確認
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ エラー: 環境変数 PRIVATE_KEY が設定されていません');
    console.error('   コントラクトデプロイには秘密鍵が必要です');
    process.exit(1);
  }

  try {
    // バイトコードを読み込み
    const bytecode = loadBytecode(args.bytecode);
    
    // コントラクトユーティリティを初期化
    const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
    const contractUtils = new UniversalContractUtils(rpcUrl, process.env.PRIVATE_KEY);

    console.log('📋 デプロイ設定:');
    console.log(`   ABI: ${args.abi}`);
    console.log(`   Bytecode: ${args.bytecode}`);
    console.log(`   Bytecode長: ${(bytecode.length - 2) / 2} bytes`);
    if (args.args && args.args.length > 0) {
      console.log(`   コンストラクタ引数: ${JSON.stringify(args.args)}`);
    }
    
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
    
    console.log('');

    // コントラクトをデプロイ
    const config: ContractDeployConfig = {
      abiPath: args.abi,
      bytecode: bytecode,
      constructorArgs: args.args || [],
      options: gasOptions,
      waitForConfirmation: !args.noWait
    };

    console.log('🚀 コントラクトデプロイ中...');
    const result = await contractUtils.deployContract(config);

    if (result.success) {
      console.log('✅ デプロイ成功!');
      console.log('');
      console.log('📊 結果:');
      console.log(`   デプロイされたアドレス: ${result.contractAddress}`);
      console.log(`   トランザクションハッシュ: ${result.transactionHash}`);
      
      if (result.blockNumber) {
        console.log(`   ブロック番号: ${result.blockNumber}`);
      }
      if (result.gasUsed) {
        console.log(`   使用ガス: ${result.gasUsed}`);
      }
      console.log(`   デプロイ時刻: ${result.timestamp}`);
      
      if (!args.noWait) {
        console.log('');
        console.log('✅ デプロイ確認完了!');
        console.log('');
        console.log('🎉 コントラクトが正常にデプロイされました!');
        console.log(`   今後このアドレスを使用してコントラクトと相互作用できます: ${result.contractAddress}`);
      } else {
        console.log('');
        console.log('ℹ️  注意: --no-wait が指定されているため、確認を待機していません');
        console.log('   デプロイの状態を確認してください');
      }
      
      // 結果をJSONでも出力
      console.log('');
      console.log('📋 JSON出力:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('❌ デプロイ失敗:');
      console.error(`   エラー: ${result.error}`);
      if (result.args && result.args.length > 0) {
        console.error(`   コンストラクタ引数: ${JSON.stringify(result.args)}`);
      }
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

export { main as deployContract };