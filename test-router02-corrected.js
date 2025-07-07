const { ethers } = require('ethers');
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider("https://rpc.hyperliquid-testnet.xyz/evm");

// 修正されたRouter02でのテスト
const SWAP_ROUTER_02 = "0x51c5958FFb3e326F8d7AA945948159f1FF27e14A";
const QUOTER_V2 = "0x7FEd8993828A61A5985F384Cee8bDD42177Aa263";
const WETH_ADDRESS = "0xadcb2f358eae6492f61a5f87eb8893d09391d160";
const PURR_ADDRESS = "0xc003d79b8a489703b1753711e3ae9ffdfc8d1a82";

// 修正されたABI（deadline無し）
const router02ABI = require('./abi/HyperSwapV3SwapRouter02.json');
const quoterV2ABI = require('./abi/HyperSwapQuoterV2.json');
const erc20ABI = require('./examples/sample-abi/ERC20.json');

async function testRouter02Corrected() {
    console.log("🔧 修正されたRouter02でのスワップテスト\n");
    
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEYが設定されていません");
        return;
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`ウォレット: ${wallet.address}`);
    
    // コントラクト初期化
    const router = new ethers.Contract(SWAP_ROUTER_02, router02ABI, wallet);
    const quoter = new ethers.Contract(QUOTER_V2, quoterV2ABI, provider);
    const weth = new ethers.Contract(WETH_ADDRESS, erc20ABI, wallet);
    const purr = new ethers.Contract(PURR_ADDRESS, erc20ABI, wallet);
    
    // テスト設定
    const amountIn = ethers.utils.parseEther("0.001"); // 0.001 WETH
    const fee = 3000; // 0.3%
    
    console.log(`\n📊 テスト設定:`);
    console.log(`   入力: ${ethers.utils.formatEther(amountIn)} WETH`);
    console.log(`   フィー: ${fee} (0.3%)`);
    console.log(`   Router: SwapRouter02 (修正版ABI)`);
    
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
        const allowance = await weth.allowance(wallet.address, SWAP_ROUTER_02);
        console.log(`   現在のAllowance: ${ethers.utils.formatEther(allowance)}`);
        
        if (allowance.lt(amountIn)) {
            console.log("   📝 Approve実行中...");
            const approveTx = await weth.approve(SWAP_ROUTER_02, amountIn);
            await approveTx.wait();
            console.log("   ✅ Approve完了");
        } else {
            console.log("   ✅ Allowance充分");
        }
        
        // Step 4: callStaticでテスト（deadline無し）
        console.log("\n🧪 callStaticテスト（deadline無し）:");
        const swapParams = {
            tokenIn: WETH_ADDRESS,
            tokenOut: PURR_ADDRESS,
            fee: fee,
            recipient: wallet.address,
            // deadline: 削除済み
            amountIn: amountIn,
            amountOutMinimum: quoteResult.amountOut.mul(98).div(100), // 2%スリッページ
            sqrtPriceLimitX96: 0
        };
        
        console.log("   📋 使用パラメータ:");
        console.log(`     tokenIn: ${swapParams.tokenIn}`);
        console.log(`     tokenOut: ${swapParams.tokenOut}`);
        console.log(`     fee: ${swapParams.fee}`);
        console.log(`     recipient: ${swapParams.recipient}`);
        console.log(`     amountIn: ${ethers.utils.formatEther(swapParams.amountIn)}`);
        console.log(`     amountOutMinimum: ${ethers.utils.formatEther(swapParams.amountOutMinimum)}`);
        console.log(`     deadline: 無し（Router02仕様）`);
        
        try {
            const staticResult = await router.callStatic.exactInputSingle(swapParams);
            console.log(`   ✅ callStatic成功: ${ethers.utils.formatEther(staticResult)} PURR`);
            
            // Step 5: 実際のスワップ実行
            console.log("\n💸 実際のRouter02スワップ実行:");
            const gasEstimate = await router.estimateGas.exactInputSingle(swapParams);
            console.log(`   推定ガス: ${gasEstimate.toString()}`);
            
            const swapTx = await router.exactInputSingle(swapParams, {
                gasLimit: gasEstimate.mul(120).div(100), // 20%マージン
                gasPrice: ethers.utils.parseUnits("2", "gwei")
            });
            
            console.log(`   トランザクション: ${swapTx.hash}`);
            const receipt = await swapTx.wait();
            
            if (receipt.status === 1) {
                console.log(`   ✅ Router02スワップ成功!`);
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
                
                console.log(`\n🎉 ChatGPT指摘の検証結果:`);
                console.log(`   ✅ Router02にexactInputSingle関数は存在した`);
                console.log(`   ✅ deadline無しのパラメータ構造で正常動作`);
                console.log(`   ✅ Router01とRouter02は両方とも機能する`);
                
            } else {
                console.log(`   ❌ スワップ失敗 (status: ${receipt.status})`);
                console.log(`   ガス使用量: ${receipt.gasUsed.toString()}`);
            }
            
        } catch (staticError) {
            console.log(`   ❌ callStatic失敗:`);
            console.log(`   エラー: ${staticError.message}`);
            
            if (staticError.data) {
                console.log(`   revertデータ: ${staticError.data}`);
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
    testRouter02Corrected().catch(console.error);
}