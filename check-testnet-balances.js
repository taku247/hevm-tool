const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

/**
 * テストネットでの残高確認ツール
 * 環境変数のPRIVATE_KEYまたはコマンドライン引数のウォレットアドレスで残高を確認
 */

// テストネット設定
const provider = new ethers.providers.JsonRpcProvider(
    process.env.HYPERLIQUID_TESTNET_RPC || "https://rpc.hyperliquid-testnet.xyz/evm"
);

// ERC20 ABI
const erc20ABI = [
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }]
    },
    {
        name: "decimals",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint8" }]
    },
    {
        name: "symbol",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }]
    }
];

// トークン設定を読み込み
function loadTokenConfig() {
    try {
        const configPath = path.join(__dirname, 'config/token-config.json');
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const testnetTokens = configData.networks['hyperevm-testnet'].tokens;
        
        const tokens = {};
        for (const [symbol, tokenInfo] of Object.entries(testnetTokens)) {
            if (tokenInfo.type !== 'native') {
                tokens[symbol] = {
                    address: tokenInfo.address,
                    decimals: tokenInfo.decimals
                };
            }
        }
        return tokens;
    } catch (error) {
        console.error("❌ トークン設定読み込みエラー:", error.message);
        process.exit(1);
    }
}

async function checkBalances(walletAddress) {
    console.log(`🔍 テストネット残高確認: ${walletAddress}\n`);
    
    // HYPE残高確認
    try {
        const hypeBalance = await provider.getBalance(walletAddress);
        console.log(`💰 HYPE: ${ethers.utils.formatEther(hypeBalance)} HYPE`);
        
        if (hypeBalance.lt(ethers.utils.parseEther("0.1"))) {
            console.log("⚠️  HYPEが不足しています（最低0.1 HYPE必要）");
            console.log("🚰 フォーセット: https://faucet.hyperliquid-testnet.xyz");
        }
    } catch (error) {
        console.error("❌ HYPE残高取得エラー:", error.message);
    }
    
    console.log("");
    
    // ERC20トークン残高確認
    const tokens = loadTokenConfig();
    
    for (const [symbol, tokenInfo] of Object.entries(tokens)) {
        try {
            const tokenContract = new ethers.Contract(tokenInfo.address, erc20ABI, provider);
            const balance = await tokenContract.balanceOf(walletAddress);
            const formattedBalance = ethers.utils.formatUnits(balance, tokenInfo.decimals);
            
            if (balance.gt(0)) {
                console.log(`✅ ${symbol}: ${formattedBalance} ${symbol}`);
            } else {
                console.log(`⚪ ${symbol}: 0 ${symbol}`);
            }
        } catch (error) {
            console.log(`❌ ${symbol}: 残高取得エラー`);
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes("--help") || args.includes("-h")) {
        console.log("使用方法:");
        console.log("  node check-testnet-balances.js [wallet_address]");
        console.log("  node check-testnet-balances.js  # PRIVATE_KEYから自動取得");
        console.log("\n例:");
        console.log("  node check-testnet-balances.js 0x1234567890123456789012345678901234567890");
        return;
    }
    
    let walletAddress;
    
    // ウォレットアドレス取得
    if (args.length > 0) {
        walletAddress = args[0];
        if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
            console.error("❌ 無効なウォレットアドレスです:", walletAddress);
            process.exit(1);
        }
    } else if (process.env.TESTNET_WALLET_ADDRESS) {
        walletAddress = process.env.TESTNET_WALLET_ADDRESS;
        console.log("📋 環境変数のTESTNET_WALLET_ADDRESSを使用");
        if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
            console.error("❌ TESTNET_WALLET_ADDRESSが無効です:", walletAddress);
            process.exit(1);
        }
    } else if (process.env.PRIVATE_KEY) {
        try {
            const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
            walletAddress = wallet.address;
            console.log("📋 環境変数のPRIVATE_KEYからウォレットアドレスを取得");
        } catch (error) {
            console.error("❌ PRIVATE_KEYが無効です:", error.message);
            process.exit(1);
        }
    } else {
        console.error("❌ ウォレットアドレス、TESTNET_WALLET_ADDRESS、またはPRIVATE_KEYが必要です");
        console.log("使用方法: node check-testnet-balances.js --help");
        process.exit(1);
    }
    
    await checkBalances(walletAddress);
    
    console.log("\n🎯 次のステップ:");
    console.log("1. HYPEが不足している場合: https://faucet.hyperliquid-testnet.xyz");
    console.log("2. ERC20トークンが不足している場合: DEXまたはフォーセットで取得");
    console.log("3. 残高がある場合: v2-swap-testnet.js または v3-swap-testnet.js でスワップテスト");
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { checkBalances };