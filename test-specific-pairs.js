#!/usr/bin/env node

/**
 * 特定ペアの詳細テスト
 */

const { UniversalContractUtils } = require('./temp/templates/contract-utils');
const { ethers } = require('ethers');

async function testSpecificPairs() {
  console.log('🔍 特定ペア詳細テスト\n');
  
  const utils = new UniversalContractUtils('https://rpc.hyperliquid.xyz/evm');
  const quoterV2 = '0x03A918028f22D9E1473B7959C927AD7425A45C7C';
  
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UETH: '0xBe6727B535545C67d5cAa73dEa54865B92CF7907',
    ADHD: '0xE3D5F45d97fee83B48c85E00c8359A2E07D68Fee'
  };
  
  const amount = ethers.utils.parseEther('1').toString();
  
  // 1. WHYPE/UETH 直接ペアテスト（これは存在するはず）
  console.log('1. WHYPE/UETH 直接ペアテスト:');
  
  for (const fee of [100, 500, 3000, 10000]) {
    try {
      const result = await utils.callReadFunction({
        abiPath: './abi/KittenQuoterV2.json',
        contractAddress: quoterV2,
        functionName: 'quoteExactInputSingle',
        args: [tokens.WHYPE, tokens.UETH, fee, amount, 0]
      });
      
      console.log(`  ${fee}bps:`, result.success ? '✅ 成功' : `❌ 失敗 - ${result.error}`);
      
      if (result.success) {
        console.log(`    結果:`, result.result);
        const amountOut = result.result[0] || result.result;
        const rate = parseFloat(ethers.utils.formatUnits(amountOut, 18));
        console.log(`    レート: ${rate}`);
      }
    } catch (error) {
      console.log(`  ${fee}bps: ❌ エラー -`, error.message.substring(0, 100));
    }
  }
  
  // 2. WHYPE/ADHD 直接ペアテスト
  console.log('\n2. WHYPE/ADHD 直接ペアテスト:');
  
  for (const fee of [3000]) {  // 0.3%のみテスト
    try {
      const result = await utils.callReadFunction({
        abiPath: './abi/KittenQuoterV2.json',
        contractAddress: quoterV2,
        functionName: 'quoteExactInputSingle',
        args: [tokens.WHYPE, tokens.ADHD, fee, amount, 0]
      });
      
      console.log(`  ${fee}bps:`, result.success ? '✅ 成功' : `❌ 失敗`);
      
      if (result.success) {
        console.log(`    結果:`, result.result);
      }
    } catch (error) {
      console.log(`  ${fee}bps: ❌ エラー -`, error.message.substring(0, 100));
    }
  }
  
  // 3. V2でのテスト
  console.log('\n3. HyperSwap V2でWHYPE/ADHDテスト:');
  
  const v2Router = '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A';
  
  try {
    const result = await utils.callReadFunction({
      abiPath: './abi/UniV2Router.json',
      contractAddress: v2Router,
      functionName: 'getAmountsOut',
      args: [amount, [tokens.WHYPE, tokens.ADHD]]
    });
    
    if (result.success) {
      console.log('  ✅ V2成功:', result.result);
      const amounts = result.result;
      if (amounts && amounts[1]) {
        const rate = parseFloat(ethers.utils.formatUnits(amounts[1], 18));
        console.log(`  レート: ${rate} ADHD`);
      }
    } else {
      console.log('  ❌ V2失敗:', result.error);
    }
  } catch (error) {
    console.log('  ❌ V2エラー:', error.message);
  }
}

if (require.main === module) {
  testSpecificPairs()
    .then(() => console.log('\n🏁 テスト完了'))
    .catch(error => console.error('❌ エラー:', error));
}

module.exports = { testSpecificPairs };