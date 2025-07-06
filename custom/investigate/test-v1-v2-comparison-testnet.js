const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// テストネット設定
const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

/**
 * テストネット版: V3のQuoterV1とQuoterV2の包括的比較テスト
 * 有効なプールとスワップルートを発見
 */

async function compareV1AndV2Testnet() {
    console.log("🔍 QuoterV1 vs QuoterV2 包括的比較テスト (テストネット)\n");

    const contracts = {
        quoterV1: "0xF865716B90f09268fF12B6B620e14bEC390B8139", // テストネット用に要確認
        quoterV2: "0x7FEd8993828A61A5985F384Cee8bDD42177Aa263", // テストネット QuoterV2
        factory: "0x22B0768972bB7f1F5ea7a8740BB8f94b32483826"   // テストネット Factory
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

    // 各トークンのdecimalsに応じた投入量を動的に計算
    function getAmountForToken(tokenSymbol) {
        return ethers.utils.parseUnits("1", tokenInfo[tokenSymbol].decimals);
    }

    // V1 ABI (両方の関数を含む)
    const quoterV1ABI = [
        {
            name: "quoteExactInputSingle",
            type: "function",
            stateMutability: "view",
            inputs: [
                { name: "tokenIn", type: "address" },
                { name: "tokenOut", type: "address" },
                { name: "fee", type: "uint24" },
                { name: "amountIn", type: "uint256" },
                { name: "sqrtPriceLimitX96", type: "uint160" }
            ],
            outputs: [{ name: "amountOut", type: "uint256" }]
        },
        {
            name: "quoteExactInput",
            type: "function",
            stateMutability: "view",
            inputs: [
                { name: "path", type: "bytes" },
                { name: "amountIn", type: "uint256" }
            ],
            outputs: [{ name: "amountOut", type: "uint256" }]
        }
    ];

    // V2 ABI (両方の関数を含む)
    const quoterV2ABI = [
        {
            name: "quoteExactInputSingle",
            type: "function",
            stateMutability: "view",
            inputs: [
                { name: "tokenIn", type: "address" },
                { name: "tokenOut", type: "address" },
                { name: "fee", type: "uint24" },
                { name: "amountIn", type: "uint256" },
                { name: "sqrtPriceLimitX96", type: "uint160" }
            ],
            outputs: [
                { name: "amountOut", type: "uint256" },
                { name: "sqrtPriceX96After", type: "uint160" },
                { name: "initializedTicksCrossed", type: "uint32" },
                { name: "gasEstimate", type: "uint256" }
            ]
        },
        {
            name: "quoteExactInput",
            type: "function",
            stateMutability: "view",
            inputs: [
                { name: "path", type: "bytes" },
                { name: "amountIn", type: "uint256" }
            ],
            outputs: [
                { name: "amountOut", type: "uint256" },
                { name: "sqrtPriceX96AfterList", type: "uint160[]" },
                { name: "initializedTicksCrossedList", type: "uint32[]" },
                { name: "gasEstimate", type: "uint256" }
            ]
        }
    ];

    const quoterV1 = new ethers.Contract(contracts.quoterV1, quoterV1ABI, provider);
    const quoterV2 = new ethers.Contract(contracts.quoterV2, quoterV2ABI, provider);

    // 手数料ティア
    const feeTiers = [100, 500, 3000, 10000]; // 1bps, 5bps, 30bps, 100bps

    console.log("🎯 テスト1: 全ペアでのExactInputSingle比較\n");

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

            console.log(`\n🔍 ${tokenInSymbol} → ${tokenOutSymbol}:`);

            for (const fee of feeTiers) {
                totalTests += 2; // V1とV2で2回
                
                try {
                    // V1テスト
                    let v1Result = null;
                    try {
                        const v1Quote = await quoterV1.quoteExactInputSingle(
                            tokenIn, tokenOut, fee, amountIn, 0
                        );
                        v1Result = {
                            success: true,
                            amountOut: v1Quote.toString(),
                            formatted: ethers.utils.formatUnits(v1Quote, tokenInfo[tokenOutSymbol].decimals)
                        };
                        successfulTests++;
                    } catch (error) {
                        v1Result = { success: false, error: error.message.substring(0, 50) + "..." };
                    }

                    // V2テスト
                    let v2Result = null;
                    try {
                        const v2Quote = await quoterV2.quoteExactInputSingle(
                            tokenIn, tokenOut, fee, amountIn, 0
                        );
                        v2Result = {
                            success: true,
                            amountOut: v2Quote.amountOut.toString(),
                            formatted: ethers.utils.formatUnits(v2Quote.amountOut, tokenInfo[tokenOutSymbol].decimals),
                            gasEstimate: v2Quote.gasEstimate.toString()
                        };
                        successfulTests++;
                    } catch (error) {
                        v2Result = { success: false, error: error.message.substring(0, 50) + "..." };
                    }

                    // 結果表示
                    const feeDisplay = `${fee/100}bps`;
                    const v1Status = v1Result.success ? `✅ ${v1Result.formatted}` : `❌ ${v1Result.error}`;
                    const v2Status = v2Result.success ? `✅ ${v2Result.formatted} (gas: ${v2Result.gasEstimate})` : `❌ ${v2Result.error}`;
                    
                    console.log(`   ${feeDisplay.padEnd(6)}: V1=${v1Status} | V2=${v2Status}`);

                    // 成功したペアを記録
                    if (v1Result.success || v2Result.success) {
                        workingPairs.push({
                            pair: `${tokenInSymbol}/${tokenOutSymbol}`,
                            fee: fee,
                            feeDisplay: feeDisplay,
                            v1Working: v1Result.success,
                            v2Working: v2Result.success,
                            v1Rate: v1Result.success ? parseFloat(v1Result.formatted) : null,
                            v2Rate: v2Result.success ? parseFloat(v2Result.formatted) : null,
                            v2Gas: v2Result.success ? v2Result.gasEstimate : null
                        });
                    }

                } catch (error) {
                    console.log(`   ${fee/100}bps: ❌ システムエラー: ${error.message}`);
                }
            }
        }
    }

    // 統計とサマリー
    console.log(`\n\n📊 テスト結果サマリー:`);
    console.log(`   総テスト数: ${totalTests}`);
    console.log(`   成功: ${successfulTests} (${((successfulTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`   動作ペア数: ${workingPairs.length}`);

    if (workingPairs.length > 0) {
        console.log(`\n✅ 動作確認済みペア一覧:`);
        
        // V1とV2の動作状況で分類
        const bothWorking = workingPairs.filter(p => p.v1Working && p.v2Working);
        const v1Only = workingPairs.filter(p => p.v1Working && !p.v2Working);
        const v2Only = workingPairs.filter(p => !p.v1Working && p.v2Working);

        if (bothWorking.length > 0) {
            console.log(`\n🎯 V1・V2両方で動作 (${bothWorking.length}ペア):`);
            bothWorking.forEach(p => {
                console.log(`   ${p.pair} @ ${p.feeDisplay}: V1=${p.v1Rate?.toFixed(6)} | V2=${p.v2Rate?.toFixed(6)}`);
            });
        }

        if (v1Only.length > 0) {
            console.log(`\n🔹 V1のみ動作 (${v1Only.length}ペア):`);
            v1Only.forEach(p => {
                console.log(`   ${p.pair} @ ${p.feeDisplay}: V1=${p.v1Rate?.toFixed(6)}`);
            });
        }

        if (v2Only.length > 0) {
            console.log(`\n🔸 V2のみ動作 (${v2Only.length}ペア):`);
            v2Only.forEach(p => {
                console.log(`   ${p.pair} @ ${p.feeDisplay}: V2=${p.v2Rate?.toFixed(6)} (gas: ${p.v2Gas})`);
            });
        }

        // 最も活発なトークンを特定
        console.log(`\n🏆 流動性分析:`);
        const tokenActivity = {};
        workingPairs.forEach(p => {
            const [tokenA, tokenB] = p.pair.split('/');
            tokenActivity[tokenA] = (tokenActivity[tokenA] || 0) + 1;
            tokenActivity[tokenB] = (tokenActivity[tokenB] || 0) + 1;
        });

        const sortedTokens = Object.entries(tokenActivity)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        console.log(`   トップ流動性トークン:`);
        sortedTokens.forEach(([token, count], index) => {
            console.log(`   ${index + 1}. ${token}: ${count}ペア`);
        });

        // 推奨スワップルート
        console.log(`\n🚀 推奨テストスワップ:`);
        const bestPairs = bothWorking.slice(0, 3);
        bestPairs.forEach((p, index) => {
            console.log(`   ${index + 1}. ${p.pair} @ ${p.feeDisplay}`);
            console.log(`      V2コマンド: node custom/hyperevm-swap/v2-swap-testnet.js --tokenIn ${p.pair.split('/')[0]} --tokenOut ${p.pair.split('/')[1]} --amount 1 --quote-only`);
            console.log(`      V3コマンド: node custom/hyperevm-swap/v3-swap-testnet.js --tokenIn ${p.pair.split('/')[0]} --tokenOut ${p.pair.split('/')[1]} --amount 1 --fee ${p.fee} --quote-only`);
        });
    }

    return workingPairs;
}

// CLI実行
if (require.main === module) {
    compareV1AndV2Testnet()
        .then((workingPairs) => {
            console.log(`\n🎉 分析完了！動作ペア: ${workingPairs.length}個`);
        })
        .catch((error) => {
            console.error("❌ エラー:", error);
        });
}

module.exports = { compareV1AndV2Testnet };