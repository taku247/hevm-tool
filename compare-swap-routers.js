const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

const SWAP_ROUTER_01 = "0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990";
const SWAP_ROUTER_02 = "0x51c5958FFb3e326F8d7AA945948159f1FF27e14A";

// 現在のSwapRouter ABI
const swapRouterABI = require('./abi/HyperSwapV3SwapRouter02.json');

async function compareSwapRouters() {
    console.log("🔍 SwapRouter01 vs SwapRouter02 比較分析\n");
    
    try {
        // バイトコードサイズ比較
        console.log("📊 バイトコードサイズ比較:");
        const [bytecode01, bytecode02] = await Promise.all([
            provider.getCode(SWAP_ROUTER_01),
            provider.getCode(SWAP_ROUTER_02)
        ]);
        
        console.log(`   SwapRouter01: ${bytecode01.length / 2 - 1} bytes`);
        console.log(`   SwapRouter02: ${bytecode02.length / 2 - 1} bytes`);
        console.log(`   同一バイトコード: ${bytecode01 === bytecode02 ? "✅ Yes" : "❌ No"}\n`);
        
        // 関数セレクター抽出・比較
        const selectors01 = extractFunctionSelectors(bytecode01);
        const selectors02 = extractFunctionSelectors(bytecode02);
        
        console.log("🔧 関数セレクター比較:");
        console.log(`   SwapRouter01: ${selectors01.length}個の関数`);
        console.log(`   SwapRouter02: ${selectors02.length}個の関数\n`);
        
        // 共通関数
        const commonSelectors = selectors01.filter(s => selectors02.includes(s));
        console.log(`📋 共通関数: ${commonSelectors.length}個`);
        
        // Router01のみ
        const only01 = selectors01.filter(s => !selectors02.includes(s));
        if (only01.length > 0) {
            console.log(`\n🟦 SwapRouter01のみの関数: ${only01.length}個`);
            only01.slice(0, 10).forEach(s => console.log(`   ${s}`));
            if (only01.length > 10) console.log(`   ... (他${only01.length - 10}個)`);
        }
        
        // Router02のみ
        const only02 = selectors02.filter(s => !selectors01.includes(s));
        if (only02.length > 0) {
            console.log(`\n🟨 SwapRouter02のみの関数: ${only02.length}個`);
            only02.slice(0, 10).forEach(s => console.log(`   ${s}`));
            if (only02.length > 10) console.log(`   ... (他${only02.length - 10}個)`);
        }
        
        // 既知の重要関数の存在確認
        console.log("\n🧪 重要関数の存在確認:");
        const importantFunctions = {
            "0x414bf389": "exactInputSingle(tuple)",
            "0xdb3e2198": "exactOutputSingle(tuple)", 
            "0xc04b8d59": "exactInput(tuple)",
            "0xf28c0498": "exactOutput(tuple)",
            "0xc45a0155": "factory()",
            "0x1f00ca74": "WETH9()"
        };
        
        for (const [selector, signature] of Object.entries(importantFunctions)) {
            const in01 = selectors01.includes(selector);
            const in02 = selectors02.includes(selector);
            console.log(`   ${signature}:`);
            console.log(`     Router01: ${in01 ? "✅" : "❌"}  Router02: ${in02 ? "✅" : "❌"}`);
        }
        
        // 現在のABIとの互換性テスト
        console.log("\n🧪 現在のABIとの互換性テスト:");
        
        for (const routerAddr of [SWAP_ROUTER_01, SWAP_ROUTER_02]) {
            const routerName = routerAddr === SWAP_ROUTER_01 ? "SwapRouter01" : "SwapRouter02";
            console.log(`\n   ${routerName} (${routerAddr}):`);
            
            const router = new ethers.Contract(routerAddr, swapRouterABI, provider);
            
            // 基本関数テスト
            const testFunctions = ['factory', 'WETH9'];
            
            for (const funcName of testFunctions) {
                try {
                    const result = await router[funcName]();
                    console.log(`     ${funcName}(): ${result} ✅`);
                } catch (error) {
                    console.log(`     ${funcName}(): ❌ ${error.message.substring(0, 50)}...`);
                }
            }
        }
        
        // 結論
        console.log("\n📋 分析結論:");
        if (bytecode01 === bytecode02) {
            console.log("   ✅ 同一コントラクト: 単一ABIで対応可能");
        } else {
            console.log("   ⚠️  異なるコントラクト: 個別ABI検討が必要");
        }
        
        if (only01.length === 0 && only02.length === 0) {
            console.log("   ✅ 関数セット同一: HyperSwapV3Router.jsonで両方対応可能");
        } else {
            console.log("   ⚠️  関数差異あり: 個別ABI作成を推奨");
            if (only01.length > 0) {
                console.log(`     - SwapRouter01用ABI: +${only01.length}個の追加関数`);
            }
            if (only02.length > 0) {
                console.log(`     - SwapRouter02用ABI: +${only02.length}個の追加関数`);
            }
        }
        
    } catch (error) {
        console.error("❌ 比較エラー:", error.message);
    }
}

function extractFunctionSelectors(bytecode) {
    const selectors = [];
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
    compareSwapRouters().catch(console.error);
}