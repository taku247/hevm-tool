const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

const V2_ROUTER = "0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853";
const PURR_ADDRESS = "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82";
const WETH_ADDRESS = "0xADcb2f358Eae6492F61A5F87eb8893d09391d160";

const routerABI = [
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

async function debugSwapEstimate() {
    console.log("🔍 Swap EstimateGas詳細デバッグ\n");
    
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEYが設定されていません");
        return;
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`ウォレット: ${wallet.address}`);
    
    const router = new ethers.Contract(V2_ROUTER, routerABI, wallet);
    
    const amountIn = ethers.utils.parseEther("1"); // 1 PURR
    const path = [PURR_ADDRESS, WETH_ADDRESS];
    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30分後
    
    try {
        // Step 1: getAmountsOut for reference
        console.log("📊 getAmountsOut結果:");
        const amounts = await router.getAmountsOut(amountIn, path);
        const amountOut = amounts[1];
        console.log(`   期待出力: ${ethers.utils.formatEther(amountOut)} WETH`);
        
        // Step 2: 異なるスリッページでestimateGas
        const slippages = [0.5, 1.0, 2.0, 5.0, 10.0];
        
        for (const slippage of slippages) {
            const slippageMultiplier = (100 - slippage) / 100;
            const amountOutMin = amountOut.mul(Math.floor(slippageMultiplier * 10000)).div(10000);
            
            console.log(`\\n💸 ${slippage}% スリッページでestimateGas:`);
            console.log(`   最小出力: ${ethers.utils.formatEther(amountOutMin)} WETH`);
            
            try {
                const gasEstimate = await router.estimateGas.swapExactTokensForTokens(
                    amountIn,
                    amountOutMin,
                    path,
                    wallet.address,
                    deadline
                );
                console.log(`   ✅ 推定ガス: ${gasEstimate.toString()}`);
            } catch (error) {
                console.log(`   ❌ EstimateGas失敗: ${error.message.substring(0, 80)}...`);
                
                // さらに詳細なエラー分析
                if (error.message.includes('revert')) {
                    console.log(`   🔍 Revert詳細: ${error.reason || 'Unknown'}`);
                }
            }
        }
        
        // Step 3: 異なる金額でテスト
        console.log(`\\n💰 異なる金額でestimateGas:`);
        const testAmounts = ["0.1", "0.5", "1.0", "2.0"];
        
        for (const amount of testAmounts) {
            const testAmountIn = ethers.utils.parseEther(amount);
            const testAmounts = await router.getAmountsOut(testAmountIn, path);
            const testAmountOut = testAmounts[1];
            const testAmountOutMin = testAmountOut.mul(9500).div(10000); // 5% slippage
            
            console.log(`\\n   ${amount} PURR:`)
            console.log(`     期待: ${ethers.utils.formatEther(testAmountOut)} WETH`);
            
            try {
                const gasEstimate = await router.estimateGas.swapExactTokensForTokens(
                    testAmountIn,
                    testAmountOutMin,
                    path,
                    wallet.address,
                    deadline
                );
                console.log(`     ✅ ガス: ${gasEstimate.toString()}`);
            } catch (error) {
                console.log(`     ❌ 失敗: ${error.message.substring(0, 60)}...`);
            }
        }
        
    } catch (error) {
        console.error("❌ 全体エラー:", error.message);
    }
}

if (require.main === module) {
    debugSwapEstimate().catch(console.error);
}