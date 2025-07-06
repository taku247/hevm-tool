const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

// KittenSwap V2アドレス（メインネット設定から）
const KITTEN_V2_ROUTER = "0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802";
const KITTEN_V2_FACTORY = "0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B";

const WETH_ADDRESS = "0xADcb2f358Eae6492F61A5f87eb8893d09391d160".toLowerCase();
const PURR_ADDRESS = "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82".toLowerCase();

// 標準UniV2 ABI（KittenSwap用）
const uniV2ABI = require('./abi/UniV2Router.json');

const factoryABI = [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

async function testKittenSwapComparison() {
    console.log("🐱 KittenSwap V2 比較テスト\n");
    
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEYが設定されていません");
        return;
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`ウォレット: ${wallet.address}\n`);
    
    // KittenSwap Router初期化
    const kittenRouter = new ethers.Contract(KITTEN_V2_ROUTER, uniV2ABI, wallet);
    const kittenFactory = new ethers.Contract(KITTEN_V2_FACTORY, factoryABI, provider);
    
    // テスト設定
    const amountIn = ethers.utils.parseEther("0.001"); // 0.001 WETH
    const path = [WETH_ADDRESS, PURR_ADDRESS];
    const deadline = Math.floor(Date.now() / 1000) + 1800;
    
    console.log("📊 KittenSwap V2 機能確認:");
    console.log(`入力: ${ethers.utils.formatEther(amountIn)} WETH\n`);
    
    try {
        // Step 1: 基本機能テスト
        console.log("🔧 基本機能テスト:");
        
        try {
            const factory = await kittenRouter.factory();
            console.log(`   factory(): ${factory} ✅`);
            
            if (factory.toLowerCase() === KITTEN_V2_FACTORY.toLowerCase()) {
                console.log(`   ✅ Factory一致確認`);
            } else {
                console.log(`   ❌ Factory不一致: 期待=${KITTEN_V2_FACTORY}`);
            }
        } catch (error) {
            console.log(`   factory(): ❌ ${error.message.substring(0, 50)}...`);
        }
        
        try {
            const weth = await kittenRouter.WETH();
            console.log(`   WETH(): ${weth} ✅`);
        } catch (error) {
            console.log(`   WETH(): ❌ ${error.message.substring(0, 50)}...`);
        }
        
        // Step 2: ペア存在確認
        console.log("\n🔍 ペア存在確認:");
        
        try {
            const pairAddress = await kittenFactory.getPair(WETH_ADDRESS, PURR_ADDRESS);
            if (pairAddress === "0x0000000000000000000000000000000000000000") {
                console.log(`   ❌ WETH/PURRペアが存在しません`);
                console.log(`   💡 KittenSwapではこのペアが利用できない可能性`);
                return;
            } else {
                console.log(`   ✅ WETH/PURRペア存在: ${pairAddress}`);
            }
        } catch (error) {
            console.log(`   ❌ ペア確認エラー: ${error.message.substring(0, 50)}...`);
        }
        
        // Step 3: Quote機能テスト
        console.log("\n📈 Quote機能テスト:");
        
        try {
            const amountsOut = await kittenRouter.getAmountsOut(amountIn, path);
            const expectedOut = amountsOut[1];
            console.log(`   getAmountsOut(): ${ethers.utils.formatEther(expectedOut)} PURR ✅`);
            
            // Step 4: スワップテスト
            console.log("\n💸 スワップテスト:");
            
            const amountOutMin = expectedOut.mul(9000).div(10000); // 10% slippage
            console.log(`   最小出力: ${ethers.utils.formatEther(amountOutMin)} PURR`);
            
            try {
                // callStatic でテスト
                const result = await kittenRouter.callStatic.swapExactTokensForTokens(
                    amountIn,
                    amountOutMin,
                    path,
                    wallet.address,
                    deadline
                );
                console.log(`   ✅ callStatic成功: 戻り値配列長=${result.length}`);
                
                // estimateGas でテスト
                const gasEstimate = await kittenRouter.estimateGas.swapExactTokensForTokens(
                    amountIn,
                    amountOutMin,
                    path,
                    wallet.address,
                    deadline
                );
                console.log(`   ✅ 推定ガス: ${gasEstimate.toString()}`);
                
                // 実際のトランザクション送信
                console.log(`   💸 実際のスワップ実行...`);
                const tx = await kittenRouter.swapExactTokensForTokens(
                    amountIn,
                    amountOutMin,
                    path,
                    wallet.address,
                    deadline,
                    {
                        gasLimit: gasEstimate.mul(120).div(100), // 20%マージン
                        gasPrice: ethers.utils.parseUnits("2", "gwei")
                    }
                );
                
                console.log(`   トランザクション: ${tx.hash}`);
                const receipt = await tx.wait();
                
                if (receipt.status === 1) {
                    console.log(`   ✅ KittenSwap スワップ成功! ガス: ${receipt.gasUsed.toString()}`);
                    console.log(`   ブロック: ${receipt.blockNumber}`);
                    console.log(`   🎉 KittenSwapは正常に動作します！`);
                } else {
                    console.log(`   ❌ KittenSwap スワップ失敗 (status: ${receipt.status})`);
                }
                
            } catch (error) {
                console.log(`   ❌ KittenSwap スワップ失敗: ${error.message.substring(0, 80)}...`);
            }
            
        } catch (error) {
            console.log(`   ❌ Quote失敗: ${error.message.substring(0, 80)}...`);
        }
        
        // Step 5: 比較結論
        console.log("\n📋 比較結論:");
        console.log("   HyperSwap: Quote成功、Swap失敗");
        console.log("   KittenSwap: 動作状況を確認中...");
        
    } catch (error) {
        console.error("❌ 全体エラー:", error.message);
    }
}

if (require.main === module) {
    testKittenSwapComparison().catch(console.error);
}