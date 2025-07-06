#!/usr/bin/env node

/**
 * QuoterからFactoryアドレスを逆算
 */

const { UniversalContractUtils } = require('./temp/templates/contract-utils');
const { ethers } = require('ethers');

async function findFactoryAddress() {
  console.log('🔍 QuoterからFactoryアドレスを逆算\n');
  
  const utils = new UniversalContractUtils('https://rpc.hyperliquid.xyz/evm');
  const quoterAddress = '0x03A918028f22D9E1473B7959C927AD7425A45C7C';
  
  // Quoter V2の一般的なABI（factory関数付き）
  const quoterABI = [
    {
      "name": "factory",
      "type": "function",
      "stateMutability": "view",
      "inputs": [],
      "outputs": [
        {"name": "", "type": "address"}
      ]
    }
  ];
  
  console.log(`📍 Quoter: ${quoterAddress}`);
  
  try {
    const quoterContract = new ethers.Contract(
      quoterAddress,
      quoterABI,
      utils.provider
    );
    
    const factoryAddress = await quoterContract.factory();
    
    console.log(`✅ Factory発見: ${factoryAddress}`);
    
    // Factoryの動作確認
    const factoryABI = [
      {
        "name": "getPool",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
          {"name": "tokenA", "type": "address"},
          {"name": "tokenB", "type": "address"},
          {"name": "fee", "type": "uint24"}
        ],
        "outputs": [
          {"name": "pool", "type": "address"}
        ]
      }
    ];
    
    const factoryContract = new ethers.Contract(
      factoryAddress,
      factoryABI,
      utils.provider
    );
    
    console.log('\n🧪 Factory動作テスト:');
    
    // テストトークン
    const tokens = {
      WHYPE: '0x5555555555555555555555555555555555555555',
      UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463',
      UETH: '0xBe6727B535545C67d5cAa73dEa54865B92CF7907'
    };
    
    // いくつかのペアをテスト
    const testPairs = [
      { name: 'WHYPE/UBTC', tokenA: tokens.WHYPE, tokenB: tokens.UBTC },
      { name: 'WHYPE/UETH', tokenA: tokens.WHYPE, tokenB: tokens.UETH },
      { name: 'UBTC/UETH', tokenA: tokens.UBTC, tokenB: tokens.UETH }
    ];
    
    const feeTiers = [100, 500, 3000, 10000];
    
    for (const pair of testPairs) {
      console.log(`\n📊 ${pair.name}:`);
      
      for (const fee of feeTiers) {
        try {
          const poolAddress = await factoryContract.getPool(pair.tokenA, pair.tokenB, fee);
          
          if (poolAddress === '0x0000000000000000000000000000000000000000') {
            console.log(`   ${fee}bps: プールなし`);
          } else {
            console.log(`   ${fee}bps: ✅ ${poolAddress}`);
            
            // プールにコードがあるか確認
            const poolCode = await utils.provider.getCode(poolAddress);
            if (poolCode === '0x' || poolCode.length <= 2) {
              console.log(`      └─ ⚠️  コードなし（未初期化？）`);
            } else {
              console.log(`      └─ ✅ 初期化済み`);
            }
          }
        } catch (error) {
          console.log(`   ${fee}bps: ❌ エラー: ${error.message.substring(0, 50)}`);
        }
      }
    }
    
    return { factoryAddress, quoterAddress };
    
  } catch (error) {
    console.log(`❌ Factory取得エラー: ${error.message}`);
    
    // 代替手段: QuoterコントラクトのABIを確認
    console.log('\n🔍 代替手段: QuoterのABI確認');
    
    try {
      const quoterCode = await utils.provider.getCode(quoterAddress);
      console.log(`Quoterコードサイズ: ${(quoterCode.length - 2) / 2} bytes`);
      
      if (quoterCode.length > 2) {
        console.log('✅ Quoterは正常にデプロイされています');
        
        // 既存の方法でテストを続行
        console.log('\n📋 推奨事項:');
        console.log('   - Quoterのfactoryメソッドがないかもしれません');
        console.log('   - HyperSwapのカスタムABIを使用する必要があります');
        console.log('   - 別の方法でFactoryアドレスを取得してください');
      }
    } catch (codeError) {
      console.log(`❌ Quoterコード取得エラー: ${codeError.message}`);
    }
    
    return null;
  }
}

if (require.main === module) {
  findFactoryAddress()
    .then((result) => {
      if (result) {
        console.log('\n🎯 発見されたアドレス:');
        console.log(`   Factory: ${result.factoryAddress}`);
        console.log(`   Quoter: ${result.quoterAddress}`);
      } else {
        console.log('\n❌ Factoryアドレスの取得に失敗しました');
      }
    })
    .catch(error => console.error('❌ エラー:', error));
}

module.exports = { findFactoryAddress };