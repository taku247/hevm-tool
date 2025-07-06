const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

// V2 Factory and Pair ABI
const factoryABI = [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

const pairABI = [
    "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function totalSupply() external view returns (uint256)"
];

const FACTORY_ADDRESS = "0xA028411927E2015A363014881a4404C636218fb1";
const WETH_ADDRESS = "0xADcb2f358Eae6492F61A5f87eb8893d09391d160";
const PURR_ADDRESS = "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82";
const HSPX_ADDRESS = "0xD8c23394e2d55AA6dB9E5bb1305df54A1F83D122";

async function checkPoolLiquidity() {
    console.log("🔍 実際のプール流動性確認\n");
    
    const factory = new ethers.Contract(FACTORY_ADDRESS, factoryABI, provider);
    
    const pairs = [
        { name: "WETH/PURR", tokenA: WETH_ADDRESS.toLowerCase(), tokenB: PURR_ADDRESS.toLowerCase() },
        { name: "WETH/HSPX", tokenA: WETH_ADDRESS.toLowerCase(), tokenB: HSPX_ADDRESS.toLowerCase() },
        { name: "PURR/HSPX", tokenA: PURR_ADDRESS.toLowerCase(), tokenB: HSPX_ADDRESS.toLowerCase() }
    ];
    
    for (const pairInfo of pairs) {
        console.log(`\n📊 ${pairInfo.name} ペア:`);
        
        try {
            // プールアドレス取得
            const pairAddress = await factory.getPair(pairInfo.tokenA, pairInfo.tokenB);
            
            if (pairAddress === "0x0000000000000000000000000000000000000000") {
                console.log("   ❌ プールが存在しません");
                continue;
            }
            
            console.log(`   ペアアドレス: ${pairAddress}`);
            
            // プール詳細確認
            const pair = new ethers.Contract(pairAddress, pairABI, provider);
            
            const [reserves, token0, token1, totalSupply] = await Promise.all([
                pair.getReserves(),
                pair.token0(),
                pair.token1(),
                pair.totalSupply()
            ]);
            
            console.log(`   Token0: ${token0}`);
            console.log(`   Token1: ${token1}`);
            console.log(`   Reserve0: ${ethers.utils.formatEther(reserves.reserve0)}`);
            console.log(`   Reserve1: ${ethers.utils.formatEther(reserves.reserve1)}`);
            console.log(`   Total Supply: ${ethers.utils.formatEther(totalSupply)}`);
            
            // 流動性の有無判定
            if (reserves.reserve0.eq(0) || reserves.reserve1.eq(0)) {
                console.log("   ⚠️  流動性がありません！");
            } else {
                console.log("   ✅ 流動性が存在します");
            }
            
        } catch (error) {
            console.log(`   ❌ エラー: ${error.message}`);
        }
    }
    
    // Routerの状態確認
    console.log("\n🔧 Router状態確認:");
    
    const routerAddress = "0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853";
    try {
        const code = await provider.getCode(routerAddress);
        if (code === "0x") {
            console.log("   ❌ Routerコントラクトが存在しません");
        } else {
            console.log(`   ✅ Routerコントラクト存在: ${code.length / 2 - 1} bytes`);
        }
        
        // Factoryアドレス確認
        const routerABI = ["function factory() external pure returns (address)"];
        const router = new ethers.Contract(routerAddress, routerABI, provider);
        const factoryFromRouter = await router.factory();
        
        console.log(`   Router内Factory: ${factoryFromRouter}`);
        console.log(`   設定Factory: ${FACTORY_ADDRESS}`);
        
        if (factoryFromRouter.toLowerCase() === FACTORY_ADDRESS.toLowerCase()) {
            console.log("   ✅ Factory アドレス一致");
        } else {
            console.log("   ❌ Factory アドレス不一致");
        }
        
    } catch (error) {
        console.log(`   ❌ Router確認エラー: ${error.message}`);
    }
}

if (require.main === module) {
    checkPoolLiquidity().catch(console.error);
}