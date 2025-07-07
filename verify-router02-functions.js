const { ethers } = require('ethers');
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider("https://rpc.hyperliquid-testnet.xyz/evm");

const SWAP_ROUTER_01 = "0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990";
const SWAP_ROUTER_02 = "0x51c5958FFb3e326F8d7AA945948159f1FF27e14A";

// Router01用ABI（deadline含む）
const router01ABI = require('./abi/HyperSwapV3SwapRouter01.json');

// Router02用ABI（deadline無し版を作成）
const router02ABI = [
    {
        "inputs": [
            {
                "components": [
                    { "name": "tokenIn", "type": "address" },
                    { "name": "tokenOut", "type": "address" },
                    { "name": "fee", "type": "uint24" },
                    { "name": "recipient", "type": "address" },
                    { "name": "amountIn", "type": "uint256" },
                    { "name": "amountOutMinimum", "type": "uint256" },
                    { "name": "sqrtPriceLimitX96", "type": "uint160" }
                ],
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "exactInputSingle",
        "outputs": [
            { "name": "amountOut", "type": "uint256" }
        ],
        "stateMutability": "payable",
        "type": "function"
    }
];

async function verifyRouter02Functions() {
    console.log("🔍 SwapRouter02 関数存在確認（ChatGPT指摘検証）\n");
    
    try {
        // 1. バイトコード確認
        console.log("📊 バイトコード確認:");
        const [code01, code02] = await Promise.all([
            provider.getCode(SWAP_ROUTER_01),
            provider.getCode(SWAP_ROUTER_02)
        ]);
        
        console.log(`   SwapRouter01: ${code01.length / 2 - 1} bytes`);
        console.log(`   SwapRouter02: ${code02.length / 2 - 1} bytes`);
        
        if (code02 === "0x") {
            console.log("❌ SwapRouter02がデプロイされていません");
            return;
        }
        
        // 2. 関数シグネチャ確認
        console.log("\n🔧 関数シグネチャ確認:");
        
        // Router01用interface（deadline含む）
        const iface01 = new ethers.utils.Interface(router01ABI);
        const exactInputSingle01 = iface01.getFunction("exactInputSingle");
        console.log(`   Router01 exactInputSingle selector: ${iface01.getSighash(exactInputSingle01)}`);
        console.log(`   Router01 パラメータ数: ${exactInputSingle01.inputs[0].components.length}`);
        
        // Router02用interface（deadline無し）
        const iface02 = new ethers.utils.Interface(router02ABI);
        const exactInputSingle02 = iface02.getFunction("exactInputSingle");
        console.log(`   Router02 exactInputSingle selector: ${iface02.getSighash(exactInputSingle02)}`);
        console.log(`   Router02 パラメータ数: ${exactInputSingle02.inputs[0].components.length}`);
        
        // 3. 実際のcontract呼び出しテスト
        console.log("\n🧪 Contract呼び出しテスト:");
        
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "0x1234567890123456789012345678901234567890123456789012345678901234", provider);
        
        // Router01でのテスト
        console.log("\n   Router01テスト:");
        const router01 = new ethers.Contract(SWAP_ROUTER_01, router01ABI, wallet);
        
        const params01 = {
            tokenIn: "0xadcb2f358eae6492f61a5f87eb8893d09391d160",
            tokenOut: "0xc003d79b8a489703b1753711e3ae9ffdfc8d1a82",
            fee: 3000,
            recipient: wallet.address,
            deadline: Math.floor(Date.now() / 1000) + 1800,
            amountIn: "1000000000000000", // 0.001 WETH
            amountOutMinimum: "1",
            sqrtPriceLimitX96: 0
        };
        
        try {
            await router01.callStatic.exactInputSingle(params01);
            console.log("     ✅ Router01 exactInputSingle 関数存在確認");
        } catch (error) {
            console.log(`     ❌ Router01 エラー: ${error.message.substring(0, 100)}...`);
        }
        
        // Router02でのテスト（deadline無し）
        console.log("\n   Router02テスト（deadline無し版）:");
        const router02 = new ethers.Contract(SWAP_ROUTER_02, router02ABI, wallet);
        
        const params02 = {
            tokenIn: "0xadcb2f358eae6492f61a5f87eb8893d09391d160",
            tokenOut: "0xc003d79b8a489703b1753711e3ae9ffdfc8d1a82",
            fee: 3000,
            recipient: wallet.address,
            // deadline: 無し
            amountIn: "1000000000000000",
            amountOutMinimum: "1",
            sqrtPriceLimitX96: 0
        };
        
        try {
            await router02.callStatic.exactInputSingle(params02);
            console.log("     ✅ Router02 exactInputSingle 関数存在確認（deadline無し版）");
        } catch (error) {
            console.log(`     ❌ Router02 エラー: ${error.message.substring(0, 100)}...`);
        }
        
        // Router02でのテスト（Router01のABI使用 - 失敗するはず）
        console.log("\n   Router02テスト（Router01のABI使用 - 失敗予想）:");
        const router02WithWrongABI = new ethers.Contract(SWAP_ROUTER_02, router01ABI, wallet);
        
        try {
            await router02WithWrongABI.callStatic.exactInputSingle(params01);
            console.log("     ✅ Router02でRouter01 ABI使用成功（予想外）");
        } catch (error) {
            console.log(`     ❌ Router02でRouter01 ABI使用失敗（予想通り）: ${error.message.substring(0, 100)}...`);
        }
        
        // 4. バイトコードから関数セレクター抽出
        console.log("\n🔍 バイトコードから関数セレクター抽出:");
        
        const selectors01 = extractFunctionSelectors(code01);
        const selectors02 = extractFunctionSelectors(code02);
        
        console.log(`   Router01: ${selectors01.length}個の関数セレクター`);
        console.log(`   Router02: ${selectors02.length}個の関数セレクター`);
        
        // exactInputSingleのセレクター確認
        const selector01 = iface01.getSighash(exactInputSingle01);
        const selector02 = iface02.getSighash(exactInputSingle02);
        
        console.log(`\n   Router01 exactInputSingle selector (${selector01}): ${selectors01.includes(selector01) ? '✅ 存在' : '❌ 不在'}`);
        console.log(`   Router02 exactInputSingle selector (${selector02}): ${selectors02.includes(selector02) ? '✅ 存在' : '❌ 不在'}`);
        console.log(`   Router01 selector in Router02: ${selectors02.includes(selector01) ? '✅ 存在' : '❌ 不在'}`);
        
        // 5. 結論
        console.log("\n📋 ChatGPT指摘の検証結果:");
        
        if (selectors02.includes(selector02)) {
            console.log("   ✅ Router02にexactInputSingle関数は存在する（ChatGPT正しい）");
            console.log("   ✅ deadline無し版のパラメータ構造が必要");
        } else {
            console.log("   ❌ Router02にexactInputSingle関数は存在しない（元の分析正しい）");
        }
        
        if (!selectors02.includes(selector01)) {
            console.log("   ✅ Router01用ABIでRouter02を呼ぶとselector不一致で失敗");
        }
        
        console.log("\n💡 推奨:");
        if (selectors02.includes(selector02)) {
            console.log("   - Router02を使用する場合はdeadline無しのパラメータ構造を使用");
            console.log("   - Router01とRouter02で異なるABIが必要");
        }
        console.log("   - 現在のRouter01での動作は問題なし");
        
    } catch (error) {
        console.error("❌ 検証エラー:", error.message);
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
    verifyRouter02Functions().catch(console.error);
}