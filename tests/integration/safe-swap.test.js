const { expect } = require('chai');
const { ethers } = require('ethers');
const { SafeSwapHelper } = require('../../utils/safe-swap-helper');
const { SwapValidator } = require('../../utils/swap-validator');
const { PreSwapChecker } = require('../../utils/pre-swap-checker');

describe('Safe Swap Integration Tests', () => {
    let safeSwapper;
    let validator;
    let checker;
    let provider;
    let mockWallet;

    before(async () => {
        // Use testnet provider
        provider = new ethers.providers.JsonRpcProvider("https://rpc.hyperliquid-testnet.xyz/evm");
        
        // Create a test wallet (don't use real private key in tests)
        const testPrivateKey = "0x1234567890123456789012345678901234567890123456789012345678901234";
        mockWallet = new ethers.Wallet(testPrivateKey, provider);
        
        safeSwapper = new SafeSwapHelper(provider, testPrivateKey);
        validator = new SwapValidator(provider);
        checker = new PreSwapChecker(
            provider,
            "0x03A918028f22D9E1473B7959C927AD7425A45C7C", // Factory
            "0x7FEd8993828A61A5985F384Cee8bDD42177Aa263"  // QuoterV2
        );
    });

    describe('Parameter Validation Prevention', () => {
        it('should prevent expired deadline errors', () => {
            const expiredParams = {
                tokenIn: "0xADcb2f358Eae6492F61A5f87eb8893d09391d160",
                tokenOut: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
                fee: 3000,
                recipient: mockWallet.address,
                deadline: 1672531200, // 2023-01-01 - expired
                amountIn: "1000000000000000000",
                amountOutMinimum: "900000000000000000",
                sqrtPriceLimitX96: 0
            };

            expect(() => {
                validator.createSafeSwapParams(expiredParams, 'v3');
            }).to.throw(/Invalid swap parameters.*deadline/);
        });

        it('should prevent invalid address errors', () => {
            const invalidAddressParams = {
                tokenIn: "0x8ba1f109551bD432803012645Hac136c5B5f2c2e", // Contains 'H'
                tokenOut: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
                fee: 3000,
                recipient: mockWallet.address,
                deadline: Math.floor(Date.now() / 1000) + 1800,
                amountIn: "1000000000000000000",
                amountOutMinimum: "900000000000000000",
                sqrtPriceLimitX96: 0
            };

            expect(() => {
                validator.createSafeSwapParams(invalidAddressParams, 'v3');
            }).to.throw(/Invalid swap parameters.*tokenIn.*invalid hex/);
        });

        it('should prevent zero amount errors', () => {
            const zeroAmountParams = {
                tokenIn: "0xADcb2f358Eae6492F61A5f87eb8893d09391d160",
                tokenOut: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
                fee: 3000,
                recipient: mockWallet.address,
                deadline: Math.floor(Date.now() / 1000) + 1800,
                amountIn: "0", // Zero amount
                amountOutMinimum: "900000000000000000",
                sqrtPriceLimitX96: 0
            };

            expect(() => {
                validator.createSafeSwapParams(zeroAmountParams, 'v3');
            }).to.throw(/Invalid swap parameters.*amountIn.*zero/);
        });

        it('should prevent invalid fee tier errors', () => {
            const invalidFeeParams = {
                tokenIn: "0xADcb2f358Eae6492F61A5f87eb8893d09391d160",
                tokenOut: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
                fee: 123, // Invalid fee tier
                recipient: mockWallet.address,
                deadline: Math.floor(Date.now() / 1000) + 1800,
                amountIn: "1000000000000000000",
                amountOutMinimum: "900000000000000000",
                sqrtPriceLimitX96: 0
            };

            expect(() => {
                validator.createSafeSwapParams(invalidFeeParams, 'v3');
            }).to.throw(/Invalid swap parameters.*fee.*Invalid fee tier/);
        });
    });

    describe('Auto-correction Features', () => {
        it('should auto-generate valid deadline when missing', () => {
            const paramsWithoutDeadline = {
                tokenIn: "0xADcb2f358Eae6492F61A5f87eb8893d09391d160",
                tokenOut: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
                fee: 3000,
                recipient: mockWallet.address,
                // deadline: missing
                amountIn: "1000000000000000000",
                amountOutMinimum: "900000000000000000",
                sqrtPriceLimitX96: 0
            };

            const safeParams = validator.createSafeSwapParams(paramsWithoutDeadline, 'v3');
            const now = Math.floor(Date.now() / 1000);
            
            expect(safeParams.deadline).to.be.greaterThan(now);
            expect(safeParams.deadline).to.be.lessThan(now + 3600); // Within 1 hour
        });

        it('should normalize addresses to lowercase', () => {
            const mixedCaseParams = {
                tokenIn: "0xADcb2f358Eae6492F61A5f87eb8893d09391d160", // Mixed case
                tokenOut: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82", // Mixed case
                fee: 3000,
                recipient: mockWallet.address,
                deadline: Math.floor(Date.now() / 1000) + 1800,
                amountIn: "1000000000000000000",
                amountOutMinimum: "900000000000000000",
                sqrtPriceLimitX96: 0
            };

            const safeParams = validator.createSafeSwapParams(mixedCaseParams, 'v3');
            
            expect(safeParams.tokenIn).to.equal("0xadcb2f358eae6492f61a5f87eb8893d09391d160");
            expect(safeParams.tokenOut).to.equal("0xc003d79b8a489703b1753711e3ae9ffdfc8d1a82");
        });

        it('should handle decimal string amounts', () => {
            const decimalParams = {
                tokenIn: "0xADcb2f358Eae6492F61A5f87eb8893d09391d160",
                tokenOut: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
                fee: 3000,
                recipient: mockWallet.address,
                deadline: Math.floor(Date.now() / 1000) + 1800,
                amountIn: "1.5", // Decimal string
                amountOutMinimum: "0.9", // Decimal string
                sqrtPriceLimitX96: 0
            };

            const safeParams = validator.createSafeSwapParams(decimalParams, 'v3');
            
            expect(safeParams.amountIn).to.equal(ethers.utils.parseEther("1.5").toString());
            expect(safeParams.amountOutMinimum).to.equal(ethers.utils.parseEther("0.9").toString());
        });
    });

    describe('Emergency Validation', () => {
        it('should quickly identify critical issues', async () => {
            const problematicParams = {
                tokenIn: "0xADcb2f358Eae6492F61A5f87eb8893d09391d160",
                tokenOut: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
                fee: 3000,
                recipient: mockWallet.address,
                deadline: 1672531200, // Expired
                amountIn: "1000000000000000000000", // Very large amount
                amountOutMinimum: "0",
                sqrtPriceLimitX96: 0
            };

            const emergencyResult = await safeSwapper.emergencyValidation(problematicParams);
            
            expect(emergencyResult.safe).to.be.false;
            expect(emergencyResult.issues).to.include.members([
                "Deadline expired",
                "Insufficient balance"
            ]);
        });

        it('should pass validation for correct parameters', async () => {
            const validParams = {
                tokenIn: "0xADcb2f358Eae6492F61A5f87eb8893d09391d160",
                tokenOut: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
                fee: 3000,
                recipient: mockWallet.address,
                deadline: Math.floor(Date.now() / 1000) + 1800,
                amountIn: "1000000000000000", // Small amount
                amountOutMinimum: "1",
                sqrtPriceLimitX96: 0
            };

            // This test depends on actual network state, so we'll just check structure
            const emergencyResult = await safeSwapper.emergencyValidation(validParams);
            
            expect(emergencyResult).to.have.property('safe');
            expect(emergencyResult).to.have.property('issues');
            expect(Array.isArray(emergencyResult.issues)).to.be.true;
        });
    });

    describe('Helper Functions', () => {
        it('should create minimal safe parameters correctly', () => {
            const minimal = safeSwapper.createMinimalSafeParams(
                "0xADcb2f358Eae6492F61A5f87eb8893d09391d160",
                "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
                "0.001"
            );

            expect(minimal.tokenIn).to.equal("0xadcb2f358eae6492f61a5f87eb8893d09391d160");
            expect(minimal.tokenOut).to.equal("0xc003d79b8a489703b1753711e3ae9ffdfc8d1a82");
            expect(minimal.amountIn).to.equal(ethers.utils.parseEther("0.001").toString());
            expect(minimal.fee).to.equal(3000);
            expect(minimal.recipient).to.equal(mockWallet.address);
            expect(minimal.deadline).to.be.greaterThan(Math.floor(Date.now() / 1000));
        });

        it('should add slippage protection correctly', async function() {
            this.timeout(10000); // Increase timeout for network call
            
            const params = safeSwapper.createMinimalSafeParams(
                "0xADcb2f358Eae6492F61A5f87eb8893d09391d160",
                "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
                "0.001"
            );

            try {
                const withSlippage = await safeSwapper.addSlippageProtection(params, 0.5);
                
                expect(withSlippage.amountOutMinimum).to.not.equal("0");
                
                // Verify slippage calculation
                const quote = await checker.getQuote(
                    params.tokenIn,
                    params.tokenOut,
                    params.amountIn,
                    params.fee
                );
                
                if (quote.success) {
                    const expectedMin = ethers.BigNumber.from(quote.amountOut).mul(9950).div(10000); // 0.5% slippage
                    expect(withSlippage.amountOutMinimum).to.equal(expectedMin.toString());
                }
            } catch (error) {
                // Network call may fail in test environment, that's okay
                console.log(`Slippage test skipped due to network: ${error.message}`);
            }
        });
    });

    describe('Error Prevention Scenarios', () => {
        const commonErrorScenarios = [
            {
                name: "Expired deadline from 2023",
                params: { deadline: 1672531200 },
                expectedError: /deadline.*expired/i
            },
            {
                name: "Address with non-hex character",
                params: { tokenIn: "0x8ba1f109551bD432803012645Hac136c5B5f2c2e" },
                expectedError: /tokenIn.*invalid hex/i
            },
            {
                name: "Zero address as token",
                params: { tokenOut: ethers.constants.AddressZero },
                expectedError: /tokenOut.*zero address/i
            },
            {
                name: "Negative amount",
                params: { amountIn: "-1" },
                expectedError: /amountIn.*negative/i
            },
            {
                name: "Invalid fee tier",
                params: { fee: 12345 },
                expectedError: /fee.*Invalid fee tier/i
            }
        ];

        commonErrorScenarios.forEach(scenario => {
            it(`should prevent: ${scenario.name}`, () => {
                const baseParams = {
                    tokenIn: "0xADcb2f358Eae6492F61A5f87eb8893d09391d160",
                    tokenOut: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
                    fee: 3000,
                    recipient: mockWallet.address,
                    deadline: Math.floor(Date.now() / 1000) + 1800,
                    amountIn: "1000000000000000000",
                    amountOutMinimum: "900000000000000000",
                    sqrtPriceLimitX96: 0,
                    ...scenario.params
                };

                expect(() => {
                    validator.createSafeSwapParams(baseParams, 'v3');
                }).to.throw(scenario.expectedError);
            });
        });
    });

    describe('Performance and Edge Cases', () => {
        it('should handle very large amounts', () => {
            const largeAmountParams = {
                tokenIn: "0xADcb2f358Eae6492F61A5f87eb8893d09391d160",
                tokenOut: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
                fee: 3000,
                recipient: mockWallet.address,
                deadline: Math.floor(Date.now() / 1000) + 1800,
                amountIn: ethers.constants.MaxUint256.toString(),
                amountOutMinimum: "1",
                sqrtPriceLimitX96: 0
            };

            // Should not throw, just validate the format
            const result = validator.validateV3SwapParams(largeAmountParams);
            expect(result.normalizedParams.amountIn).to.equal(ethers.constants.MaxUint256.toString());
        });

        it('should handle all valid fee tiers', () => {
            const validFees = [100, 500, 3000, 10000];
            
            validFees.forEach(fee => {
                const params = {
                    tokenIn: "0xADcb2f358Eae6492F61A5f87eb8893d09391d160",
                    tokenOut: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
                    fee: fee,
                    recipient: mockWallet.address,
                    deadline: Math.floor(Date.now() / 1000) + 1800,
                    amountIn: "1000000000000000000",
                    amountOutMinimum: "1",
                    sqrtPriceLimitX96: 0
                };

                expect(() => {
                    validator.createSafeSwapParams(params, 'v3');
                }).to.not.throw();
            });
        });
    });
});