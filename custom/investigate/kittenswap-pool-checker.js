#!/usr/bin/env node

/**
 * KittenSwap V3プール存在確認
 * CLFactoryを使ってプールの存在を確認
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function checkKittenSwapPools() {
  console.log('🔍 KittenSwap V3プール存在確認\n');
  
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm'
  );
  
  console.log('📊 RPC接続情報:');
  console.log(`   URL: ${provider.connection.url}`);
  console.log(`   Block Number: ${await provider.getBlockNumber()}`);
  
  // KittenSwap V3コントラクト
  const CONTRACTS = {
    CLFactory: '0x2E08F5Ff603E4343864B14599CAeDb19918BDCaF',
    QuoterV2: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF',
    SwapRouter: '0x8fFDB06039B1b8188c2C721Dc3C435B5773D7346'
  };
  
  // 実際のトークン
  const TOKENS = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    PAWS: '0xe3C80b7A1A8631E8cFd59c61E2a74Eb497dB28F6',
    wstHYPE: '0x94e8396e0869c9F2200760aF0621aFd240E1CF38',
    KEI: '0xB5fE77d323d69eB352A02006eA8ecC38D882620C'
  };
  
  // V3 Factory ABI (getPool関数）
  const factoryABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
  ];
  
  // V3 Pool ABI
  const poolABI = [
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function fee() external view returns (uint24)",
    "function liquidity() external view returns (uint128)",
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
  ];
  
  const factory = new ethers.Contract(CONTRACTS.CLFactory, factoryABI, provider);
  
  console.log('\n1. CLFactory プール確認:');
  console.log(`📍 Factory: ${CONTRACTS.CLFactory}`);
  
  // Fee tiers
  const feeTiers = [200, 2500, 7500]; // 0.02%, 0.25%, 0.75%
  
  // テスト対象のトークンペア
  const tokenPairs = [
    { name: 'WHYPE/PAWS', tokenA: TOKENS.WHYPE, tokenB: TOKENS.PAWS },
    { name: 'WHYPE/wstHYPE', tokenA: TOKENS.WHYPE, tokenB: TOKENS.wstHYPE },
    { name: 'PAWS/wstHYPE', tokenA: TOKENS.PAWS, tokenB: TOKENS.wstHYPE },
    { name: 'WHYPE/KEI', tokenA: TOKENS.WHYPE, tokenB: TOKENS.KEI },
    { name: 'PAWS/KEI', tokenA: TOKENS.PAWS, tokenB: TOKENS.KEI }
  ];
  
  const existingPools = [];
  
  for (const pair of tokenPairs) {
    console.log(`\n🔍 ${pair.name}:`);
    
    for (const fee of feeTiers) {
      try {
        const poolAddress = await factory.getPool(pair.tokenA, pair.tokenB, fee);
        
        if (poolAddress !== ethers.constants.AddressZero) {
          console.log(`   ✅ ${fee/10000}% fee: ${poolAddress}`);
          existingPools.push({
            pair: pair.name,
            fee: fee,
            address: poolAddress,
            tokenA: pair.tokenA,
            tokenB: pair.tokenB
          });
        } else {
          console.log(`   ❌ ${fee/10000}% fee: プールなし`);
        }
        
      } catch (error) {
        console.log(`   ❌ ${fee/10000}% fee: エラー - ${error.message.substring(0, 30)}...`);
      }
    }
  }
  
  // 2. 存在するプールの詳細情報を取得
  if (existingPools.length > 0) {
    console.log('\n2. 存在するプールの詳細:');
    
    for (const pool of existingPools) {
      console.log(`\n🏊 ${pool.pair} (${pool.fee/10000}% fee):`);
      console.log(`   アドレス: ${pool.address}`);
      
      try {
        const poolContract = new ethers.Contract(pool.address, poolABI, provider);
        
        // 基本情報
        const [token0, token1, fee, liquidity, slot0] = await Promise.all([
          poolContract.token0(),
          poolContract.token1(),
          poolContract.fee(),
          poolContract.liquidity(),
          poolContract.slot0()
        ]);
        
        console.log(`   Token0: ${token0}`);
        console.log(`   Token1: ${token1}`);
        console.log(`   Fee: ${fee} (${fee/10000}%)`);
        console.log(`   Liquidity: ${liquidity.toString()}`);
        console.log(`   SqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
        console.log(`   Tick: ${slot0.tick}`);
        console.log(`   Unlocked: ${slot0.unlocked}`);
        
        // 流動性があるかチェック
        if (liquidity.gt(0)) {
          console.log(`   💰 流動性あり: ${liquidity.toString()}`);
        } else {
          console.log(`   💸 流動性なし`);
        }
        
      } catch (error) {
        console.log(`   ❌ プール情報取得エラー: ${error.message.substring(0, 50)}...`);
      }
    }
  } else {
    console.log('\n❌ 存在するプールが見つかりませんでした');
  }
  
  // 3. 別のFactory候補確認
  console.log('\n3. 他のFactory候補確認:');
  
  const otherFactories = [
    { name: 'PairFactory', address: '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B' },
    { name: 'FactoryRegistry', address: '0x8C142521ebB1aC1cC1F0958037702A69b6f608e4' }
  ];
  
  // V2 Factory ABI
  const v2FactoryABI = [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)"
  ];
  
  for (const factoryInfo of otherFactories) {
    console.log(`\n🏭 ${factoryInfo.name}:`);
    console.log(`   アドレス: ${factoryInfo.address}`);
    
    try {
      const v2Factory = new ethers.Contract(factoryInfo.address, v2FactoryABI, provider);
      
      for (const pair of tokenPairs.slice(0, 2)) { // 最初の2ペアだけテスト
        try {
          const pairAddress = await v2Factory.getPair(pair.tokenA, pair.tokenB);
          
          if (pairAddress !== ethers.constants.AddressZero) {
            console.log(`   ✅ ${pair.name}: ${pairAddress}`);
          } else {
            console.log(`   ❌ ${pair.name}: ペアなし`);
          }
        } catch (error) {
          console.log(`   ❌ ${pair.name}: エラー - ${error.message.substring(0, 30)}...`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Factory接続エラー: ${error.message.substring(0, 50)}...`);
    }
  }
  
  // 4. 結論
  console.log('\n4. 結論:');
  console.log(`   - 存在するV3プール: ${existingPools.length}個`);
  console.log(`   - 流動性のあるプール: ${existingPools.filter(p => p.liquidity && p.liquidity > 0).length}個`);
  
  if (existingPools.length === 0) {
    console.log('   💡 推定原因: KittenSwapのプールが作成されていない、または異なるFactory');
  } else {
    console.log('   💡 Quoterエラーの原因: 流動性不足、または異なるシグネチャ');
  }
  
  console.log('\n🏁 KittenSwap プール確認完了');
}

if (require.main === module) {
  checkKittenSwapPools().catch(console.error);
}

module.exports = { checkKittenSwapPools };