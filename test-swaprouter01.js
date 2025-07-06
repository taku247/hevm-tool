const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

// SwapRouter01 (スワップ機能があるはず)
const QUOTER_V3 = "0x7FEd8993828A61A5985F384Cee8bDD42177Aa263";
const SWAP_ROUTER_01 = "0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990";

const WETH_ADDRESS = "0xADcb2f358Eae6492F61A5f87eb8893d09391d160".toLowerCase();
const PURR_ADDRESS = "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82".toLowerCase();

// 専用ABIファイル
const quoterABI = require('./abi/HyperSwapQuoterV2.json');
const swapRouter01ABI = require('./abi/HyperSwapV3SwapRouter01.json');

async function testSwapRouter01() {
    console.log("🚀 SwapRouter01 実際のスワップテスト\n");
    
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEYが設定されていません");
        return;
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`ウォレット: ${wallet.address}\n`);
    
    // SwapRouter01で初期化
    const quoter = new ethers.Contract(QUOTER_V3, quoterABI, provider);
    const swapRouter01 = new ethers.Contract(SWAP_ROUTER_01, swapRouter01ABI, wallet);
    
    // テスト設定
    const amountIn = ethers.utils.parseEther("0.0001"); // 0.0001 WETH
    const feeAmount = 100; // 0.01% fee
    
    console.log("📊 SwapRouter01での処理:");
    console.log(`入力: ${ethers.utils.formatEther(amountIn)} WETH\n`);
    
    try {
        // Step 1: Quote取得
        console.log("📈 Quote取得:");
        const quoteParams = {
            tokenIn: WETH_ADDRESS,
            tokenOut: PURR_ADDRESS,
            amountIn: amountIn,
            fee: feeAmount,
            sqrtPriceLimitX96: 0
        };
        
        const result = await quoter.quoteExactInputSingle(quoteParams);
        const expectedOut = result[0]; // amountOut
        console.log(`期待出力: ${ethers.utils.formatEther(expectedOut)} PURR\n`);
        
        // Step 2: SwapRouter01での実際のスワップ
        console.log("💸 SwapRouter01でのスワップ実行:");
        
        const deadline = Math.floor(Date.now() / 1000) + 1800;
        const amountOutMin = expectedOut.mul(5000).div(10000); // 50% slippage
        
        const swapParams = {
            tokenIn: WETH_ADDRESS,
            tokenOut: PURR_ADDRESS,
            fee: feeAmount,
            recipient: wallet.address,
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0
        };
        
        console.log(`最小出力: ${ethers.utils.formatEther(amountOutMin)} PURR (50%スリッページ)`);
        
        // 基本機能確認
        try {
            const factory = await swapRouter01.factory();
            console.log(`   factory(): ${factory} ✅`);
        } catch (error) {
            console.log(`   factory(): ❌ ${error.message.substring(0, 50)}...`);
        }
        
        try {
            const weth9 = await swapRouter01.WETH9();
            console.log(`   WETH9(): ${weth9} ✅`);
        } catch (error) {
            console.log(`   WETH9(): ❌ ${error.message.substring(0, 50)}...`);
        }
        
        // callStatic でテスト
        try {
            const callStaticResult = await swapRouter01.callStatic.exactInputSingle(swapParams);
            console.log(`   ✅ callStatic成功: ${ethers.utils.formatEther(callStaticResult)} PURR`);
            
            // estimateGas でテスト
            try {
                const gasEstimate = await swapRouter01.estimateGas.exactInputSingle(swapParams);
                console.log(`   ✅ 推定ガス: ${gasEstimate.toString()}`);
                
                // 実際のトランザクション送信
                console.log(`   💸 実際のスワップ実行...`);
                const tx = await swapRouter01.exactInputSingle(swapParams, {
                    gasLimit: gasEstimate.mul(120).div(100), // 20%マージン
                    gasPrice: ethers.utils.parseUnits("2", "gwei")
                });
                
                console.log(`   トランザクション: ${tx.hash}`);
                const receipt = await tx.wait();
                
                if (receipt.status === 1) {
                    console.log(`   ✅ SwapRouter01 スワップ成功! ガス: ${receipt.gasUsed.toString()}`);
                    console.log(`   ブロック: ${receipt.blockNumber}`);
                    console.log(`   🎉 SwapRouter01は正常に動作します！`);
                } else {
                    console.log(`   ❌ SwapRouter01 スワップ失敗 (status: ${receipt.status})`);
                }
                
            } catch (gasError) {
                console.log(`   ❌ ガス見積もり失敗: ${gasError.message.substring(0, 80)}...`);
            }
            
        } catch (callStaticError) {
            console.log(`   ❌ callStatic失敗: ${callStaticError.message.substring(0, 80)}...`);
        }
        
        // 結論
        console.log("\n📋 SwapRouter01 vs SwapRouter02 結論:");
        console.log("   SwapRouter01: V3スワップ関数を持つ正統なSwapRouter");
        console.log("   SwapRouter02: 別の機能（Multicall等）を持つ拡張Router");
        console.log("   推奨: V3スワップにはSwapRouter01を使用");
        
    } catch (error) {
        console.error("❌ 全体エラー:", error.message);
    }
}

if (require.main === module) {
    testSwapRouter01().catch(console.error);
}