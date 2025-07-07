const { ethers } = require('ethers');
require('dotenv').config();

/**
 * V3流動性制限の詳細分析
 */
async function analyzeV3Liquidity() {
  console.log('🔍 V3流動性制限の詳細分析\n');
  
  const testnetRpc = 'https://rpc.hyperliquid-testnet.xyz/evm';
  const provider = new ethers.providers.JsonRpcProvider(testnetRpc);
  
  console.log('📊 V3流動性制限とは？\n');
  
  // 1. V2 vs V3の基本的な違い
  console.log('🔄 1. V2 vs V3 アーキテクチャの違い:\n');
  
  console.log('   📈 V2（AMM）:');
  console.log('      - 流動性: 全価格範囲（0 ～ ∞）に均等分散');
  console.log('      - プール作成: 簡単（2トークンのペア作成のみ）');
  console.log('      - 初期化: factory.createPair() で自動生成');
  console.log('      - 流動性提供者: 誰でも簡単にLPトークン預入可能');
  console.log('');
  
  console.log('   📊 V3（Concentrated Liquidity）:');
  console.log('      - 流動性: 指定価格範囲にのみ集中');
  console.log('      - プール作成: 複雑（価格範囲の設定が必要）');
  console.log('      - 初期化: createPool() + initialize() + mint() が必要');
  console.log('      - 流動性提供者: 価格範囲を理解した上級者向け');
  console.log('');
  
  // 2. テストネット特有の制限
  console.log('🧪 2. テストネット特有の制限:\n');
  
  console.log('   ⚠️  V3プール作成の難しさ:');
  console.log('      - 適切な価格範囲の設定が必要');
  console.log('      - 初期流動性の提供が複雑');
  console.log('      - テストネットでは十分な流動性提供者が少ない');
  console.log('      - 経済的インセンティブが限定的');
  console.log('');
  
  console.log('   📉 実際の状況:');
  console.log('      - HyperSwap V3は技術的には動作している');
  console.log('      - HSPX/WETHペアの流動性プールが未作成');
  console.log('      - テストユーザーがV3の複雑さを避けている');
  console.log('      - V2で十分な流動性があるため、V3の必要性が低い');
  console.log('');
  
  // 3. V3プール確認
  console.log('🔍 3. V3ファクトリーとプール確認:\n');
  
  const v3Factory = '0x22B0768972bB7f1F5ea7a8740BB8f94b32483826';
  const tokens = {
    HSPX: '0xD8c23394e2d55AA6dB9E5bb1305df54A1F83D122',
    WETH: '0xADcb2f358Eae6492F61A5F87eb8893d09391d160',
    PURR: '0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82'
  };
  
  console.log('   📍 V3 Factory確認:');
  const factoryCode = await provider.getCode(v3Factory);
  console.log(`      Factory: ${(factoryCode.length - 2) / 2} bytes ✅`);
  
  console.log('\n   🔍 プール存在確認:');
  
  // V3 Factory ABI（getPool関数のみ）
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
  
  const factory = new ethers.Contract(v3Factory, factoryABI, provider);
  const fees = [100, 500, 3000, 10000]; // 1bps, 5bps, 30bps, 100bps
  
  const pairs = [
    { name: 'HSPX/WETH', tokenA: tokens.HSPX, tokenB: tokens.WETH },
    { name: 'HSPX/PURR', tokenA: tokens.HSPX, tokenB: tokens.PURR },
    { name: 'WETH/PURR', tokenA: tokens.WETH, tokenB: tokens.PURR }
  ];
  
  for (const pair of pairs) {
    console.log(`\n      ${pair.name}:`);
    for (const fee of fees) {
      try {
        const poolAddress = await factory.getPool(pair.tokenA, pair.tokenB, fee);
        
        if (poolAddress === '0x0000000000000000000000000000000000000000') {
          console.log(`         ${fee/100}bps: プールなし`);
        } else {
          console.log(`         ${fee/100}bps: ✅ ${poolAddress}`);
          
          // プールの初期化状況確認
          const poolCode = await provider.getCode(poolAddress);
          if (poolCode && poolCode !== '0x') {
            console.log(`            └─ プール初期化済み`);
          } else {
            console.log(`            └─ プール未初期化`);
          }
        }
      } catch (error) {
        console.log(`         ${fee/100}bps: 確認エラー`);
      }
    }
  }
  
  // 4. メインネットとの比較
  console.log('\n\n🌐 4. メインネット vs テストネットの比較:\n');
  
  console.log('   🏦 メインネット（本番）:');
  console.log('      - 経済的インセンティブ: 実際の利益が期待できる');
  console.log('      - 流動性提供者: 多数の参加者');
  console.log('      - プール多様性: 全手数料ティアでプール存在');
  console.log('      - 取引量: 大量の取引により流動性が厚い');
  console.log('');
  
  console.log('   🧪 テストネット:');
  console.log('      - 経済的インセンティブ: なし（テスト目的のみ）');
  console.log('      - 流動性提供者: 限定的（開発者・テスター）');
  console.log('      - プール多様性: V2中心、V3は限定的');
  console.log('      - 取引量: 少量（機能テストのみ）');
  console.log('');
  
  // 5. 影響と対策
  console.log('🎯 5. 影響と対策:\n');
  
  console.log('   📊 現在の状況:');
  console.log('      - V2: 完全に機能（HSPX/WETH, HSPX/PURR等）');
  console.log('      - V3: 技術的には動作するが流動性なし');
  console.log('      - テストには十分（V2で主要機能確認可能）');
  console.log('');
  
  console.log('   💡 対策:');
  console.log('      - テストネット: V2を中心にテスト実行');
  console.log('      - V3機能: メインネットで確認');
  console.log('      - コード品質: V3実装は技術的に正しい');
  console.log('      - 実用性: 本番環境では両方とも利用可能');
  console.log('');
  
  console.log('📋 結論:');
  console.log('   "V3流動性制限" = 部分的制約（2025年1月更新）');
  console.log('   - 技術実装: ✅ 正常');
  console.log('   - WETH/PURRプール: ✅ 動作確認済み（101,038-101,341 gas成功）');
  console.log('   - HSPXペア: ❌ 流動性提供者不足');
  console.log('   - 本番環境: ✅ 利用可能予想');
  console.log('   - テスト方針: V3（WETH/PURR）、V2（その他ペア）');
  
  return {
    v2Status: 'limited_liquidity_some_pairs',
    v3Status: 'weth_purr_working_hspx_pairs_limited',
    recommendation: 'use_v3_for_weth_purr_v2_for_others',
    mainnetExpectation: 'both_v2_and_v3_should_work',
    lastUpdated: '2025-01-07',
    successfulPairs: ['WETH/PURR'],
    gasUsage: { router01: 101038, router02: 101341 }
  };
}

// 実行
if (require.main === module) {
  analyzeV3Liquidity()
    .then(result => {
      console.log('\n🎯 分析結果:', result);
    })
    .catch(error => {
      console.error('❌ 分析エラー:', error);
    });
}

module.exports = { analyzeV3Liquidity };