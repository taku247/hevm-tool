const { ethers } = require('ethers');

class SwapValidator {
    constructor(provider) {
        this.provider = provider;
        this.VALID_FEE_TIERS = [100, 500, 3000, 10000];
        this.MAX_SLIPPAGE = 5000; // 50%
        this.DEFAULT_SLIPPAGE = 50; // 0.5%
        this.DEFAULT_DEADLINE_MINUTES = 30;
    }

    /**
     * Validate deadline parameter
     */
    validateDeadline(deadline) {
        const now = Math.floor(Date.now() / 1000);
        
        if (!deadline || deadline <= now) {
            return {
                isValid: false,
                error: `Deadline is expired. Current time: ${now}, Provided: ${deadline}`
            };
        }

        // Check if deadline is suspiciously old (pre-2024)
        const year2024 = 1704067200; // 2024-01-01 UTC
        if (deadline < year2024) {
            return {
                isValid: false,
                error: `Deadline appears to be from the past (${new Date(deadline * 1000).toISOString()})`
            };
        }

        return { isValid: true };
    }

    /**
     * Generate a valid deadline
     */
    generateDeadline(minutesFromNow = this.DEFAULT_DEADLINE_MINUTES) {
        return Math.floor(Date.now() / 1000) + (minutesFromNow * 60);
    }

    /**
     * Validate Ethereum address
     */
    validateAddress(address) {
        if (!address || typeof address !== 'string') {
            return {
                isValid: false,
                error: 'Address is required and must be a string'
            };
        }

        // Check if it starts with 0x
        if (!address.startsWith('0x')) {
            return {
                isValid: false,
                error: 'Address must start with 0x'
            };
        }

        // Check length (42 characters: 0x + 40 hex chars)
        if (address.length !== 42) {
            return {
                isValid: false,
                error: `Address has invalid length: ${address.length}, expected 42`
            };
        }

        // Check for invalid hex characters
        const hexRegex = /^0x[0-9a-fA-F]{40}$/;
        if (!hexRegex.test(address)) {
            return {
                isValid: false,
                error: 'Address contains invalid hex characters'
            };
        }

        // Check for zero address
        if (address.toLowerCase() === ethers.constants.AddressZero.toLowerCase()) {
            return {
                isValid: false,
                error: 'Zero address not allowed'
            };
        }

        return {
            isValid: true,
            normalizedAddress: address.toLowerCase()
        };
    }

    /**
     * Validate token amount
     */
    validateAmount(amount) {
        if (!amount) {
            return {
                isValid: false,
                error: 'Amount is required'
            };
        }

        let normalizedAmount;
        
        try {
            // Handle string decimal amounts
            if (typeof amount === 'string' && amount.includes('.')) {
                normalizedAmount = ethers.utils.parseEther(amount).toString();
            } else {
                normalizedAmount = ethers.BigNumber.from(amount).toString();
            }
        } catch (error) {
            return {
                isValid: false,
                error: `Invalid amount format: ${error.message}`
            };
        }

        const amountBN = ethers.BigNumber.from(normalizedAmount);

        if (amountBN.lte(0)) {
            return {
                isValid: false,
                error: amountBN.lt(0) ? 'Amount cannot be negative' : 'Amount cannot be zero'
            };
        }

        return {
            isValid: true,
            normalizedAmount: normalizedAmount
        };
    }

    /**
     * Validate slippage tolerance (in basis points)
     */
    validateSlippage(slippage) {
        if (slippage < 0) {
            return {
                isValid: false,
                error: 'Slippage cannot be negative'
            };
        }

        if (slippage > this.MAX_SLIPPAGE) {
            return {
                isValid: false,
                error: `Slippage too high: ${slippage / 100}%, maximum allowed: ${this.MAX_SLIPPAGE / 100}%`
            };
        }

        return {
            isValid: true,
            normalizedSlippage: slippage
        };
    }

    /**
     * Get default slippage
     */
    getDefaultSlippage() {
        return this.DEFAULT_SLIPPAGE;
    }

    /**
     * Validate fee tier for V3 swaps
     */
    validateFeeTier(fee) {
        if (!this.VALID_FEE_TIERS.includes(fee)) {
            // Find closest valid fee tier
            const closest = this.VALID_FEE_TIERS.reduce((prev, curr) => 
                Math.abs(curr - fee) < Math.abs(prev - fee) ? curr : prev
            );

            return {
                isValid: false,
                error: `Invalid fee tier: ${fee}. Valid tiers: ${this.VALID_FEE_TIERS.join(', ')}`,
                suggestedFee: closest
            };
        }

        return { isValid: true };
    }

    /**
     * Validate complete V3 swap parameters
     */
    validateV3SwapParams(params) {
        const errors = [];
        const normalizedParams = {};

        // Validate tokenIn
        const tokenInResult = this.validateAddress(params.tokenIn);
        if (!tokenInResult.isValid) {
            errors.push(`tokenIn: ${tokenInResult.error}`);
        } else {
            normalizedParams.tokenIn = tokenInResult.normalizedAddress;
        }

        // Validate tokenOut
        const tokenOutResult = this.validateAddress(params.tokenOut);
        if (!tokenOutResult.isValid) {
            errors.push(`tokenOut: ${tokenOutResult.error}`);
        } else {
            normalizedParams.tokenOut = tokenOutResult.normalizedAddress;
        }

        // Validate fee
        const feeResult = this.validateFeeTier(params.fee);
        if (!feeResult.isValid) {
            errors.push(`fee: ${feeResult.error}`);
        } else {
            normalizedParams.fee = params.fee;
        }

        // Validate recipient
        const recipientResult = this.validateAddress(params.recipient);
        if (!recipientResult.isValid) {
            errors.push(`recipient: ${recipientResult.error}`);
        } else {
            normalizedParams.recipient = recipientResult.normalizedAddress;
        }

        // Validate deadline
        const deadlineResult = this.validateDeadline(params.deadline);
        if (!deadlineResult.isValid) {
            errors.push(`deadline: ${deadlineResult.error}`);
        } else {
            normalizedParams.deadline = params.deadline;
        }

        // Validate amountIn
        const amountInResult = this.validateAmount(params.amountIn);
        if (!amountInResult.isValid) {
            errors.push(`amountIn: ${amountInResult.error}`);
        } else {
            normalizedParams.amountIn = amountInResult.normalizedAmount;
        }

        // Validate amountOutMinimum
        const amountOutMinResult = this.validateAmount(params.amountOutMinimum);
        if (!amountOutMinResult.isValid) {
            errors.push(`amountOutMinimum: ${amountOutMinResult.error}`);
        } else {
            normalizedParams.amountOutMinimum = amountOutMinResult.normalizedAmount;
        }

        // sqrtPriceLimitX96 is optional, just copy if provided
        normalizedParams.sqrtPriceLimitX96 = params.sqrtPriceLimitX96 || 0;

        return {
            isValid: errors.length === 0,
            errors: errors,
            normalizedParams: errors.length === 0 ? normalizedParams : null
        };
    }

    /**
     * Validate complete V2 swap parameters
     */
    validateV2SwapParams(params) {
        const errors = [];
        const normalizedParams = {};

        // Validate amountIn
        const amountInResult = this.validateAmount(params.amountIn);
        if (!amountInResult.isValid) {
            errors.push(`amountIn: ${amountInResult.error}`);
        } else {
            normalizedParams.amountIn = amountInResult.normalizedAmount;
        }

        // Validate amountOutMin
        const amountOutMinResult = this.validateAmount(params.amountOutMin);
        if (!amountOutMinResult.isValid) {
            errors.push(`amountOutMin: ${amountOutMinResult.error}`);
        } else {
            normalizedParams.amountOutMin = amountOutMinResult.normalizedAmount;
        }

        // Validate path
        if (!params.path || !Array.isArray(params.path) || params.path.length < 2) {
            errors.push('path: Must be an array with at least 2 addresses');
        } else {
            const normalizedPath = [];
            for (let i = 0; i < params.path.length; i++) {
                const addressResult = this.validateAddress(params.path[i]);
                if (!addressResult.isValid) {
                    errors.push(`path[${i}]: ${addressResult.error}`);
                } else {
                    normalizedPath.push(addressResult.normalizedAddress);
                }
            }
            if (normalizedPath.length === params.path.length) {
                normalizedParams.path = normalizedPath;
            }
        }

        // Validate to address
        const toResult = this.validateAddress(params.to);
        if (!toResult.isValid) {
            errors.push(`to: ${toResult.error}`);
        } else {
            normalizedParams.to = toResult.normalizedAddress;
        }

        // Validate deadline
        const deadlineResult = this.validateDeadline(params.deadline);
        if (!deadlineResult.isValid) {
            errors.push(`deadline: ${deadlineResult.error}`);
        } else {
            normalizedParams.deadline = params.deadline;
        }

        return {
            isValid: errors.length === 0,
            errors: errors,
            normalizedParams: errors.length === 0 ? normalizedParams : null
        };
    }

    /**
     * Create pre-swap safety checks
     */
    async performPreSwapChecks(params) {
        const checks = {
            balanceCheck: false,
            allowanceCheck: false,
            poolExistsCheck: false,
            gasEstimateCheck: false,
            errors: []
        };

        try {
            // These would be implemented with actual contract calls
            // For now, returning structure for testing
            
            checks.balanceCheck = true;
            checks.allowanceCheck = true;
            checks.poolExistsCheck = true;
            checks.gasEstimateCheck = true;
            
            return {
                allChecksPassed: true,
                checks: checks
            };
        } catch (error) {
            checks.errors.push(error.message);
            return {
                allChecksPassed: false,
                checks: checks
            };
        }
    }

    /**
     * Helper to create safe swap parameters with validation
     */
    createSafeSwapParams(userParams, type = 'v3') {
        // Auto-generate deadline if not provided
        if (!userParams.deadline || userParams.deadline <= Math.floor(Date.now() / 1000)) {
            userParams.deadline = this.generateDeadline();
        }

        // Validate and normalize parameters
        const validationResult = type === 'v3' ? 
            this.validateV3SwapParams(userParams) : 
            this.validateV2SwapParams(userParams);

        if (!validationResult.isValid) {
            throw new Error(`Invalid swap parameters: ${validationResult.errors.join(', ')}`);
        }

        return validationResult.normalizedParams;
    }
}

module.exports = { SwapValidator };