const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

const SWAP_ROUTER = "0x51c5958FFb3e326F8d7AA945948159f1FF27e14A";
const WETH_ADDRESS = "0xADcb2f358Eae6492F61A5f87eb8893d09391d160".toLowerCase();

const erc20ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function symbol() view returns (string)"
];

async function approveV3Router() {
    console.log("🔧 HyperSwap V3 Router承認\n");
    
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEYが設定されていません");
        return;
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`ウォレット: ${wallet.address}`);
    console.log(`V3 Router: ${SWAP_ROUTER}\n`);
    
    const wethContract = new ethers.Contract(WETH_ADDRESS, erc20ABI, wallet);
    
    try {
        // 現在の状態確認
        const [balance, allowance, symbol] = await Promise.all([
            wethContract.balanceOf(wallet.address),
            wethContract.allowance(wallet.address, SWAP_ROUTER),
            wethContract.symbol()
        ]);
        
        console.log("📊 現在の状態:");
        console.log(`   ${symbol}残高: ${ethers.utils.formatEther(balance)}`);
        console.log(`   V3 Router承認: ${ethers.utils.formatEther(allowance)}`);
        
        if (allowance.gt(ethers.utils.parseEther("0.001"))) {
            console.log("   ✅ 既に十分な承認があります\n");
        } else {
            console.log("   ❌ V3 Router承認が不足しています\n");
            
            // 無制限承認
            console.log("💸 V3 Router承認実行:");
            const maxUint256 = ethers.constants.MaxUint256;
            
            const approveTx = await wethContract.approve(SWAP_ROUTER, maxUint256, {
                gasLimit: 100000,
                gasPrice: ethers.utils.parseUnits("2", "gwei")
            });
            
            console.log(`承認トランザクション: ${approveTx.hash}`);
            console.log(`待機中...`);
            
            const receipt = await approveTx.wait();
            
            if (receipt.status === 1) {
                console.log(`✅ 承認成功!`);
                console.log(`ガス使用量: ${receipt.gasUsed.toString()}`);
            } else {
                console.log(`❌ 承認失敗`);
                return;
            }
        }
        
        // V3スワップ再テスト
        console.log("🔄 V3スワップ再テスト:");
        const { exec } = require('child_process');
        exec('node test-official-hyperswap-v3.js', (error, stdout, stderr) => {
            if (error) {
                console.error(`実行エラー: ${error}`);
                return;
            }
            console.log(stdout);
            if (stderr) {
                console.error(`エラー出力: ${stderr}`);
            }
        });
        
    } catch (error) {
        console.error("❌ エラー:", error.message);
    }
}

if (require.main === module) {
    approveV3Router().catch(console.error);
}