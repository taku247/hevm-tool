const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

const V2_ROUTER = "0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853";
const WETH_ADDRESS = "0xADcb2f358Eae6492F61A5f87eb8893d09391d160";
const PURR_ADDRESS = "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82";
const HSPX_ADDRESS = "0xD8c23394e2d55AA6dB9E5bb1305df54A1F83D122";

const erc20ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

async function checkTokenApprovals() {
    console.log("🔍 トークン承認状態確認\n");
    
    if (!process.env.TESTNET_WALLET_ADDRESS) {
        console.error("❌ TESTNET_WALLET_ADDRESSが設定されていません");
        return;
    }
    
    const wallet = process.env.TESTNET_WALLET_ADDRESS;
    console.log(`ウォレット: ${wallet}\n`);
    
    const tokens = [
        { name: "WETH", address: WETH_ADDRESS.toLowerCase() },
        { name: "PURR", address: PURR_ADDRESS.toLowerCase() },
        { name: "HSPX", address: HSPX_ADDRESS.toLowerCase() }
    ];
    
    for (const token of tokens) {
        console.log(`📊 ${token.name} (${token.address.toLowerCase()}):`);
        
        try {
            const contract = new ethers.Contract(token.address, erc20ABI, provider);
            
            const [balance, allowance, decimals, symbol] = await Promise.all([
                contract.balanceOf(wallet),
                contract.allowance(wallet, V2_ROUTER),
                contract.decimals(),
                contract.symbol()
            ]);
            
            console.log(`   残高: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}`);
            console.log(`   承認: ${ethers.utils.formatUnits(allowance, decimals)} ${symbol}`);
            
            if (allowance.gt(0)) {
                console.log("   ✅ Router承認済み");
            } else {
                console.log("   ❌ Router未承認");
            }
            
        } catch (error) {
            console.log(`   ❌ エラー: ${error.message}`);
        }
        
        console.log();
    }
    
    // 実際のスワップ必要承認額を計算
    console.log("💸 テストスワップ必要承認量:");
    console.log("   0.01 WETH → 任意のトークン: 0.01 WETH承認必要");
    console.log("   1 PURR → 任意のトークン: 1 PURR承認必要");
    console.log("   1 HSPX → 任意のトークン: 1 HSPX承認必要");
}

if (require.main === module) {
    checkTokenApprovals().catch(console.error);
}