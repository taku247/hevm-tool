#!/usr/bin/env node

/**
 * KittenSwap動作可能プール特定
 * 実際にスワップ可能なプールを見つける
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function findWorkingPools() {
  console.log('🔍 KittenSwap動作可能プール特定\n');
  
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm'
  );
  
  console.log('📊 RPC接続情報:');
  console.log(`   URL: ${provider.connection.url}`);
  console.log(`   Block Number: ${await provider.getBlockNumber()}`);
  
  const CONTRACTS = {
    SwapRouter: '0x8fFDB06039B1b8188c2C721Dc3C435B5773D7346',
    CLFactory: '0x2E08F5Ff603E4343864B14599CAeDb19918BDCaF',
    QuoterV2: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF'
  };
  
  // 1. プール一覧を取得して基本情報を確認
  console.log('\n1. プール基本情報確認:');
  
  const factoryABI = [
    "function allPoolsLength() external view returns (uint256)",
    "function allPools(uint256 index) external view returns (address pool)"
  ];
  
  const factory = new ethers.Contract(CONTRACTS.CLFactory, factoryABI, provider);
  
  try {
    const poolCount = await factory.allPoolsLength();
    console.log(`   📊 プール総数: ${poolCount.toString()}`);
    
    const workingPools = [];
    const maxCheck = Math.min(poolCount.toNumber(), 20); // 最大20個チェック
    
    // プールの基本情報取得
    const poolABI = [
      "function token0() external view returns (address)",
      "function token1() external view returns (address)",
      "function fee() external view returns (uint24)"
    ];
    
    for (let i = 0; i < maxCheck; i++) {
      try {
        const poolAddress = await factory.allPools(i);
        const pool = new ethers.Contract(poolAddress, poolABI, provider);
        
        const [token0, token1, fee] = await Promise.all([
          pool.token0(),
          pool.token1(),
          pool.fee()
        ]);
        
        console.log(`   Pool[${i}]: ${poolAddress}`);
        console.log(`      Token0: ${token0}`);
        console.log(`      Token1: ${token1}`);
        console.log(`      Fee: ${fee} (${fee/10000}%)`);
        
        workingPools.push({
          index: i,
          address: poolAddress,
          token0,
          token1,
          fee
        });
        
      } catch (error) {
        console.log(`   Pool[${i}]: エラー - ${error.message.substring(0, 40)}...`);
      }
    }
    
    // 2. QuoterV2でレート取得テスト
    console.log('\n2. QuoterV2でのレート取得テスト:');
    
    const quoterABI = [
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
      }
    ];
    
    const quoter = new ethers.Contract(CONTRACTS.QuoterV2, quoterABI, provider);
    
    const workingQuotes = [];
    
    for (const pool of workingPools.slice(0, 5)) { // 最初の5個をテスト
      console.log(`\n   🧪 Pool[${pool.index}] Quote テスト:`);
      
      try {
        const params = {
          tokenIn: pool.token0,
          tokenOut: pool.token1,
          amountIn: ethers.utils.parseEther('0.001'), // 少量でテスト
          fee: pool.fee,
          sqrtPriceLimitX96: 0
        };
        
        const result = await quoter.callStatic.quoteExactInputSingle(params);
        console.log(`      ✅ 成功! 出力: ${ethers.utils.formatEther(result.amountOut)}`);
        console.log(`         ガス見積: ${result.gasEstimate.toString()}`);
        
        workingQuotes.push({
          ...pool,
          quoteResult: result,
          status: 'working'
        });
        
      } catch (error) {
        console.log(`      ❌ 失敗: ${error.message.substring(0, 60)}...`);
      }
    }
    
    // 3. SwapRouterでのスワップテスト
    console.log('\n3. SwapRouterでのスワップテスト:');
    
    if (workingQuotes.length > 0) {
      const swapRouterABI = [
        {
          name: "exactInputSingle",
          type: "function",
          stateMutability: "payable",
          inputs: [{
            components: [
              { name: "tokenIn", type: "address" },
              { name: "tokenOut", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "recipient", type: "address" },
              { name: "deadline", type: "uint256" },
              { name: "amountIn", type: "uint256" },
              { name: "amountOutMinimum", type: "uint256" }
            ],
            name: "params",
            type: "tuple"
          }],
          outputs: [{ name: "amountOut", type: "uint256" }]
        }
      ];
      
      const swapRouter = new ethers.Contract(CONTRACTS.SwapRouter, swapRouterABI, provider);
      
      for (const workingPool of workingQuotes.slice(0, 3)) {
        console.log(`\n   🎯 Pool[${workingPool.index}] Swap テスト:`);
        
        try {
          const params = {
            tokenIn: workingPool.token0,
            tokenOut: workingPool.token1,
            fee: workingPool.fee,
            recipient: '0x0000000000000000000000000000000000000001',
            deadline: Math.floor(Date.now() / 1000) + 3600,
            amountIn: ethers.utils.parseEther('0.001'),
            amountOutMinimum: 0
          };
          
          const result = await swapRouter.callStatic.exactInputSingle(params);
          console.log(`      ✅ SwapRouter成功! 出力: ${ethers.utils.formatEther(result)}`);
          
        } catch (error) {
          console.log(`      ❌ SwapRouter失敗: ${error.message.substring(0, 60)}...`);
        }
      }
    } else {
      console.log('   ❌ 動作するQuoteプールがありません');
    }
    
    // 4. 結果サマリー
    console.log('\n4. 結果サマリー:');
    console.log(`   📊 基本情報取得成功: ${workingPools.length}/${maxCheck}プール`);
    console.log(`   📊 Quote成功: ${workingQuotes.length}/${workingPools.length}プール`);
    
    if (workingQuotes.length > 0) {
      console.log('\n   ✅ 動作確認されたプール:');
      workingQuotes.forEach((pool, index) => {
        console.log(`      ${index + 1}. Pool[${pool.index}]: ${pool.address}`);
        console.log(`         Token0: ${pool.token0}`);
        console.log(`         Token1: ${pool.token1}`);
        console.log(`         Fee: ${pool.fee} (${pool.fee/10000}%)`);
      });
      
      console.log('\n   💡 KittenSwapは実際に使用可能です！');
      console.log('   💡 適切なトークンApprovalを行えば実際のスワップが可能');
    } else {
      console.log('\n   ❌ 現在使用可能なプールはありません');
    }
    
  } catch (error) {
    console.log(`   ❌ プール確認エラー: ${error.message}`);
  }
  
  console.log('\n🏁 KittenSwap動作可能プール特定完了');
}

if (require.main === module) {
  findWorkingPools().catch(console.error);
}

module.exports = { findWorkingPools };