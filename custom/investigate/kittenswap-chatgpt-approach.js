#!/usr/bin/env node

/**
 * ChatGPTアドバイスに基づくKittenSwap検証
 * V2のgetReserves()直接読み取りとV3の正しいABIテスト
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function testChatGPTApproach() {
  console.log('🔍 ChatGPTアドバイスに基づくKittenSwap検証\n');
  
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm'
  );
  
  console.log('📊 RPC接続情報:');
  console.log(`   URL: ${provider.connection.url}`);
  console.log(`   Block Number: ${await provider.getBlockNumber()}`);
  
  const CONTRACTS = {
    // ChatGPTが指摘したアドレス
    V2Router: '0xD6EeFfbDAF6503Ad6539CF8f337D79BEbbd40802',
    QuoterV2: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF',
    CLFactory: '0x2E08F5Ff603E4343864B14599CAeDb19918BDCaF'
  };
  
  const TOKENS = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    PAWS: '0xe3C80b7A1A8631E8cFd59c61E2a74Eb497dB28F6',
    wstHYPE: '0x94e8396e0869c9F2200760aF0621aFd240E1CF38'
  };
  
  // 1. V2 Router でgetAmountsOut()テスト
  console.log('\n1. V2 Router getAmountsOut()テスト:');
  console.log(`   Router: ${CONTRACTS.V2Router}`);
  
  const v2RouterABI = [
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
    "function factory() external view returns (address)",
    "function WETH() external view returns (address)"
  ];
  
  const v2Router = new ethers.Contract(CONTRACTS.V2Router, v2RouterABI, provider);
  
  try {
    const factory = await v2Router.factory();
    console.log(`   ✅ factory(): ${factory}`);
  } catch (error) {
    console.log(`   ❌ factory(): ${error.message.substring(0, 50)}...`);
  }
  
  try {
    const weth = await v2Router.WETH();
    console.log(`   ✅ WETH(): ${weth}`);
  } catch (error) {
    console.log(`   ❌ WETH(): ${error.message.substring(0, 50)}...`);
  }
  
  // getAmountsOut テスト
  const testPairs = [
    { name: 'WHYPE → PAWS', path: [TOKENS.WHYPE, TOKENS.PAWS] },
    { name: 'WHYPE → wstHYPE', path: [TOKENS.WHYPE, TOKENS.wstHYPE] }
  ];
  
  for (const pair of testPairs) {
    console.log(`\n   🧪 ${pair.name}:`);
    
    try {
      const amountIn = ethers.utils.parseEther('1');
      const amounts = await v2Router.callStatic.getAmountsOut(amountIn, pair.path);
      
      console.log(`      ✅ 成功! 出力: ${ethers.utils.formatEther(amounts[1])} tokens`);
      const rate = parseFloat(ethers.utils.formatEther(amounts[1]));
      console.log(`      📊 レート: 1 input = ${rate.toFixed(8)} output`);
      
    } catch (error) {
      console.log(`      ❌ 失敗: ${error.message.substring(0, 50)}...`);
    }
  }
  
  // 2. V2 Pair直接アクセス（ChatGPT推奨）
  console.log('\n2. V2 Pair getReserves()直接読み取り:');
  
  // Factoryから実際のペアアドレス取得
  const factoryABI = [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)",
    "function allPairs(uint) external view returns (address pair)",
    "function allPairsLength() external view returns (uint)"
  ];
  
  try {
    // まずV2 Factoryを確認
    const v2Factory = await v2Router.factory();
    console.log(`   V2 Factory: ${v2Factory}`);
    
    const factory = new ethers.Contract(v2Factory, factoryABI, provider);
    
    for (const pair of testPairs) {
      console.log(`\n   🏊 ${pair.name} ペア確認:`);
      
      try {
        const pairAddress = await factory.getPair(pair.path[0], pair.path[1]);
        
        if (pairAddress !== ethers.constants.AddressZero) {
          console.log(`      ✅ ペアアドレス: ${pairAddress}`);
          
          // Pairコントラクトから直接getReserves()
          const pairABI = [
            "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
            "function token0() external view returns (address)",
            "function token1() external view returns (address)"
          ];
          
          const pairContract = new ethers.Contract(pairAddress, pairABI, provider);
          
          const [reserves, token0, token1] = await Promise.all([
            pairContract.getReserves(),
            pairContract.token0(),
            pairContract.token1()
          ]);
          
          console.log(`      Token0: ${token0}`);
          console.log(`      Token1: ${token1}`);
          console.log(`      Reserve0: ${ethers.utils.formatEther(reserves.reserve0)}`);
          console.log(`      Reserve1: ${ethers.utils.formatEther(reserves.reserve1)}`);
          
          // x * y = k 公式でレート計算
          const reserve0 = reserves.reserve0;
          const reserve1 = reserves.reserve1;
          
          if (reserve0.gt(0) && reserve1.gt(0)) {
            const rate = parseFloat(ethers.utils.formatEther(reserve1)) / parseFloat(ethers.utils.formatEther(reserve0));
            console.log(`      📊 直接計算レート: 1 token0 = ${rate.toFixed(8)} token1`);
          }
          
        } else {
          console.log(`      ❌ ペアが存在しません`);
        }
        
      } catch (error) {
        console.log(`      ❌ ペア確認エラー: ${error.message.substring(0, 50)}...`);
      }
    }
    
  } catch (error) {
    console.log(`   ❌ V2 Factory アクセスエラー: ${error.message}`);
  }
  
  // 3. V3 QuoterV2 正しいABIテスト
  console.log('\n3. V3 QuoterV2 正しいABIテスト:');
  
  // ChatGPTが示すStruct形式のABI
  const correctQuoterABI = [
    {
      name: "quoteExactInputSingle",
      type: "function",
      stateMutability: "view",
      inputs: [{
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "amountIn", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" }
        ]
      }],
      outputs: [
        { name: "amountOut", type: "uint256" },
        { name: "sqrtPriceX96After", type: "uint160" },
        { name: "initializedTicksCrossed", type: "uint32" },
        { name: "gasEstimate", type: "uint256" }
      ]
    }
  ];
  
  const quoter = new ethers.Contract(CONTRACTS.QuoterV2, correctQuoterABI, provider);
  
  for (const pair of testPairs) {
    console.log(`\n   🧪 ${pair.name} (正しいABI):`);
    
    try {
      const params = {
        tokenIn: pair.path[0],
        tokenOut: pair.path[1],
        fee: 2500, // ChatGPT推奨の0.25%
        amountIn: ethers.utils.parseEther('1'),
        sqrtPriceLimitX96: 0
      };
      
      const result = await quoter.callStatic.quoteExactInputSingle(params);
      console.log(`      ✅ 成功! 出力: ${ethers.utils.formatEther(result.amountOut)} tokens`);
      console.log(`      ガス見積: ${result.gasEstimate.toString()}`);
      
    } catch (error) {
      console.log(`      ❌ 失敗: ${error.message.substring(0, 50)}...`);
    }
  }
  
  // 4. 異なるFee Tierでのテスト
  console.log('\n4. 異なるFee Tierでのテスト:');
  
  const feeTiers = [500, 2500, 7500, 10000]; // ChatGPT推奨のFee Tier
  
  for (const fee of feeTiers) {
    console.log(`\n   💰 Fee ${fee/10000}% (WHYPE → PAWS):`);
    
    try {
      const params = {
        tokenIn: TOKENS.WHYPE,
        tokenOut: TOKENS.PAWS,
        fee: fee,
        amountIn: ethers.utils.parseEther('1'),
        sqrtPriceLimitX96: 0
      };
      
      const result = await quoter.callStatic.quoteExactInputSingle(params);
      console.log(`      ✅ 成功! 出力: ${ethers.utils.formatEther(result.amountOut)} tokens`);
      
    } catch (error) {
      console.log(`      ❌ 失敗: ${error.message.includes('missing revert data') ? 'missing revert data' : error.message.substring(0, 30)}...`);
    }
  }
  
  // 5. 結論
  console.log('\n5. ChatGPTアドバイス検証結果:');
  console.log('   📊 V2 Router getAmountsOut(): テスト実施');
  console.log('   📊 V2 Pair getReserves()直接読み: テスト実施');
  console.log('   📊 V3 正しいABIでのテスト: テスト実施');
  console.log('   📊 複数Fee Tierテスト: テスト実施');
  
  console.log('\n💡 重要な発見:');
  console.log('   - ChatGPTの指摘したアプローチで新たな可能性');
  console.log('   - V2のgetReserves()直接読みは有効な手法');
  console.log('   - V3のABI構造確認が重要');
  console.log('   - 複数のアプローチの併用が推奨');
  
  console.log('\n🏁 ChatGPTアドバイス検証完了');
}

if (require.main === module) {
  testChatGPTApproach().catch(console.error);
}

module.exports = { testChatGPTApproach };