const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * KittenSwap 既知ペア直接テスト
 * token-discovery.jsで発見済みのペアアドレスを直接使用してテスト
 */

// token-discovery.jsで発見された実際のペア
const KNOWN_PAIRS = [
  {
    address: '0x6c9408dE11F3AD1388dE1c4Fe011520c757D93B5',
    tokens: ['WHYPE', 'PURR'],
    expectedTokens: {
      WHYPE: '0x5555555555555555555555555555555555555555',
      PURR: '0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E'
    }
  },
  {
    address: '0x8494f537DD2a6B2bb1cf60632473eD3473204b56',
    tokens: ['WHYPE', 'USDXL'],
    expectedTokens: {
      WHYPE: '0x5555555555555555555555555555555555555555',
      USDXL: '0xca79db4B49f608eF54a5CB813FbEd3a6387bC645'
    }
  },
  {
    address: '0xeDdd36cABD1D6BcE2e9F6D40162943B2346C7e7B',
    tokens: ['KEI', 'USDXL'],
    expectedTokens: {
      KEI: '0xB5fE77d323d69eB352A02006eA8ecC38D882620C',
      USDXL: '0xca79db4B49f608eF54a5CB813FbEd3a6387bC645'
    }
  },
  {
    address: '0x5c06758C2D322daDB9b2E2e708F49cD5FA75877c',
    tokens: ['PURR', 'USDXL'],
    expectedTokens: {
      PURR: '0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E',
      USDXL: '0xca79db4B49f608eF54a5CB813FbEd3a6387bC645'
    }
  },
  {
    address: '0x3C1F6D843aF17d0d87c6924b633cB500047B67bF',
    tokens: ['WHYPE', 'LHYPE'],
    expectedTokens: {
      WHYPE: '0x5555555555555555555555555555555555555555',
      LHYPE: '0x5748ae796AE46A4F1348a1693de4b50560485562'
    }
  }
];

// KittenSwap V2 Factory
const KITTENSWAP_V2_FACTORY = '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B';

// ABI
const FACTORY_V2_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

const PAIR_ABI = [
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function totalSupply() external view returns (uint256)"
];

const ERC20_ABI = [
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
  "function decimals() external view returns (uint8)"
];

async function testKnownKittenSwapPairs() {
  console.log('🐱 KittenSwap 既知ペア直接テスト');
  console.log('===============================\\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm';
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    console.log('📊 RPC接続情報:');
    console.log(`   URL: ${rpcUrl}`);
    console.log(`   Block Number: ${await provider.getBlockNumber()}`);
    console.log('');

    const factory = new ethers.Contract(
      KITTENSWAP_V2_FACTORY,
      FACTORY_V2_ABI,
      provider
    );

    console.log(`🏭 Factory: ${KITTENSWAP_V2_FACTORY}\\n`);

    const results = [];

    for (let i = 0; i < KNOWN_PAIRS.length; i++) {
      const knownPair = KNOWN_PAIRS[i];
      console.log(`🔍 テスト ${i + 1}: ${knownPair.tokens.join('/')} ペア`);
      console.log(`📍 ペアアドレス: ${knownPair.address}`);

      try {
        // 1. 既知ペアアドレスの直接確認
        const pair = new ethers.Contract(knownPair.address, PAIR_ABI, provider);
        
        const [token0Addr, token1Addr, reserves, pairSymbol, totalSupply] = await Promise.all([
          pair.token0(),
          pair.token1(),
          pair.getReserves(),
          pair.symbol().catch(() => 'UNK-LP'),
          pair.totalSupply()
        ]);

        console.log(`   ✅ ペア情報取得成功`);
        console.log(`   Token0: ${token0Addr}`);
        console.log(`   Token1: ${token1Addr}`);

        // 2. トークン情報取得
        const token0 = new ethers.Contract(token0Addr, ERC20_ABI, provider);
        const token1 = new ethers.Contract(token1Addr, ERC20_ABI, provider);

        const [token0Info, token1Info] = await Promise.all([
          getTokenInfo(token0, token0Addr),
          getTokenInfo(token1, token1Addr)
        ]);

        console.log(`   ${token0Info.symbol} (${token0Info.decimals}桁): ${token0Addr}`);
        console.log(`   ${token1Info.symbol} (${token1Info.decimals}桁): ${token1Addr}`);

        // 3. 流動性情報
        const reserve0 = ethers.utils.formatUnits(reserves.reserve0, token0Info.decimals);
        const reserve1 = ethers.utils.formatUnits(reserves.reserve1, token1Info.decimals);
        const lpSupply = ethers.utils.formatEther(totalSupply);

        console.log(`   流動性: ${parseFloat(reserve0).toFixed(4)} ${token0Info.symbol} / ${parseFloat(reserve1).toFixed(4)} ${token1Info.symbol}`);
        console.log(`   LP供給量: ${parseFloat(lpSupply).toFixed(4)} ${pairSymbol}`);

        // 4. レート計算
        if (parseFloat(reserve0) > 0 && parseFloat(reserve1) > 0) {
          const rate01 = parseFloat(reserve1) / parseFloat(reserve0);
          const rate10 = parseFloat(reserve0) / parseFloat(reserve1);
          console.log(`   レート: 1 ${token0Info.symbol} = ${rate01.toFixed(6)} ${token1Info.symbol}`);
          console.log(`   レート: 1 ${token1Info.symbol} = ${rate10.toFixed(6)} ${token0Info.symbol}`);
        }

        // 5. Factory経由での確認テスト
        console.log(`\\n   🔍 Factory経由確認テスト:`);
        try {
          const factoryPairAddr = await factory.getPair(token0Addr, token1Addr);
          if (factoryPairAddr === knownPair.address) {
            console.log(`   ✅ Factory確認成功: ${factoryPairAddr}`);
          } else if (factoryPairAddr === ethers.constants.AddressZero) {
            console.log(`   ❌ Factory確認失敗: ゼロアドレス返却`);
          } else {
            console.log(`   ⚠️  Factory確認: 異なるアドレス ${factoryPairAddr}`);
          }
        } catch (factoryError) {
          console.log(`   ❌ Factory確認エラー: ${factoryError.message.substring(0, 50)}`);
        }

        const resultInfo = {
          pairAddress: knownPair.address,
          pairSymbol: pairSymbol,
          token0: {
            address: token0Addr,
            symbol: token0Info.symbol,
            name: token0Info.name,
            decimals: token0Info.decimals
          },
          token1: {
            address: token1Addr,
            symbol: token1Info.symbol,
            name: token1Info.name,
            decimals: token1Info.decimals
          },
          reserves: {
            reserve0: reserve0,
            reserve1: reserve1,
            reserve0Raw: reserves.reserve0.toString(),
            reserve1Raw: reserves.reserve1.toString()
          },
          totalSupply: lpSupply,
          rates: {
            token0To1: parseFloat(reserve0) > 0 ? parseFloat(reserve1) / parseFloat(reserve0) : 0,
            token1To0: parseFloat(reserve1) > 0 ? parseFloat(reserve0) / parseFloat(reserve1) : 0
          }
        };

        results.push(resultInfo);

      } catch (error) {
        console.log(`   ❌ エラー: ${error.message}`);
      }

      console.log('');
    }

    // 結果サマリー
    console.log('📊 テスト結果サマリー');
    console.log('====================');
    console.log(`テスト対象: ${KNOWN_PAIRS.length}ペア`);
    console.log(`成功: ${results.length}ペア`);
    console.log('');

    if (results.length > 0) {
      console.log('✅ 成功したペア一覧:');
      results.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.token0.symbol}/${result.token1.symbol}`);
        console.log(`      Address: ${result.pairAddress}`);
        console.log(`      流動性: ${parseFloat(result.reserves.reserve0).toFixed(2)} / ${parseFloat(result.reserves.reserve1).toFixed(2)}`);
      });
    }

    // 結果をJSONファイルに保存
    const fs = require('fs');
    const outputData = {
      summary: {
        tested: KNOWN_PAIRS.length,
        successful: results.length,
        timestamp: new Date().toISOString()
      },
      results: results
    };

    const outputPath = path.join(__dirname, '../../kittenswap-known-pairs-test.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

    console.log('\\n✅ KittenSwap既知ペアテスト完了!');
    console.log(`📁 結果保存先: ${outputPath}`);

    return outputData;

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    console.error('詳細:', error.message);
  }
}

async function getTokenInfo(tokenContract, address) {
  try {
    const [symbol, name, decimals] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.name(),
      tokenContract.decimals()
    ]);
    
    return { symbol, name, decimals };
  } catch (error) {
    return {
      symbol: address.substring(0, 8),
      name: `Token ${address.substring(0, 8)}`,
      decimals: 18
    };
  }
}

// スクリプト実行
if (require.main === module) {
  testKnownKittenSwapPairs()
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { testKnownKittenSwapPairs };