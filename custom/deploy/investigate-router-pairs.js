const { ethers } = require('ethers');
require('dotenv').config({ path: '../../.env' });

/**
 * V2 vs V3 ルーター ペア調査
 * どのペアがV2/V3で利用可能かを体系的に調査
 */

async function investigateRouterPairs() {
  console.log('🔍 V2 vs V3 ルーターペア包括調査');
  console.log('=====================================\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const privateKey = process.env.PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('📋 設定:');
    console.log(`   ウォレット: ${wallet.address}`);
    console.log('');

    // Token addresses (testnet) - proper checksum
    const TOKENS = {
      WETH: '0xADcb2f358Eae6492F61A5F87eb8893d09391d160',
      PURR: '0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82',
      HFUN: '0x37adB2550b965851593832a6444763eeB3e1d1Ec'
    };

    // Router addresses
    const V2_ROUTER = '0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853';
    const V3_ROUTER = '0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990';

    // Router ABIs
    const v2Abi = [
      "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
      "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
    ];

    const v3Abi = [
      "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)"
    ];

    const v2Router = new ethers.Contract(V2_ROUTER, v2Abi, wallet);
    const v3Router = new ethers.Contract(V3_ROUTER, v3Abi, wallet);

    // テスト用の金額
    const testAmount = ethers.parseEther('0.01');

    console.log('🔍 1. 全ペア組み合わせ調査:');
    console.log('=====================================\n');

    const tokenNames = Object.keys(TOKENS);
    const results = {
      v2Available: [],
      v3Available: [],
      bothAvailable: [],
      neitherAvailable: [],
      v2OnlyErrors: [],
      v3OnlyErrors: []
    };

    // 全ペア組み合わせをテスト
    for (let i = 0; i < tokenNames.length; i++) {
      for (let j = i + 1; j < tokenNames.length; j++) {
        const tokenA = tokenNames[i];
        const tokenB = tokenNames[j];
        const addressA = TOKENS[tokenA];
        const addressB = TOKENS[tokenB];

        console.log(`🔄 ${tokenA} ↔ ${tokenB} ペア調査:`);

        // V2テスト
        let v2Works = false;
        let v2Error = '';
        try {
          const v2Path = [addressA, addressB];
          const v2Amounts = await v2Router.getAmountsOut(testAmount, v2Path);
          
          if (v2Amounts[1] > 0) {
            // さらにestimateGasで実行可能性確認
            try {
              const deadline = Math.floor(Date.now() / 1000) + 300;
              const minOut = v2Amounts[1] * BigInt(95) / BigInt(100);
              
              await v2Router.swapExactTokensForTokens.estimateGas(
                testAmount, minOut, v2Path, wallet.address, deadline
              );
              v2Works = true;
              console.log(`   V2: ✅ 利用可能 (Rate: 1 ${tokenA} = ${ethers.formatEther(v2Amounts[1]) / ethers.formatEther(testAmount)} ${tokenB})`);
            } catch (gasError) {
              v2Error = `Gas estimate failed: ${gasError.message.substring(0, 50)}...`;
              console.log(`   V2: ⚠️  レート取得OK、実行NG (${v2Error})`);
            }
          }
        } catch (error) {
          v2Error = error.message.substring(0, 50) + '...';
          console.log(`   V2: ❌ 利用不可 (${v2Error})`);
        }

        // V3テスト (複数fee tierを試行)
        let v3Works = false;
        let v3Error = '';
        const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

        for (const fee of feeTiers) {
          try {
            const params = {
              tokenIn: addressA,
              tokenOut: addressB,
              fee: fee,
              recipient: wallet.address,
              deadline: Math.floor(Date.now() / 1000) + 300,
              amountIn: testAmount,
              amountOutMinimum: 1, // 最小限
              sqrtPriceLimitX96: 0
            };

            await v3Router.exactInputSingle.estimateGas(params);
            v3Works = true;
            console.log(`   V3: ✅ 利用可能 (Fee: ${fee}bps)`);
            break;
          } catch (error) {
            v3Error = error.message.substring(0, 50) + '...';
            // 次のfee tierを試行
          }
        }

        if (!v3Works) {
          console.log(`   V3: ❌ 利用不可 (${v3Error})`);
        }

        // 結果分類
        const pairKey = `${tokenA}-${tokenB}`;
        if (v2Works && v3Works) {
          results.bothAvailable.push(pairKey);
        } else if (v2Works && !v3Works) {
          results.v2Available.push(pairKey);
          results.v3OnlyErrors.push(`${pairKey}: ${v3Error}`);
        } else if (!v2Works && v3Works) {
          results.v3Available.push(pairKey);
          results.v2OnlyErrors.push(`${pairKey}: ${v2Error}`);
        } else {
          results.neitherAvailable.push(pairKey);
        }

        console.log('');
      }
    }

    // 2. 結果サマリー
    console.log('📊 2. 調査結果サマリー:');
    console.log('=====================================\n');

    console.log('✅ 両方利用可能 (V2 + V3):');
    results.bothAvailable.forEach(pair => console.log(`   ${pair}`));
    console.log('');

    console.log('🔵 V3のみ利用可能:');
    results.v3Available.forEach(pair => console.log(`   ${pair}`));
    console.log('');

    console.log('🟡 V2のみ利用可能:');
    results.v2Available.forEach(pair => console.log(`   ${pair}`));
    console.log('');

    console.log('❌ どちらも利用不可:');
    results.neitherAvailable.forEach(pair => console.log(`   ${pair}`));
    console.log('');

    // 3. 詳細エラー分析
    console.log('🔍 3. V2制約詳細:');
    console.log('=====================================');
    results.v2OnlyErrors.forEach(error => console.log(`   ${error}`));
    console.log('');

    console.log('🔍 4. V3制約詳細:');
    console.log('=====================================');
    results.v3OnlyErrors.forEach(error => console.log(`   ${error}`));
    console.log('');

    // 4. MultiSwap関連の推奨事項
    console.log('💡 5. MultiSwap推奨事項:');
    console.log('=====================================');
    
    if (results.v3Available.includes('WETH-PURR') || results.bothAvailable.includes('WETH-PURR')) {
      console.log('   ✅ WETH→PURR: V3推奨');
    }
    
    if (results.v3Available.includes('PURR-HFUN') || results.bothAvailable.includes('PURR-HFUN')) {
      console.log('   ✅ PURR→HFUN: V3推奨');
    } else if (results.v2Available.includes('PURR-HFUN')) {
      console.log('   ⚠️  PURR→HFUN: V2のみ利用可能');
    } else {
      console.log('   ❌ PURR→HFUN: 制約あり（これが元のMultiSwap失敗原因）');
    }

    console.log('\n📋 統計:');
    console.log(`   両方利用可能: ${results.bothAvailable.length}ペア`);
    console.log(`   V3のみ: ${results.v3Available.length}ペア`);
    console.log(`   V2のみ: ${results.v2Available.length}ペア`);
    console.log(`   どちらも不可: ${results.neitherAvailable.length}ペア`);

  } catch (error) {
    console.error('❌ 調査中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  investigateRouterPairs()
    .then(() => {
      console.log('\n🔍 ルーターペア調査完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { investigateRouterPairs };