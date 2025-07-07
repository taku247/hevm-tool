const { ethers } = require('ethers');

class PreSwapChecker {
    constructor(provider, factoryAddress, quoterAddress) {
        this.provider = provider;
        this.factoryAddress = factoryAddress;
        this.quoterAddress = quoterAddress;
        
        // Basic ABIs for checking
        this.erc20ABI = [
            "function balanceOf(address owner) view returns (uint256)",
            "function allowance(address owner, address spender) view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function symbol() view returns (string)"
        ];
        
        this.factoryABI = [
            "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)"
        ];
        
        this.poolABI = [
            "function liquidity() view returns (uint128)"
        ];
        
        this.quoterABI = [
            {
                "inputs": [{
                    "components": [
                        {"name": "tokenIn", "type": "address"},
                        {"name": "tokenOut", "type": "address"},
                        {"name": "amountIn", "type": "uint256"},
                        {"name": "fee", "type": "uint24"},
                        {"name": "sqrtPriceLimitX96", "type": "uint160"}
                    ],
                    "name": "params",
                    "type": "tuple"
                }],
                "name": "quoteExactInputSingle",
                "outputs": [
                    {"name": "amountOut", "type": "uint256"},
                    {"name": "sqrtPriceX96After", "type": "uint160"},
                    {"name": "initializedTicksCrossed", "type": "uint32"},
                    {"name": "gasEstimate", "type": "uint256"}
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ];
    }

    /**
     * Check wallet balance for input token
     */
    async checkBalance(tokenAddress, walletAddress, requiredAmount) {
        try {
            const token = new ethers.Contract(tokenAddress, this.erc20ABI, this.provider);
            const balance = await token.balanceOf(walletAddress);
            const decimals = await token.decimals();
            const symbol = await token.symbol();
            
            const hasBalance = balance.gte(requiredAmount);
            
            return {
                success: true,
                hasBalance,
                balance: balance.toString(),
                required: requiredAmount.toString(),
                decimals,
                symbol,
                balanceFormatted: ethers.utils.formatUnits(balance, decimals),
                requiredFormatted: ethers.utils.formatUnits(requiredAmount, decimals)
            };
        } catch (error) {
            return {
                success: false,
                error: `Balance check failed: ${error.message}`
            };
        }
    }

    /**
     * Check ERC20 allowance for router
     */
    async checkAllowance(tokenAddress, ownerAddress, spenderAddress, requiredAmount) {
        try {
            const token = new ethers.Contract(tokenAddress, this.erc20ABI, this.provider);
            const allowance = await token.allowance(ownerAddress, spenderAddress);
            const decimals = await token.decimals();
            const symbol = await token.symbol();
            
            const hasAllowance = allowance.gte(requiredAmount);
            
            return {
                success: true,
                hasAllowance,
                allowance: allowance.toString(),
                required: requiredAmount.toString(),
                decimals,
                symbol,
                allowanceFormatted: ethers.utils.formatUnits(allowance, decimals),
                requiredFormatted: ethers.utils.formatUnits(requiredAmount, decimals),
                needsApproval: !hasAllowance
            };
        } catch (error) {
            return {
                success: false,
                error: `Allowance check failed: ${error.message}`
            };
        }
    }

    /**
     * Check if V3 pool exists
     */
    async checkPoolExists(tokenA, tokenB, fee) {
        try {
            const factory = new ethers.Contract(this.factoryAddress, this.factoryABI, this.provider);
            const poolAddress = await factory.getPool(tokenA, tokenB, fee);
            
            const poolExists = poolAddress !== ethers.constants.AddressZero;
            
            let liquidityInfo = null;
            if (poolExists) {
                try {
                    const pool = new ethers.Contract(poolAddress, this.poolABI, this.provider);
                    const liquidity = await pool.liquidity();
                    liquidityInfo = {
                        liquidity: liquidity.toString(),
                        hasLiquidity: liquidity.gt(0)
                    };
                } catch (liquidityError) {
                    // Pool exists but can't read liquidity
                    liquidityInfo = {
                        error: `Could not read liquidity: ${liquidityError.message}`
                    };
                }
            }
            
            return {
                success: true,
                poolExists,
                poolAddress,
                fee,
                tokenA,
                tokenB,
                liquidityInfo
            };
        } catch (error) {
            return {
                success: false,
                error: `Pool existence check failed: ${error.message}`
            };
        }
    }

    /**
     * Get quote for V3 swap
     */
    async getQuote(tokenIn, tokenOut, amountIn, fee) {
        try {
            const quoter = new ethers.Contract(this.quoterAddress, this.quoterABI, this.provider);
            
            const result = await quoter.quoteExactInputSingle({
                tokenIn,
                tokenOut,
                amountIn,
                fee,
                sqrtPriceLimitX96: 0
            });
            
            return {
                success: true,
                amountOut: result.amountOut.toString(),
                sqrtPriceX96After: result.sqrtPriceX96After?.toString(),
                initializedTicksCrossed: result.initializedTicksCrossed?.toString(),
                gasEstimate: result.gasEstimate?.toString()
            };
        } catch (error) {
            return {
                success: false,
                error: `Quote failed: ${error.message}`,
                revertData: error.data || null
            };
        }
    }

    /**
     * Check gas price and network congestion
     */
    async checkGasConditions() {
        try {
            const gasPrice = await this.provider.getGasPrice();
            const block = await this.provider.getBlock('latest');
            
            return {
                success: true,
                gasPrice: gasPrice.toString(),
                gasPriceGwei: ethers.utils.formatUnits(gasPrice, 'gwei'),
                blockNumber: block.number,
                gasUsed: block.gasUsed.toString(),
                gasLimit: block.gasLimit.toString(),
                utilization: block.gasUsed.mul(100).div(block.gasLimit).toNumber()
            };
        } catch (error) {
            return {
                success: false,
                error: `Gas condition check failed: ${error.message}`
            };
        }
    }

    /**
     * Comprehensive pre-swap check
     */
    async performComprehensiveCheck(swapParams, walletAddress, routerAddress) {
        const results = {
            timestamp: Date.now(),
            walletAddress,
            routerAddress,
            swapParams,
            checks: {},
            summary: {
                allPassed: false,
                criticalIssues: [],
                warnings: [],
                recommendations: []
            }
        };

        console.log("🔍 Comprehensive Pre-Swap Check Started\n");

        // 1. Balance Check
        console.log("💰 Checking wallet balance...");
        results.checks.balance = await this.checkBalance(
            swapParams.tokenIn,
            walletAddress,
            ethers.BigNumber.from(swapParams.amountIn)
        );
        
        if (!results.checks.balance.success) {
            results.summary.criticalIssues.push("Balance check failed");
        } else if (!results.checks.balance.hasBalance) {
            results.summary.criticalIssues.push("Insufficient token balance");
        } else {
            console.log(`   ✅ Balance: ${results.checks.balance.balanceFormatted} ${results.checks.balance.symbol}`);
        }

        // 2. Allowance Check
        console.log("\n🔐 Checking token allowance...");
        results.checks.allowance = await this.checkAllowance(
            swapParams.tokenIn,
            walletAddress,
            routerAddress,
            ethers.BigNumber.from(swapParams.amountIn)
        );
        
        if (!results.checks.allowance.success) {
            results.summary.criticalIssues.push("Allowance check failed");
        } else if (results.checks.allowance.needsApproval) {
            results.summary.warnings.push("Token approval required before swap");
            results.summary.recommendations.push("Run token.approve() before executing swap");
        } else {
            console.log(`   ✅ Allowance: ${results.checks.allowance.allowanceFormatted} ${results.checks.allowance.symbol}`);
        }

        // 3. Pool Existence Check
        console.log("\n🏊 Checking pool existence...");
        results.checks.pool = await this.checkPoolExists(
            swapParams.tokenIn,
            swapParams.tokenOut,
            swapParams.fee
        );
        
        if (!results.checks.pool.success) {
            results.summary.criticalIssues.push("Pool check failed");
        } else if (!results.checks.pool.poolExists) {
            results.summary.criticalIssues.push(`No pool exists for fee tier ${swapParams.fee}`);
            results.summary.recommendations.push("Try different fee tiers: 100, 500, 3000, 10000");
        } else {
            console.log(`   ✅ Pool exists: ${results.checks.pool.poolAddress}`);
            if (results.checks.pool.liquidityInfo?.hasLiquidity === false) {
                results.summary.warnings.push("Pool has zero liquidity");
            }
        }

        // 4. Quote Check
        console.log("\n📈 Getting swap quote...");
        results.checks.quote = await this.getQuote(
            swapParams.tokenIn,
            swapParams.tokenOut,
            swapParams.amountIn,
            swapParams.fee
        );
        
        if (!results.checks.quote.success) {
            results.summary.criticalIssues.push("Quote failed - swap likely to fail");
        } else {
            const tokenOutContract = new ethers.Contract(swapParams.tokenOut, this.erc20ABI, this.provider);
            const outDecimals = await tokenOutContract.decimals();
            const outSymbol = await tokenOutContract.symbol();
            const amountOutFormatted = ethers.utils.formatUnits(results.checks.quote.amountOut, outDecimals);
            console.log(`   ✅ Expected output: ${amountOutFormatted} ${outSymbol}`);
        }

        // 5. Gas Conditions
        console.log("\n⛽ Checking gas conditions...");
        results.checks.gas = await this.checkGasConditions();
        
        if (!results.checks.gas.success) {
            results.summary.warnings.push("Could not check gas conditions");
        } else {
            console.log(`   ✅ Gas price: ${results.checks.gas.gasPriceGwei} gwei`);
            console.log(`   ✅ Network utilization: ${results.checks.gas.utilization}%`);
            
            if (parseFloat(results.checks.gas.gasPriceGwei) > 10) {
                results.summary.warnings.push("High gas price detected");
            }
            
            if (results.checks.gas.utilization > 90) {
                results.summary.warnings.push("High network congestion");
            }
        }

        // 6. Parameter Validation
        console.log("\n📋 Validating parameters...");
        const now = Math.floor(Date.now() / 1000);
        if (swapParams.deadline <= now) {
            results.summary.criticalIssues.push("Deadline is expired");
        }
        
        if (swapParams.amountOutMinimum === "0") {
            results.summary.warnings.push("No slippage protection (amountOutMinimum = 0)");
        }

        // Summary
        results.summary.allPassed = results.summary.criticalIssues.length === 0;
        
        console.log("\n📋 Pre-Swap Check Summary:");
        if (results.summary.allPassed) {
            console.log("   ✅ All critical checks passed - swap should succeed");
        } else {
            console.log("   ❌ Critical issues found:");
            results.summary.criticalIssues.forEach(issue => {
                console.log(`     - ${issue}`);
            });
        }
        
        if (results.summary.warnings.length > 0) {
            console.log("   ⚠️  Warnings:");
            results.summary.warnings.forEach(warning => {
                console.log(`     - ${warning}`);
            });
        }
        
        if (results.summary.recommendations.length > 0) {
            console.log("   💡 Recommendations:");
            results.summary.recommendations.forEach(rec => {
                console.log(`     - ${rec}`);
            });
        }

        return results;
    }

    /**
     * Quick validation for critical issues only
     */
    async quickValidation(swapParams, walletAddress, routerAddress) {
        const issues = [];
        
        try {
            // Quick balance check
            const balanceResult = await this.checkBalance(
                swapParams.tokenIn,
                walletAddress,
                ethers.BigNumber.from(swapParams.amountIn)
            );
            
            if (!balanceResult.hasBalance) {
                issues.push("Insufficient balance");
            }
            
            // Quick allowance check
            const allowanceResult = await this.checkAllowance(
                swapParams.tokenIn,
                walletAddress,
                routerAddress,
                ethers.BigNumber.from(swapParams.amountIn)
            );
            
            if (allowanceResult.needsApproval) {
                issues.push("Approval required");
            }
            
            // Deadline check
            const now = Math.floor(Date.now() / 1000);
            if (swapParams.deadline <= now) {
                issues.push("Deadline expired");
            }
            
        } catch (error) {
            issues.push(`Validation error: ${error.message}`);
        }
        
        return {
            isValid: issues.length === 0,
            issues
        };
    }
}

module.exports = { PreSwapChecker };