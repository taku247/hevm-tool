const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

const SWAP_ROUTER = "0x51c5958FFb3e326F8d7AA945948159f1FF27e14A";
const WETH_ADDRESS = "0xADcb2f358Eae6492F61A5f87eb8893d09391d160".toLowerCase();
const PURR_ADDRESS = "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82".toLowerCase();

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

async function debugV3Swap() {
    console.log("🔍 HyperSwap V3スワップ詳細デバッグ\n");
    
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEYが設定されていません");
        return;
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`ウォレット: ${wallet.address}\n`);
    
    const swapRouter = new ethers.Contract(SWAP_ROUTER, swapRouterABI, wallet);
    
    // 極小額でテスト
    const amountIn = ethers.utils.parseEther("0.0001"); // 0.0001 WETH
    const deadline = Math.floor(Date.now() / 1000) + 1800;
    
    const testCases = [
        { fee: 100, slippage: 50 },   // 0.01% fee, 50% slippage
        { fee: 500, slippage: 50 },   // 0.05% fee, 50% slippage
        { fee: 3000, slippage: 50 },  // 0.3% fee, 50% slippage
        { fee: 10000, slippage: 50 }  // 1% fee, 50% slippage
    ];
    
    console.log(`入力: ${ethers.utils.formatEther(amountIn)} WETH\n`);
    
    for (const testCase of testCases) {
        console.log(`🧪 Fee ${testCase.fee/10000}%, スリッページ ${testCase.slippage}%:`);
        
        try {
            // 極端に低い最小出力で試行
            const amountOutMin = ethers.utils.parseEther("0.001"); // 固定値
            
            const swapParams = {
                tokenIn: WETH_ADDRESS,
                tokenOut: PURR_ADDRESS,
                fee: testCase.fee,
                recipient: wallet.address,
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: amountOutMin,
                sqrtPriceLimitX96: 0
            };
            
            console.log(`   最小出力: ${ethers.utils.formatEther(amountOutMin)} PURR`);
            
            // callStatic で実際の結果をテスト
            try {
                const result = await swapRouter.callStatic.exactInputSingle(swapParams);
                console.log(`   ✅ callStatic成功: ${ethers.utils.formatEther(result)} PURR`);
                
                // callStaticが成功した場合、estimateGasを試行
                try {
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
                        console.log(`   ✅ スワップ成功! ガス: ${receipt.gasUsed.toString()}`);
                        return; // 成功したら終了
                    } else {
                        console.log(`   ❌ スワップ失敗 (status: ${receipt.status})`);
                    }
                    
                } catch (gasError) {
                    console.log(`   ❌ ガス見積もり失敗: ${gasError.message.substring(0, 60)}...`);
                }
                
            } catch (callStaticError) {
                console.log(`   ❌ callStatic失敗: ${callStaticError.message.substring(0, 60)}...`);
                
                // エラーの詳細分析
                if (callStaticError.message.includes('STF')) {
                    console.log(`   🔍 分析: SafeTransferFrom失敗`);
                } else if (callStaticError.message.includes('IIA')) {
                    console.log(`   🔍 分析: InvalidInput引数`);
                } else if (callStaticError.message.includes('AS')) {
                    console.log(`   🔍 分析: AmountSlippage`);
                } else if (callStaticError.message.includes('TLM')) {
                    console.log(`   🔍 分析: Too Little received Minimum`);
                }
            }
            
        } catch (error) {
            console.log(`   ❌ 全体エラー: ${error.message.substring(0, 60)}...`);
        }
        
        console.log();
    }
    
    console.log("❌ 全てのテストケースが失敗しました");
    console.log("💡 HyperSwap V3テストネットも制限されている可能性があります");
}

if (require.main === module) {
    debugV3Swap().catch(console.error);
}