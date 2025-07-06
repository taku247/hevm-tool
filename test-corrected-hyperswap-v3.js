const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

// 公式のHyperSwap V3テストネットアドレス
const QUOTER_V3 = "0x7FEd8993828A61A5985F384Cee8bDD42177Aa263";
const SWAP_ROUTER = "0x51c5958FFb3e326F8d7AA945948159f1FF27e14A";

const WETH_ADDRESS = "0xADcb2f358Eae6492F61A5f87eb8893d09391d160".toLowerCase();
const PURR_ADDRESS = "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82".toLowerCase();

// 修正されたABIファイル
const quoterABI = require('./abi/HyperSwapQuoterV2.json');
const swapRouterABI = require('./abi/HyperSwapV3SwapRouter02.json');

async function testCorrectedHyperSwapV3() {
    console.log("🚀 修正されたHyperSwap V3 ABI でスワップテスト\n");
    
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEYが設定されていません");
        return;
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`ウォレット: ${wallet.address}\n`);
    
    // 新しいABIでコントラクト初期化
    const quoter = new ethers.Contract(QUOTER_V3, quoterABI, provider);
    const swapRouter = new ethers.Contract(SWAP_ROUTER, swapRouterABI, wallet);
    
    // テスト設定
    const amountIn = ethers.utils.parseEther("0.001"); // 0.001 WETH
    const feeAmounts = [100, 500, 3000, 10000]; // V3 fee tiers
    
    console.log("📊 修正されたV3 ABI での機能確認:");
    console.log(`入力: ${ethers.utils.formatEther(amountIn)} WETH\n`);
    
    try {
        // Step 1: 基本機能テスト
        console.log("🔧 基本機能テスト:");
        
        try {
            const factory = await swapRouter.factory();
            console.log(`   SwapRouter.factory(): ${factory} ✅`);
        } catch (error) {
            console.log(`   SwapRouter.factory(): ❌ ${error.message.substring(0, 50)}...`);
        }
        
        try {
            const weth9 = await swapRouter.WETH9();
            console.log(`   SwapRouter.WETH9(): ${weth9} ✅`);
        } catch (error) {
            console.log(`   SwapRouter.WETH9(): ❌ ${error.message.substring(0, 50)}...`);
        }
        
        // Step 2: Quote機能テスト（全fee tier）
        console.log("\n📈 Quote機能テスト:");
        
        let bestQuote = null;
        let bestFee = null;
        
        for (const fee of feeAmounts) {
            try {
                const quoteParams = {
                    tokenIn: WETH_ADDRESS,
                    tokenOut: PURR_ADDRESS,
                    amountIn: amountIn,
                    fee: fee,
                    sqrtPriceLimitX96: 0
                };
                
                const result = await quoter.quoteExactInputSingle(quoteParams);
                
                // 新しいABIでは複数の戻り値があることを確認
                let amountOut;
                if (Array.isArray(result)) {
                    amountOut = result[0]; // 最初の要素がamountOut
                    console.log(`   Fee ${fee/10000}%: ${ethers.utils.formatEther(amountOut)} PURR`);
                    console.log(`     詳細: sqrtPrice=${result[1]?.toString()}, ticks=${result[2]?.toString()}, gas=${result[3]?.toString()}`);
                } else {
                    amountOut = result;
                    console.log(`   Fee ${fee/10000}%: ${ethers.utils.formatEther(amountOut)} PURR`);
                }
                
                if (!bestQuote || amountOut.gt(bestQuote)) {
                    bestQuote = amountOut;
                    bestFee = fee;
                }
                
            } catch (error) {
                console.log(`   Fee ${fee/10000}%: ❌ ${error.message.substring(0, 60)}...`);
            }
        }
        
        if (!bestQuote) {
            console.log("\n❌ 全てのfee tierでquoteが失敗しました");
            return;
        }
        
        console.log(`\n✅ 最適fee tier: ${bestFee/10000}%`);
        console.log(`期待出力: ${ethers.utils.formatEther(bestQuote)} PURR`);
        
        // Step 3: スワップ関数テスト
        console.log("\n💸 V3スワップ関数テスト:");
        
        const deadline = Math.floor(Date.now() / 1000) + 1800;
        const amountOutMin = bestQuote.mul(5000).div(10000); // 50% slippage (極端に寛容)
        
        const swapParams = {
            tokenIn: WETH_ADDRESS,
            tokenOut: PURR_ADDRESS,
            fee: bestFee,
            recipient: wallet.address,
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0
        };
        
        console.log(`最小出力: ${ethers.utils.formatEther(amountOutMin)} PURR (50%スリッページ)`);
        
        try {
            // callStatic でテスト
            const result = await swapRouter.callStatic.exactInputSingle(swapParams);
            console.log(`   ✅ callStatic成功: ${ethers.utils.formatEther(result)} PURR`);
            
            // estimateGas でテスト
            const gasEstimate = await swapRouter.estimateGas.exactInputSingle(swapParams);
            console.log(`   ✅ 推定ガス: ${gasEstimate.toString()}`);
            
            // 実際のトランザクション送信
            console.log(`   💸 実際のスワップ実行...`);
            const tx = await swapRouter.exactInputSingle(swapParams, {
                gasLimit: gasEstimate.mul(120).div(100), // 20%マージン
                gasPrice: ethers.utils.parseUnits("2", "gwei")
            });
            
            console.log(`   トランザクション: ${tx.hash}`);
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
                console.log(`   ✅ V3スワップ成功! ガス: ${receipt.gasUsed.toString()}`);
                console.log(`   ブロック: ${receipt.blockNumber}`);
                
                // ログ解析
                if (receipt.logs.length > 0) {
                    console.log(`   📊 イベントログ数: ${receipt.logs.length}`);
                }
            } else {
                console.log(`   ❌ V3スワップ失敗 (status: ${receipt.status})`);
                console.log(`   ガス使用量: ${receipt.gasUsed.toString()}`);
            }
            
        } catch (error) {
            console.log(`   ❌ V3スワップ失敗: ${error.message.substring(0, 80)}...`);
            
            if (error.transaction && error.transaction.hash) {
                console.log(`   失敗トランザクション: ${error.transaction.hash}`);
            }
        }
        
        // Step 4: 結論
        console.log("\n📋 結論:");
        console.log("   ✅ 修正されたABIでQuote機能が改善");
        console.log("   📊 詳細なquote情報（価格、ティック、ガス）が取得可能");
        
    } catch (error) {
        console.error("❌ 全体エラー:", error.message);
    }
}

if (require.main === module) {
    testCorrectedHyperSwapV3().catch(console.error);
}