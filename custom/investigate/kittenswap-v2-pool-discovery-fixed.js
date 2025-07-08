const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * KittenSwap V2プール発見（修正版）
 * 実際のKittenSwapトークンアドレスを使用してV2プール詳細を取得
 */

// KittenSwap V2 Contract
const KITTENSWAP_V2_FACTORY = '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B';

// 実際のKittenSwapトークン（token-discovery.jsで発見済み）
const REAL_KITTENSWAP_TOKENS = {
  WHYPE: {
    address: '0x5555555555555555555555555555555555555555',
    symbol: 'WHYPE',
    name: 'Wrapped HYPE'
  },
  PURR: {
    address: '0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E',
    symbol: 'PURR',
    name: 'Purr'
  },
  USDXL: {
    address: '0xca79db4B49f608eF54a5CB813FbEd3a6387bC645',
    symbol: 'USDXL',
    name: 'Last USD'
  },
  KEI: {
    address: '0xB5fE77d323d69eB352A02006eA8ecC38D882620C',
    symbol: 'KEI',
    name: 'KEI Stablecoin'
  },
  LHYPE: {
    address: '0x5748ae796AE46A4F1348a1693de4b50560485562',
    symbol: 'LHYPE',
    name: 'Looped HYPE'
  },
  feUSD: {
    address: '0x02c6a2fA58cC01A18B8D9E00eA48d65E4dF26c70',
    symbol: 'feUSD',
    name: 'feUSD'
  },
  BUDDY: {
    address: '0x47bb061C0204Af921F43DC73C7D7768d2672DdEE',
    symbol: 'BUDDY',
    name: 'alright buddy'
  }
};

// ABI
const FACTORY_V2_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  "function allPairs(uint) external view returns (address pair)",
  "function allPairsLength() external view returns (uint)"
];

const PAIR_ABI = [
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function totalSupply() external view returns (uint256)"
];

async function discoverKittenSwapV2PoolsFixed() {
  console.log('🐱 KittenSwap V2プール発見（修正版）');
  console.log('=====================================\\n');

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

    console.log(`🏭 Factory: ${KITTENSWAP_V2_FACTORY}`);
    
    // 総ペア数確認
    const totalPairs = await factory.allPairsLength();
    console.log(`📊 総ペア数: ${totalPairs.toString()}\\n`);

    const discoveredPools = [];
    const tokens = Object.entries(REAL_KITTENSWAP_TOKENS);
    
    console.log('🔍 実際のKittenSwapトークンでペア検索中...');
    console.log('===========================================\\n');

    // 各トークンペアを検索
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        const [symbol1, token1] = tokens[i];
        const [symbol2, token2] = tokens[j];
        
        console.log(`🔎 ${symbol1}/${symbol2} ペア検索中...`);
        
        try {
          const pairAddress = await factory.getPair(token1.address, token2.address);
          
          if (pairAddress !== ethers.constants.AddressZero) {
            console.log(`   ✅ ペア発見: ${pairAddress}`);
            
            // ペア詳細取得
            const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
            
            const [token0Addr, token1Addr, reserves, pairSymbol, totalSupply] = await Promise.all([
              pair.token0(),
              pair.token1(),
              pair.getReserves(),
              pair.symbol().catch(() => 'UNK-LP'),
              pair.totalSupply()
            ]);

            // トークン順序確認
            const isToken0First = token0Addr.toLowerCase() === token1.address.toLowerCase();
            const firstToken = isToken0First ? token1 : token2;
            const secondToken = isToken0First ? token2 : token1;
            const reserve0 = ethers.utils.formatEther(reserves.reserve0);
            const reserve1 = ethers.utils.formatEther(reserves.reserve1);

            const poolInfo = {
              pair: `${firstToken.symbol}/${secondToken.symbol}`,
              address: pairAddress,
              pairSymbol: pairSymbol,
              token0: {
                address: token0Addr,
                symbol: firstToken.symbol,
                name: firstToken.name
              },
              token1: {
                address: token1Addr,
                symbol: secondToken.symbol,
                name: secondToken.name
              },
              reserves: {
                reserve0: reserve0,
                reserve1: reserve1,
                reserve0Raw: reserves.reserve0.toString(),
                reserve1Raw: reserves.reserve1.toString()
              },
              totalSupply: ethers.utils.formatEther(totalSupply),
              lastUpdate: reserves.blockTimestampLast
            };

            discoveredPools.push(poolInfo);

            console.log(`   📝 詳細情報:`);
            console.log(`      LPトークン: ${pairSymbol}`);
            console.log(`      ${firstToken.symbol}: ${reserve0} (${firstToken.address})`);
            console.log(`      ${secondToken.symbol}: ${reserve1} (${secondToken.address})`);
            console.log(`      総供給量: ${ethers.utils.formatEther(totalSupply)} LP`);
            console.log(`      最終更新: ${new Date(reserves.blockTimestampLast * 1000).toLocaleString()}`);
            
            // 簡易レート計算
            if (parseFloat(reserve0) > 0 && parseFloat(reserve1) > 0) {
              const rate01 = parseFloat(reserve1) / parseFloat(reserve0);
              const rate10 = parseFloat(reserve0) / parseFloat(reserve1);
              console.log(`      レート: 1 ${firstToken.symbol} = ${rate01.toFixed(6)} ${secondToken.symbol}`);
              console.log(`      レート: 1 ${secondToken.symbol} = ${rate10.toFixed(6)} ${firstToken.symbol}`);
            }
            
          } else {
            console.log(`   ❌ ペア不存在`);
          }
        } catch (error) {
          console.log(`   ⚠️  エラー: ${error.message.substring(0, 60)}`);
        }
        
        console.log('');
      }
    }

    // 結果サマリー
    console.log('\\n📊 発見結果サマリー');
    console.log('==================');
    console.log(`検索対象トークン: ${tokens.length}個`);
    console.log(`発見されたペア: ${discoveredPools.length}個`);
    console.log(`Factory総ペア数: ${totalPairs.toString()}個`);
    console.log('');

    if (discoveredPools.length > 0) {
      console.log('📋 発見されたプール一覧:');
      discoveredPools.forEach((pool, index) => {
        console.log(`   ${index + 1}. ${pool.pair}`);
        console.log(`      Address: ${pool.address}`);
        console.log(`      流動性: ${pool.reserves.reserve0} / ${pool.reserves.reserve1}`);
      });
      console.log('');

      // 流動性ランキング
      const sortedByLiquidity = [...discoveredPools]
        .filter(pool => parseFloat(pool.totalSupply) > 0)
        .sort((a, b) => parseFloat(b.totalSupply) - parseFloat(a.totalSupply))
        .slice(0, 5);

      if (sortedByLiquidity.length > 0) {
        console.log('🏆 流動性トップ5:');
        sortedByLiquidity.forEach((pool, index) => {
          console.log(`   ${index + 1}. ${pool.pair}: ${parseFloat(pool.totalSupply).toFixed(2)} LP`);
        });
        console.log('');
      }
    }

    // 結果をJSONファイルに保存
    const fs = require('fs');
    const result = {
      summary: {
        searchedTokens: tokens.length,
        discoveredPools: discoveredPools.length,
        totalFactoryPairs: totalPairs.toString(),
        timestamp: new Date().toISOString()
      },
      tokens: REAL_KITTENSWAP_TOKENS,
      pools: discoveredPools
    };

    const outputPath = path.join(__dirname, '../../kittenswap-v2-pools-fixed.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log('✅ KittenSwap V2プール発見完了!');
    console.log(`📁 結果保存先: ${outputPath}`);

    return result;

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    console.error('詳細:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  discoverKittenSwapV2PoolsFixed()
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { discoverKittenSwapV2PoolsFixed };