#!/usr/bin/env ts-node

/**
 * シンプルなDEXレート確認ツール（動作確認用）
 * 
 * 使用例:
 * ts-node custom/monitoring/simple-rate-check.ts
 */

import { UniversalContractUtils } from '../../templates/contract-utils';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config();

// DEX設定
const HYPERSWAP_ROUTER = '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A'; // 修正済みアドレス
const KITTENSWAP_V2_ROUTER = '0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802';

// 主要トークンアドレス
const HYPE = '0x0000000000000000000000000000000000000000'; // ネイティブトークン
const WHYPE = '0x5555555555555555555555555555555555555555'; // Wrapped HYPE
const UBTC = '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463'; // UBTC

/**
 * HyperSwap V2のレート取得
 */
async function getHyperSwapRate(utils: UniversalContractUtils): Promise<void> {
  try {
    console.log('📊 HyperSwap V2 のレートを確認中...');
    
    const amountIn = ethers.utils.parseEther('1'); // 1 HYPE
    const path = [WHYPE, UBTC];
    
    const result = await utils.callReadFunction({
      abiPath: './abi/UniV2Router.json',
      contractAddress: HYPERSWAP_ROUTER,
      functionName: 'getAmountsOut',
      args: [amountIn.toString(), path]
    });

    if (result.success && result.result) {
      const amounts = result.result as string[];
      const amountOut = amounts[1];
      if (amountOut) {
        const rate = parseFloat(ethers.utils.formatEther(amountOut)); // UBTC は 18 decimals
        console.log(`✅ HyperSwap V2: 1 WHYPE = ${rate.toFixed(4)} UBTC`);
      }
    } else {
      console.log(`❌ HyperSwap V2 エラー: ${result.error}`);
    }
  } catch (error: any) {
    console.log(`❌ HyperSwap V2 例外: ${error.message}`);
  }
}

/**
 * KittenSwap V2のレート取得
 */
async function getKittenSwapV2Rate(utils: UniversalContractUtils): Promise<void> {
  try {
    console.log('📊 KittenSwap V2 のレートを確認中...');
    
    const amountIn = ethers.utils.parseEther('1'); // 1 HYPE
    const path = [WHYPE, UBTC];
    
    const result = await utils.callReadFunction({
      abiPath: './abi/UniV2Router.json',
      contractAddress: KITTENSWAP_V2_ROUTER,
      functionName: 'getAmountsOut',
      args: [amountIn.toString(), path]
    });

    if (result.success && result.result) {
      const amounts = result.result as string[];
      const amountOut = amounts[1];
      if (amountOut) {
        const rate = parseFloat(ethers.utils.formatEther(amountOut)); // UBTC は 18 decimals
        console.log(`✅ KittenSwap V2: 1 WHYPE = ${rate.toFixed(4)} UBTC`);
      }
    } else {
      console.log(`❌ KittenSwap V2 エラー: ${result.error}`);
    }
  } catch (error: any) {
    console.log(`❌ KittenSwap V2 例外: ${error.message}`);
  }
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  console.log('🚀 DEXレート確認ツール\n');
  
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  
  try {
    const utils = new UniversalContractUtils(rpcUrl);
    
    console.log('🔍 1 WHYPE → UBTC のレートを確認します...\n');
    
    await getHyperSwapRate(utils);
    await getKittenSwapV2Rate(utils);
    
    console.log('\n✅ レート確認完了!');
    
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