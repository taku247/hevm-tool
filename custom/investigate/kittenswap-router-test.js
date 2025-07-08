#!/usr/bin/env node

/**
 * KittenSwap Router 基本機能テスト
 * getAmountsOut()が動作するか確認
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function testKittenSwapRouter() {
  console.log('🔍 KittenSwap Router 基本機能テスト\n');
  
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm'
  );
  
  console.log('📊 RPC接続情報:');
  console.log(`   URL: ${provider.connection.url}`);
  console.log(`   Block Number: ${await provider.getBlockNumber()}`);
  
  // KittenSwap Router V2
  const ROUTER_ADDRESS = '0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802';
  
  // 基本的なRouter ABI
  const ROUTER_ABI = [
    "function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)",
    "function factory() external view returns (address)",
    "function WETH() external view returns (address)"
  ];
  
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, provider);
  console.log(`📍 Router: ${ROUTER_ADDRESS}`);
  
  // 実際のトークン（token-discovery.jsで確認済み）
  const TOKENS = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    PAWS: '0xe3C80b7A1A8631E8cFd59c61E2a74Eb497dB28F6',
    wstHYPE: '0x94e8396e0869c9F2200760aF0621aFd240E1CF38',
    KEI: '0xB5fE77d323d69eB352A02006eA8ecC38D882620C'
  };
  
  // 1. Router基本情報確認
  console.log('\n1. Router基本情報:');
  try {
    const factory = await router.factory();
    console.log(`   Factory: ${factory}`);
  } catch (error) {
    console.log(`   Factory: ❌ ${error.message}`);
  }
  
  try {
    const weth = await router.WETH();
    console.log(`   WETH: ${weth}`);
  } catch (error) {
    console.log(`   WETH: ❌ ${error.message}`);
  }
  
  // 2. getAmountsOut テスト
  console.log('\n2. getAmountsOut テスト:');
  
  const testCases = [
    {
      name: 'WHYPE → PAWS',
      path: [TOKENS.WHYPE, TOKENS.PAWS],
      amountIn: ethers.utils.parseEther('1')
    },
    {
      name: 'WHYPE → wstHYPE',
      path: [TOKENS.WHYPE, TOKENS.wstHYPE],
      amountIn: ethers.utils.parseEther('1')
    },
    {
      name: 'PAWS → WHYPE',
      path: [TOKENS.PAWS, TOKENS.WHYPE],
      amountIn: ethers.utils.parseEther('1')
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🔍 ${testCase.name}:`);
    console.log(`   パス: ${testCase.path.join(' → ')}`);
    console.log(`   投入量: ${ethers.utils.formatEther(testCase.amountIn)} ETH`);
    
    try {
      // callStatic使用
      const amounts = await router.callStatic.getAmountsOut(testCase.amountIn, testCase.path);
      console.log(`   ✅ 成功: ${amounts.length}個の結果`);
      amounts.forEach((amount, i) => {
        console.log(`     [${i}]: ${ethers.utils.formatEther(amount)} ETH`);
      });
      
      const outputAmount = amounts[amounts.length - 1];
      const rate = parseFloat(ethers.utils.formatEther(outputAmount));
      console.log(`   📊 レート: 1 input = ${rate.toFixed(8)} output`);
      
    } catch (error) {
      console.log(`   ❌ 失敗: ${error.message}`);
      
      // エラーの詳細分析
      if (error.message.includes('missing revert data')) {
        console.log('   💡 推定原因: プールが存在しない、または流動性なし');
      } else if (error.message.includes('INSUFFICIENT_LIQUIDITY')) {
        console.log('   💡 推定原因: 流動性不足');
      } else if (error.message.includes('INVALID_PATH')) {
        console.log('   💡 推定原因: 無効なパス');
      }
    }
  }
  
  // 3. 異なるamountInでのテスト
  console.log('\n3. 異なる投入量でのテスト:');
  
  const amounts = [
    ethers.utils.parseEther('0.001'),
    ethers.utils.parseEther('0.01'),
    ethers.utils.parseEther('0.1'),
    ethers.utils.parseEther('1')
  ];
  
  for (const amount of amounts) {
    console.log(`\n🔍 ${ethers.utils.formatEther(amount)} ETH投入 (WHYPE → PAWS):`);
    
    try {
      const result = await router.callStatic.getAmountsOut(amount, [TOKENS.WHYPE, TOKENS.PAWS]);
      const outputAmount = result[result.length - 1];
      const rate = parseFloat(ethers.utils.formatEther(outputAmount)) / parseFloat(ethers.utils.formatEther(amount));
      console.log(`   ✅ 出力: ${ethers.utils.formatEther(outputAmount)} ETH (レート: ${rate.toFixed(8)})`);
    } catch (error) {
      console.log(`   ❌ 失敗: ${error.message.substring(0, 50)}...`);
    }
  }
  
  // 4. 結論
  console.log('\n4. 結論:');
  console.log('   - KittenSwapのRouterがgetAmountsOut()に対応しているかテスト');
  console.log('   - 実際のプールペアで動作確認');
  console.log('   - HyperSwapのV2制約と同様の問題があるか確認');
  
  console.log('\n🏁 KittenSwap Router テスト完了');
}

if (require.main === module) {
  testKittenSwapRouter().catch(console.error);
}

module.exports = { testKittenSwapRouter };