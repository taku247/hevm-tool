#!/usr/bin/env ts-node

/**
 * シンプルなDEXレート確認ツール（動作確認用）
 * 
 * 使用例:
 * ts-node custom/monitoring/simple-rate-check.ts
 */

import { UniversalContractUtils } from '../../templates/contract-utils';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config();

// DEX設定
const HYPERSWAP_ROUTER = '0xda0f518d521e0dE83fAdC8500C2D21b6a6C39bF9';
const KITTENSWAP_V2_ROUTER = '0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802';

// 主要トークンアドレス
const HYPE = '0x0000000000000000000000000000000000000000'; // ネイティブトークン
const USDC = '0x8ae93f5E9d3c77C78372C3Cc86e8E9cAce2AD6A6'; // 例：USDCアドレス

/**
 * HyperSwap V2のレート取得
 */
async function getHyperSwapRate(utils: UniversalContractUtils): Promise<void> {
  try {
    console.log('📊 HyperSwap V2 のレートを確認中...');
    
    const amountIn = ethers.utils.parseEther('1'); // 1 HYPE
    const path = [HYPE, USDC];
    
    const result = await utils.callReadFunction({
      abiPath: './abi/UniV2Router.json',
      contractAddress: HYPERSWAP_ROUTER,
      functionName: 'getAmountsOut',
      args: [amountIn.toString(), path]
    });

    if (result.success && result.result) {
      const amounts = result.result as string[];
      const amountOut = amounts[1];
      const rate = parseFloat(ethers.utils.formatUnits(amountOut, 6)); // USDC は 6 decimals
      
      console.log(`✅ HyperSwap V2: 1 HYPE = ${rate.toFixed(4)} USDC`);
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
    const path = [HYPE, USDC];
    
    const result = await utils.callReadFunction({
      abiPath: './abi/UniV2Router.json',
      contractAddress: KITTENSWAP_V2_ROUTER,
      functionName: 'getAmountsOut',
      args: [amountIn.toString(), path]
    });

    if (result.success && result.result) {
      const amounts = result.result as string[];
      const amountOut = amounts[1];
      const rate = parseFloat(ethers.utils.formatUnits(amountOut, 6)); // USDC は 6 decimals
      
      console.log(`✅ KittenSwap V2: 1 HYPE = ${rate.toFixed(4)} USDC`);
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
    
    console.log('🔍 1 HYPE → USDC のレートを確認します...\n');
    
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