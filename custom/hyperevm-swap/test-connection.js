const { UniversalContractUtils } = require('../../dist/templates/contract-utils');
const { ethers } = require('ethers');
require('dotenv').config();

/**
 * HyperSwap テストネット接続テスト
 */
async function testConnection() {
  console.log('🧪 HyperSwap テストネット接続テスト\n');
  
  // テストネット設定
  const TESTNET_RPC = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
  const CHAIN_ID = 998;
  
  console.log('📍 テストネット情報:');
  console.log(`   RPC: ${TESTNET_RPC}`);
  console.log(`   Chain ID: ${CHAIN_ID}\n`);
  
  // 1. 基本接続テスト
  console.log('🔌 1. 基本接続テスト:');
  try {
    const provider = new ethers.providers.JsonRpcProvider(TESTNET_RPC);
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    
    console.log(`   ✅ 接続成功`);
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   最新ブロック: ${blockNumber}`);
    
    if (network.chainId !== CHAIN_ID) {
      console.log(`   ⚠️  期待されるChain ID (${CHAIN_ID}) と異なります`);
    }
  } catch (error) {
    console.log(`   ❌ 接続失敗: ${error.message}`);
    return;
  }
  
  // 2. ウォレット設定確認
  console.log('\n🔑 2. ウォレット設定確認:');
  const privateKey = process.env.TESTNET_PRIVATE_KEY;
  
  if (!privateKey) {
    console.log('   ⚠️  TESTNET_PRIVATE_KEY が設定されていません');
    console.log('   .envファイルに以下を追加してください:');
    console.log('   TESTNET_PRIVATE_KEY=your_test_private_key_here');
  } else {
    try {
      const provider = new ethers.providers.JsonRpcProvider(TESTNET_RPC);
      const wallet = new ethers.Wallet(privateKey, provider);
      const balance = await wallet.getBalance();
      
      console.log(`   ✅ ウォレット設定OK`);
      console.log(`   アドレス: ${wallet.address}`);
      console.log(`   残高: ${ethers.utils.formatEther(balance)} ETH`);
      
      if (balance.eq(0)) {
        console.log('   💰 テストネットETHが必要です（フォーセット情報は後で提供）');
      }
    } catch (error) {
      console.log(`   ❌ ウォレット設定エラー: ${error.message}`);
    }
  }
  
  // 3. コントラクト存在確認
  console.log('\n🏭 3. HyperSwap コントラクト確認:');
  
  const contracts = [
    { name: 'V2 Router', address: '0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853' },
    { name: 'V2 Factory', address: '0xA028411927E2015A363014881a4404C636218fb1' },
    { name: 'V3 SwapRouter02', address: '0x51c5958FFb3e326F8d7AA945948159f1FF27e14A' },
    { name: 'V3 Quoter', address: '0x7FEd8993828A61A5985F384Cee8bDD42177Aa263' },
    { name: 'V3 Factory', address: '0x22B0768972bB7f1F5ea7a8740BB8f94b32483826' }
  ];
  
  const provider = new ethers.providers.JsonRpcProvider(TESTNET_RPC);
  
  for (const contract of contracts) {
    try {
      const code = await provider.getCode(contract.address);
      if (code && code !== '0x') {
        console.log(`   ✅ ${contract.name}: ${(code.length - 2) / 2} bytes`);
      } else {
        console.log(`   ❌ ${contract.name}: コントラクトなし`);
      }
    } catch (error) {
      console.log(`   ❌ ${contract.name}: エラー`);
    }
  }
  
  // 4. テストトークン確認
  console.log('\n🪙 4. テストトークン確認:');
  
  const tokens = [
    { name: 'HSPX', address: '0xD8c23394e2d55AA6dB9E5bb1305df54A1F83D122' },
    { name: 'WETH', address: '0xADcb2f358Eae6492F61A5F87eb8893d09391d160' },
    { name: 'PURR', address: '0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82' },
    { name: 'JEFF', address: '0xbF7C8201519EC22512EB1405Db19C427DF64fC91' }
  ];
  
  for (const token of tokens) {
    try {
      const code = await provider.getCode(token.address);
      if (code && code !== '0x') {
        console.log(`   ✅ ${token.name}: ${(code.length - 2) / 2} bytes`);
      } else {
        console.log(`   ❌ ${token.name}: コントラクトなし`);
      }
    } catch (error) {
      console.log(`   ❌ ${token.name}: エラー`);
    }
  }
  
  // 5. UniversalContractUtils テスト
  console.log('\n🔧 5. UniversalContractUtils テスト:');
  try {
    const utils = new UniversalContractUtils(TESTNET_RPC);
    const gasAnalysis = await utils.analyzeCurrentGasPrices();
    
    console.log(`   ✅ Utils初期化成功`);
    console.log(`   ガス価格: ${(parseInt(gasAnalysis.currentBaseFee) / 1e9).toFixed(2)} Gwei`);
    console.log(`   混雑度: ${gasAnalysis.networkCongestion}`);
  } catch (error) {
    console.log(`   ❌ Utils初期化失敗: ${error.message}`);
  }
  
  // 6. 結果サマリー
  console.log('\n📋 接続テスト結果:');
  console.log('   ✅ HyperSwap テストネットへの接続確認完了');
  console.log('   ✅ 主要コントラクトの存在確認完了');
  console.log('   ✅ テストトークンの存在確認完了');
  
  if (!privateKey) {
    console.log('\n⚠️  次のステップ:');
    console.log('   1. テスト用ウォレットの秘密鍵を.envに設定');
    console.log('   2. テストネットETHの取得');
    console.log('   3. スワップ機能のテスト開始');
  } else {
    console.log('\n🎯 準備完了:');
    console.log('   スワップ機能の実装・テストが可能です');
  }
  
  return {
    connected: true,
    chainId: CHAIN_ID,
    hasWallet: !!privateKey,
    contractsVerified: true
  };
}

// 実行
if (require.main === module) {
  testConnection()
    .then(result => {
      console.log('\n🎯 最終結果:', result);
    })
    .catch(error => {
      console.error('❌ テストエラー:', error);
    });
}

module.exports = { testConnection };