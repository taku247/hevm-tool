const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

const V2_ROUTER = "0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853";
const WETH_ADDRESS = "0xADcb2f358Eae6492F61A5f87eb8893d09391d160".toLowerCase();
const PURR_ADDRESS = "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82".toLowerCase();

const routerABI = [
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

const erc20ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

async function analyzeFailedSwap() {
    console.log("🔍 失敗したスワップの詳細分析\n");
    
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEYが設定されていません");
        return;
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`ウォレット: ${wallet.address}\n`);
    
    const router = new ethers.Contract(V2_ROUTER, routerABI, wallet);
    const wethContract = new ethers.Contract(WETH_ADDRESS, erc20ABI, provider);
    
    // 小額でテスト
    const amountIn = ethers.utils.parseEther("0.001"); // 0.001 WETH
    const path = [WETH_ADDRESS, PURR_ADDRESS];
    const deadline = Math.floor(Date.now() / 1000) + 1800;
    
    try {
        // Step 1: 残高と承認チェック
        console.log("📊 事前状態確認:");
        const [balance, allowance] = await Promise.all([
            wethContract.balanceOf(wallet.address),
            wethContract.allowance(wallet.address, V2_ROUTER)
        ]);
        
        console.log(`   WETH残高: ${ethers.utils.formatEther(balance)} WETH`);
        console.log(`   承認額: ${ethers.utils.formatEther(allowance)} WETH`);
        console.log(`   スワップ額: ${ethers.utils.formatEther(amountIn)} WETH`);
        
        if (balance.lt(amountIn)) {
            console.log("   ❌ 残高不足");
            return;
        }
        
        if (allowance.lt(amountIn)) {
            console.log("   ❌ 承認不足");
            return;
        }
        
        console.log("   ✅ 残高・承認OK\n");
        
        // Step 2: getAmountsOut で期待値確認
        console.log("📈 期待出力確認:");
        const expectedAmounts = await router.getAmountsOut(amountIn, path);
        const expectedOut = expectedAmounts[1];
        console.log(`   期待出力: ${ethers.utils.formatEther(expectedOut)} PURR\n`);
        
        // Step 3: 異なるスリッページでcallStatic
        console.log("🧪 callStatic テスト:");
        const slippages = [0.1, 0.5, 1.0, 2.0, 5.0];
        
        for (const slippage of slippages) {
            const slippageMultiplier = (100 - slippage) / 100;
            const amountOutMin = expectedOut.mul(Math.floor(slippageMultiplier * 10000)).div(10000);
            
            console.log(`   ${slippage}% スリッページ (最小: ${ethers.utils.formatEther(amountOutMin)} PURR):`);
            
            try {
                const result = await router.callStatic.swapExactTokensForTokens(
                    amountIn,
                    amountOutMin,
                    path,
                    wallet.address,
                    deadline
                );
                console.log(`     ✅ 成功: ${ethers.utils.formatEther(result[1])} PURR`);
            } catch (error) {
                console.log(`     ❌ 失敗: ${error.reason || error.message.substring(0, 60)}`);
                
                // エラーの詳細分析
                if (error.message.includes('UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT')) {
                    console.log(`     🔍 分析: スリッページが小さすぎる可能性`);
                } else if (error.message.includes('UniswapV2Router: EXPIRED')) {
                    console.log(`     🔍 分析: Deadline期限切れ`);
                } else if (error.message.includes('TransferHelper: TRANSFER_FROM_FAILED')) {
                    console.log(`     🔍 分析: トークン転送失敗`);
                } else {
                    console.log(`     🔍 分析: 不明なエラー`);
                }
            }
        }
        
        // Step 4: 実際のestimateGasでガス見積もり
        console.log(`\n⛽ ガス見積もり:`)
        const amountOutMin = expectedOut.mul(9500).div(10000); // 5% slippage
        
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
            console.log(`   ❌ ガス見積もり失敗: ${error.reason || error.message.substring(0, 80)}`);
        }
        
    } catch (error) {
        console.error("❌ 全体エラー:", error);
    }
}

if (require.main === module) {
    analyzeFailedSwap().catch(console.error);
}