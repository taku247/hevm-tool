const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

const ROUTER_ADDRESS = "0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853";

async function findHyperSwapFunctions() {
    console.log("🔍 HyperSwap固有の関数発見\n");
    
    // 未知の関数セレクターを既知のパターンと照合
    const unknownSelectors = [
        "0x014881a4", "0x0902f1ac", "0x21f3f647", "0x226bf2d1",
        "0x23b872dd", "0x24c69627", "0x25760008", "0x2e1a7d4d",
        "0x358b8166", "0x3610bbc7", "0x43000606", "0x52aa4c22",
        "0x57600080", "0x5b0d5984", "0x6174696f", "0x6218fb18",
        "0x6218fb19", "0x64e329cb", "0x6a627842", "0x6e1fdd7f",
        "0x70a08231", "0x74696f6e", "0x89afcb44", "0x8e4c9b59",
        "0xa9059cbb", "0xac3893ba", "0xad615dec", "0xaf2979eb",
        "0xb4822be3", "0xc9c65396", "0xd0e30db0", "0xd505accf",
        "0xded9382a", "0xe6a43905", "0xe8e33700", "0xf140a35a"
    ];
    
    // 既知のERC20関数セレクターを除外
    const erc20Selectors = [
        "0x70a08231", // balanceOf
        "0xa9059cbb", // transfer
        "0x23b872dd", // transferFrom
        "0xd505accf", // permit
        "0xd0e30db0", // deposit (WETH)
        "0x2e1a7d4d"  // withdraw (WETH)
    ];
    
    // 可能性のあるスワップ関数セレクターを推測
    const possibleSwapFunctions = [
        "0x89afcb44", // よく見られるパターン
        "0xc9c65396", // 別のパターン
        "0xf140a35a", // 別のパターン
        "0xe6a43905", // 別のパターン
        "0x226bf2d1", // 別のパターン
        "0x358b8166", // 別のパターン
        "0xac3893ba", // 別のパターン
        "0xaf2979eb", // 別のパターン
        "0xb4822be3", // 別のパターン
        "0xded9382a", // 別のパターン
        "0xe8e33700"  // 別のパターン
    ];
    
    console.log("🧪 可能性のあるスワップ関数のテスト:\n");
    
    // 標準的なスワップ関数のシグネチャパターンをテスト
    const testSignatures = [
        "function swap(uint256,uint256,address[],address,uint256) external returns (uint256[])",
        "function swapTokens(uint256,uint256,address[],address,uint256) external returns (uint256[])",
        "function executeSwap(uint256,uint256,address[],address,uint256) external returns (uint256[])",
        "function swapExact(uint256,uint256,address[],address,uint256) external returns (uint256[])",
        "function trade(uint256,uint256,address[],address,uint256) external returns (uint256[])",
        "function exchange(uint256,uint256,address[],address,uint256) external returns (uint256[])",
        "function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) external returns (uint256[])",
        "function swapExactTokensForTokensSimple(uint256,uint256,address[],address,uint256) external returns (uint256[])"
    ];
    
    const testAmountIn = ethers.utils.parseEther("0.001");
    const testAmountOutMin = ethers.utils.parseEther("0.1");
    const testPath = ["0xadcb2f358eae6492f61a5f87eb8893d09391d160", "0xc003d79b8a489703b1753711e3ae9ffdfc8d1a82"];
    const testTo = "0x1234567890123456789012345678901234567890"; // ダミーアドレス
    const testDeadline = Math.floor(Date.now() / 1000) + 1800;
    
    for (const signature of testSignatures) {
        console.log(`テスト中: ${signature}`);
        
        try {
            const iface = new ethers.utils.Interface([signature]);
            const contract = new ethers.Contract(ROUTER_ADDRESS, [signature], provider);
            
            // 関数名を取得
            const funcName = signature.split('(')[0].split(' ')[1];
            
            // estimateGasでテスト
            const estimateGas = await contract.estimateGas[funcName](
                testAmountIn,
                testAmountOutMin,
                testPath,
                testTo,
                testDeadline
            );
            
            console.log(`   ✅ 成功! 推定ガス: ${estimateGas.toString()}`);
            
            // 実際の関数セレクターを計算
            const selector = ethers.utils.id(signature.split(' ')[1]).substring(0, 10);
            console.log(`   関数セレクター: ${selector}`);
            
            return { signature, selector, funcName };
            
        } catch (error) {
            console.log(`   ❌ 失敗: ${error.message.substring(0, 50)}...`);
        }
    }
    
    // 手動でselectors.ethereum.orgから調べた可能性
    console.log("\n🔍 手動調査 - 既知のセレクターパターン:");
    
    const knownAlternatives = {
        "0x89afcb44": "swapTokensForExactTokens(uint256,uint256,address[],address,uint256)",
        "0xc9c65396": "swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)",
        "0xf140a35a": "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
        "0xe6a43905": "swapExactTokensForTokensSimple(uint256,uint256,address[],address,uint256)",
        "0x226bf2d1": "swapTokens(uint256,uint256,address[],address,uint256)",
        "0x358b8166": "swap(uint256,uint256,address[],address,uint256)"
    };
    
    for (const [selector, signature] of Object.entries(knownAlternatives)) {
        if (unknownSelectors.includes(selector)) {
            console.log(`\n🎯 可能性: ${selector} - ${signature}`);
            
            try {
                const contract = new ethers.Contract(ROUTER_ADDRESS, [
                    `function ${signature} external returns (uint256[])`
                ], provider);
                
                const funcName = signature.split('(')[0];
                const estimateGas = await contract.estimateGas[funcName](
                    testAmountIn,
                    testAmountOutMin,
                    testPath,
                    testTo,
                    testDeadline
                );
                
                console.log(`   ✅ 成功! これがスワップ関数: ${signature}`);
                console.log(`   推定ガス: ${estimateGas.toString()}`);
                
                return { signature: `function ${signature} external returns (uint256[])`, selector, funcName };
                
            } catch (error) {
                console.log(`   ❌ 失敗: ${error.message.substring(0, 50)}...`);
            }
        }
    }
    
    console.log("\n❌ HyperSwap固有のスワップ関数が見つかりませんでした");
    console.log("💡 HyperSwapは独自の実装を使用している可能性があります");
    
    return null;
}

if (require.main === module) {
    findHyperSwapFunctions().catch(console.error);
}