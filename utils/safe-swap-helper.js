const { ethers } = require('ethers');
const { SwapValidator } = require('./swap-validator');
const { PreSwapChecker } = require('./pre-swap-checker');

class SafeSwapHelper {
    constructor(provider, privateKey) {
        this.provider = provider;
        this.wallet = new ethers.Wallet(privateKey, provider);
        this.validator = new SwapValidator(provider);
        
        // HyperSwap testnet addresses
        this.addresses = {
            factory: "0x03A918028f22D9E1473B7959C927AD7425A45C7C",
            quoterV2: "0x7FEd8993828A61A5985F384Cee8bDD42177Aa263",
            swapRouter01: "0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990",
            swapRouter02: "0x51c5958FFb3e326F8d7AA945948159f1FF27e14A"
        };
        
        this.checker = new PreSwapChecker(
            provider,
            this.addresses.factory,
            this.addresses.quoterV2
        );
        
        // Load ABIs
        this.swapRouter01ABI = require('../abi/HyperSwapV3SwapRouter01.json');
        this.erc20ABI = require('../examples/sample-abi/ERC20.json');
    }

    /**
     * Safe V3 swap with comprehensive validation
     */
    async safeV3Swap(userParams) {
        console.log("🛡️ Safe V3 Swap Started\n");
        
        try {
            // Step 1: Parameter validation and normalization
            console.log("1️⃣ Validating parameters...");
            const safeParams = this.validator.createSafeSwapParams(userParams, 'v3');
            console.log("   ✅ Parameters validated and normalized\n");
            
            // Step 2: Pre-swap checks
            console.log("2️⃣ Performing pre-swap checks...");
            const checkResult = await this.checker.performComprehensiveCheck(
                safeParams,
                this.wallet.address,
                this.addresses.swapRouter01
            );
            
            if (!checkResult.summary.allPassed) {
                throw new Error(`Pre-swap checks failed: ${checkResult.summary.criticalIssues.join(', ')}`);
            }
            console.log("   ✅ All pre-swap checks passed\n");
            
            // Step 3: Handle approval if needed
            if (checkResult.checks.allowance.needsApproval) {
                console.log("3️⃣ Handling token approval...");
                await this.handleApproval(safeParams.tokenIn, safeParams.amountIn);
                console.log("   ✅ Token approval completed\n");
            } else {
                console.log("3️⃣ Token approval not needed\n");
            }
            
            // Step 4: callStatic test
            console.log("4️⃣ Testing swap with callStatic...");
            const staticResult = await this.testSwapStatic(safeParams);
            console.log(`   ✅ callStatic successful: ${staticResult.formattedOutput}\n`);
            
            // Step 5: Execute actual swap
            console.log("5️⃣ Executing actual swap...");
            const swapResult = await this.executeV3Swap(safeParams);
            console.log(`   ✅ Swap successful: ${swapResult.hash}\n`);
            
            // Step 6: Verify result
            console.log("6️⃣ Verifying swap result...");
            const verification = await this.verifySwapResult(swapResult, safeParams);
            console.log("   ✅ Swap result verified\n");
            
            return {
                success: true,
                transaction: swapResult,
                verification,
                preChecks: checkResult
            };
            
        } catch (error) {
            console.error(`❌ Safe swap failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                stack: error.stack
            };
        }
    }

    /**
     * Handle ERC20 token approval
     */
    async handleApproval(tokenAddress, amount) {
        const token = new ethers.Contract(tokenAddress, this.erc20ABI, this.wallet);
        
        // Check current allowance
        const currentAllowance = await token.allowance(this.wallet.address, this.addresses.swapRouter01);
        const requiredAmount = ethers.BigNumber.from(amount);
        
        if (currentAllowance.gte(requiredAmount)) {
            console.log("   ℹ️  Sufficient allowance already exists");
            return;
        }
        
        // Approve the exact amount needed
        console.log(`   📝 Approving ${ethers.utils.formatEther(amount)} tokens...`);
        const approveTx = await token.approve(this.addresses.swapRouter01, requiredAmount);
        const approveReceipt = await approveTx.wait();
        
        if (approveReceipt.status !== 1) {
            throw new Error("Token approval failed");
        }
        
        console.log(`   ✅ Approval confirmed in block ${approveReceipt.blockNumber}`);
    }

    /**
     * Test swap with callStatic
     */
    async testSwapStatic(params) {
        const router = new ethers.Contract(this.addresses.swapRouter01, this.swapRouter01ABI, this.wallet);
        
        const result = await router.callStatic.exactInputSingle(params);
        
        // Format output for display
        const tokenOut = new ethers.Contract(params.tokenOut, this.erc20ABI, this.provider);
        const outDecimals = await tokenOut.decimals();
        const outSymbol = await tokenOut.symbol();
        
        return {
            amountOut: result.toString(),
            formattedOutput: `${ethers.utils.formatUnits(result, outDecimals)} ${outSymbol}`
        };
    }

    /**
     * Execute V3 swap
     */
    async executeV3Swap(params) {
        const router = new ethers.Contract(this.addresses.swapRouter01, this.swapRouter01ABI, this.wallet);
        
        // Estimate gas
        const gasEstimate = await router.estimateGas.exactInputSingle(params);
        const gasLimit = gasEstimate.mul(120).div(100); // 20% buffer
        
        // Get current gas price
        const gasPrice = await this.provider.getGasPrice();
        const adjustedGasPrice = gasPrice.mul(110).div(100); // 10% premium
        
        console.log(`   ⛽ Gas limit: ${gasLimit.toString()}`);
        console.log(`   ⛽ Gas price: ${ethers.utils.formatUnits(adjustedGasPrice, 'gwei')} gwei`);
        
        // Execute swap
        const tx = await router.exactInputSingle(params, {
            gasLimit,
            gasPrice: adjustedGasPrice
        });
        
        console.log(`   📤 Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        
        if (receipt.status !== 1) {
            throw new Error(`Swap transaction failed: ${tx.hash}`);
        }
        
        return {
            hash: tx.hash,
            receipt,
            gasUsed: receipt.gasUsed.toString(),
            blockNumber: receipt.blockNumber
        };
    }

    /**
     * Verify swap result by checking balances
     */
    async verifySwapResult(swapResult, params) {
        const tokenIn = new ethers.Contract(params.tokenIn, this.erc20ABI, this.provider);
        const tokenOut = new ethers.Contract(params.tokenOut, this.erc20ABI, this.provider);
        
        const [inBalance, outBalance, inSymbol, outSymbol, inDecimals, outDecimals] = await Promise.all([
            tokenIn.balanceOf(this.wallet.address),
            tokenOut.balanceOf(this.wallet.address),
            tokenIn.symbol(),
            tokenOut.symbol(),
            tokenIn.decimals(),
            tokenOut.decimals()
        ]);
        
        return {
            balances: {
                tokenIn: {
                    balance: inBalance.toString(),
                    formatted: `${ethers.utils.formatUnits(inBalance, inDecimals)} ${inSymbol}`
                },
                tokenOut: {
                    balance: outBalance.toString(),
                    formatted: `${ethers.utils.formatUnits(outBalance, outDecimals)} ${outSymbol}`
                }
            },
            transaction: {
                hash: swapResult.hash,
                gasUsed: swapResult.gasUsed,
                blockNumber: swapResult.blockNumber
            }
        };
    }

    /**
     * Emergency validation - quick check before any swap
     */
    async emergencyValidation(userParams) {
        try {
            // Basic parameter validation
            const validation = this.validator.validateV3SwapParams(userParams);
            if (!validation.isValid) {
                return {
                    safe: false,
                    issues: validation.errors
                };
            }
            
            // Quick pre-swap check
            const quickCheck = await this.checker.quickValidation(
                validation.normalizedParams,
                this.wallet.address,
                this.addresses.swapRouter01
            );
            
            return {
                safe: quickCheck.isValid,
                issues: quickCheck.issues
            };
            
        } catch (error) {
            return {
                safe: false,
                issues: [`Emergency validation failed: ${error.message}`]
            };
        }
    }

    /**
     * Create safe swap parameters from minimal user input
     */
    createMinimalSafeParams(tokenIn, tokenOut, amountIn, slippagePercent = 0.5) {
        return {
            tokenIn: tokenIn.toLowerCase(),
            tokenOut: tokenOut.toLowerCase(),
            fee: 3000, // Default to 0.3%
            recipient: this.wallet.address,
            deadline: this.validator.generateDeadline(),
            amountIn: ethers.utils.parseEther(amountIn.toString()).toString(),
            amountOutMinimum: "0", // Will be calculated from quote
            sqrtPriceLimitX96: 0
        };
    }

    /**
     * Auto-calculate slippage protection
     */
    async addSlippageProtection(params, slippagePercent = 0.5) {
        // Get quote to calculate minimum output
        const quoteResult = await this.checker.getQuote(
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            params.fee
        );
        
        if (!quoteResult.success) {
            throw new Error(`Failed to get quote for slippage calculation: ${quoteResult.error}`);
        }
        
        // Calculate minimum output with slippage protection
        const amountOut = ethers.BigNumber.from(quoteResult.amountOut);
        const slippageBasisPoints = Math.floor(slippagePercent * 100); // Convert to basis points
        const amountOutMinimum = amountOut.mul(10000 - slippageBasisPoints).div(10000);
        
        return {
            ...params,
            amountOutMinimum: amountOutMinimum.toString()
        };
    }
}

module.exports = { SafeSwapHelper };