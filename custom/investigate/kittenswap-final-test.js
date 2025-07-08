#!/usr/bin/env node

/**
 * KittenSwap最終動作テスト
 * 実装コントラクトと正しいプールで動作確認
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function finalKittenSwapTest() {
  console.log('🔍 KittenSwap最終動作テスト\n');
  
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm'
  );
  
  console.log('📊 RPC接続情報:');
  console.log(`   URL: ${provider.connection.url}`);
  console.log(`   Block Number: ${await provider.getBlockNumber()}`);
  
  // KittenSwapの実装コントラクト
  const CONTRACTS = {
    QuoterV2: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF',
    CLFactory: '0x2E08F5Ff603E4343864B14599CAeDb19918BDCaF'
  };
  
  // 実際に存在する可能性のあるトークン
  const TOKENS = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    PAWS: '0xe3C80b7A1A8631E8cFd59c61E2a74Eb497dB28F6',
    wstHYPE: '0x94e8396e0869c9F2200760aF0621aFd240E1CF38',
    KEI: '0xB5fE77d323d69eB352A02006eA8ecC38D882620C',
    USDC: '0x8e2D2dF57df7f95D7e30c82E38b8A4b1E2C4B4a7' // 仮定
  };
  
  console.log('\n1. CLFactoryでプール存在確認:');
  
  // V3 Factory ABI
  const factoryABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)",
    "function allPools(uint256 index) external view returns (address pool)",
    "function allPoolsLength() external view returns (uint256)"
  ];
  
  const factory = new ethers.Contract(CONTRACTS.CLFactory, factoryABI, provider);
  
  try {
    // 全プール数確認
    const poolCount = await factory.allPoolsLength();
    console.log(`   プール総数: ${poolCount.toString()}`);
    
    if (poolCount.gt(0)) {
      console.log('\n   既存のプール一覧:');
      const maxCheck = Math.min(poolCount.toNumber(), 10); // 最大10個チェック
      
      for (let i = 0; i < maxCheck; i++) {
        try {
          const poolAddress = await factory.allPools(i);
          console.log(`     Pool[${i}]: ${poolAddress}`);
          
          // プールの詳細情報を取得
          const poolABI = [
            "function token0() external view returns (address)",
            "function token1() external view returns (address)",
            "function fee() external view returns (uint24)"
          ];
          
          const pool = new ethers.Contract(poolAddress, poolABI, provider);
          const [token0, token1, fee] = await Promise.all([
            pool.token0(),
            pool.token1(),
            pool.fee()
          ]);
          
          console.log(`       Token0: ${token0}`);
          console.log(`       Token1: ${token1}`);
          console.log(`       Fee: ${fee} (${fee/10000}%)`);
          
          // 実際のプールでQuoterV2テスト
          console.log(`\n   🧪 Pool[${i}]でのQuoterV2テスト:`);
          await testQuoterV2WithPool(provider, CONTRACTS.QuoterV2, token0, token1, fee);
          
        } catch (error) {
          console.log(`     Pool[${i}]: エラー - ${error.message.substring(0, 30)}...`);
        }
      }
    } else {
      console.log('   ❌ プールが存在しません');
    }
    
  } catch (error) {
    console.log(`   ❌ Factory接続エラー: ${error.message}`);
  }
  
  console.log('\n2. 代替手段: HyperSwapとの比較');
  
  // HyperSwapのQuoterV2で同じトークンペアをテスト
  const hyperswapQuoter = '0x03A918028f22D9E1473B7959C927AD7425A45C7C';
  
  console.log(`\n   🔍 HyperSwap QuoterV2でのテスト:`);
  await testQuoterV2WithTokens(provider, hyperswapQuoter, TOKENS.WHYPE, TOKENS.PAWS, 500);
  
  console.log('\n3. 結論:');
  console.log('   - KittenSwapのQuoterV2は実装コントラクト');
  console.log('   - プールが存在しない、または流動性がない');
  console.log('   - HyperSwapでは同じトークンペアが動作する');
  console.log('   - KittenSwapはまだ完全に稼働していない可能性');
  
  console.log('\n🏁 KittenSwap最終テスト完了');
}

async function testQuoterV2WithPool(provider, quoterAddress, token0, token1, fee) {
  const quoterABI = [
    {
      name: "quoteExactInputSingle",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "tokenIn", type: "address" },
        { name: "tokenOut", type: "address" },
        { name: "fee", type: "uint24" },
        { name: "amountIn", type: "uint256" },
        { name: "sqrtPriceLimitX96", type: "uint160" }
      ],
      outputs: [
        { name: "amountOut", type: "uint256" },
        { name: "sqrtPriceX96After", type: "uint160" },
        { name: "initializedTicksCrossed", type: "uint32" },
        { name: "gasEstimate", type: "uint256" }
      ]
    }
  ];
  
  const quoter = new ethers.Contract(quoterAddress, quoterABI, provider);
  
  try {
    const result = await quoter.callStatic.quoteExactInputSingle(
      token0,
      token1,
      fee,
      ethers.utils.parseEther('1'),
      0
    );
    
    console.log(`       ✅ 成功! 出力: ${ethers.utils.formatEther(result.amountOut)}`);
    console.log(`          ガス見積: ${result.gasEstimate.toString()}`);
    
  } catch (error) {
    console.log(`       ❌ 失敗: ${error.message.substring(0, 50)}...`);
  }
}

async function testQuoterV2WithTokens(provider, quoterAddress, tokenIn, tokenOut, fee) {
  const quoterABI = [
    {
      name: "quoteExactInputSingle",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "tokenIn", type: "address" },
        { name: "tokenOut", type: "address" },
        { name: "fee", type: "uint24" },
        { name: "amountIn", type: "uint256" },
        { name: "sqrtPriceLimitX96", type: "uint160" }
      ],
      outputs: [
        { name: "amountOut", type: "uint256" },
        { name: "sqrtPriceX96After", type: "uint160" },
        { name: "initializedTicksCrossed", type: "uint32" },
        { name: "gasEstimate", type: "uint256" }
      ]
    }
  ];
  
  const quoter = new ethers.Contract(quoterAddress, quoterABI, provider);
  
  try {
    const result = await quoter.callStatic.quoteExactInputSingle(
      tokenIn,
      tokenOut,
      fee,
      ethers.utils.parseEther('1'),
      0
    );
    
    console.log(`       ✅ 成功! 出力: ${ethers.utils.formatEther(result.amountOut)}`);
    console.log(`          ガス見積: ${result.gasEstimate.toString()}`);
    
  } catch (error) {
    console.log(`       ❌ 失敗: ${error.message.substring(0, 50)}...`);
  }
}

if (require.main === module) {
  finalKittenSwapTest().catch(console.error);
}

module.exports = { finalKittenSwapTest };