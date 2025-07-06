const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// テストネット設定
const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

/**
 * テストネット版: V2プールの存在確認とルート発見
 * 実際に動作するペアを特定
 */

async function testV2PoolsTestnet() {
    console.log("🔍 V2プール存在確認テスト (テストネット)\n");

    const contracts = {
        router: "0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853", // V2 Router
        factory: "0xA028411927E2015A363014881a4404C636218fb1"  // V2 Factory
    };

    // テストネット対応トークンリスト（config/token-config.jsonから取得）
    let tokens = {};
    let tokenInfo = {};
    
    try {
        const configPath = path.join(__dirname, '../../config/token-config.json');
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const testnetTokens = configData.networks['hyperevm-testnet'].tokens;
        
        // ネイティブトークンを除外して、ERC20トークンのみを対象とする
        for (const [symbol, tokenData] of Object.entries(testnetTokens)) {
            if (tokenData.type !== 'native') {
                tokens[symbol] = tokenData.address;
                tokenInfo[symbol] = { decimals: tokenData.decimals };
            }
        }
        
        console.log(`📋 対象トークン: ${Object.keys(tokens).join(', ')}`);
        console.log(`💰 トークン数: ${Object.keys(tokens).length}\n`);
        
    } catch (error) {
        console.error("❌ トークン設定読み込み失敗:", error.message);
        return;
    }

    // V2 Router ABI（レート取得用）
    const routerABI = [
        {
            name: "getAmountsOut",
            type: "function",
            stateMutability: "view",
            inputs: [
                { name: "amountIn", type: "uint256" },
                { name: "path", type: "address[]" }
            ],
            outputs: [{ name: "amounts", type: "uint256[]" }]
        }
    ];

    const router = new ethers.Contract(contracts.router, routerABI, provider);

    // 各トークンのdecimalsに応じた投入量を動的に計算
    function getAmountForToken(tokenSymbol) {
        return ethers.utils.parseUnits("1", tokenInfo[tokenSymbol].decimals);
    }

    console.log("🎯 V2ペア存在確認テスト\n");

    let workingPairs = [];
    let totalTests = 0;
    let successfulTests = 0;

    const tokenSymbols = Object.keys(tokens);
    
    for (let i = 0; i < tokenSymbols.length; i++) {
        for (let j = 0; j < tokenSymbols.length; j++) {
            if (i === j) continue;

            const tokenInSymbol = tokenSymbols[i];
            const tokenOutSymbol = tokenSymbols[j];
            const tokenIn = tokens[tokenInSymbol];
            const tokenOut = tokens[tokenOutSymbol];
            const amountIn = getAmountForToken(tokenInSymbol);

            console.log(`🔍 ${tokenInSymbol} → ${tokenOutSymbol}:`);
            totalTests++;

            try {
                const path = [tokenIn, tokenOut];
                const amounts = await router.getAmountsOut(amountIn, path);
                const amountOut = amounts[1];
                
                const rate = parseFloat(ethers.utils.formatUnits(amountOut, tokenInfo[tokenOutSymbol].decimals)) /
                           parseFloat(ethers.utils.formatUnits(amountIn, tokenInfo[tokenInSymbol].decimals));
                
                const formatted = ethers.utils.formatUnits(amountOut, tokenInfo[tokenOutSymbol].decimals);
                
                console.log(`   ✅ Rate: 1 ${tokenInSymbol} = ${rate.toFixed(6)} ${tokenOutSymbol} (${formatted})`);
                
                workingPairs.push({
                    pair: `${tokenInSymbol}/${tokenOutSymbol}`,
                    tokenIn: tokenInSymbol,
                    tokenOut: tokenOutSymbol,
                    rate: rate,
                    amountOut: amountOut.toString(),
                    formatted: formatted
                });
                
                successfulTests++;
                
            } catch (error) {
                console.log(`   ❌ Pool not found or error: ${error.message.substring(0, 80)}...`);
            }
        }
    }

    // 統計とサマリー
    console.log(`\n\n📊 V2テスト結果サマリー:`);
    console.log(`   総テスト数: ${totalTests}`);
    console.log(`   成功: ${successfulTests} (${((successfulTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`   動作ペア数: ${workingPairs.length}`);

    if (workingPairs.length > 0) {
        console.log(`\n✅ V2動作確認済みペア一覧:`);
        
        workingPairs.forEach((p, index) => {
            console.log(`   ${index + 1}. ${p.pair}: 1 ${p.tokenIn} = ${p.rate.toFixed(6)} ${p.tokenOut}`);
        });

        // 最も活発なトークンを特定
        console.log(`\n🏆 流動性分析:`);
        const tokenActivity = {};
        workingPairs.forEach(p => {
            tokenActivity[p.tokenIn] = (tokenActivity[p.tokenIn] || 0) + 1;
            tokenActivity[p.tokenOut] = (tokenActivity[p.tokenOut] || 0) + 1;
        });

        const sortedTokens = Object.entries(tokenActivity)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        console.log(`   トップ流動性トークン:`);
        sortedTokens.forEach(([token, count], index) => {
            console.log(`   ${index + 1}. ${token}: ${count}ペア`);
        });

        // 推奨スワップルート
        console.log(`\n🚀 推奨実際スワップテスト:`);
        const topPairs = workingPairs.slice(0, 5);
        topPairs.forEach((p, index) => {
            console.log(`   ${index + 1}. ${p.pair}`);
            console.log(`      Quote: node custom/hyperevm-swap/v2-swap-testnet.js --tokenIn ${p.tokenIn} --tokenOut ${p.tokenOut} --amount 1 --quote-only`);
        });

        // 双方向ペアの特定
        console.log(`\n🔄 双方向取引可能ペア:`);
        const bidirectionalPairs = [];
        
        for (const pair1 of workingPairs) {
            const reversePair = workingPairs.find(pair2 => 
                pair1.tokenIn === pair2.tokenOut && pair1.tokenOut === pair2.tokenIn
            );
            
            if (reversePair && !bidirectionalPairs.some(bp => 
                (bp.token1 === pair1.tokenIn && bp.token2 === pair1.tokenOut) ||
                (bp.token1 === pair1.tokenOut && bp.token2 === pair1.tokenIn)
            )) {
                bidirectionalPairs.push({
                    token1: pair1.tokenIn,
                    token2: pair1.tokenOut,
                    rate1to2: pair1.rate,
                    rate2to1: reversePair.rate
                });
            }
        }

        bidirectionalPairs.forEach((bp, index) => {
            console.log(`   ${index + 1}. ${bp.token1} ↔ ${bp.token2}`);
            console.log(`      ${bp.token1}→${bp.token2}: ${bp.rate1to2.toFixed(6)}`);
            console.log(`      ${bp.token2}→${bp.token1}: ${bp.rate2to1.toFixed(6)}`);
        });
    }

    return {
        workingPairs,
        totalTests,
        successfulTests,
        successRate: (successfulTests/totalTests)*100
    };
}

// CLI実行
if (require.main === module) {
    testV2PoolsTestnet()
        .then((result) => {
            console.log(`\n🎉 V2プール調査完了！`);
            console.log(`   成功率: ${result.successRate.toFixed(1)}%`);
            console.log(`   動作ペア: ${result.workingPairs.length}個`);
        })
        .catch((error) => {
            console.error("❌ エラー:", error);
        });
}

module.exports = { testV2PoolsTestnet };