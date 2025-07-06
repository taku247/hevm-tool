#!/usr/bin/env node

/**
 * HyperSwap UI情報に基づくV3検証
 * UIで表示されている0.3% (3000bps) fee tierを重点的にテスト
 */

const { UniversalContractUtils } = require('./temp/templates/contract-utils');
const { ethers } = require('ethers');

async function testV3UIVerification() {
  console.log('🔍 HyperSwap UI情報に基づくV3検証\n');
  
  const utils = new UniversalContractUtils('https://rpc.hyperliquid.xyz/evm');
  const quoterV2 = '0x03A918028f22D9E1473B7959C927AD7425A45C7C';
  
  const WHYPE = '0x5555555555555555555555555555555555555555';
  const UBTC = '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463';
  const UETH = '0xBe6727B535545C67d5cAa73dEa54865B92CF7907';
  
  console.log('📊 UIで表示されている情報をテスト:');
  console.log('- WHYPE/UBTC V3 0.3% (3000bps) fee tier\n');
  
  // 1. UI表示の3000bps fee tierを重点テスト
  console.log('🎯 1. UI表示の3000bps fee tierテスト:');
  
  const testAmounts = [
    { amount: '0.01', desc: '0.01 WHYPE' },
    { amount: '0.1', desc: '0.1 WHYPE' },
    { amount: '1', desc: '1 WHYPE' }
  ];
  
  for (const testCase of testAmounts) {
    const amount = ethers.utils.parseEther(testCase.amount).toString();
    
    try {
      console.log(`  テスト量: ${testCase.desc}`);
      
      const result = await utils.callReadFunction({
        abiPath: './abi/KittenQuoterV2.json',
        contractAddress: quoterV2,
        functionName: 'quoteExactInputSingle',
        args: [WHYPE, UBTC, 3000, amount, 0]
      });
      
      if (result.success) {
        const amountOut = result.result[0] || result.result;
        const rate = parseFloat(ethers.utils.formatUnits(amountOut, 8)) / parseFloat(testCase.amount);
        console.log(`    ✅ 成功: ${rate.toFixed(8)} UBTC/WHYPE`);
        console.log(`    📈 ${testCase.amount} WHYPE → ${parseFloat(ethers.utils.formatUnits(amountOut, 8)).toFixed(8)} UBTC`);
      } else {
        console.log(`    ❌ 失敗: ${result.error || 'execution reverted'}`);
      }
    } catch (error) {
      console.log(`    ❌ エラー: ${error.message.substring(0, 100)}...`);
    }
    console.log('');
  }
  
  // 2. 他のfee tierも確認
  console.log('🔍 2. 他のfee tierでの比較:');
  
  const amount = ethers.utils.parseEther('1').toString();
  const feeTiers = [100, 500, 2500, 10000];
  
  for (const fee of feeTiers) {
    try {
      const result = await utils.callReadFunction({
        abiPath: './abi/KittenQuoterV2.json',
        contractAddress: quoterV2,
        functionName: 'quoteExactInputSingle',
        args: [WHYPE, UBTC, fee, amount, 0]
      });
      
      if (result.success) {
        const amountOut = result.result[0] || result.result;
        const rate = parseFloat(ethers.utils.formatUnits(amountOut, 8));
        console.log(`  ✅ ${fee}bps: ${rate.toFixed(8)} UBTC`);
      } else {
        console.log(`  ❌ ${fee}bps: 失敗`);
      }
    } catch (error) {
      console.log(`  ❌ ${fee}bps: revert`);
    }
  }
  
  // 3. マルチホップ（UETH経由）も試行
  console.log('\n🔄 3. マルチホップテスト (WHYPE → UETH → UBTC):');
  
  try {
    const path = ethers.utils.solidityPack(
      ['address', 'uint24', 'address', 'uint24', 'address'],
      [WHYPE, 3000, UETH, 3000, UBTC]  // 両方とも3000bpsで試行
    );
    
    const result = await utils.callReadFunction({
      abiPath: './abi/KittenQuoterV2.json',
      contractAddress: quoterV2,
      functionName: 'quoteExactInput',
      args: [path, amount]
    });
    
    if (result.success) {
      const amountOut = result.result[0] || result.result;
      const rate = parseFloat(ethers.utils.formatUnits(amountOut, 8));
      console.log(`  ✅ マルチホップ成功: ${rate.toFixed(8)} UBTC`);
    } else {
      console.log(`  ❌ マルチホップ失敗: ${result.error || 'execution reverted'}`);
    }
  } catch (error) {
    console.log(`  ❌ マルチホップエラー: ${error.message.substring(0, 100)}...`);
  }
  
  console.log('\n📋 結論:');
  console.log('UIで表示されているV3情報と実際のコントラクト応答を比較');
  console.log('もしUIが3000bpsを表示していて実際に動作しない場合、');
  console.log('UIとバックエンドの実装に不整合がある可能性があります。');
}

if (require.main === module) {
  testV3UIVerification()
    .then(() => console.log('\n🏁 UI検証完了'))
    .catch(error => console.error('❌ 検証エラー:', error));
}

module.exports = { testV3UIVerification };