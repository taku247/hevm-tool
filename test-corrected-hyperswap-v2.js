const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

const V2_ROUTER = "0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853";
const WETH_ADDRESS = "0xADcb2f358Eae6492F61A5f87eb8893d09391d160".toLowerCase();
const PURR_ADDRESS = "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82".toLowerCase();

// 修正されたHyperSwap V2 Router ABI
const hyperswapV2ABI = require('./abi/HyperSwapV2Router.json');

async function testCorrectedHyperSwapV2() {
    console.log("🚀 修正されたHyperSwap V2 ABI でスワップテスト\n");
    
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEYが設定されていません");
        return;
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`ウォレット: ${wallet.address}\n`);
    
    // 新しいABIでRouter初期化
    const router = new ethers.Contract(V2_ROUTER, hyperswapV2ABI, wallet);
    
    // テスト設定
    const amountIn = ethers.utils.parseEther("0.001"); // 0.001 WETH
    const path = [WETH_ADDRESS, PURR_ADDRESS];
    const deadline = Math.floor(Date.now() / 1000) + 1800;
    
    console.log("📊 新しいABIでの機能確認:");
    console.log(`入力: ${ethers.utils.formatEther(amountIn)} WETH\n`);
    
    try {
        // Step 1: 基本機能テスト
        console.log("🔧 基本機能テスト:");
        
        const [factory, weth] = await Promise.all([
            router.factory(),
            router.WETH()
        ]);
        
        console.log(`   factory(): ${factory} ✅`);
        console.log(`   WETH(): ${weth} ✅`);
        
        // Step 2: Quote機能テスト（両方向）
        console.log("\n📈 Quote機能テスト:");
        
        const amountsOut = await router.getAmountsOut(amountIn, path);
        const expectedOut = amountsOut[1];
        console.log(`   getAmountsOut(): ${ethers.utils.formatEther(expectedOut)} PURR ✅`);
        
        const amountsIn = await router.getAmountsIn(expectedOut, path);
        console.log(`   getAmountsIn(): ${ethers.utils.formatEther(amountsIn[0])} WETH ✅`);
        
        // Step 3: スワップ関数テスト（全種類）
        console.log("\n💸 スワップ関数テスト:");
        
        const swapFunctions = [
            'swapExactTokensForTokens',
            'swapTokensForExactTokens'
        ];
        
        for (const funcName of swapFunctions) {
            console.log(`\n   ${funcName}:`);
            
            try {
                let params;
                if (funcName === 'swapExactTokensForTokens') {
                    const amountOutMin = expectedOut.mul(9000).div(10000); // 10% slippage
                    params = [amountIn, amountOutMin, path, wallet.address, deadline];
                    console.log(`     最小出力: ${ethers.utils.formatEther(amountOutMin)} PURR`);
                } else {
                    const targetOut = ethers.utils.parseEther("1.0"); // 1 PURR
                    const amountInMax = amountIn.mul(11000).div(10000); // 10% max input
                    params = [targetOut, amountInMax, path, wallet.address, deadline];
                    console.log(`     目標出力: ${ethers.utils.formatEther(targetOut)} PURR`);
                    console.log(`     最大入力: ${ethers.utils.formatEther(amountInMax)} WETH`);
                }
                
                // callStatic でテスト
                const result = await router.callStatic[funcName](...params);
                console.log(`     ✅ callStatic成功: 戻り値配列長=${result.length}`);
                
                // estimateGas でテスト
                const gasEstimate = await router.estimateGas[funcName](...params);
                console.log(`     ✅ 推定ガス: ${gasEstimate.toString()}`);
                
                // 実際のトランザクション送信（最初の成功した関数のみ）
                if (funcName === 'swapExactTokensForTokens') {
                    console.log(`     💸 実際のトランザクション送信...`);
                    
                    const tx = await router[funcName](...params, {
                        gasLimit: gasEstimate.mul(120).div(100), // 20%マージン
                        gasPrice: ethers.utils.parseUnits("2", "gwei")
                    });
                    
                    console.log(`     トランザクション: ${tx.hash}`);
                    const receipt = await tx.wait();
                    
                    if (receipt.status === 1) {
                        console.log(`     ✅ スワップ成功! ガス: ${receipt.gasUsed.toString()}`);
                        console.log(`     ブロック: ${receipt.blockNumber}`);
                        return; // 成功したら終了
                    } else {
                        console.log(`     ❌ スワップ失敗 (status: ${receipt.status})`);
                        console.log(`     ガス使用量: ${receipt.gasUsed.toString()}`);
                    }
                }
                
            } catch (error) {
                console.log(`     ❌ 失敗: ${error.message.substring(0, 80)}...`);
                
                // エラーの詳細分析
                if (error.message.includes('UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT')) {
                    console.log(`     🔍 分析: スリッページ不足`);
                } else if (error.message.includes('UniswapV2Router: EXPIRED')) {
                    console.log(`     🔍 分析: Deadline期限切れ`);
                } else if (error.message.includes('execution reverted')) {
                    console.log(`     🔍 分析: コントラクトレベルでのリバート`);
                }
            }
        }
        
        // Step 4: 結論
        console.log("\n📋 結論:");
        console.log("   ✅ 新しいABIでQuote機能は完全に動作");
        console.log("   ❓ スワップ機能の実際の動作を確認中...");
        
    } catch (error) {
        console.error("❌ 全体エラー:", error.message);
    }
}

if (require.main === module) {
    testCorrectedHyperSwapV2().catch(console.error);
}