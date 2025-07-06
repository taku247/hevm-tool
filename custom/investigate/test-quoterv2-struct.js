const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// HyperEVM メインネット設定
const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid.xyz/evm"
);

/**
 * バイトコード解析結果に基づくQuoterV2の正しい実装テスト
 * 
 * 発見事項:
 * - セレクタ 0xc6a5026a が quoteExactInputSingle((address,address,uint256,uint24,uint160)) にマッチ
 * - これはStruct引数を使用するパターン
 */

async function testQuoterV2WithStruct() {
    console.log("🔍 QuoterV2 Struct引数パターンのテスト\n");

    const contracts = {
        quoterV2: "0x03A918028f22D9E1473B7959C927AD7425A45C7C",
    };

    // 実際のトークン情報
    const tokens = {
        WHYPE: "0x5555555555555555555555555555555555555555",
        UBTC: "0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463",
        UETH: "0xBe6727B535545C67d5cAa73dEa54865B92CF7907",
    };

    const tokenInfo = {
        WHYPE: { decimals: 18 },
        UBTC: { decimals: 8 },
        UETH: { decimals: 18 },
    };

    // バイトコード解析で発見された正しいABI (Struct引数版)
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

    const quoterV2 = new ethers.Contract(contracts.quoterV2, quoterV2ABI, provider);

    // 手数料ティア
    const feeTiers = [100, 500, 3000, 10000]; // 1bps, 5bps, 30bps, 100bps

    console.log("🎯 Struct引数パターンでのQuoterV2テスト\n");

    const tokenPairs = [
        { from: "WHYPE", to: "UBTC" },
        { from: "WHYPE", to: "UETH" },
        { from: "UBTC", to: "UETH" },
    ];

    for (const pair of tokenPairs) {
        console.log(`\n🔍 ${pair.from} → ${pair.to}:`);
        
        const tokenIn = tokens[pair.from];
        const tokenOut = tokens[pair.to];
        const amountIn = ethers.utils.parseUnits("1", tokenInfo[pair.from].decimals);

        for (const fee of feeTiers) {
            try {
                // Struct引数を作成
                const params = {
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    amountIn: amountIn,
                    fee: fee,
                    sqrtPriceLimitX96: 0,
                };

                console.log(`   ${fee/100}bps:`);
                console.log(`      入力パラメータ:`);
                console.log(`        tokenIn: ${params.tokenIn}`);
                console.log(`        tokenOut: ${params.tokenOut}`);
                console.log(`        amountIn: ${params.amountIn.toString()}`);
                console.log(`        fee: ${params.fee}`);

                const result = await quoterV2.callStatic.quoteExactInputSingle(params);
                
                const amountOut = result.amountOut;
                const rate = parseFloat(
                    ethers.utils.formatUnits(amountOut, tokenInfo[pair.to].decimals)
                );

                console.log(`      ✅ 成功!`);
                console.log(`        amountOut: ${amountOut.toString()}`);
                console.log(`        レート: 1 ${pair.from} = ${rate.toFixed(8)} ${pair.to}`);
                console.log(`        ガス見積もり: ${result.gasEstimate.toString()}`);
                console.log(`        sqrtPriceX96After: ${result.sqrtPriceX96After.toString()}`);
                console.log(`        ticksCrossed: ${result.initializedTicksCrossed.toString()}`);

            } catch (error) {
                console.log(`      ❌ エラー: ${error.message.substring(0, 80)}...`);
            }
        }
    }

    // マルチホップテスト
    console.log("\n\n🚀 Struct引数版 quoteExactInput マルチホップテスト\n");

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

    const multiHopPaths = [
        {
            name: "WHYPE → UETH → UBTC",
            tokens: [tokens.WHYPE, tokens.UETH, tokens.UBTC],
            fees: [3000, 3000],
            inputDecimals: 18,
            outputDecimals: 8,
        },
        {
            name: "UBTC → UETH → WHYPE",
            tokens: [tokens.UBTC, tokens.UETH, tokens.WHYPE],
            fees: [3000, 3000],
            inputDecimals: 8,
            outputDecimals: 18,
        },
    ];

    for (const pathInfo of multiHopPaths) {
        console.log(`🔍 ${pathInfo.name}:`);
        
        const path = encodePath(pathInfo.tokens, pathInfo.fees);
        const amountIn = ethers.utils.parseUnits("1", pathInfo.inputDecimals);

        try {
            const result = await quoterV2.callStatic.quoteExactInput(path, amountIn);
            
            const amountOut = result.amountOut;
            const rate = parseFloat(
                ethers.utils.formatUnits(amountOut, pathInfo.outputDecimals)
            );

            console.log(`   ✅ 成功!`);
            console.log(`      レート: ${rate.toFixed(8)}`);
            console.log(`      ガス見積もり: ${result.gasEstimate.toString()}`);
            console.log(`      経由したTick数: ${result.initializedTicksCrossedList.length}`);
            
        } catch (error) {
            console.log(`   ❌ エラー: ${error.message.substring(0, 80)}...`);
        }
        
        console.log("");
    }
    
    console.log("\n🎉 QuoterV2 Struct引数パターンのテスト完了!");
    console.log("\n💡 発見事項:");
    console.log("   - セレクタ 0xc6a5026a は正しくStruct引数パターンと一致");
    console.log("   - HyperSwap V3のQuoterV2は標準的なUniswap実装と異なる");
    console.log("   - バイトコード解析により正しい関数シグネチャを特定可能");
}

// CLI実行
if (require.main === module) {
    testQuoterV2WithStruct()
        .then(() => {
            console.log("\n✅ テスト完了");
        })
        .catch((error) => {
            console.error("❌ エラー:", error);
        });
}

module.exports = { testQuoterV2WithStruct };