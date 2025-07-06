const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

const PURR_ADDRESS = "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82";
const WETH_ADDRESS = "0xADcb2f358Eae6492F61A5F87eb8893d09391d160";

// ERC20 ABI + 拡張
const erc20ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    // 特殊関数があるかチェック
    "function fee() view returns (uint256)",
    "function maxTransfer() view returns (uint256)",
    "function minTransfer() view returns (uint256)",
];

async function investigatePurrToken() {
    console.log("🔍 PURRトークンコントラクト調査\n");
    
    const purrContract = new ethers.Contract(PURR_ADDRESS, erc20ABI, provider);
    const wallet = process.env.TESTNET_WALLET_ADDRESS;
    
    if (!wallet) {
        console.error("❌ TESTNET_WALLET_ADDRESSが設定されていません");
        return;
    }
    
    try {
        console.log("📋 基本情報:");
        const name = await purrContract.name();
        const symbol = await purrContract.symbol();
        const decimals = await purrContract.decimals();
        const balance = await purrContract.balanceOf(wallet);
        
        console.log(`   名前: ${name}`);
        console.log(`   シンボル: ${symbol}`);
        console.log(`   Decimals: ${decimals}`);
        console.log(`   残高: ${ethers.utils.formatEther(balance)} PURR`);
        
    } catch (error) {
        console.error("❌ 基本情報取得エラー:", error.message);
    }
    
    // 特殊関数の存在確認
    console.log("\n🔧 特殊関数チェック:");
    
    const specialFunctions = ['fee', 'maxTransfer', 'minTransfer'];
    
    for (const func of specialFunctions) {
        try {
            const result = await purrContract[func]();
            console.log(`   ✅ ${func}(): ${result.toString()}`);
        } catch (error) {
            console.log(`   ❌ ${func}(): 関数なし`);
        }
    }
    
    // 少額転送テスト（実際は実行しない、estimateGasのみ）
    console.log("\n💸 転送ガス見積もりテスト:");
    
    if (process.env.PRIVATE_KEY) {
        const wallet_signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const purrWithSigner = purrContract.connect(wallet_signer);
        
        const testAmounts = [
            ethers.utils.parseEther("0.001"), // 0.001 PURR
            ethers.utils.parseEther("0.01"),  // 0.01 PURR  
            ethers.utils.parseEther("0.1"),   // 0.1 PURR
            ethers.utils.parseEther("1.0"),   // 1 PURR
        ];
        
        for (const amount of testAmounts) {
            try {
                const gasEstimate = await purrWithSigner.estimateGas.transfer(
                    WETH_ADDRESS, // 適当なアドレス
                    amount
                );
                const amountFormatted = ethers.utils.formatEther(amount);
                console.log(`   ✅ ${amountFormatted} PURR転送: ${gasEstimate.toString()} gas`);
            } catch (error) {
                const amountFormatted = ethers.utils.formatEther(amount);
                console.log(`   ❌ ${amountFormatted} PURR転送: ${error.message.substring(0, 50)}...`);
            }
        }
    } else {
        console.log("   ⚠️  PRIVATE_KEYが設定されていないため、ガス見積もりをスキップ");
    }
    
    // バイトコード調査
    console.log("\n🔍 バイトコード調査:");
    try {
        const code = await provider.getCode(PURR_ADDRESS);
        console.log(`   バイトコードサイズ: ${code.length / 2 - 1} bytes`);
        
        // 転送制限に関連する可能性のあるパターンを検索
        const patterns = {
            "maxTransactionAmount": "6d617854",
            "maxWallet": "6d617857",
            "fees": "66656573",
            "whitelist": "77686974",
            "blacklist": "626c6163",
        };
        
        for (const [name, pattern] of Object.entries(patterns)) {
            if (code.toLowerCase().includes(pattern)) {
                console.log(`   🔍 発見: ${name}関連のバイトコードパターン`);
            }
        }
        
    } catch (error) {
        console.error("   ❌ バイトコード取得エラー:", error.message);
    }
}

if (require.main === module) {
    investigatePurrToken().catch(console.error);
}