#!/usr/bin/env ts-node

/**
 * 汎用コントラクトREAD関数実行スクリプト
 * 
 * 使用例:
 * ts-node templates/call-read.ts --abi=./abi/ERC20.json --address=0x1234... --function=balanceOf --args=0xabcd...
 * ts-node templates/call-read.ts --abi=./abi/ERC20.json --address=0x1234... --function=totalSupply
 * ts-node templates/call-read.ts --abi=./abi/Uniswap.json --address=0x1234... --function=getAmountsOut --args=1000000000000000000,["0xA","0xB"]
 */

import { UniversalContractUtils } from './contract-utils';
import { ReadCallConfig } from '../src/contract-template-types';
import dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config();

interface ParsedArgs {
  abi?: string;
  address: string;
  function: string;
  args?: string[];
  block?: string;
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
              return parseInt(v.trim());
            }
            // 真偽値の場合は変換
            if (v.trim() === 'true') return true;
            if (v.trim() === 'false') return false;
            // その他は文字列として扱う
            return v.trim();
          });
        }
      } else {
        parsed[key] = value;
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
汎用コントラクトREAD関数実行ツール

使用方法:
  ts-node templates/call-read.ts [options]

オプション:
  --abi=<path>          ABI JSONファイルのパス (必須)
  --address=<address>   コントラクトアドレス (必須)
  --function=<name>     実行する関数名 (必須)
  --args=<args>         関数の引数 (カンマ区切りまたはJSON配列)
  --block=<block>       実行時のブロック番号 (省略時は最新)
  --help, -h            このヘルプを表示

使用例:
  # ERC20トークンの残高を確認
  ts-node templates/call-read.ts \\
    --abi=./abi/ERC20.json \\
    --address=0x1234567890123456789012345678901234567890 \\
    --function=balanceOf \\
    --args=0xabcdef1234567890123456789012345678901234

  # 総供給量を確認
  ts-node templates/call-read.ts \\
    --abi=./abi/ERC20.json \\
    --address=0x1234567890123456789012345678901234567890 \\
    --function=totalSupply

  # Uniswapの価格を確認（複雑な引数）
  ts-node templates/call-read.ts \\
    --abi=./abi/UniswapV2Router.json \\
    --address=0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D \\
    --function=getAmountsOut \\
    --args='["1000000000000000000",["0xA0b86a33E6441E7D375cAF440d6c7e1F2B9E2CD9","0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"]]'

  # 特定ブロックでの実行
  ts-node templates/call-read.ts \\
    --abi=./abi/ERC20.json \\
    --address=0x1234567890123456789012345678901234567890 \\
    --function=balanceOf \\
    --args=0xabcdef1234567890123456789012345678901234 \\
    --block=18500000

環境変数:
  HYPEREVM_RPC_URL      RPCエンドポイント (デフォルト: https://rpc.hyperliquid.xyz/evm)
  PRIVATE_KEY           秘密鍵 (READ操作では不要)
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
  if (!args.abi || !args.address || !args.function) {
    console.error('❌ エラー: 必須パラメータが不足しています');
    console.error('   --abi, --address, --function は必須です');
    console.error('   詳細は --help を参照してください');
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
    if (args.block) {
      console.log(`   ブロック: ${args.block}`);
    }
    console.log('');

    // READ関数を実行
    const config: ReadCallConfig = {
      abiPath: args.abi,
      contractAddress: args.address,
      functionName: args.function,
      args: args.args || [],
      blockTag: args.block
    };

    console.log('🔄 実行中...');
    const result = await contractUtils.callReadFunction(config);

    if (result.success) {
      console.log('✅ 実行成功!');
      console.log('');
      console.log('📊 結果:');
      console.log(`   関数: ${result.functionName}`);
      console.log(`   引数: ${JSON.stringify(result.args)}`);
      console.log(`   戻り値: ${JSON.stringify(result.result, null, 2)}`);
      console.log(`   ブロック番号: ${result.blockNumber}`);
      console.log(`   実行時刻: ${result.timestamp}`);
      
      // 結果をJSONでも出力（他のスクリプトから使いやすくするため）
      console.log('');
      console.log('📋 JSON出力:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('❌ 実行失敗:');
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

export { main as callReadFunction };