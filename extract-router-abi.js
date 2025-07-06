const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

const ROUTER_ADDRESS = "0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853";

async function extractRouterABI() {
    console.log("🔍 HyperSwap Router ABI抽出\n");
    
    try {
        // バイトコード取得
        const bytecode = await provider.getCode(ROUTER_ADDRESS);
        console.log(`バイトコードサイズ: ${bytecode.length / 2 - 1} bytes\n`);
        
        // 関数セレクター抽出
        const functionSelectors = extractFunctionSelectors(bytecode);
        console.log("📋 検出された関数セレクター:");
        
        // 既知の関数セレクターと照合
        const knownFunctions = {
            "0x38ed1739": "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
            "0xd06ca61f": "getAmountsOut(uint256,address[])",
            "0x1f00ca74": "getAmountsIn(uint256,address[])",
            "0xc45a0155": "factory()",
            "0xad5c4648": "WETH()",
            "0x85f8c259": "quote(uint256,uint256,uint256)",
            "0x2195995c": "addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)",
            "0xf305d719": "addLiquidityETH(address,uint256,uint256,uint256,address,uint256)",
            "0xbaa2abde": "removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)",
            "0x02751cec": "removeLiquidityETH(address,uint256,uint256,uint256,address,uint256)",
            "0x8803dbee": "swapTokensForExactTokens(uint256,uint256,address[],address,uint256)",
            "0x7ff36ab5": "swapExactETHForTokens(uint256,address[],address,uint256)",
            "0x18cbafe5": "swapTokensForExactETH(uint256,uint256,address[],address,uint256)",
            "0x4a25d94a": "swapExactTokensForETH(uint256,uint256,address[],address,uint256)",
            "0xfb3bdb41": "swapETHForExactTokens(uint256,address[],address,uint256)"
        };
        
        let matchedFunctions = [];
        let unknownSelectors = [];
        
        for (const selector of functionSelectors) {
            if (knownFunctions[selector]) {
                matchedFunctions.push({
                    selector,
                    signature: knownFunctions[selector]
                });
            } else {
                unknownSelectors.push(selector);
            }
        }
        
        console.log("\n✅ 確認済み関数:");
        for (const func of matchedFunctions) {
            console.log(`   ${func.selector}: ${func.signature}`);
        }
        
        console.log("\n❓ 未知の関数セレクター:");
        for (const selector of unknownSelectors) {
            console.log(`   ${selector}: [未知]`);
        }
        
        // 重要な関数の存在確認
        console.log("\n🔧 重要な関数の存在確認:");
        const criticalFunctions = [
            "0x38ed1739", // swapExactTokensForTokens
            "0xd06ca61f", // getAmountsOut
            "0xc45a0155", // factory
            "0xad5c4648"  // WETH
        ];
        
        for (const selector of criticalFunctions) {
            const exists = functionSelectors.includes(selector);
            const funcName = knownFunctions[selector] || "未知の関数";
            console.log(`   ${selector} (${funcName}): ${exists ? "✅ 存在" : "❌ 不在"}`);
        }
        
        // 実際の関数呼び出しテスト
        console.log("\n🧪 実際の関数呼び出しテスト:");
        
        const routerABI = [
            "function factory() external view returns (address)",
            "function WETH() external view returns (address)",
            "function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)"
        ];
        
        const router = new ethers.Contract(ROUTER_ADDRESS, routerABI, provider);
        
        try {
            const factory = await router.factory();
            console.log(`   factory(): ${factory} ✅`);
        } catch (error) {
            console.log(`   factory(): ❌ ${error.message.substring(0, 50)}`);
        }
        
        try {
            const weth = await router.WETH();
            console.log(`   WETH(): ${weth} ✅`);
        } catch (error) {
            console.log(`   WETH(): ❌ ${error.message.substring(0, 50)}`);
        }
        
        try {
            const testAmounts = await router.getAmountsOut(
                ethers.utils.parseEther("1"),
                ["0xadcb2f358eae6492f61a5f87eb8893d09391d160", "0xc003d79b8a489703b1753711e3ae9ffdfc8d1a82"]
            );
            console.log(`   getAmountsOut(): ${ethers.utils.formatEther(testAmounts[1])} PURR ✅`);
        } catch (error) {
            console.log(`   getAmountsOut(): ❌ ${error.message.substring(0, 50)}`);
        }
        
    } catch (error) {
        console.error("❌ エラー:", error.message);
    }
}

function extractFunctionSelectors(bytecode) {
    const selectors = [];
    
    // 4byte関数セレクターのパターンを検索
    const selectorPattern = /63([0-9a-f]{8})/gi;
    let match;
    
    while ((match = selectorPattern.exec(bytecode)) !== null) {
        const selector = "0x" + match[1];
        if (!selectors.includes(selector)) {
            selectors.push(selector);
        }
    }
    
    return selectors.sort();
}

if (require.main === module) {
    extractRouterABI().catch(console.error);
}