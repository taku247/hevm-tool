const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../../.env' });

/**
 * V2ルート詳細分析 - token-config.jsonベース
 * testnetの全トークンでV2ルートの利用可能性を調査し、同じ形式でJSON出力
 */

async function analyzeV2Routes() {
  console.log('🔍 V2ルート詳細分析 (token-config.jsonベース)');
  console.log('================================================\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const privateKey = process.env.PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('📋 設定:');
    console.log(`   ウォレット: ${wallet.address}`);
    console.log('');

    // 1. token-config.json読み込み
    const configPath = path.join(__dirname, '../../config/token-config.json');
    const tokenConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const testnetTokens = tokenConfig.networks['hyperevm-testnet'].tokens;

    console.log('📋 1. Testnetトークン一覧:');
    console.log('===========================');
    Object.entries(testnetTokens).forEach(([symbol, config]) => {
      console.log(`   ${symbol}: ${config.address} (${config.name})`);
    });
    console.log('');

    // 2. V2 Router設定
    const V2_ROUTER = '0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853';
    const routerAbi = [
      "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
      "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
    ];

    const router = new ethers.Contract(V2_ROUTER, routerAbi, wallet);
    const testAmount = ethers.parseEther('0.01');

    // 3. 全ペア組み合わせでV2ルート調査
    console.log('🔍 2. V2ルート利用可能性調査:');
    console.log('================================');

    const tokenSymbols = Object.keys(testnetTokens);
    const v2Results = {
      availablePairs: [],
      unavailablePairs: [],
      rateOnlyPairs: [], // レート取得可能だが実行不可
      routeDetails: {},
      pairAnalysis: {}
    };

    for (let i = 0; i < tokenSymbols.length; i++) {
      for (let j = i + 1; j < tokenSymbols.length; j++) {
        const symbolA = tokenSymbols[i];
        const symbolB = tokenSymbols[j];
        const tokenA = testnetTokens[symbolA];
        const tokenB = testnetTokens[symbolB];
        const pairKey = `${symbolA}-${symbolB}`;

        console.log(`🔄 ${pairKey} ペア分析:`);

        let analysis = {
          symbols: [symbolA, symbolB],
          addresses: [tokenA.address, tokenB.address],
          rateAvailable: false,
          executableByEstimate: false,
          executableByStatic: false,
          rate: null,
          errors: {}
        };

        // Step 1: レート取得テスト
        try {
          const path = [tokenA.address, tokenB.address];
          const amounts = await router.getAmountsOut(testAmount, path);
          
          if (amounts[1] > 0) {
            analysis.rateAvailable = true;
            analysis.rate = {
              input: ethers.formatEther(amounts[0]),
              output: ethers.formatEther(amounts[1]),
              ratio: parseFloat(ethers.formatEther(amounts[1])) / parseFloat(ethers.formatEther(amounts[0]))
            };
            
            console.log(`   ✅ レート取得成功: 1 ${symbolA} = ${analysis.rate.ratio.toFixed(6)} ${symbolB}`);

            // Step 2: ガス見積もりテスト
            try {
              const deadline = Math.floor(Date.now() / 1000) + 300;
              const minOut = amounts[1] * BigInt(95) / BigInt(100); // 5% slippage
              
              const gasEstimate = await router.swapExactTokensForTokens.estimateGas(
                testAmount, minOut, path, wallet.address, deadline
              );
              
              analysis.executableByEstimate = true;
              analysis.gasEstimate = gasEstimate.toString();
              console.log(`   ✅ ガス見積もり成功: ${gasEstimate.toString()} gas`);

              // Step 3: callStatic テスト
              try {
                await router.swapExactTokensForTokens.staticCall(
                  testAmount, minOut, path, wallet.address, deadline
                );
                
                analysis.executableByStatic = true;
                console.log(`   ✅ callStatic成功: 実行可能`);
                
                v2Results.availablePairs.push(pairKey);
                
              } catch (staticError) {
                analysis.errors.staticCall = staticError.message.substring(0, 100);
                console.log(`   ❌ callStatic失敗: ${analysis.errors.staticCall}`);
                v2Results.rateOnlyPairs.push(pairKey);
              }
              
            } catch (gasError) {
              analysis.errors.gasEstimate = gasError.message.substring(0, 100);
              console.log(`   ❌ ガス見積もり失敗: ${analysis.errors.gasEstimate}`);
              v2Results.rateOnlyPairs.push(pairKey);
            }
            
          } else {
            console.log(`   ❌ レート取得: 出力0`);
            v2Results.unavailablePairs.push(pairKey);
          }
          
        } catch (rateError) {
          analysis.errors.rateQuery = rateError.message.substring(0, 100);
          console.log(`   ❌ レート取得失敗: ${analysis.errors.rateQuery}`);
          v2Results.unavailablePairs.push(pairKey);
        }

        v2Results.pairAnalysis[pairKey] = analysis;
        console.log('');
      }
    }

    // 4. 結果を token-config.json 形式で構築
    console.log('📊 3. V2ルート分析結果:');
    console.log('========================');

    const v2RouteConfig = {
      network: 'hyperevm-testnet',
      router: {
        v2: {
          address: V2_ROUTER,
          type: 'UniswapV2-compatible',
          status: 'limited' // テストネット制約
        }
      },
      analysisResults: {
        totalPairs: Object.keys(v2Results.pairAnalysis).length,
        fullyAvailable: v2Results.availablePairs.length,
        rateOnly: v2Results.rateOnlyPairs.length,
        unavailable: v2Results.unavailablePairs.length
      },
      availablePairs: v2Results.availablePairs.map(pairKey => {
        const analysis = v2Results.pairAnalysis[pairKey];
        return {
          pair: pairKey,
          symbols: analysis.symbols,
          addresses: analysis.addresses,
          rate: analysis.rate,
          gasEstimate: analysis.gasEstimate,
          status: 'fully-available'
        };
      }),
      limitedPairs: v2Results.rateOnlyPairs.map(pairKey => {
        const analysis = v2Results.pairAnalysis[pairKey];
        return {
          pair: pairKey,
          symbols: analysis.symbols,
          addresses: analysis.addresses,
          rate: analysis.rate,
          limitation: 'execution-blocked',
          errors: analysis.errors,
          status: 'rate-only'
        };
      }),
      unavailablePairs: v2Results.unavailablePairs.map(pairKey => {
        const analysis = v2Results.pairAnalysis[pairKey];
        return {
          pair: pairKey,
          symbols: analysis.symbols,
          addresses: analysis.addresses,
          errors: analysis.errors,
          status: 'unavailable'
        };
      }),
      metadata: {
        analyzedAt: new Date().toISOString(),
        chainId: 998,
        blockNumber: await provider.getBlockNumber(),
        testAmount: ethers.formatEther(testAmount),
        slippageTolerance: '5%'
      }
    };

    // 5. 結果サマリー表示
    console.log(`✅ 完全利用可能: ${v2Results.availablePairs.length}ペア`);
    v2Results.availablePairs.forEach(pair => console.log(`   ${pair}`));
    console.log('');

    console.log(`⚠️  レート取得のみ可能: ${v2Results.rateOnlyPairs.length}ペア`);
    v2Results.rateOnlyPairs.forEach(pair => console.log(`   ${pair}`));
    console.log('');

    console.log(`❌ 利用不可: ${v2Results.unavailablePairs.length}ペア`);
    v2Results.unavailablePairs.forEach(pair => console.log(`   ${pair}`));
    console.log('');

    // 6. JSON出力
    const outputPath = path.join(__dirname, 'v2-route-analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(v2RouteConfig, null, 2));
    
    console.log(`💾 分析結果をJSONで保存: ${outputPath}`);
    
    console.log('\n🎯 結論:');
    console.log('   V2ルーターは大部分のペアで実行制約あり');
    console.log('   レート計算は可能だが、実際のスワップは制限される');
    console.log('   MultiSwap等ではV3使用が必須');

  } catch (error) {
    console.error('❌ V2ルート分析中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  analyzeV2Routes()
    .then(() => {
      console.log('\n🔍 V2ルート分析完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { analyzeV2Routes };