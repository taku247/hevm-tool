#!/usr/bin/env ts-node

/**
 * バッチ実行スクリプト
 * 複数のコントラクト関数を順次実行
 * 
 * 使用例:
 * ts-node templates/batch-execute.ts --config=./batch-config.json
 */

import { UniversalContractUtils } from './contract-utils';
import { BatchCallConfig, ReadCallConfig, WriteCallConfig } from '../src/contract-template-types';
import fs from 'fs';
import dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config();

interface ParsedArgs {
  config?: string;
  stopOnError?: boolean;
  help?: boolean;
}

interface BatchConfigFile {
  stopOnError?: boolean;
  calls: Array<{
    type: 'read' | 'write';
    abi?: string;
    contractAddress: string;
    functionName: string;
    args?: any[];
    blockTag?: string | number;
    options?: any;
    waitForConfirmation?: boolean;
    confirmations?: number;
    description?: string;
  }>;
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

    if (arg === '--stop-on-error') {
      parsed.stopOnError = true;
      continue;
    }

    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      parsed[camelKey] = value;
    }
  }

  return parsed;
}

/**
 * バッチ設定ファイルを読み込む
 */
function loadBatchConfig(configPath: string): BatchConfigFile {
  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error: any) {
    throw new Error(`Failed to load batch config from ${configPath}: ${error.message}`);
  }
}

/**
 * ヘルプメッセージを表示
 */
function showHelp(): void {
  console.log(`
バッチ実行ツール

使用方法:
  ts-node templates/batch-execute.ts [options]

オプション:
  --config=<path>        バッチ設定JSONファイルのパス (必須)
  --stop-on-error        エラー時に実行を停止
  --help, -h             このヘルプを表示

設定ファイル形式:
{
  "stopOnError": true,
  "calls": [
    {
      "type": "read",
      "abi": "./abi/ERC20.json",
      "contractAddress": "0x1234...",
      "functionName": "balanceOf",
      "args": ["0xabcd..."],
      "description": "残高確認"
    },
    {
      "type": "write",
      "abi": "./abi/ERC20.json",
      "contractAddress": "0x1234...",
      "functionName": "transfer",
      "args": ["0xabcd...", "1000000000000000000"],
      "options": {
        "gasLimit": "100000",
        "gasPrice": "30000000000"
      },
      "waitForConfirmation": true,
      "confirmations": 1,
      "description": "トークン転送"
    }
  ]
}

使用例:
  # バッチ設定に従って実行
  ts-node templates/batch-execute.ts --config=./my-batch.json

  # エラー時停止オプション付き
  ts-node templates/batch-execute.ts --config=./my-batch.json --stop-on-error

環境変数:
  HYPEREVM_RPC_URL      RPCエンドポイント (デフォルト: https://rpc.hyperliquid.xyz/evm)
  PRIVATE_KEY           秘密鍵 (WRITE操作がある場合は必須)
`);
}

/**
 * 進行状況を表示
 */
function displayProgress(current: number, total: number, description?: string): void {
  const percentage = Math.round((current / total) * 100);
  const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
  const desc = description ? ` - ${description}` : '';
  console.log(`\r🔄 進行状況: [${progressBar}] ${percentage}% (${current}/${total})${desc}`);
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
  if (!args.config) {
    console.error('❌ エラー: 設定ファイルが指定されていません');
    console.error('   --config オプションは必須です');
    console.error('   詳細は --help を参照してください');
    process.exit(1);
  }

  try {
    // 設定ファイルを読み込み
    const batchConfig = loadBatchConfig(args.config);
    const stopOnError = args.stopOnError || batchConfig.stopOnError || false;

    console.log('📋 バッチ実行設定:');
    console.log(`   設定ファイル: ${args.config}`);
    console.log(`   実行予定: ${batchConfig.calls.length} 件`);
    console.log(`   エラー時停止: ${stopOnError ? 'はい' : 'いいえ'}`);
    console.log('');

    // WRITE操作があるかチェック
    const hasWriteOperations = batchConfig.calls.some(call => call.type === 'write');
    if (hasWriteOperations && !process.env.PRIVATE_KEY) {
      console.error('❌ エラー: 環境変数 PRIVATE_KEY が設定されていません');
      console.error('   WRITE操作が含まれているため秘密鍵が必要です');
      process.exit(1);
    }

    // コントラクトユーティリティを初期化
    const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
    const contractUtils = new UniversalContractUtils(rpcUrl, process.env.PRIVATE_KEY);

    // バッチ設定を変換
    const calls: (ReadCallConfig | WriteCallConfig)[] = batchConfig.calls.map(call => {
      if (call.type === 'read') {
        return {
          abiPath: call.abi,
          contractAddress: call.contractAddress,
          functionName: call.functionName,
          args: call.args || [],
          blockTag: call.blockTag
        } as ReadCallConfig;
      } else {
        return {
          abiPath: call.abi,
          contractAddress: call.contractAddress,
          functionName: call.functionName,
          args: call.args || [],
          options: call.options,
          waitForConfirmation: call.waitForConfirmation,
          confirmations: call.confirmations
        } as WriteCallConfig;
      }
    });

    const batchCallConfig: BatchCallConfig = {
      calls,
      stopOnError
    };

    console.log('🚀 バッチ実行開始...');
    console.log('');

    // 実行開始時刻を記録
    const startTime = Date.now();
    
    // バッチ実行（進行状況表示付き）
    let currentIndex = 0;
    const results: any[] = [];

    for (const call of batchConfig.calls) {
      currentIndex++;
      displayProgress(currentIndex - 1, batchConfig.calls.length, call.description);

      try {
        let result;
        const callConfig = calls[currentIndex - 1];
        
        if (call.type === 'read') {
          result = await contractUtils.callReadFunction(callConfig as ReadCallConfig);
        } else {
          result = await contractUtils.callWriteFunction(callConfig as WriteCallConfig);
        }

        results.push({
          ...result,
          index: currentIndex,
          type: call.type,
          description: call.description
        });

        // 個別結果の表示
        console.log(`\n📋 ${currentIndex}. ${call.description || call.functionName}`);
        console.log(`   タイプ: ${call.type.toUpperCase()}`);
        console.log(`   コントラクト: ${call.contractAddress}`);
        console.log(`   関数: ${call.functionName}`);
        
        if (result.success) {
          console.log(`   ✅ 成功`);
          if (call.type === 'read') {
            console.log(`   結果: ${JSON.stringify(result.result)}`);
          } else {
            console.log(`   TX: ${result.transactionHash}`);
          }
        } else {
          console.log(`   ❌ 失敗: ${result.error}`);
          if (stopOnError) {
            console.log('\n❌ エラーが発生したため実行を停止します');
            break;
          }
        }
        console.log('');
      } catch (error: any) {
        console.log(`\n❌ ${currentIndex}. 実行エラー: ${error.message}`);
        results.push({
          success: false,
          error: error.message,
          index: currentIndex,
          type: call.type,
          description: call.description,
          contractAddress: call.contractAddress,
          functionName: call.functionName,
          timestamp: new Date().toISOString()
        });
        
        if (stopOnError) {
          console.log('\n❌ エラーが発生したため実行を停止します');
          break;
        }
        console.log('');
      }
    }

    // 最終進行状況
    displayProgress(currentIndex, batchConfig.calls.length);
    console.log('\n');

    // 実行時間計算
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // 結果サマリー
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log('📊 実行完了サマリー:');
    console.log(`   総実行数: ${results.length}`);
    console.log(`   成功: ${successCount}`);
    console.log(`   失敗: ${failureCount}`);
    console.log(`   実行時間: ${duration.toFixed(2)}秒`);
    console.log('');

    if (failureCount > 0) {
      console.log('❌ 失敗した操作:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   ${r.index}. ${r.description || r.functionName}: ${r.error}`);
      });
      console.log('');
    }

    // 詳細結果をJSONで出力
    console.log('📋 詳細結果 (JSON):');
    console.log(JSON.stringify({
      summary: {
        total: results.length,
        success: successCount,
        failure: failureCount,
        duration: duration,
        timestamp: new Date().toISOString()
      },
      results
    }, null, 2));

    // 失敗があった場合は非ゼロで終了
    if (failureCount > 0) {
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

export { main as batchExecute };