#!/usr/bin/env node

/**
 * Uniswap AlphaRouter を HyperEVM で試行
 * ChatGPTの提案に基づく自動ルーティングSDKのテスト
 */

const { AlphaRouter, SwapType } = require('@uniswap/smart-order-router');
const { ChainId, CurrencyAmount, TradeType, Percent, Token } = require('@uniswap/sdk-core');
const { ethers } = require('ethers');

async function testAlphaRouter() {
  console.log('🔍 Uniswap AlphaRouter HyperEVM検証\n');
  
  try {
    // 1. RPC プロバイダ（ethers v5対応）
    const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
    console.log('✅ RPC接続成功');
    
    // 2. HyperEVM トークン定義（ChainId = 999）
    const WHYPE = new Token(999, '0x5555555555555555555555555555555555555555', 18, 'WHYPE', 'Wrapped HYPE');
    const UBTC = new Token(999, '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463', 8, 'UBTC', 'Universal Bitcoin');
    const UETH = new Token(999, '0xBe6727B535545C67d5cAa73dEa54865B92CF7907', 18, 'UETH', 'Universal Ethereum');
    
    console.log('✅ トークン定義完了');
    console.log(`  WHYPE: ${WHYPE.address}`);
    console.log(`  UBTC:  ${UBTC.address}`);
    console.log(`  UETH:  ${UETH.address}`);
    
    // 3. AlphaRouter 生成（ChainId 999 をキャスト）
    console.log('\\n🚀 AlphaRouter初期化中...');
    const router = new AlphaRouter({
      chainId: 999, // HyperEVM Chain ID
      provider
    });
    console.log('✅ AlphaRouter初期化完了');
    
    // 4. スワップオプション
    const options = {
      recipient: '0x1234567890123456789012345678901234567890', // ダミーアドレス
      slippageTolerance: new Percent(30, 10_000), // 0.30%
      deadline: Math.floor(Date.now() / 1000) + 60 * 10, // 10分後
      type: SwapType.SWAP_ROUTER_02
    };
    
    // 5. テスト金額（ethers v5対応）
    const amountIn = CurrencyAmount.fromRawAmount(WHYPE, ethers.utils.parseUnits('1', 18).toString());
    console.log(`\\n💰 テスト金額: ${amountIn.toSignificant(6)} WHYPE`);
    
    // 6. ルート計算実行
    console.log('\\n🔄 最適ルート計算中...');
    const route = await router.route(amountIn, UBTC, TradeType.EXACT_INPUT, options);
    
    if (!route) {
      console.log('❌ ルートが見つかりませんでした');
      
      // フォールバック: 手動でマルチホップテスト
      console.log('\\n🔄 フォールバック: 手動マルチホップ確認');
      const { UniversalContractUtils } = require('./temp/templates/contract-utils');
      const utils = new UniversalContractUtils('https://rpc.hyperliquid.xyz/evm');
      
      const path = ethers.utils.solidityPack(
        ['address', 'uint24', 'address', 'uint24', 'address'],
        [WHYPE.address, 3000, UETH.address, 3000, UBTC.address]
      );
      
      const quoterResult = await utils.callReadFunction({
        abiPath: './abi/KittenQuoterV2.json',
        contractAddress: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
        functionName: 'quoteExactInput',
        args: [path, amountIn.quotient.toString()]
      });
      
      if (quoterResult.success) {
        const amountOut = quoterResult.result[0] || quoterResult.result;
        const rate = parseFloat(ethers.utils.formatUnits(amountOut, 8));
        console.log(`✅ 手動マルチホップ成功: ${rate.toFixed(8)} UBTC`);
      } else {
        console.log('❌ 手動マルチホップも失敗');
      }
      
      return;
    }
    
    // 7. 結果表示
    console.log('\\n🎉 AlphaRouter ルート発見!');
    console.log('================================');
    
    if (route.quote) {
      console.log(`💱 クォート: ${route.quote.toSignificant(6)} ${route.quote.currency.symbol}`);
    }
    
    if (route.quoteGasAdjusted) {
      console.log(`⛽ ガス調整後: ${route.quoteGasAdjusted.toSignificant(6)} ${route.quoteGasAdjusted.currency.symbol}`);
    }
    
    if (route.estimatedGasUsed) {
      console.log(`📊 推定ガス: ${route.estimatedGasUsed.toString()}`);
    }
    
    if (route.gasPriceWei) {
      console.log(`💰 ガス価格: ${ethers.utils.formatUnits(route.gasPriceWei, 'gwei')} gwei`);
    }
    
    if (route.trade && route.trade.swaps) {
      console.log(`\\n🛣️  ルート詳細:`);
      route.trade.swaps.forEach((swap, index) => {
        console.log(`  スワップ ${index + 1}:`);
        swap.route.pools.forEach((pool, poolIndex) => {
          console.log(`    プール ${poolIndex + 1}: ${pool.token0.symbol}/${pool.token1.symbol} (${pool.fee}bps)`);
        });
      });
    }
    
    if (route.methodParameters) {
      console.log(`\\n📄 Transaction Parameters:`);
      console.log(`  to: ${route.methodParameters.to}`);
      console.log(`  value: ${route.methodParameters.value}`);
      console.log(`  calldata: ${route.methodParameters.calldata.substring(0, 50)}...`);
    }
    
  } catch (error) {
    console.error('❌ AlphaRouter テストエラー:', error.message);
    
    if (error.message.includes('ChainId')) {
      console.log('\\n💡 ヒント: HyperEVM (ChainId 999) はAlphaRouterで未サポートの可能性があります');
      console.log('   これは設定済みSubgraphやプール情報が不足しているためです');
    }
    
    if (error.message.includes('SUBGRAPH')) {
      console.log('\\n💡 ヒント: Subgraphエンドポイントが設定されていない可能性があります');
      console.log('   オンチェーンのみでプール情報を取得するため時間がかかります');
    }
  }
}

if (require.main === module) {
  testAlphaRouter()
    .then(() => console.log('\\n🏁 AlphaRouter検証完了'))
    .catch(error => console.error('❌ 予期しないエラー:', error));
}

module.exports = { testAlphaRouter };