#!/usr/bin/env ts-node

/**
 * DEXレート監視テンプレート
 * 実際のコントラクトアドレスが確認できたら動作するバージョン
 * 
 * 使用方法:
 * 1. 正しいDEXコントラクトアドレスを取得
 * 2. TOKEN_ADDRESSESを実際のアドレスに更新
 * 3. 実行: ts-node custom/monitoring/rate-monitor-template.ts --tokens=HYPE,USDC
 */

import { UniversalContractUtils } from '../../templates/contract-utils';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// DEX設定（実際のアドレスに更新が必要）
const DEX_CONFIG = {
  hyperswap: {
    name: 'HyperSwap V2',
    router: '0x...', // 実際のアドレスに更新が必要
    abi: './abi/UniV2Router.json',
    type: 'v2'
  },
  kittenswap_v2: {
    name: 'KittenSwap V2',
    router: '0x...', // 実際のアドレスに更新が必要  
    abi: './abi/UniV2Router.json',
    type: 'v2'
  }
};

// トークンアドレス（実際のアドレスに更新が必要）
const TOKEN_ADDRESSES = {
  'HYPE': '0x0000000000000000000000000000000000000000', // ネイティブ
  'USDC': '0x...', // 実際のUSDCアドレスに更新が必要
  'WETH': '0x...'  // 実際のWETHアドレスに更新が必要
};

interface RateResult {
  dex: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  rate: number;
  timestamp: string;
}

/**
 * DEXレート取得（テンプレート）
 */
async function getDEXRate(
  utils: UniversalContractUtils,
  dexKey: string,
  tokenIn: string,
  tokenOut: string,
  amount: number
): Promise<RateResult | null> {
  const dexConfig = DEX_CONFIG[dexKey];
  if (!dexConfig || dexConfig.router === '0x...') {
    console.log(`⚠️  ${dexKey}: コントラクトアドレスが未設定`);
    return null;
  }

  try {
    const amountIn = ethers.utils.parseEther(amount.toString());
    const path = [TOKEN_ADDRESSES[tokenIn], TOKEN_ADDRESSES[tokenOut]];
    
    const result = await utils.callReadFunction({
      abiPath: dexConfig.abi,
      contractAddress: dexConfig.router,
      functionName: 'getAmountsOut',
      args: [amountIn.toString(), path]
    });

    if (!result.success) {
      throw new Error(result.error || 'Unknown error');
    }

    const amounts = result.result as string[];
    const amountOut = amounts[1];
    const rate = parseFloat(ethers.utils.formatEther(amountOut)) / amount;

    return {
      dex: dexConfig.name,
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      amountOut,
      rate,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.warn(`❌ ${dexConfig.name} エラー: ${error.message}`);
    return null;
  }
}

/**
 * 利用可能なDEXを表示
 */
function showAvailableDEX(): void {
  console.log('📊 設定済みDEX:');
  console.log('================');
  
  Object.entries(DEX_CONFIG).forEach(([key, config]) => {
    const status = config.router === '0x...' ? '❌ 未設定' : '✅ 設定済み';
    console.log(`${key}: ${config.name} - ${status}`);
    if (config.router !== '0x...') {
      console.log(`   Router: ${config.router}`);
    }
  });
  
  console.log('\n📝 トークンアドレス:');
  console.log('==================');
  Object.entries(TOKEN_ADDRESSES).forEach(([symbol, address]) => {
    const status = address === '0x...' ? '❌ 未設定' : '✅ 設定済み';
    console.log(`${symbol}: ${address} - ${status}`);
  });
}

/**
 * セットアップガイドを表示
 */
function showSetupGuide(): void {
  console.log(`
🔧 セットアップガイド
==================

1. 正しいDEXコントラクトアドレスを取得:
   - HyperEVMエクスプローラーで確認
   - 公式ドキュメント参照
   - Purrsec.com等のツール活用

2. ファイル更新:
   custom/monitoring/rate-monitor-template.ts の以下を更新:
   
   DEX_CONFIG: {
     hyperswap: {
       router: '0x実際のHyperSwapルーターアドレス'
     },
     kittenswap_v2: {
       router: '0x実際のKittenSwapルーターアドレス'
     }
   }
   
   TOKEN_ADDRESSES: {
     'USDC': '0x実際のUSDCアドレス',
     'WETH': '0x実際のWETHアドレス'
   }

3. 動作確認:
   ts-node custom/monitoring/rate-monitor-template.ts --test

4. レート取得テスト:
   ts-node custom/monitoring/rate-monitor-template.ts --tokens=HYPE,USDC
`);
}

/**
 * 接続テスト
 */
async function testConnection(): Promise<void> {
  console.log('🔍 HyperEVM接続テスト');
  
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    
    console.log('✅ 接続成功');
    console.log(`   RPC: ${rpcUrl}`);
    console.log(`   チェーンID: ${network.chainId}`);
    console.log(`   最新ブロック: ${blockNumber}`);
    
  } catch (error: any) {
    console.error('❌ 接続エラー:', error.message);
  }
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
HyperEVM DEXレート監視テンプレート

オプション:
  --help, -h        このヘルプを表示
  --setup          セットアップガイドを表示
  --available      利用可能なDEX一覧を表示
  --test           接続テストを実行
  --tokens=A,B     指定ペアのレート取得（要セットアップ）

使用例:
  ts-node custom/monitoring/rate-monitor-template.ts --setup
  ts-node custom/monitoring/rate-monitor-template.ts --test
    `);
    return;
  }

  if (args.includes('--setup')) {
    showSetupGuide();
    return;
  }

  if (args.includes('--available')) {
    showAvailableDEX();
    return;
  }

  if (args.includes('--test')) {
    await testConnection();
    return;
  }

  const tokensArg = args.find(arg => arg.startsWith('--tokens='));
  if (tokensArg) {
    const [tokenIn, tokenOut] = tokensArg.split('=')[1].split(',');
    
    if (!TOKEN_ADDRESSES[tokenIn] || !TOKEN_ADDRESSES[tokenOut]) {
      console.error('❌ サポートされていないトークンです');
      showAvailableDEX();
      return;
    }

    if (TOKEN_ADDRESSES[tokenIn] === '0x...' || TOKEN_ADDRESSES[tokenOut] === '0x...') {
      console.error('❌ トークンアドレスが未設定です');
      console.log('--setup オプションでセットアップガイドを確認してください');
      return;
    }

    console.log('🔍 レート取得テスト実行...');
    console.log('❌ DEXアドレスが未設定のため実行できません');
    console.log('--setup オプションでセットアップガイドを確認してください');
    return;
  }

  // デフォルト: 利用可能なDEXを表示
  showAvailableDEX();
  console.log('\n💡 --help でオプション一覧を確認できます');
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
}

export { getDEXRate, RateResult };