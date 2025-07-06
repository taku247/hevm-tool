#!/usr/bin/env node

/**
 * 設定ベースDEXシステムの実動作確認スクリプト
 * 実際のネットワークに接続してシステムの動作を検証
 */

const { DexManager } = require('./temp/src/dex/dex-manager');
const { configLoader } = require('./temp/src/config/config-loader');
const { ethers } = require('ethers');

async function testLiveFunctionality() {
  console.log('🚀 設定ベースDEXシステム実動作確認開始\n');

  try {
    // 1. 設定システムの検証
    console.log('📋 1. 設定システム検証');
    console.log('========================');
    
    const validation = await configLoader.validateConfig();
    console.log(`設定検証: ${validation.valid ? '✅ 有効' : '❌ 無効'}`);
    
    if (!validation.valid) {
      console.log('エラー:', validation.errors);
      return;
    }

    const configInfo = await (new DexManager('https://rpc.hyperliquid.xyz/evm')).getConfigInfo();
    console.log(`ネットワーク: ${configInfo.network}`);
    console.log(`DEX数: ${configInfo.dexCount}`);
    console.log(`トークン数: ${configInfo.tokenCount}`);
    console.log(`プロトコル: ${configInfo.protocols.join(', ')}\n`);

    // 2. 基本レート取得テスト
    console.log('💱 2. 基本レート取得テスト');
    console.log('==========================');
    
    const dexManager = new DexManager('https://rpc.hyperliquid.xyz/evm', 'hyperevm-mainnet');
    
    const testAmount = ethers.utils.parseEther('1').toString();
    const quoteParams = {
      tokenIn: 'WHYPE',
      tokenOut: 'UBTC',
      amountIn: testAmount
    };

    console.log('テストペア: 1 WHYPE → UBTC');
    
    // 3. 各DEX個別テスト
    console.log('\n🔍 3. 各DEX個別テスト');
    console.log('=====================');
    
    const activeDexes = await configLoader.getActiveDexes();
    const testResults = {};
    
    for (const [dexId, dexConfig] of Object.entries(activeDexes)) {
      console.log(`\n  📊 ${dexConfig.name} (${dexConfig.type.toUpperCase()}) テスト中...`);
      
      const startTime = Date.now();
      const result = await dexManager.getQuote(dexId, quoteParams);
      const endTime = Date.now();
      
      testResults[dexId] = {
        success: result.success,
        rate: result.rate,
        responseTime: endTime - startTime,
        error: result.error
      };
      
      if (result.success) {
        console.log(`     ✅ 成功: レート ${result.rate.toFixed(8)} (${endTime - startTime}ms)`);
        console.log(`     💰 1 WHYPE = ${result.rate.toFixed(8)} UBTC`);
        console.log(`     ⛽ ガス見積もり: ~${Math.round(result.gasEstimate/1000)}k`);
      } else {
        console.log(`     ❌ 失敗: ${result.error}`);
      }
    }

    // 4. 全DEX一括取得テスト
    console.log('\n🎯 4. 全DEX一括取得テスト');
    console.log('========================');
    
    const startTime = Date.now();
    const allQuotes = await dexManager.getAllQuotes(quoteParams);
    const endTime = Date.now();
    
    const successfulQuotes = allQuotes.filter(q => q.success);
    const failedQuotes = allQuotes.filter(q => !q.success);
    
    console.log(`総実行時間: ${endTime - startTime}ms`);
    console.log(`成功: ${successfulQuotes.length}/${allQuotes.length} DEX`);
    
    if (successfulQuotes.length > 0) {
      const rates = successfulQuotes.map(q => q.rate);
      const bestRate = Math.max(...rates);
      const worstRate = Math.min(...rates);
      const spread = ((bestRate - worstRate) / worstRate * 100);
      
      console.log(`最良レート: ${bestRate.toFixed(8)}`);
      console.log(`最悪レート: ${worstRate.toFixed(8)}`);
      console.log(`価格差: ${spread.toFixed(2)}%`);
    }

    // 5. プロトコル別テスト
    console.log('\n🔄 5. プロトコル別テスト');
    console.log('======================');
    
    const protocols = await configLoader.getSupportedProtocols();
    for (const protocol of ['uniswap-v2', 'uniswap-v3']) {
      if (protocols.includes(protocol)) {
        console.log(`\n  ${protocol.toUpperCase()} プロトコルテスト:`);
        
        const protocolQuotes = await dexManager.getQuotesByProtocol(protocol, quoteParams);
        const successCount = protocolQuotes.filter(q => q.success).length;
        
        console.log(`    結果: ${successCount}/${protocolQuotes.length} DEX成功`);
        
        protocolQuotes.forEach(quote => {
          if (quote.success) {
            console.log(`      ✅ ${quote.dexName}: ${quote.rate.toFixed(8)}`);
          } else {
            console.log(`      ❌ ${quote.dexName}: ${quote.error?.substring(0, 50)}...`);
          }
        });
      }
    }

    // 6. 最良レート検索テスト
    console.log('\n🏆 6. 最良レート検索テスト');
    console.log('=========================');
    
    const bestQuote = await dexManager.getBestQuote(quoteParams);
    
    if (bestQuote) {
      console.log(`最良DEX: ${bestQuote.dexName}`);
      console.log(`最良レート: ${bestQuote.rate.toFixed(8)}`);
      console.log(`ガス見積もり: ~${Math.round(bestQuote.gasEstimate/1000)}k`);
    } else {
      console.log('❌ 最良レートが見つかりませんでした');
    }

    // 7. アービトラージ機会検索テスト
    console.log('\n💡 7. アービトラージ機会検索テスト');
    console.log('===============================');
    
    const opportunities = await dexManager.findArbitrageOpportunities(
      'WHYPE',
      'UBTC',
      testAmount,
      0.01 // 1%以上の差
    );
    
    if (opportunities.length > 0) {
      console.log(`🚀 ${opportunities.length}件のアービトラージ機会を発見!`);
      
      opportunities.slice(0, 3).forEach((opp, index) => {
        console.log(`\n  機会 #${index + 1}:`);
        console.log(`    購入: ${opp.buyDex.dexName} (${opp.buyDex.rate.toFixed(8)})`);
        console.log(`    売却: ${opp.sellDex.dexName} (${opp.sellDex.rate.toFixed(8)})`);
        console.log(`    スプレッド: ${(opp.spread * 100).toFixed(2)}%`);
        console.log(`    予想利益: ${opp.profit.toFixed(6)} UBTC`);
      });
    } else {
      console.log('🔍 現在アービトラージ機会は見つかりませんでした（市況により変動）');
    }

    // 8. パフォーマンス統計
    console.log('\n📊 8. パフォーマンス統計');
    console.log('======================');
    
    const successRate = (successfulQuotes.length / allQuotes.length * 100).toFixed(1);
    const avgResponseTime = Object.values(testResults)
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.responseTime, 0) / successfulQuotes.length;
    
    console.log(`成功率: ${successRate}%`);
    console.log(`平均レスポンス時間: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`総テスト時間: ${endTime - startTime}ms`);

    // 9. 設定ファイル整合性確認
    console.log('\n🔧 9. 設定ファイル整合性確認');
    console.log('===========================');
    
    const dexConfig = await configLoader.loadDexConfig();
    const tokenConfig = await configLoader.loadTokenConfig();
    
    console.log(`DEX設定バージョン: ${dexConfig.metadata.version}`);
    console.log(`トークン設定バージョン: ${tokenConfig.metadata.version}`);
    console.log(`最終更新: ${dexConfig.metadata.lastUpdated}`);

    console.log('\n✅ 全テスト完了! 設定ベースDEXシステムは正常に動作しています。');

  } catch (error) {
    console.error('\n❌ テスト中にエラーが発生しました:', error.message);
    console.error('スタックトレース:', error.stack);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  testLiveFunctionality()
    .then(() => {
      console.log('\n🎉 テスト完了');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 予期しないエラー:', error);
      process.exit(1);
    });
}

module.exports = { testLiveFunctionality };