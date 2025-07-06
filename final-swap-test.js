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

async function finalSwapTest() {
    console.log("🔥 最終スワップテスト - 実際のトランザクション送信\n");
    
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEYが設定されていません");
        return;
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`ウォレット: ${wallet.address}\n`);
    
    const router = new ethers.Contract(V2_ROUTER, routerABI, wallet);
    
    // 極小額でテスト
    const amountIn = ethers.utils.parseEther("0.0001"); // 0.0001 WETH
    const path = [WETH_ADDRESS, PURR_ADDRESS];
    const deadline = Math.floor(Date.now() / 1000) + 1800;
    
    try {
        // Step 1: 期待出力確認
        console.log("📈 期待出力確認:");
        const expectedAmounts = await router.getAmountsOut(amountIn, path);
        const expectedOut = expectedAmounts[1];
        console.log(`   入力: ${ethers.utils.formatEther(amountIn)} WETH`);
        console.log(`   期待出力: ${ethers.utils.formatEther(expectedOut)} PURR\n`);
        
        // Step 2: 大きなスリッページで実際のトランザクション送信
        const amountOutMin = expectedOut.mul(5000).div(10000); // 50% slippage
        console.log(`💸 実際のスワップ実行 (50%スリッページ):`);
        console.log(`   最小出力: ${ethers.utils.formatEther(amountOutMin)} PURR`);
        
        const tx = await router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            wallet.address,
            deadline,
            {
                gasLimit: 300000,
                gasPrice: ethers.utils.parseUnits("2", "gwei")
            }
        );
        
        console.log(`   トランザクション送信: ${tx.hash}`);
        console.log(`   待機中...`);
        
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log(`   ✅ 成功! ガス使用量: ${receipt.gasUsed.toString()}`);
            console.log(`   ブロック: ${receipt.blockNumber}`);
        } else {
            console.log(`   ❌ 失敗 (status: ${receipt.status})`);
            console.log(`   ガス使用量: ${receipt.gasUsed.toString()}`);
        }
        
    } catch (error) {
        console.error("❌ スワップエラー:", error.message);
        
        // トランザクションハッシュがある場合は詳細確認
        if (error.transaction && error.transaction.hash) {
            console.log(`\n🔍 失敗したトランザクション: ${error.transaction.hash}`);
            
            try {
                const receipt = await provider.getTransactionReceipt(error.transaction.hash);
                console.log(`   ガス使用量: ${receipt.gasUsed.toString()}`);
                console.log(`   ステータス: ${receipt.status}`);
                
                if (receipt.logs && receipt.logs.length > 0) {
                    console.log(`   ログ数: ${receipt.logs.length}`);
                } else {
                    console.log(`   ログ: なし`);
                }
            } catch (receiptError) {
                console.log(`   レシート取得エラー: ${receiptError.message}`);
            }
        }
        
        // エラーの種類分析
        if (error.message.includes('insufficient funds')) {
            console.log(`\n💡 診断: ガス代不足`);
        } else if (error.message.includes('execution reverted')) {
            console.log(`\n💡 診断: コントラクトレベルでのリバート`);
        } else if (error.message.includes('nonce')) {
            console.log(`\n💡 診断: nonce問題`);
        } else {
            console.log(`\n💡 診断: 不明なエラー`);
        }
    }
}

if (require.main === module) {
    finalSwapTest().catch(console.error);
}