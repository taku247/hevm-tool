#!/usr/bin/env node

/**
 * KittenSwap Minimal Proxy解析
 * プロキシの実装コントラクトアドレスを特定
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function resolveKittenSwapProxy() {
  console.log('🔍 KittenSwap Minimal Proxy解析\n');
  
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm'
  );
  
  console.log('📊 RPC接続情報:');
  console.log(`   URL: ${provider.connection.url}`);
  console.log(`   Block Number: ${await provider.getBlockNumber()}`);
  
  // KittenSwapのプロキシコントラクト
  const PROXY_CONTRACTS = {
    'QuoterV2': '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF',
    'Router': '0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802',
    'PairFactory': '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B',
    'FactoryRegistry': '0x8C142521ebB1aC1cC1F0958037702A69b6f608e4'
  };
  
  // 1. 各プロキシの実装アドレス特定
  console.log('\n1. Minimal Proxy実装アドレス特定:');
  
  const implementations = {};
  
  for (const [name, address] of Object.entries(PROXY_CONTRACTS)) {
    console.log(`\n🔍 ${name} (${address}):`);
    
    try {
      const bytecode = await provider.getCode(address);
      const implementationAddress = extractImplementationAddress(bytecode);
      
      if (implementationAddress) {
        console.log(`   ✅ 実装アドレス: ${implementationAddress}`);
        implementations[name] = implementationAddress;
        
        // 実装コントラクトの存在確認
        const implCode = await provider.getCode(implementationAddress);
        const implSize = implCode.length / 2 - 1;
        console.log(`   📏 実装サイズ: ${implSize} bytes`);
        
        if (implSize > 1000) {
          console.log(`   💡 実装コントラクトが存在します`);
        }
        
      } else {
        console.log(`   ❌ 実装アドレスが見つかりません`);
      }
      
    } catch (error) {
      console.log(`   ❌ エラー: ${error.message}`);
    }
  }
  
  // 2. 実装コントラクトで直接テスト
  if (implementations.QuoterV2) {
    console.log('\n2. 実装コントラクトでの直接テスト:');
    
    const implAddress = implementations.QuoterV2;
    console.log(`🎯 実装アドレス: ${implAddress}`);
    
    // V3 QuoterV2のABI
    const quoterV2ABI = [
      {
        name: "quoteExactInput",
        type: "function",
        stateMutability: "view",
        inputs: [
          { name: "path", type: "bytes" },
          { name: "amountIn", type: "uint256" }
        ],
        outputs: [
          { name: "amountOut", type: "uint256" },
          { name: "sqrtPriceX96AfterList", type: "uint160[]" },
          { name: "initializedTicksCrossedList", type: "uint32[]" },
          { name: "gasEstimate", type: "uint256" }
        ]
      }
    ];
    
    const quoter = new ethers.Contract(implAddress, quoterV2ABI, provider);
    
    // V3パスエンコード
    function encodePath(tokens, fees) {
      let path = '0x';
      for (let i = 0; i < tokens.length; i++) {
        path += tokens[i].slice(2);
        if (i < fees.length) {
          path += fees[i].toString(16).padStart(6, '0');
        }
      }
      return path;
    }
    
    const TOKENS = {
      WHYPE: '0x5555555555555555555555555555555555555555',
      PAWS: '0xe3C80b7A1A8631E8cFd59c61E2a74Eb497dB28F6'
    };
    
    const testPath = encodePath([TOKENS.WHYPE, TOKENS.PAWS], [2500]);
    const amountIn = ethers.utils.parseEther('1');
    
    console.log(`\n🧪 実装コントラクトでのテスト:`);
    console.log(`   パス: WHYPE → PAWS (0.25% fee)`);
    console.log(`   投入量: 1.0 ETH`);
    
    try {
      const result = await quoter.callStatic.quoteExactInput(testPath, amountIn);
      console.log(`   ✅ 成功!`);
      console.log(`      出力: ${ethers.utils.formatEther(result[0])} PAWS`);
      console.log(`      ガス見積: ${result[3].toString()}`);
      
    } catch (error) {
      console.log(`   ❌ 失敗: ${error.message}`);
    }
  }
  
  // 3. 正しいProxy呼び出し方法を確認
  console.log('\n3. 正しいProxy呼び出し方法:');
  
  if (implementations.QuoterV2) {
    const proxyAddress = PROXY_CONTRACTS.QuoterV2;
    console.log(`🎯 プロキシアドレス: ${proxyAddress}`);
    
    // プロキシ経由でのテスト
    const quoterV2ABI = [
      {
        name: "quoteExactInput",
        type: "function",
        stateMutability: "view",
        inputs: [
          { name: "path", type: "bytes" },
          { name: "amountIn", type: "uint256" }
        ],
        outputs: [
          { name: "amountOut", type: "uint256" },
          { name: "sqrtPriceX96AfterList", type: "uint160[]" },
          { name: "initializedTicksCrossedList", type: "uint32[]" },
          { name: "gasEstimate", type: "uint256" }
        ]
      }
    ];
    
    const proxyQuoter = new ethers.Contract(proxyAddress, quoterV2ABI, provider);
    
    const TOKENS = {
      WHYPE: '0x5555555555555555555555555555555555555555',
      PAWS: '0xe3C80b7A1A8631E8cFd59c61E2a74Eb497dB28F6'
    };
    
    function encodePath(tokens, fees) {
      let path = '0x';
      for (let i = 0; i < tokens.length; i++) {
        path += tokens[i].slice(2);
        if (i < fees.length) {
          path += fees[i].toString(16).padStart(6, '0');
        }
      }
      return path;
    }
    
    const testPath = encodePath([TOKENS.WHYPE, TOKENS.PAWS], [2500]);
    const amountIn = ethers.utils.parseEther('1');
    
    console.log(`\n🧪 プロキシ経由でのテスト:`);
    console.log(`   パス: WHYPE → PAWS (0.25% fee)`);
    console.log(`   投入量: 1.0 ETH`);
    
    try {
      const result = await proxyQuoter.callStatic.quoteExactInput(testPath, amountIn);
      console.log(`   ✅ 成功!`);
      console.log(`      出力: ${ethers.utils.formatEther(result[0])} PAWS`);
      console.log(`      ガス見積: ${result[3].toString()}`);
      
    } catch (error) {
      console.log(`   ❌ 失敗: ${error.message}`);
      
      // 詳細なエラー分析
      if (error.message.includes('missing revert data')) {
        console.log(`   💡 原因: プールが存在しない、または流動性なし`);
      }
    }
  }
  
  // 4. 結論
  console.log('\n4. 結論:');
  console.log(`   - 検出された実装コントラクト: ${Object.keys(implementations).length}個`);
  
  Object.entries(implementations).forEach(([name, address]) => {
    console.log(`     ${name}: ${address}`);
  });
  
  if (Object.keys(implementations).length === 0) {
    console.log('   💡 すべてのコントラクトがMinimal Proxyですが、実装が特定できません');
  } else {
    console.log('   💡 実装コントラクトが特定できました。プールの存在を確認してください');
  }
  
  console.log('\n🏁 KittenSwap Proxy解析完了');
}

// Minimal Proxyから実装アドレスを抽出
function extractImplementationAddress(bytecode) {
  // Minimal Proxy パターン: 363d3d373d3d3d363d73{implementation}5af43d82803e903d91602b57fd5bf3
  const minimalProxyPattern = /363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3/i;
  const match = minimalProxyPattern.exec(bytecode);
  
  if (match && match[1]) {
    return '0x' + match[1];
  }
  
  // 他のプロキシパターンも試す
  const eip1167Pattern = /363d3d373d3d3d363d73([0-9a-f]{40})/i;
  const eip1167Match = eip1167Pattern.exec(bytecode);
  
  if (eip1167Match && eip1167Match[1]) {
    return '0x' + eip1167Match[1];
  }
  
  return null;
}

if (require.main === module) {
  resolveKittenSwapProxy().catch(console.error);
}

module.exports = { resolveKittenSwapProxy };