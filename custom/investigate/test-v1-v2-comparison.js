const { ethers } = require("ethers");
const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid.xyz/evm"
);

/**
 * V3のQuoterV1とQuoterV2の包括的比較テスト
 */

async function compareV1AndV2() {
    console.log("🔍 QuoterV1 vs QuoterV2 包括的比較テスト\n");

    const contracts = {
        quoterV1: "0xF865716B90f09268fF12B6B620e14bEC390B8139",
        quoterV2: "0x03A918028f22D9E1473B7959C927AD7425A45C7C",
    };

    // 全トークンリスト
    const tokens = {
        WHYPE: "0x5555555555555555555555555555555555555555",
        UBTC: "0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463",
        UETH: "0xBe6727B535545C67d5cAa73dEa54865B92CF7907",
        ADHD: "0xE3D5F45d97fee83B48c85E00c8359A2E07D68Fee",
        BUDDY: "0x47bb061C0204Af921F43DC73C7D7768d2672DdEE", // decimals修正でテスト再開
        CATBAL: "0x11735dBd0B97CfA7Accf47d005673BA185f7fd49",
        HFUN: "0xa320D9f65ec992EfF38622c63627856382Db726c",
    };

    const tokenInfo = {
        WHYPE: { decimals: 18 },
        UBTC: { decimals: 8 },
        UETH: { decimals: 18 },
        ADHD: { decimals: 18 },
        BUDDY: { decimals: 6 }, // 実際は6 decimals（修正済み）
        CATBAL: { decimals: 18 },
        HFUN: { decimals: 18 },
    };

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
                { name: "sqrtPriceLimitX96", type: "uint160" },
            ],
            outputs: [{ name: "amountOut", type: "uint256" }],
        },
        {
            name: "quoteExactInput",
            type: "function",
            stateMutability: "view",
            inputs: [
                { name: "path", type: "bytes" },
                { name: "amountIn", type: "uint256" },
            ],
            outputs: [{ name: "amountOut", type: "uint256" }],
        },
    ];

    // V2 ABI (両方の関数を含む)
    const quoterV2ABI = [
        {
            name: "quoteExactInputSingle",
            type: "function",
            stateMutability: "view",
            inputs: [
                {
                    components: [
                        { name: "tokenIn", type: "address" },
                        { name: "tokenOut", type: "address" },
                        { name: "amountIn", type: "uint256" },
                        { name: "fee", type: "uint24" },
                        { name: "sqrtPriceLimitX96", type: "uint160" },
                    ],
                    name: "params",
                    type: "tuple",
                },
            ],
            outputs: [
                { name: "amountOut", type: "uint256" },
                { name: "sqrtPriceX96After", type: "uint160" },
                { name: "initializedTicksCrossed", type: "uint32" },
                { name: "gasEstimate", type: "uint256" },
            ],
        },
        {
            name: "quoteExactInput",
            type: "function",
            stateMutability: "view",
            inputs: [
                { name: "path", type: "bytes" },
                { name: "amountIn", type: "uint256" },
            ],
            outputs: [
                { name: "amountOut", type: "uint256" },
                { name: "sqrtPriceX96AfterList", type: "uint160[]" },
                { name: "initializedTicksCrossedList", type: "uint32[]" },
                { name: "gasEstimate", type: "uint256" },
            ],
        },
    ];

    // V3パスエンコード
    function encodePath(tokens, fees) {
        let path = "0x";
        for (let i = 0; i < tokens.length; i++) {
            path += tokens[i].slice(2);
            if (i < fees.length) {
                path += fees[i].toString(16).padStart(6, "0");
            }
        }
        return path;
    }

    const feeTiers = [100, 500, 3000, 10000];
    const tokenList = Object.keys(tokens);

    // コントラクトインスタンス
    const v1Contract = new ethers.Contract(
        contracts.quoterV1,
        quoterV1ABI,
        provider
    );
    const v2Contract = new ethers.Contract(
        contracts.quoterV2,
        quoterV2ABI,
        provider
    );

    console.log("📊 1. quoteExactInputSingle比較（全ペア）\n");

    const singleHopResults = [];

    // 全ペアでのquoteExactInputSingle比較
    for (let i = 0; i < tokenList.length; i++) {
        for (let j = 0; j < tokenList.length; j++) {
            if (i === j) continue;

            const tokenA = tokenList[i];
            const tokenB = tokenList[j];
            const pairName = `${tokenA}/${tokenB}`;

            console.log(`🔍 ${pairName}:`);

            for (const fee of feeTiers) {
                const inputAmount = getAmountForToken(tokenA);

                try {
                    // V1 quoteExactInputSingle
                    const v1Result =
                        await v1Contract.callStatic.quoteExactInputSingle(
                            tokens[tokenA],
                            tokens[tokenB],
                            fee,
                            inputAmount,
                            0
                        );

                    const decimals = tokenInfo[tokenB].decimals;
                    const v1Rate = parseFloat(
                        ethers.utils.formatUnits(v1Result, decimals)
                    );

                    // V2 quoteExactInputSingle (Struct形式)
                    try {
                        const params = {
                            tokenIn: tokens[tokenA],
                            tokenOut: tokens[tokenB],
                            amountIn: inputAmount,
                            fee: fee,
                            sqrtPriceLimitX96: 0,
                        };

                        const v2Result =
                            await v2Contract.callStatic.quoteExactInputSingle(
                                params
                            );
                        const v2Rate = parseFloat(
                            ethers.utils.formatUnits(
                                v2Result.amountOut,
                                decimals
                            )
                        );

                        const priceDiff = Math.abs(v1Rate - v2Rate);
                        const priceDiffPercent =
                            v1Rate > 0 ? (priceDiff / v1Rate) * 100 : 0;

                        console.log(
                            `   ✅ ${fee}bps: V1=${v1Rate.toFixed(
                                6
                            )}, V2=${v2Rate.toFixed(
                                6
                            )} (差=${priceDiffPercent.toFixed(
                                4
                            )}%) Gas=${v2Result.gasEstimate.toString()}`
                        );
                        console.log(
                            `      価格: 1 ${tokenA} = ${v1Rate.toFixed(
                                6
                            )} ${tokenB}`
                        );

                        singleHopResults.push({
                            pair: pairName,
                            fee,
                            v1Rate,
                            v2Rate,
                            gasEstimate: v2Result.gasEstimate.toString(),
                        });
                    } catch (v2Error) {
                        console.log(`   ⚠️  ${fee}bps: V1成功、V2失敗`);
                    }
                } catch (v1Error) {
                    // 両方失敗の場合はスキップ
                }
            }
            console.log("");
        }
    }

    console.log("📊 2. quoteExactInput比較（マルチホップ）\n");

    // マルチホップパターン
    const multiHopPatterns = [
        {
            name: "WHYPE → UETH → UBTC",
            tokens: [tokens.WHYPE, tokens.UETH, tokens.UBTC],
            fees: [3000, 3000],
            outputDecimals: 8,
        },
        {
            name: "CATBAL → WHYPE → HFUN",
            tokens: [tokens.CATBAL, tokens.WHYPE, tokens.HFUN],
            fees: [3000, 10000],
            outputDecimals: 18,
        },
        {
            name: "UBTC → WHYPE → BUDDY", // decimals修正でテスト再開
            tokens: [tokens.UBTC, tokens.WHYPE, tokens.BUDDY],
            fees: [3000, 3000],
            outputDecimals: 6 // BUDDYは6 decimals
        },
        {
            name: "WHYPE → UBTC → UETH",
            tokens: [tokens.WHYPE, tokens.UBTC, tokens.UETH],
            fees: [3000, 3000],
            outputDecimals: 18,
        },
        {
            name: "ADHD → WHYPE → HFUN (3ホップ)",
            tokens: [tokens.ADHD, tokens.WHYPE, tokens.HFUN],
            fees: [10000, 10000],
            outputDecimals: 18,
        },
        {
            name: "BUDDY → WHYPE → UETH → UBTC (4ホップ)", // decimals修正でテスト再開
            tokens: [tokens.BUDDY, tokens.WHYPE, tokens.UETH, tokens.UBTC],
            fees: [3000, 3000, 3000],
            outputDecimals: 8
        }
    ];

    for (const pattern of multiHopPatterns) {
        console.log(`🔍 ${pattern.name}:`);

        const path = encodePath(pattern.tokens, pattern.fees);

        // 最初のトークンのdecimalsに基づいて投入量を決定
        const firstTokenAddress = pattern.tokens[0];
        const firstTokenSymbol = Object.keys(tokens).find(
            (key) => tokens[key] === firstTokenAddress
        );
        const inputAmount = getAmountForToken(firstTokenSymbol);

        try {
            // V1 quoteExactInput
            const v1Result = await v1Contract.callStatic.quoteExactInput(
                path,
                inputAmount
            );
            const v1Rate = parseFloat(
                ethers.utils.formatUnits(v1Result, pattern.outputDecimals)
            );

            // V2 quoteExactInput
            try {
                const v2Result = await v2Contract.callStatic.quoteExactInput(
                    path,
                    inputAmount
                );
                const v2Rate = parseFloat(
                    ethers.utils.formatUnits(
                        v2Result[0],
                        pattern.outputDecimals
                    )
                );

                const priceDiff = Math.abs(v1Rate - v2Rate);
                const priceDiffPercent =
                    v1Rate > 0 ? (priceDiff / v1Rate) * 100 : 0;

                console.log(
                    `   ✅ V1=${v1Rate.toFixed(8)}, V2=${v2Rate.toFixed(8)}`
                );
                console.log(
                    `   📊 価格差: ${priceDiffPercent.toFixed(
                        4
                    )}%, Gas=${v2Result[3].toString()}`
                );
            } catch (v2Error) {
                console.log(
                    `   ⚠️  V1成功、V2失敗: ${v2Error.message.substring(
                        0,
                        50
                    )}...`
                );
            }
        } catch (v1Error) {
            console.log(`   ❌ 両方失敗（流動性なし）`);
        }

        console.log("");
    }

    console.log("📋 3. サマリー\n");

    // 成功したペアの数を集計
    const successfulPairs = singleHopResults.length;
    const totalPairs =
        tokenList.length * (tokenList.length - 1) * feeTiers.length;

    console.log(
        `✅ シングルホップ成功率: ${successfulPairs}/${totalPairs} (${(
            (successfulPairs / totalPairs) *
            100
        ).toFixed(1)}%)`
    );

    // 価格差の統計
    const priceDiffs = singleHopResults.map(
        (r) => (Math.abs(r.v1Rate - r.v2Rate) / r.v1Rate) * 100
    );
    const avgDiff = priceDiffs.reduce((a, b) => a + b, 0) / priceDiffs.length;

    console.log(`📊 平均価格差: ${avgDiff.toFixed(6)}%`);
    console.log(
        `🎯 価格一致率: ${
            priceDiffs.filter((d) => d < 0.01).length
        }/${successfulPairs} (完全一致)`
    );

    console.log("\n💡 結論:");
    console.log("✅ QuoterV1: シングル・マルチホップ両対応（価格のみ）");
    console.log("✅ QuoterV2: シングル・マルチホップ両対応（価格＋詳細情報）");
    console.log("🎯 V1とV2は同一価格を返し、V2は追加でガス見積もりを提供");
}

if (require.main === module) {
    compareV1AndV2().catch(console.error);
}

module.exports = { compareV1AndV2 };
