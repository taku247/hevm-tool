const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * KittenSwap 実際のトークン・プール発見
 * V2 Factory から実際のペアを列挙
 */

// KittenSwap Mainnet Contracts
const KITTENSWAP_MAINNET = {
  V2_FACTORY: '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B',
  V3_FACTORY: '0x2E08F5Ff603E4343864B14599CAeDb19918BDCaF',
  QUOTER_V2: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF'
};

// Factory ABI
const FACTORY_V2_ABI = [
  "function allPairs(uint) external view returns (address pair)",
  "function allPairsLength() external view returns (uint)",
  "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

// Pair ABI
const PAIR_ABI = [
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function totalSupply() external view returns (uint256)"
];

// ERC20 ABI for token info
const ERC20_ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)"
];

async function discoverKittenSwapTokens() {
  console.log('🐱 KittenSwap 実際のトークン・プール発見');
  console.log('========================================\\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm';
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    console.log('📊 RPC接続情報:');
    console.log(`   URL: ${rpcUrl}`);
    console.log(`   Block Number: ${await provider.getBlockNumber()}`);
    console.log('');

    const factory = new ethers.Contract(
      KITTENSWAP_MAINNET.V2_FACTORY,
      FACTORY_V2_ABI,
      provider
    );

    // 全ペア数取得
    const pairsLength = await factory.allPairsLength();
    console.log(`📊 KittenSwap V2 総ペア数: ${pairsLength.toString()}\\n`);

    const allPairs = [];
    const uniqueTokens = new Set();

    // 最初の20ペアを調査（サンプル）
    const maxPairs = Math.min(20, pairsLength.toNumber());
    console.log(`🔍 最初の${maxPairs}ペアを調査中...\\n`);

    for (let i = 0; i < maxPairs; i++) {
      try {
        const pairAddress = await factory.allPairs(i);
        const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
        
        const [token0Addr, token1Addr, reserves, pairName, pairSymbol] = await Promise.all([
          pair.token0(),
          pair.token1(),
          pair.getReserves(),
          pair.name().catch(() => 'Unknown'),
          pair.symbol().catch(() => 'UNK')
        ]);

        // トークン情報取得
        const token0 = new ethers.Contract(token0Addr, ERC20_ABI, provider);
        const token1 = new ethers.Contract(token1Addr, ERC20_ABI, provider);

        const [token0Info, token1Info] = await Promise.all([
          getTokenInfo(token0, token0Addr).catch(() => ({ symbol: 'UNK0', name: 'Unknown0', decimals: 18 })),
          getTokenInfo(token1, token1Addr).catch(() => ({ symbol: 'UNK1', name: 'Unknown1', decimals: 18 }))
        ]);

        const pairInfo = {
          index: i,
          address: pairAddress,
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
            reserve0: ethers.utils.formatUnits(reserves.reserve0, token0Info.decimals),
            reserve1: ethers.utils.formatUnits(reserves.reserve1, token1Info.decimals)
          }
        };

        allPairs.push(pairInfo);
        uniqueTokens.add(token0Addr);
        uniqueTokens.add(token1Addr);

        console.log(`${i + 1}. ${token0Info.symbol}/${token1Info.symbol}`);
        console.log(`   Pair: ${pairAddress}`);
        console.log(`   ${token0Info.symbol}: ${token0Addr}`);
        console.log(`   ${token1Info.symbol}: ${token1Addr}`);
        console.log(`   Reserves: ${pairInfo.reserves.reserve0} / ${pairInfo.reserves.reserve1}`);
        console.log('');

      } catch (error) {
        console.log(`${i + 1}. ❌ エラー: ${error.message.substring(0, 50)}`);
      }
    }

    // 統計情報
    console.log('📊 発見結果統計');
    console.log('================');
    console.log(`調査ペア数: ${allPairs.length}`);
    console.log(`ユニークトークン数: ${uniqueTokens.size}`);
    console.log('');

    // 人気トークンランキング
    const tokenCounts = {};
    allPairs.forEach(pair => {
      tokenCounts[pair.token0.symbol] = (tokenCounts[pair.token0.symbol] || 0) + 1;
      tokenCounts[pair.token1.symbol] = (tokenCounts[pair.token1.symbol] || 0) + 1;
    });

    const sortedTokens = Object.entries(tokenCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    console.log('🏆 人気トークンランキング（ペア数）:');
    sortedTokens.forEach(([symbol, count], index) => {
      console.log(`   ${index + 1}. ${symbol}: ${count}ペア`);
    });
    console.log('');

    // 実際のトークンアドレス一覧
    console.log('📋 発見されたトークンアドレス:');
    const tokensBySymbol = {};
    allPairs.forEach(pair => {
      if (!tokensBySymbol[pair.token0.symbol]) {
        tokensBySymbol[pair.token0.symbol] = pair.token0;
      }
      if (!tokensBySymbol[pair.token1.symbol]) {
        tokensBySymbol[pair.token1.symbol] = pair.token1;
      }
    });

    Object.entries(tokensBySymbol)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([symbol, token]) => {
        console.log(`   ${symbol}: '${token.address}', // ${token.name}`);
      });

    // 結果をJSONファイルに保存
    const fs = require('fs');
    const result = {
      summary: {
        totalPairsInFactory: pairsLength.toString(),
        analyzedPairs: allPairs.length,
        uniqueTokens: uniqueTokens.size,
        topTokens: sortedTokens
      },
      pairs: allPairs,
      tokens: tokensBySymbol
    };

    const outputPath = path.join(__dirname, '../../kittenswap-tokens-discovery.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log('\\n✅ トークン発見完了!');
    console.log(`📁 結果保存先: ${outputPath}`);

    return result;

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
    // フォールバック: アドレスから推測
    return {
      symbol: address.substring(0, 6),
      name: `Token ${address.substring(0, 6)}`,
      decimals: 18
    };
  }
}

// スクリプト実行
if (require.main === module) {
  discoverKittenSwapTokens()
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { discoverKittenSwapTokens };