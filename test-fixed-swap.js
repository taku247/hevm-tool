const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

// 正しいコントラクトアドレス
const SWAP_ROUTER_01 = "0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990";
const QUOTER_V2 = "0x7FEd8993828A61A5985F384Cee8bDD42177Aa263";
const WETH_ADDRESS = "0xADcb2f358Eae6492F61A5f87eb8893d09391d160".toLowerCase();
const PURR_ADDRESS = "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82".toLowerCase();

// 正しいABI
const swapRouter01ABI = require('./abi/HyperSwapV3SwapRouter01.json');
const quoterV2ABI = require('./abi/HyperSwapQuoterV2.json');
const erc20ABI = require('./examples/sample-abi/ERC20.json');

async function testFixedSwap() {
    console.log("🔧 修正されたスワップテスト\n");
    
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEYが設定されていません");
        return;
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`ウォレット: ${wallet.address}`);
    
    // 1. ChatGPTの指摘事項を修正
    console.log("\n🛠️ ChatGPT指摘事項の修正:");
    
    // 修正1: 正しいdeadlineを設定
    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30分後
    console.log(`✅ deadline修正: ${deadline} (30分後)`);
    
    // 修正2: 正しいtoアドレスを設定（wallet.addressを使用）
    const toAddress = wallet.address;
    console.log(`✅ toアドレス修正: ${toAddress}`);
    
    // コントラクト初期化
    const router = new ethers.Contract(SWAP_ROUTER_01, swapRouter01ABI, wallet);
    const quoter = new ethers.Contract(QUOTER_V2, quoterV2ABI, provider);
    const weth = new ethers.Contract(WETH_ADDRESS, erc20ABI, wallet);
    const purr = new ethers.Contract(PURR_ADDRESS, erc20ABI, wallet);
    
    // テスト設定
    const amountIn = ethers.utils.parseEther("0.001"); // 0.001 WETH
    const fee = 3000; // 0.3%
    
    console.log(`\n📊 テスト設定:`);
    console.log(`   入力: ${ethers.utils.formatEther(amountIn)} WETH`);
    console.log(`   フィー: ${fee} (0.3%)`);
    
    try {
        // Step 1: 残高確認
        console.log("\n💰 残高確認:");
        const [wethBalance, purrBalance] = await Promise.all([
            weth.balanceOf(wallet.address),
            purr.balanceOf(wallet.address)
        ]);
        
        console.log(`   WETH: ${ethers.utils.formatEther(wethBalance)}`);
        console.log(`   PURR: ${ethers.utils.formatEther(purrBalance)}`);
        
        if (wethBalance.lt(amountIn)) {
            console.log("❌ WETH残高不足");
            return;
        }
        
        // Step 2: クォート取得
        console.log("\n📈 クォート取得:");
        const quoteResult = await quoter.quoteExactInputSingle({
            tokenIn: WETH_ADDRESS,
            tokenOut: PURR_ADDRESS,
            amountIn: amountIn,
            fee: fee,
            sqrtPriceLimitX96: 0
        });
        
        console.log(`   クォート結果: ${ethers.utils.formatEther(quoteResult.amountOut)} PURR`);
        
        // Step 3: Approve確認・実行
        console.log("\n🔐 Allowance確認・Approve:");
        const allowance = await weth.allowance(wallet.address, SWAP_ROUTER_01);
        console.log(`   現在のAllowance: ${ethers.utils.formatEther(allowance)}`);
        
        if (allowance.lt(amountIn)) {
            console.log("   📝 Approve実行中...");
            const approveTx = await weth.approve(SWAP_ROUTER_01, amountIn);
            await approveTx.wait();
            console.log("   ✅ Approve完了");
        } else {
            console.log("   ✅ Allowance充分");
        }
        
        // Step 4: callStaticでテスト
        console.log("\n🧪 callStaticテスト:");
        const swapParams = {
            tokenIn: WETH_ADDRESS,
            tokenOut: PURR_ADDRESS,
            fee: fee,
            recipient: toAddress,
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: quoteResult.amountOut.mul(98).div(100), // 2%スリッページ
            sqrtPriceLimitX96: 0
        };
        
        try {
            const staticResult = await router.callStatic.exactInputSingle(swapParams);
            console.log(`   ✅ callStatic成功: ${ethers.utils.formatEther(staticResult)} PURR`);
            
            // Step 5: 実際のスワップ実行
            console.log("\n💸 実際のスワップ実行:");
            const gasEstimate = await router.estimateGas.exactInputSingle(swapParams);
            console.log(`   推定ガス: ${gasEstimate.toString()}`);
            
            const swapTx = await router.exactInputSingle(swapParams, {
                gasLimit: gasEstimate.mul(120).div(100), // 20%マージン
                gasPrice: ethers.utils.parseUnits("2", "gwei")
            });
            
            console.log(`   トランザクション: ${swapTx.hash}`);
            const receipt = await swapTx.wait();
            
            if (receipt.status === 1) {
                console.log(`   ✅ スワップ成功!`);
                console.log(`   ガス使用量: ${receipt.gasUsed.toString()}`);
                console.log(`   ブロック: ${receipt.blockNumber}`);
                
                // 最終残高確認
                const [newWethBalance, newPurrBalance] = await Promise.all([
                    weth.balanceOf(wallet.address),
                    purr.balanceOf(wallet.address)
                ]);
                
                console.log(`\n📊 最終残高:`);
                console.log(`   WETH: ${ethers.utils.formatEther(newWethBalance)} (差分: ${ethers.utils.formatEther(newWethBalance.sub(wethBalance))})`);
                console.log(`   PURR: ${ethers.utils.formatEther(newPurrBalance)} (差分: ${ethers.utils.formatEther(newPurrBalance.sub(purrBalance))})`);
                
            } else {
                console.log(`   ❌ スワップ失敗 (status: ${receipt.status})`);
                console.log(`   ガス使用量: ${receipt.gasUsed.toString()}`);
            }
            
        } catch (staticError) {
            console.log(`   ❌ callStatic失敗:`);
            console.log(`   エラー: ${staticError.message}`);
            
            // revertデータを詳しく分析
            if (staticError.data) {
                console.log(`   revertデータ: ${staticError.data}`);
            }
            
            // 一般的なエラー分析
            if (staticError.message.includes('INSUFFICIENT_OUTPUT_AMOUNT')) {
                console.log(`   🔍 分析: スリッページ不足`);
            } else if (staticError.message.includes('EXPIRED')) {
                console.log(`   🔍 分析: Deadline期限切れ`);
            } else if (staticError.message.includes('TRANSFER_FROM_FAILED')) {
                console.log(`   🔍 分析: Approve不足またはトークン転送失敗`);
            }
        }
        
    } catch (error) {
        console.error("\n❌ 全体エラー:", error.message);
        if (error.data) {
            console.error("   revertデータ:", error.data);
        }
    }
}

if (require.main === module) {
    testFixedSwap().catch(console.error);
}