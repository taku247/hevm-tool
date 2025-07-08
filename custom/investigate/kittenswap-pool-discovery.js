const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * KittenSwap プール発見スクリプト
 * メインネット + テストネットの包括的プール調査
 * 
 * 参考: https://docs.kittenswap.finance/tokenomics/deployed-contracts
 */

// KittenSwap Mainnet Contract Addresses
const KITTENSWAP_MAINNET = {
  // Phase 1 (V2)
  V2_FACTORY: '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B',
  V2_ROUTER: '0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802',
  
  // Phase 2 (V3/CL)
  V3_FACTORY: '0x2E08F5Ff603E4343864B14599CAeDb19918BDCaF',
  NFP: '0xB9201e89f94a01FF13AD4CAeCF43a2e232513754',
  SWAP_ROUTER: '0x8fFDB06039B1b8188c2C721Dc3C435B5773D7346',
  QUOTER_V2: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF',
  FACTORY_REGISTRY: '0x8C142521ebB1aC1cC1F0958037702A69b6f608e4'
};

// KittenSwap Testnet (制限あり)
const KITTENSWAP_TESTNET = {
  ROUTER: '0xc70b117857691c0e9e93b6787689be845b657d7a'
};

// テストトークン（メインネット）
const MAINNET_TOKENS = {
  WETH: '0xADcb2f358Eae6492F61A5F87eb8893d09391d160',
  PURR: '0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82',
  HFUN: '0x37adB2550b965851593832a6444763eeB3e1d1Ec',
  USDC: '0x15D73a742529C3fb11f3FA32EF7f0CC3870ACA31',
  KITTEN: '0x618275f8efe54c2afa87bfb9f210a52f0ff89364'
};

// V3手数料階層
const FEE_TIERS = [100, 500, 2500, 10000];

// 基本的なABI
const FACTORY_V2_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  "function allPairs(uint) external view returns (address pair)",
  "function allPairsLength() external view returns (uint)"
];

const FACTORY_V3_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
];

const PAIR_ABI = [
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
];

const POOL_ABI = [
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function fee() external view returns (uint24)",
  "function liquidity() external view returns (uint128)",
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

const ROUTER_V2_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

async function discoverKittenSwapPools() {
  console.log('🐱 KittenSwap プール発見開始');
  console.log('===============================\\n');

  const results = {
    mainnet: {
      v2Pools: [],
      v3Pools: []
    },
    testnet: {
      availablePairs: []
    }
  };

  // メインネット調査
  await discoverMainnetPools(results);
  
  // テストネット調査
  await discoverTestnetPools(results);
  
  // 結果サマリー
  printSummary(results);
  
  return results;
}

async function discoverMainnetPools(results) {
  console.log('🔍 メインネット調査開始');
  console.log('========================\\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm';
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    console.log('📊 RPC接続情報:');
    console.log(`   URL: ${rpcUrl}`);
    console.log(`   Block Number: ${await provider.getBlockNumber()}`);
    console.log('');

    // V2プール発見
    await discoverV2Pools(provider, results);
    
    // V3プール発見
    await discoverV3Pools(provider, results);

  } catch (error) {
    console.error('❌ メインネット調査エラー:', error.message);
  }
}

async function discoverV2Pools(provider, results) {
  console.log('🔍 V2プール調査');
  console.log('================');

  try {
    const factory = new ethers.Contract(
      KITTENSWAP_MAINNET.V2_FACTORY,
      FACTORY_V2_ABI,
      provider
    );

    console.log(`Factory: ${KITTENSWAP_MAINNET.V2_FACTORY}`);
    
    // 全ペア数取得
    const pairsLength = await factory.allPairsLength();
    console.log(`総ペア数: ${pairsLength.toString()}`);
    
    // 各トークンペアを個別チェック
    const tokens = Object.entries(MAINNET_TOKENS);
    console.log('\\n個別ペアチェック:');
    
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        const [symbol1, addr1] = tokens[i];
        const [symbol2, addr2] = tokens[j];
        
        try {
          const pairAddress = await factory.getPair(addr1, addr2);
          
          if (pairAddress !== ethers.constants.AddressZero) {
            // ペア詳細取得
            const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
            const reserves = await pair.getReserves();
            
            const poolInfo = {
              pair: `${symbol1}/${symbol2}`,
              address: pairAddress,
              token0: await pair.token0(),
              token1: await pair.token1(),
              reserve0: ethers.utils.formatEther(reserves.reserve0),
              reserve1: ethers.utils.formatEther(reserves.reserve1)
            };
            
            results.mainnet.v2Pools.push(poolInfo);
            
            console.log(`   ✅ ${symbol1}/${symbol2}`);
            console.log(`      Address: ${pairAddress}`);
            console.log(`      Reserves: ${poolInfo.reserve0} / ${poolInfo.reserve1}`);
          } else {
            console.log(`   ❌ ${symbol1}/${symbol2} - プールなし`);
          }
        } catch (error) {
          console.log(`   ⚠️  ${symbol1}/${symbol2} - エラー: ${error.message.substring(0, 50)}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ V2プール調査エラー:', error.message);
  }
  
  console.log('');
}

async function discoverV3Pools(provider, results) {
  console.log('🔍 V3プール調査');
  console.log('================');

  try {
    const factory = new ethers.Contract(
      KITTENSWAP_MAINNET.V3_FACTORY,
      FACTORY_V3_ABI,
      provider
    );

    console.log(`Factory: ${KITTENSWAP_MAINNET.V3_FACTORY}`);
    console.log('手数料階層:', FEE_TIERS.join(', '), 'bps\\n');
    
    const tokens = Object.entries(MAINNET_TOKENS);
    
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        const [symbol1, addr1] = tokens[i];
        const [symbol2, addr2] = tokens[j];
        
        console.log(`📋 ${symbol1}/${symbol2}:`);
        
        for (const fee of FEE_TIERS) {
          try {
            const poolAddress = await factory.getPool(addr1, addr2, fee);
            
            if (poolAddress !== ethers.constants.AddressZero) {
              // プール存在確認
              const code = await provider.getCode(poolAddress);
              
              if (code !== '0x') {
                const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
                const liquidity = await pool.liquidity();
                const slot0 = await pool.slot0();
                
                const poolInfo = {
                  pair: `${symbol1}/${symbol2}`,
                  address: poolAddress,
                  fee: fee,
                  liquidity: liquidity.toString(),
                  sqrtPriceX96: slot0.sqrtPriceX96.toString(),
                  tick: slot0.tick,
                  initialized: slot0.unlocked
                };
                
                results.mainnet.v3Pools.push(poolInfo);
                
                console.log(`   ✅ ${fee}bps - ${poolAddress.substring(0, 10)}...`);
                console.log(`      流動性: ${ethers.utils.formatEther(liquidity)}`);
                console.log(`      初期化: ${slot0.unlocked ? 'Yes' : 'No'}`);
              } else {
                console.log(`   ❌ ${fee}bps - デプロイされていません`);
              }
            } else {
              console.log(`   ❌ ${fee}bps - プールなし`);
            }
          } catch (error) {
            console.log(`   ⚠️  ${fee}bps - エラー: ${error.message.substring(0, 30)}`);
          }
        }
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ V3プール調査エラー:', error.message);
  }
}

async function discoverTestnetPools(results) {
  console.log('🔍 テストネット調査開始');
  console.log('========================\\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    console.log('📊 RPC接続情報:');
    console.log(`   URL: ${rpcUrl}`);
    console.log(`   Block Number: ${await provider.getBlockNumber()}`);
    console.log('');

    const router = new ethers.Contract(
      KITTENSWAP_TESTNET.ROUTER,
      ROUTER_V2_ABI,
      provider
    );

    console.log(`Router: ${KITTENSWAP_TESTNET.ROUTER}`);
    console.log('\\n⚠️  注意: テストネットは基本的なルーター機能のみ利用可能\\n');
    
    // テストネットトークンでペア確認
    const testTokens = Object.entries(MAINNET_TOKENS); // 同じアドレス想定
    const testAmount = ethers.utils.parseEther('0.01');
    
    for (let i = 0; i < testTokens.length; i++) {
      for (let j = i + 1; j < testTokens.length; j++) {
        const [symbol1, addr1] = testTokens[i];
        const [symbol2, addr2] = testTokens[j];
        
        try {
          const amounts = await router.getAmountsOut(testAmount, [addr1, addr2]);
          
          if (amounts.length > 1 && amounts[1].gt(0)) {
            const pairInfo = {
              pair: `${symbol1}/${symbol2}`,
              inputAmount: ethers.utils.formatEther(testAmount),
              outputAmount: ethers.utils.formatEther(amounts[1]),
              rate: ethers.utils.formatEther(amounts[1].mul(100))
            };
            
            results.testnet.availablePairs.push(pairInfo);
            
            console.log(`   ✅ ${symbol1}/${symbol2}`);
            console.log(`      ${pairInfo.inputAmount} ${symbol1} → ${pairInfo.outputAmount} ${symbol2}`);
            console.log(`      レート: 1 ${symbol1} = ${pairInfo.rate} ${symbol2}`);
          } else {
            console.log(`   ❌ ${symbol1}/${symbol2} - ペアなし`);
          }
        } catch (error) {
          console.log(`   ❌ ${symbol1}/${symbol2} - エラー: ${error.message.substring(0, 50)}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ テストネット調査エラー:', error.message);
  }
  
  console.log('');
}

function printSummary(results) {
  console.log('📊 調査結果サマリー');
  console.log('==================\\n');

  console.log('🌐 メインネット:');
  console.log(`   V2プール: ${results.mainnet.v2Pools.length}個`);
  console.log(`   V3プール: ${results.mainnet.v3Pools.length}個`);
  
  if (results.mainnet.v2Pools.length > 0) {
    console.log('\\n   📋 V2プール一覧:');
    results.mainnet.v2Pools.forEach(pool => {
      console.log(`   - ${pool.pair}: ${pool.address.substring(0, 10)}...`);
    });
  }
  
  if (results.mainnet.v3Pools.length > 0) {
    console.log('\\n   📋 V3プール一覧:');
    results.mainnet.v3Pools.forEach(pool => {
      console.log(`   - ${pool.pair} (${pool.fee}bps): ${pool.address.substring(0, 10)}...`);
    });
  }
  
  console.log('\\n🧪 テストネット:');
  console.log(`   利用可能ペア: ${results.testnet.availablePairs.length}個`);
  
  if (results.testnet.availablePairs.length > 0) {
    console.log('\\n   📋 利用可能ペア一覧:');
    results.testnet.availablePairs.forEach(pair => {
      console.log(`   - ${pair.pair}: 1:${pair.rate.substring(0, 8)}`);
    });
  }
  
  console.log('\\n💾 詳細結果はJSONファイルに保存されました');
}

// スクリプト実行
if (require.main === module) {
  discoverKittenSwapPools()
    .then((results) => {
      // 結果をJSONファイルに保存
      const fs = require('fs');
      const outputPath = path.join(__dirname, '../../kittenswap-pools-discovery.json');
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      
      console.log('\\n✅ KittenSwap プール発見完了!');
      console.log(`📁 結果保存先: ${outputPath}`);
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { discoverKittenSwapPools };