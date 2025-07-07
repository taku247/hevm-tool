const { ethers } = require('ethers');
const { SafeSwapHelper } = require('./utils/safe-swap-helper');
require('dotenv').config();

async function demonstrateSafeSwap() {
    console.log("🛡️ Safe Swap Demonstration\n");
    
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEY not found in environment");
        return;
    }
    
    const provider = new ethers.providers.JsonRpcProvider("https://rpc.hyperliquid-testnet.xyz/evm");
    const safeSwapper = new SafeSwapHelper(provider, process.env.PRIVATE_KEY);
    
    console.log(`Wallet: ${safeSwapper.wallet.address}\n`);
    
    // Test 1: Emergency validation
    console.log("🚨 Test 1: Emergency Validation");
    const testParams = {
        tokenIn: "0xADcb2f358Eae6492F61A5f87eb8893d09391d160", // WETH
        tokenOut: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82", // PURR
        fee: 3000,
        recipient: safeSwapper.wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 1800,
        amountIn: "1000000000000000000", // 1 WETH
        amountOutMinimum: "0",
        sqrtPriceLimitX96: 0
    };
    
    const emergencyResult = await safeSwapper.emergencyValidation(testParams);
    if (emergencyResult.safe) {
        console.log("   ✅ Emergency validation passed");
    } else {
        console.log("   ❌ Emergency validation failed:");
        emergencyResult.issues.forEach(issue => console.log(`     - ${issue}`));
    }
    
    // Test 2: Create minimal safe parameters
    console.log("\n🔧 Test 2: Create Minimal Safe Parameters");
    const minimalParams = safeSwapper.createMinimalSafeParams(
        "0xADcb2f358Eae6492F61A5f87eb8893d09391d160", // WETH
        "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82", // PURR
        "0.001" // 0.001 WETH
    );
    console.log("   ✅ Minimal parameters created:");
    console.log(`     Token In: ${minimalParams.tokenIn}`);
    console.log(`     Token Out: ${minimalParams.tokenOut}`);
    console.log(`     Amount: ${minimalParams.amountIn} wei`);
    console.log(`     Deadline: ${new Date(minimalParams.deadline * 1000).toISOString()}`);
    
    // Test 3: Add slippage protection
    console.log("\n🎯 Test 3: Add Slippage Protection");
    try {
        const paramsWithSlippage = await safeSwapper.addSlippageProtection(minimalParams, 0.5);
        console.log("   ✅ Slippage protection added:");
        console.log(`     Minimum Output: ${paramsWithSlippage.amountOutMinimum} wei`);
    } catch (error) {
        console.log(`   ❌ Failed to add slippage protection: ${error.message}`);
    }
    
    // Test 4: Full safe swap (if emergency validation passes)
    if (emergencyResult.safe) {
        console.log("\n🚀 Test 4: Full Safe Swap Execution");
        console.log("   ⚠️  This will execute a real swap transaction!");
        console.log("   💰 Make sure you have sufficient WETH balance");
        
        // Uncomment to actually execute swap
        /*
        try {
            const swapResult = await safeSwapper.safeV3Swap(minimalParams);
            if (swapResult.success) {
                console.log("   ✅ Safe swap completed successfully!");
                console.log(`     Transaction: ${swapResult.transaction.hash}`);
            } else {
                console.log(`   ❌ Safe swap failed: ${swapResult.error}`);
            }
        } catch (error) {
            console.log(`   ❌ Unexpected error: ${error.message}`);
        }
        */
        
        console.log("   ℹ️  Uncomment the swap execution code to test actual trading");
    } else {
        console.log("\n⏭️  Skipping full swap test due to validation failures");
    }
    
    console.log("\n📋 Safe Swap Demonstration Complete");
    console.log("💡 This system prevents common swap errors automatically:");
    console.log("   - Expired deadlines");
    console.log("   - Invalid addresses");
    console.log("   - Insufficient balances");
    console.log("   - Missing approvals");
    console.log("   - Non-existent pools");
    console.log("   - Failed quote checks");
}

// Also create a simple test runner
async function runTests() {
    console.log("🧪 Running Safe Swap Tests\n");
    
    // ethers already imported at top
    
    try {
        await demonstrateSafeSwap();
    } catch (error) {
        console.error("❌ Test execution failed:", error.message);
    }
}

if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { demonstrateSafeSwap };