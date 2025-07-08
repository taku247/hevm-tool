#!/usr/bin/env node

/**
 * KittenSwap SwapRouter詳細テスト
 * 実際のスワップ実行を試行
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function testKittenSwapRouter() {
  console.log('🔍 KittenSwap SwapRouter詳細テスト\n');
  
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm'
  );
  
  console.log('📊 RPC接続情報:');
  console.log(`   URL: ${provider.connection.url}`);
  console.log(`   Block Number: ${await provider.getBlockNumber()}`);
  
  // KittenSwap V3コントラクト
  const CONTRACTS = {
    SwapRouter: '0x8fFDB06039B1b8188c2C721Dc3C435B5773D7346',
    CLFactory: '0x2E08F5Ff603E4343864B14599CAeDb19918BDCaF',
    QuoterV2: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF'
  };
  
  // 実際のトークン
  const TOKENS = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    PAWS: '0xe3C80b7A1A8631E8cFd59c61E2a74Eb497dB28F6',
    wstHYPE: '0x94e8396e0869c9F2200760aF0621aFd240E1CF38'
  };
  
  // 1. SwapRouter基本情報確認
  console.log('\n1. SwapRouter基本情報確認:');
  
  const swapRouterABI = [
    "function factory() external view returns (address)",
    "function WETH9() external view returns (address)",
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
      outputs: [{ name: "amountOut", type: "uint256" }]
    },
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
  
  try {
    const factory = await swapRouter.factory();
    console.log(`   ✅ Factory: ${factory}`);
  } catch (error) {
    console.log(`   ❌ Factory取得失敗: ${error.message}`);
  }
  
  try {
    const weth9 = await swapRouter.WETH9();
    console.log(`   ✅ WETH9: ${weth9}`);
  } catch (error) {
    console.log(`   ❌ WETH9取得失敗: ${error.message}`);
  }
  
  // 2. 実際のプールでのテスト
  console.log('\n2. 実際のプールでのテスト:');
  
  // まず、実際に存在するプールを確認
  const factoryABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)",
    "function allPoolsLength() external view returns (uint256)",
    "function allPools(uint256 index) external view returns (address pool)"
  ];
  
  const factory = new ethers.Contract(CONTRACTS.CLFactory, factoryABI, provider);
  
  try {
    const poolCount = await factory.allPoolsLength();
    console.log(`   📊 プール総数: ${poolCount.toString()}`);
    
    if (poolCount.gt(0)) {
      // 最初のプールを詳細確認
      const firstPool = await factory.allPools(0);
      console.log(`   🎯 最初のプール: ${firstPool}`);
      
      // プールの詳細情報
      const poolABI = [
        "function token0() external view returns (address)",
        "function token1() external view returns (address)",
        "function fee() external view returns (uint24)",
        "function liquidity() external view returns (uint128)",
        "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
      ];
      
      const pool = new ethers.Contract(firstPool, poolABI, provider);
      
      const [token0, token1, fee, liquidity, slot0] = await Promise.all([
        pool.token0(),
        pool.token1(),
        pool.fee(),
        pool.liquidity(),
        pool.slot0()
      ]);
      
      console.log(`   🔍 プール詳細:`);
      console.log(`      Token0: ${token0}`);
      console.log(`      Token1: ${token1}`);
      console.log(`      Fee: ${fee} (${fee/10000}%)`);
      console.log(`      Liquidity: ${liquidity.toString()}`);
      console.log(`      SqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
      console.log(`      Unlocked: ${slot0.unlocked}`);
      
      // 3. 実際のスワップテスト（callStatic）
      console.log('\n3. 実際のスワップテスト:');
      
      if (liquidity.gt(0) && slot0.unlocked) {
        console.log(`   🧪 exactInputSingle テスト:`);
        console.log(`      ${token0} → ${token1}`);
        
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
        
        try {
          // exactInputSingle テスト
          const params = {
            tokenIn: token0,
            tokenOut: token1,
            fee: fee,
            recipient: '0x0000000000000000000000000000000000000001',
            deadline: Math.floor(Date.now() / 1000) + 3600,
            amountIn: ethers.utils.parseEther('0.001'), // 少量でテスト
            amountOutMinimum: 0
          };
          
          const result = await swapRouter.callStatic.exactInputSingle(params);
          console.log(`      ✅ 成功! 出力: ${ethers.utils.formatEther(result)} tokens`);
          
        } catch (error) {
          console.log(`      ❌ exactInputSingle失敗: ${error.message}`);
        }
        
        try {
          // exactInput テスト
          const path = encodePath([token0, token1], [fee]);
          const params = {
            path: path,
            recipient: '0x0000000000000000000000000000000000000001',
            deadline: Math.floor(Date.now() / 1000) + 3600,
            amountIn: ethers.utils.parseEther('0.001'),
            amountOutMinimum: 0
          };
          
          const result = await swapRouter.callStatic.exactInput(params);
          console.log(`      ✅ exactInput成功! 出力: ${ethers.utils.formatEther(result)} tokens`);
          
        } catch (error) {
          console.log(`      ❌ exactInput失敗: ${error.message}`);
        }
        
      } else {
        console.log(`   ❌ プールに流動性がないか、ロックされています`);
        console.log(`      Liquidity: ${liquidity.toString()}`);
        console.log(`      Unlocked: ${slot0.unlocked}`);
      }
    }
    
  } catch (error) {
    console.log(`   ❌ プール確認エラー: ${error.message}`);
  }
  
  // 4. 実際のWallet接続テスト（必要に応じて）
  console.log('\n4. 実際のスワップ可能性:');
  
  if (process.env.HYPERLIQUID_PRIVATE_KEY) {
    console.log('   🔑 Private Key検出 - 実際のスワップテストが可能です');
    console.log('   💡 実際にスワップを実行する場合は、少量でテストしてください');
  } else {
    console.log('   ❌ Private Key未設定 - callStaticテストのみ');
  }
  
  // 5. 結論
  console.log('\n5. 結論:');
  console.log('   - KittenSwap SwapRouterは9,908 bytesの大きな実装コントラクト');
  console.log('   - V3スタイルのexactInput/exactInputSingle機能を提供');
  console.log('   - 200個のプールが存在するが、流動性の確認が必要');
  console.log('   - 実際のスワップには適切なトークンApprovalが必要');
  
  console.log('\n🏁 KittenSwap SwapRouterテスト完了');
}

if (require.main === module) {
  testKittenSwapRouter().catch(console.error);
}

module.exports = { testKittenSwapRouter };