#!/usr/bin/env node

/**
 * Minimal Proxy詳細分析
 * EIP-1167実装アドレス正確抽出
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function analyzeMinimalProxy() {
  console.log('🔍 Minimal Proxy バイトコード詳細分析\n');
  
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm'
  );
  
  const address = '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF';
  
  const bytecode = await provider.getCode(address);
  console.log('Raw bytecode:', bytecode);
  console.log('Length:', bytecode.length);
  
  // EIP-1167 標準パターン
  console.log('\n🔍 EIP-1167 パターン分析:');
  
  // 标准模式: 363d3d373d3d3d363d73{implementation}5af43d82803e903d91602b57fd5bf3
  const eip1167Pattern = /363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3/i;
  const match = eip1167Pattern.exec(bytecode);
  
  if (match) {
    console.log('✅ 標準EIP-1167パターン検出');
    console.log('実装アドレス:', '0x' + match[1]);
  } else {
    console.log('❌ 標準EIP-1167パターンなし');
    
    // 部分的なパターンを探す
    console.log('\n🔍 部分パターン分析:');
    
    // 363d3d373d3d3d363d73で始まる部分を探す
    const partialPattern = /363d3d373d3d3d363d73([0-9a-f]{40})/i;
    const partialMatch = partialPattern.exec(bytecode);
    
    if (partialMatch) {
      console.log('✅ 部分EIP-1167パターン検出');
      console.log('候補アドレス:', '0x' + partialMatch[1]);
    } else {
      console.log('❌ 部分パターンなし');
      
      // 全てのアドレスパターンを探す
      console.log('\n🔍 20バイトアドレスパターン検索:');
      const addressPattern = /([0-9a-f]{40})/gi;
      const addresses = [];
      let addressMatch;
      
      while ((addressMatch = addressPattern.exec(bytecode)) !== null) {
        const addr = '0x' + addressMatch[1];
        if (ethers.utils.isAddress(addr) && addr !== ethers.constants.AddressZero) {
          addresses.push(addr);
        }
      }
      
      if (addresses.length > 0) {
        console.log('候補アドレス一覧:');
        addresses.forEach((addr, i) => {
          console.log(`  ${i + 1}. ${addr}`);
        });
      } else {
        console.log('❌ 有効なアドレスが見つかりません');
      }
    }
  }
  
  // バイトコードの16進表示（最初の200文字）
  console.log('\n📄 バイトコード（最初の200文字）:');
  console.log(bytecode.substring(0, 200));
  
  // バイトコードの分析
  console.log('\n📊 バイトコード分析:');
  if (bytecode.length <= 200) {
    console.log('短いバイトコード - プロキシまたはシンプルコントラクト');
  } else {
    console.log('長いバイトコード - 複雑な実装');
  }
  
  // 実際にはMinimal Proxyではない可能性
  console.log('\n🤔 プロキシ種別再評価:');
  
  if (bytecode.length > 1000) {
    console.log('実際の実装: 長いバイトコード = 通常のコントラクト');
    console.log('💡 これはMinimal Proxyではなく、実装コントラクト自体の可能性があります');
    
    // 実際のQuoterV2として動作テスト
    console.log('\n🧪 実装コントラクトとしての動作テスト:');
    
    // 簡単な関数呼び出しテスト
    const quoterABI = ["function factory() external view returns (address)"];
    const quoter = new ethers.Contract(address, quoterABI, provider);
    
    try {
      const factory = await quoter.factory();
      console.log(`✅ factory()呼び出し成功: ${factory}`);
      console.log('💡 これは実装コントラクトです');
    } catch (error) {
      console.log(`❌ factory()呼び出し失敗: ${error.message}`);
    }
    
  } else {
    console.log('短いバイトコード = プロキシの可能性が高い');
  }
}

if (require.main === module) {
  analyzeMinimalProxy().catch(console.error);
}

module.exports = { analyzeMinimalProxy };