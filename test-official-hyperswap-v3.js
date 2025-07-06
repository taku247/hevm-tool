const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

// 公式のHyperSwap V3テストネットアドレス
const QUOTER_V3 = "0x7FEd8993828A61A5985F384Cee8bDD42177Aa263";
const SWAP_ROUTER = "0x51c5958FFb3e326F8d7AA945948159f1FF27e14A";
const FACTORY = "0x22B0768972bB7f1F5ea7a8740BB8f94b32483826";

const WETH_ADDRESS = "0xADcb2f358Eae6492F61A5f87eb8893d09391d160".toLowerCase();
const PURR_ADDRESS = "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82".toLowerCase();

// QuoterV2 ABI (Struct形式)
const quoterABI = [
    {
        "name": "quoteExactInputSingle",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{
            "components": [
                { "name": "tokenIn", "type": "address" },
                { "name": "tokenOut", "type": "address" },
                { "name": "amountIn", "type": "uint256" },
                { "name": "fee", "type": "uint24" },
                { "name": "sqrtPriceLimitX96", "type": "uint160" }
            ],
            "name": "params",
            "type": "tuple"
        }],
        "outputs": [
            { "name": "amountOut", "type": "uint256" },
            { "name": "sqrtPriceX96After", "type": "uint160" },
            { "name": "initializedTicksCrossed", "type": "uint32" },
            { "name": "gasEstimate", "type": "uint256" }
        ]
    }
];

// SwapRouter ABI
const swapRouterABI = [
    {
        "name": "exactInputSingle",
        "type": "function",
        "stateMutability": "payable",
        "inputs": [{
            "components": [
                { "name": "tokenIn", "type": "address" },
                { "name": "tokenOut", "type": "address" },
                { "name": "fee", "type": "uint24" },
                { "name": "recipient", "type": "address" },
                { "name": "deadline", "type": "uint256" },
                { "name": "amountIn", "type": "uint256" },
                { "name": "amountOutMinimum", "type": "uint256" },
                { "name": "sqrtPriceLimitX96", "type": "uint160" }
            ],
            "name": "params",
            "type": "tuple"
        }],
        "outputs": [
            { "name": "amountOut", "type": "uint256" }
        ]
    }
];

async function testOfficialHyperSwapV3() {
    console.log("🚀 公式HyperSwap V3テストネット スワップテスト\n");
    
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEYが設定されていません");
        return;
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`ウォレット: ${wallet.address}\n`);
    
    // コントラクト初期化
    const quoter = new ethers.Contract(QUOTER_V3, quoterABI, provider);
    const swapRouter = new ethers.Contract(SWAP_ROUTER, swapRouterABI, wallet);
    
    // テスト設定
    const amountIn = ethers.utils.parseEther("0.001"); // 0.001 WETH
    const feeAmounts = [100, 500, 3000, 10000]; // V3 fee tiers
    
    console.log("📊 V3 Quote テスト:");
    console.log(`入力: ${ethers.utils.formatEther(amountIn)} WETH\n`);
    
    let bestQuote = null;
    let bestFee = null;
    
    // 全fee tierでquote確認
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
            const amountOut = result.amountOut || result[0];
            
            console.log(`   Fee ${fee/10000}%: ${ethers.utils.formatEther(amountOut)} PURR`);
            
            if (!bestQuote || amountOut.gt(bestQuote)) {
                bestQuote = amountOut;
                bestFee = fee;
            }
            
        } catch (error) {
            console.log(`   Fee ${fee/10000}%: ❌ ${error.message.substring(0, 50)}...`);
        }
    }
    
    if (!bestQuote) {
        console.log("\n❌ 全てのfee tierでquoteが失敗しました");
        return;
    }
    
    console.log(`\n✅ 最適fee tier: ${bestFee/10000}%`);
    console.log(`期待出力: ${ethers.utils.formatEther(bestQuote)} PURR\n`);
    
    // 実際のスワップ実行
    console.log("💸 V3スワップ実行:");
    
    try {
        const deadline = Math.floor(Date.now() / 1000) + 1800;
        const amountOutMin = bestQuote.mul(9500).div(10000); // 5% slippage
        
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
        
        console.log(`最小出力: ${ethers.utils.formatEther(amountOutMin)} PURR`);
        
        // estimateGas先にテスト
        try {
            const gasEstimate = await swapRouter.estimateGas.exactInputSingle(swapParams);
            console.log(`推定ガス: ${gasEstimate.toString()}`);
        } catch (gasError) {
            console.log(`❌ ガス見積もり失敗: ${gasError.message.substring(0, 80)}...`);
            return;
        }
        
        // 実際のトランザクション送信
        const tx = await swapRouter.exactInputSingle(swapParams, {
            gasLimit: 300000,
            gasPrice: ethers.utils.parseUnits("2", "gwei")
        });
        
        console.log(`トランザクション: ${tx.hash}`);
        console.log(`待機中...`);
        
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log(`✅ スワップ成功!`);
            console.log(`ガス使用量: ${receipt.gasUsed.toString()}`);
            console.log(`ブロック: ${receipt.blockNumber}`);
        } else {
            console.log(`❌ スワップ失敗 (status: ${receipt.status})`);
            console.log(`ガス使用量: ${receipt.gasUsed.toString()}`);
        }
        
    } catch (error) {
        console.error(`❌ スワップエラー: ${error.message}`);
        
        if (error.transaction && error.transaction.hash) {
            console.log(`失敗トランザクション: ${error.transaction.hash}`);
        }
    }
}

if (require.main === module) {
    testOfficialHyperSwapV3().catch(console.error);
}