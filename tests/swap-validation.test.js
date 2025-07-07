const { expect } = require('chai');
const { ethers } = require('ethers');
const { SwapValidator } = require('../utils/swap-validator');

describe('Swap Parameter Validation', () => {
    let validator;
    let mockProvider;
    let mockWallet;

    beforeEach(() => {
        mockProvider = new ethers.providers.JsonRpcProvider("https://rpc.hyperliquid-testnet.xyz/evm");
        mockWallet = new ethers.Wallet("0x1234567890123456789012345678901234567890123456789012345678901234", mockProvider);
        validator = new SwapValidator(mockProvider);
    });

    describe('Deadline Validation', () => {
        it('should reject expired deadlines', () => {
            const expiredDeadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
            const result = validator.validateDeadline(expiredDeadline);
            expect(result.isValid).to.be.false;
            expect(result.error).to.include('expired');
        });

        it('should reject deadlines from 2023 or earlier', () => {
            const oldDeadline = 1672531200; // 2023-01-01
            const result = validator.validateDeadline(oldDeadline);
            expect(result.isValid).to.be.false;
            expect(result.error).to.include('expired');
        });

        it('should accept valid future deadlines', () => {
            const futureDeadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes from now
            const result = validator.validateDeadline(futureDeadline);
            expect(result.isValid).to.be.true;
        });

        it('should generate valid deadline when not provided', () => {
            const generatedDeadline = validator.generateDeadline();
            const now = Math.floor(Date.now() / 1000);
            expect(generatedDeadline).to.be.greaterThan(now);
            expect(generatedDeadline).to.be.lessThan(now + 3600); // within 1 hour
        });
    });

    describe('Address Validation', () => {
        it('should reject addresses with non-hex characters', () => {
            const invalidAddress = "0x8ba1f109551bD432803012645Hac136c5B5f2c2e";
            const result = validator.validateAddress(invalidAddress);
            expect(result.isValid).to.be.false;
            expect(result.error).to.include('invalid hex');
        });

        it('should reject addresses with wrong length', () => {
            const shortAddress = "0x1234567890123456789012345678901234567890"; // 40 chars instead of 42
            const result = validator.validateAddress(shortAddress);
            expect(result.isValid).to.be.false;
            expect(result.error).to.include('invalid length');
        });

        it('should reject zero address', () => {
            const zeroAddress = ethers.constants.AddressZero;
            const result = validator.validateAddress(zeroAddress);
            expect(result.isValid).to.be.false;
            expect(result.error).to.include('zero address');
        });

        it('should normalize valid addresses', () => {
            const mixedCaseAddress = "0xADcb2f358Eae6492F61A5f87eb8893d09391d160";
            const result = validator.validateAddress(mixedCaseAddress);
            expect(result.isValid).to.be.true;
            expect(result.normalizedAddress).to.equal(mixedCaseAddress.toLowerCase());
        });

        it('should handle checksum addresses correctly', () => {
            const checksumAddress = "0xADcb2f358Eae6492F61A5f87eb8893d09391d160";
            const result = validator.validateAddress(checksumAddress);
            expect(result.isValid).to.be.true;
            expect(result.normalizedAddress).to.equal(checksumAddress.toLowerCase());
        });
    });

    describe('Amount Validation', () => {
        it('should reject zero amounts', () => {
            const result = validator.validateAmount("0");
            expect(result.isValid).to.be.false;
            expect(result.error).to.include('zero amount');
        });

        it('should reject negative amounts', () => {
            const result = validator.validateAmount("-1");
            expect(result.isValid).to.be.false;
            expect(result.error).to.include('negative amount');
        });

        it('should accept valid positive amounts', () => {
            const result = validator.validateAmount("1000000000000000000"); // 1 token
            expect(result.isValid).to.be.true;
            expect(result.normalizedAmount).to.equal("1000000000000000000");
        });

        it('should handle decimal string amounts', () => {
            const result = validator.validateAmount("1.5");
            expect(result.isValid).to.be.true;
            expect(result.normalizedAmount).to.equal(ethers.utils.parseEther("1.5").toString());
        });
    });

    describe('Slippage Validation', () => {
        it('should reject slippage over 50%', () => {
            const result = validator.validateSlippage(5001); // 50.01%
            expect(result.isValid).to.be.false;
            expect(result.error).to.include('slippage too high');
        });

        it('should reject negative slippage', () => {
            const result = validator.validateSlippage(-100);
            expect(result.isValid).to.be.false;
            expect(result.error).to.include('negative slippage');
        });

        it('should accept valid slippage values', () => {
            const result = validator.validateSlippage(300); // 3%
            expect(result.isValid).to.be.true;
            expect(result.normalizedSlippage).to.equal(300);
        });

        it('should provide default slippage when not specified', () => {
            const defaultSlippage = validator.getDefaultSlippage();
            expect(defaultSlippage).to.equal(50); // 0.5%
        });
    });

    describe('Fee Tier Validation', () => {
        it('should reject invalid fee tiers', () => {
            const result = validator.validateFeeTier(123); // Invalid fee tier
            expect(result.isValid).to.be.false;
            expect(result.error).to.include('invalid fee tier');
        });

        it('should accept valid fee tiers', () => {
            const validFees = [100, 500, 3000, 10000];
            validFees.forEach(fee => {
                const result = validator.validateFeeTier(fee);
                expect(result.isValid).to.be.true;
            });
        });

        it('should suggest closest valid fee tier for invalid input', () => {
            const result = validator.validateFeeTier(400); // Close to 500
            expect(result.isValid).to.be.false;
            expect(result.suggestedFee).to.equal(500);
        });
    });

    describe('Comprehensive Swap Parameters Validation', () => {
        it('should validate complete V3 swap parameters', () => {
            const params = {
                tokenIn: "0xADcb2f358Eae6492F61A5f87eb8893d09391d160",
                tokenOut: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
                fee: 3000,
                recipient: mockWallet.address,
                deadline: Math.floor(Date.now() / 1000) + 1800,
                amountIn: "1000000000000000000", // 1 token
                amountOutMinimum: "900000000000000000", // 0.9 token
                sqrtPriceLimitX96: 0
            };

            const result = validator.validateV3SwapParams(params);
            expect(result.isValid).to.be.true;
            expect(result.normalizedParams).to.be.an('object');
        });

        it('should validate complete V2 swap parameters', () => {
            const params = {
                amountIn: "1000000000000000000",
                amountOutMin: "900000000000000000",
                path: [
                    "0xADcb2f358Eae6492F61A5f87eb8893d09391d160",
                    "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82"
                ],
                to: mockWallet.address,
                deadline: Math.floor(Date.now() / 1000) + 1800
            };

            const result = validator.validateV2SwapParams(params);
            expect(result.isValid).to.be.true;
            expect(result.normalizedParams).to.be.an('object');
        });

        it('should reject parameters with multiple errors', () => {
            const invalidParams = {
                tokenIn: "0xInvalidAddress",
                tokenOut: ethers.constants.AddressZero,
                fee: 123, // Invalid fee
                recipient: "0x8ba1f109551bD432803012645Hac136c5B5f2c2e", // Invalid hex
                deadline: 1672531200, // Expired
                amountIn: "0", // Zero amount
                amountOutMinimum: "-1", // Negative
                sqrtPriceLimitX96: 0
            };

            const result = validator.validateV3SwapParams(invalidParams);
            expect(result.isValid).to.be.false;
            expect(result.errors).to.be.an('array');
            expect(result.errors.length).to.be.greaterThan(5);
        });
    });

    describe('Pre-swap Checks', () => {
        it('should identify missing allowance', async () => {
            // Mock contract calls would go here
            // This test would check if the token approval is sufficient
        });

        it('should verify pool existence', async () => {
            // Mock factory contract calls would go here
            // This test would verify that the trading pair exists
        });

        it('should check wallet balance', async () => {
            // Mock balance checks would go here
            // This test would verify sufficient token balance
        });
    });
});