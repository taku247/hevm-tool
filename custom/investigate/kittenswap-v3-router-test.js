#!/usr/bin/env node

/**
 * KittenSwap V3スタイルRouter調査
 * SwapRouterとQuoterV2の動作確認
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function testKittenSwapV3Router() {
  console.log('🔍 KittenSwap V3スタイル Router/Quoter テスト\n');
  
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm'
  );
  
  console.log('📊 RPC接続情報:');
  console.log(`   URL: ${provider.connection.url}`);
  console.log(`   Block Number: ${await provider.getBlockNumber()}`);
  
  // KittenSwap V3スタイルコントラクト
  const CONTRACTS = {
    SwapRouter: '0x8fFDB06039B1b8188c2C721Dc3C435B5773D7346',
    QuoterV2: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF',
    CLFactory: '0x2E08F5Ff603E4343864B14599CAeDb19918BDCaF'
  };
  
  // 実際のトークン
  const TOKENS = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    PAWS: '0xe3C80b7A1A8631E8cFd59c61E2a74Eb497dB28F6',
    wstHYPE: '0x94e8396e0869c9F2200760aF0621aFd240E1CF38'
  };
  
  // 1. QuoterV2テスト（HyperSwapと同じシグネチャ形式）
  console.log('\n1. QuoterV2 テスト:');
  
  const quoterV2ABI = [
    {
      name: "quoteExactInputSingle",
      type: "function",
      stateMutability: "view",
      inputs: [{
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" }
        ],
        name: "params",
        type: "tuple"
      }],
      outputs: [
        { name: "amountOut", type: "uint256" },
        { name: "sqrtPriceX96After", type: "uint160" },
        { name: "initializedTicksCrossed", type: "uint32" },
        { name: "gasEstimate", type: "uint256" }
      ]
    },
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
  
  const quoter = new ethers.Contract(CONTRACTS.QuoterV2, quoterV2ABI, provider);
  
  // Fee tiers (0.02%, 0.25%, 0.75% as mentioned in docs)
  const feeTiers = [200, 2500, 7500];
  
  for (const fee of feeTiers) {
    console.log(`\n🔍 WHYPE → PAWS (${fee/10000}% fee):`);
    
    try {
      const params = {
        tokenIn: TOKENS.WHYPE,
        tokenOut: TOKENS.PAWS,
        amountIn: ethers.utils.parseEther('1'),
        fee: fee,
        sqrtPriceLimitX96: 0
      };
      
      const result = await quoter.callStatic.quoteExactInputSingle(params);
      console.log(`   ✅ 成功!`);
      console.log(`      出力: ${ethers.utils.formatEther(result.amountOut)} PAWS`);
      console.log(`      ガス見積: ${result.gasEstimate.toString()}`);
      
    } catch (error) {
      console.log(`   ❌ 失敗: ${error.message.substring(0, 50)}...`);
    }
  }
  
  // 2. マルチホップパステスト
  console.log('\n2. マルチホップ quoteExactInput テスト:');
  
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
  
  const multiHopPath = encodePath(
    [TOKENS.WHYPE, TOKENS.PAWS, TOKENS.wstHYPE],
    [2500, 2500] // 0.25% fee for both hops
  );
  
  console.log(`\n🔍 WHYPE → PAWS → wstHYPE:`);
  
  try {
    const result = await quoter.callStatic.quoteExactInput(
      multiHopPath,
      ethers.utils.parseEther('1')
    );
    
    console.log(`   ✅ 成功!`);
    console.log(`      最終出力: ${ethers.utils.formatEther(result[0])} wstHYPE`);
    console.log(`      ガス見積: ${result[3].toString()}`);
    
  } catch (error) {
    console.log(`   ❌ 失敗: ${error.message}`);
  }
  
  // 3. SwapRouterテスト
  console.log('\n3. SwapRouter テスト:');
  
  const swapRouterABI = [
    {
      name: "exactInput",
      type: "function",
      stateMutability: "payable",
      inputs: [{
        components: [
          { name: "path", type: "bytes" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" }
        ],
        name: "params",
        type: "tuple"
      }],
      outputs: [
        { name: "amountOut", type: "uint256" }
      ]
    }
  ];
  
  const swapRouter = new ethers.Contract(CONTRACTS.SwapRouter, swapRouterABI, provider);
  
  console.log(`\n🔍 SwapRouter exactInput (callStatic):`);
  
  try {
    const params = {
      path: encodePath([TOKENS.WHYPE, TOKENS.PAWS], [2500]),
      recipient: '0x0000000000000000000000000000000000000001',
      deadline: Math.floor(Date.now() / 1000) + 3600,
      amountIn: ethers.utils.parseEther('1'),
      amountOutMinimum: 0
    };
    
    const result = await swapRouter.callStatic.exactInput(params);
    console.log(`   ✅ 成功!`);
    console.log(`      出力: ${ethers.utils.formatEther(result)} PAWS`);
    
  } catch (error) {
    console.log(`   ❌ 失敗: ${error.message}`);
  }
  
  // 4. 結論
  console.log('\n4. 発見:');
  console.log('   - KittenSwapはV2 Routerの代わりにV3スタイルのSwapRouterを使用');
  console.log('   - QuoterV2でレート取得が可能（V3形式）');
  console.log('   - Fee tierは0.02%, 0.25%, 0.75%（ドキュメント記載）');
  console.log('   - getAmountsOut()の代わりにquoteExactInput()を使用');
  
  console.log('\n🏁 KittenSwap V3スタイル Router/Quoter テスト完了');
}

if (require.main === module) {
  testKittenSwapV3Router().catch(console.error);
}

module.exports = { testKittenSwapV3Router };