const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * KittenSwap QuoterV2 基本テスト
 * 最小限の機能確認とデバッグ
 */

// 基本的なABI（factory、WETH9などの確認用）
const QUOTER_V2_ABI = [
  {
    "inputs": [],
    "name": "factory",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "WETH9",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const QUOTER_V2_ADDRESS = '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF';

async function testBasicQuoterV2() {
  console.log('🔍 KittenSwap QuoterV2 基本テスト');
  console.log('================================\\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    console.log('📊 RPC接続情報:');
    console.log(`   URL: ${rpcUrl}`);
    console.log(`   Block Number: ${await provider.getBlockNumber()}`);
    console.log('');

    // コントラクトの存在確認
    console.log('1. コントラクト存在確認');
    const code = await provider.getCode(QUOTER_V2_ADDRESS);
    console.log(`   バイトコード長: ${code.length} bytes`);
    
    if (code === '0x') {
      console.log('   ❌ コントラクトが存在しません');
      return;
    }
    
    console.log('   ✅ コントラクトが存在します');
    console.log('');

    // QuoterV2コントラクト接続
    const quoterV2 = new ethers.Contract(QUOTER_V2_ADDRESS, QUOTER_V2_ABI, provider);
    
    // 基本機能テスト
    console.log('2. 基本機能確認');
    
    try {
      const factory = await quoterV2.factory();
      console.log(`   Factory address: ${factory}`);
    } catch (error) {
      console.log(`   Factory取得エラー: ${error.message}`);
    }
    
    try {
      const weth9 = await quoterV2.WETH9();
      console.log(`   WETH9 address: ${weth9}`);
    } catch (error) {
      console.log(`   WETH9取得エラー: ${error.message}`);
    }
    
    console.log('');
    
    // 利用可能な関数のテスト
    console.log('3. 利用可能な関数確認');
    console.log('   以下の関数が利用可能かテスト:');
    
    const testFunctions = [
      'quoteExactInputSingle',
      'quoteExactOutputSingle',
      'quoteExactInput',
      'quoteExactOutput'
    ];
    
    for (const funcName of testFunctions) {
      try {
        const func = quoterV2[funcName];
        if (func) {
          console.log(`   ✅ ${funcName} - 存在`);
        } else {
          console.log(`   ❌ ${funcName} - 不存在`);
        }
      } catch (error) {
        console.log(`   ❌ ${funcName} - エラー: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    console.error('詳細:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  testBasicQuoterV2()
    .then(() => {
      console.log('\\n✅ 基本テスト完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { testBasicQuoterV2 };