const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

/**
 * HyperSwap V2 スワップ機能 テストネット
 */
class HyperSwapV2 {
    constructor() {
        this.rpcUrl =
            process.env.HYPERLIQUID_TESTNET_RPC ||
            "https://rpc.hyperliquid-testnet.xyz/evm";
        this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);

        // テストネット設定
        this.config = {
            chainId: 998,
            router: "0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853",
            factory: "0xA028411927E2015A363014881a4404C636218fb1",
            multicall: "0x8DD001ef8778c7be9DC409562d4CC7cDC0E78984",
        };
        
        // ガス代保護設定
        this.gasProtection = {
            minHypeBalance: ethers.utils.parseEther("0.1"), // 最低0.1 HYPE保持
            maxGasPrice: ethers.utils.parseUnits("10", "gwei"), // 最大ガス価格
            estimatedGasLimit: 200000, // 推定ガス使用量
        };

        // トークン設定をconfig/token-config.jsonから読み込み
        this.loadTokenConfig();

        // V2 Router ABI - abiディレクトリから読み込み
        this.routerABI = require('../../abi/HyperSwapV2Router.json');

        // ERC20 ABI - 共通ファイルから読み込み
        this.erc20ABI = require('../../examples/sample-abi/ERC20.json');
    }

    /**
     * トークン設定読み込み
     */
    loadTokenConfig() {
        try {
            const configPath = path.join(
                __dirname,
                "../../config/token-config.json"
            );
            const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));

            // テストネット用のトークン情報を取得
            const testnetTokens =
                configData.networks["hyperevm-testnet"].tokens;

            // アドレスマップとdecimalsマップを作成
            this.tokens = {};
            this.tokenDecimals = {};

            for (const [symbol, tokenInfo] of Object.entries(testnetTokens)) {
                this.tokens[symbol] = tokenInfo.address;
                this.tokenDecimals[symbol] = tokenInfo.decimals;
            }

            // 設定読み込み成功
        } catch (error) {
            // 設定読み込み失敗時はフォールバック
            // フォールバック: 従来の設定
            this.tokens = {
                HSPX: "0xD8c23394e2d55AA6dB9E5bb1305df54A1F83D122",
                xHSPX: "0x91483330b5953895757b65683d1272d86d6430B3",
                WETH: "0xADcb2f358Eae6492F61A5F87eb8893d09391d160",
                PURR: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
                JEFF: "0xbF7C8201519EC22512EB1405Db19C427DF64fC91",
                CATBAL: "0x26272928f2395452090143Cf347aa85f78cDa3E8",
                HFUN: "0x37adB2550b965851593832a6444763eeB3e1d1Ec",
                POINTS: "0xFe1E6dAC7601724768C5d84Eb8E1b2f6F1314BDe",
            };
            this.tokenDecimals = {
                HSPX: 18,
                xHSPX: 18,
                WETH: 18,
                PURR: 18,
                JEFF: 18,
                CATBAL: 18,
                HFUN: 18,
                POINTS: 18,
            };
        }
    }

    /**
     * ウォレット初期化
     */
    initWallet() {
        const privateKey = process.env.TESTNET_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error("TESTNET_PRIVATE_KEY not set in .env file");
        }

        return new ethers.Wallet(privateKey, this.provider);
    }

    /**
     * トークンアドレス取得
     */
    getTokenAddress(symbol) {
        const address = this.tokens[symbol.toUpperCase()];
        if (!address) {
            throw new Error(`Unknown token: ${symbol}`);
        }
        return address;
    }

    /**
     * レート取得
     */
    async getQuote(tokenInSymbol, tokenOutSymbol, amountIn) {
        try {
            const tokenIn = this.getTokenAddress(tokenInSymbol);
            const tokenOut = this.getTokenAddress(tokenOutSymbol);

            const router = new ethers.Contract(
                this.config.router,
                this.routerABI,
                this.provider
            );
            const path = [tokenIn, tokenOut];

            console.log(`📊 レート取得: ${tokenInSymbol} → ${tokenOutSymbol}`);
            console.log(`   入力量: ${amountIn}`);

            const amounts = await router.getAmountsOut(amountIn, path);
            const amountOut = amounts[1];

            console.log(
                `   出力量: ${ethers.utils.formatUnits(amountOut, 18)}`
            );

            return {
                success: true,
                amountIn: amountIn.toString(),
                amountOut: amountOut.toString(),
                path,
                rate:
                    parseFloat(ethers.utils.formatUnits(amountOut, 18)) /
                    parseFloat(ethers.utils.formatUnits(amountIn, 18)),
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * HYPE残高確認（ガス代保護）
     */
    async checkHypeBalance(walletAddress) {
        try {
            const balance = await this.provider.getBalance(walletAddress);
            return {
                success: true,
                balance: balance.toString(),
                formatted: ethers.utils.formatEther(balance),
                hasSufficientGas: balance.gte(this.gasProtection.minHypeBalance)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * ガス代見積もりと安全性チェック
     */
    async estimateGasCost() {
        try {
            const gasPrice = await this.provider.getGasPrice();
            const estimatedCost = gasPrice.mul(this.gasProtection.estimatedGasLimit);
            
            // ガス価格が高すぎる場合の警告
            const isGasPriceHigh = gasPrice.gt(this.gasProtection.maxGasPrice);
            
            return {
                success: true,
                gasPrice: gasPrice.toString(),
                gasPriceFormatted: ethers.utils.formatUnits(gasPrice, "gwei"),
                estimatedCost: estimatedCost.toString(),
                estimatedCostFormatted: ethers.utils.formatEther(estimatedCost),
                isGasPriceHigh,
                recommendation: isGasPriceHigh ? "ガス価格が高いため、後で再試行することを推奨" : "ガス価格は適正"
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * スリッページ計算
     */
    calculateMinAmountOut(amountOut, slippagePercent) {
        const slippageFactor = ethers.BigNumber.from(
            10000 - Math.floor(slippagePercent * 100)
        );
        return amountOut.mul(slippageFactor).div(10000);
    }

    /**
     * トークン残高確認
     */
    async getTokenBalance(tokenSymbol, walletAddress) {
        try {
            const tokenAddress = this.getTokenAddress(tokenSymbol);
            const token = new ethers.Contract(
                tokenAddress,
                this.erc20ABI,
                this.provider
            );

            const balance = await token.balanceOf(walletAddress);
            const decimals = await token.decimals();
            const symbol = await token.symbol();

            return {
                success: true,
                balance: balance.toString(),
                formatted: ethers.utils.formatUnits(balance, decimals),
                decimals,
                symbol,
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Approve確認・実行
     */
    async ensureApproval(wallet, tokenSymbol, amount) {
        try {
            const tokenAddress = this.getTokenAddress(tokenSymbol);
            const token = new ethers.Contract(
                tokenAddress,
                this.erc20ABI,
                wallet
            );

            console.log(`🔐 Approval確認: ${tokenSymbol}`);

            // 現在のAllowance確認
            const currentAllowance = await token.allowance(
                wallet.address,
                this.config.router
            );

            if (currentAllowance.gte(amount)) {
                console.log(
                    `   ✅ 既にApproval済み: ${ethers.utils.formatUnits(
                        currentAllowance,
                        18
                    )}`
                );
                return { success: true, alreadyApproved: true };
            }

            console.log(`   📝 Approval実行中...`);

            // 無制限Approval（一般的な手法）
            const maxAmount = ethers.constants.MaxUint256;
            const tx = await token.approve(this.config.router, maxAmount);

            console.log(`   ⏳ トランザクション送信: ${tx.hash}`);

            const receipt = await tx.wait();

            console.log(`   ✅ Approval完了: Block ${receipt.blockNumber}`);

            return {
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * スワップ実行
     */
    async swap(tokenInSymbol, tokenOutSymbol, amountIn, slippagePercent = 0.5) {
        try {
            const wallet = this.initWallet();

            console.log(
                `🔄 V2スワップ開始: ${tokenInSymbol} → ${tokenOutSymbol}`
            );
            console.log(`   ウォレット: ${wallet.address}`);
            console.log(
                `   入力量: ${ethers.utils.formatUnits(
                    amountIn,
                    18
                )} ${tokenInSymbol}`
            );
            console.log(`   スリッページ: ${slippagePercent}%\n`);

            // 1. HYPE残高確認（ガス代保護）
            console.log("⛽ HYPE残高確認（ガス代保護）:");
            const hypeBalance = await this.checkHypeBalance(wallet.address);
            if (!hypeBalance.success) {
                throw new Error(`HYPE残高確認失敗: ${hypeBalance.error}`);
            }
            
            console.log(`   HYPE残高: ${hypeBalance.formatted}`);
            console.log(`   最低必要額: ${ethers.utils.formatEther(this.gasProtection.minHypeBalance)}`);
            
            if (!hypeBalance.hasSufficientGas) {
                throw new Error(
                    `❌ ガス代不足: HYPE残高 ${hypeBalance.formatted} < 最低必要額 ${ethers.utils.formatEther(this.gasProtection.minHypeBalance)}\n` +
                    `   フォーセットでHYPEを取得してください: https://app.hyperliquid-testnet.xyz/drip`
                );
            }
            
            // 2. ガス代見積もり
            console.log("\n💸 ガス代見積もり:");
            const gasCost = await this.estimateGasCost();
            if (!gasCost.success) {
                throw new Error(`ガス代見積もり失敗: ${gasCost.error}`);
            }
            
            console.log(`   現在ガス価格: ${gasCost.gasPriceFormatted} Gwei`);
            console.log(`   推定ガス代: ${gasCost.estimatedCostFormatted} HYPE`);
            console.log(`   ${gasCost.recommendation}`);
            
            if (gasCost.isGasPriceHigh) {
                console.log(`   ⚠️  ガス価格が高いです。続行しますか？`);
            }
            
            // 3. トークン残高確認
            console.log("\n💰 トークン残高確認:");
            const balanceResult = await this.getTokenBalance(
                tokenInSymbol,
                wallet.address
            );
            if (!balanceResult.success) {
                throw new Error(`残高確認失敗: ${balanceResult.error}`);
            }

            const balance = ethers.BigNumber.from(balanceResult.balance);
            if (balance.lt(amountIn)) {
                throw new Error(
                    `残高不足: ${
                        balanceResult.formatted
                    } ${tokenInSymbol} < ${ethers.utils.formatUnits(
                        amountIn,
                        18
                    )}`
                );
            }

            console.log(`   ${tokenInSymbol}: ${balanceResult.formatted}`);

            // 4. レート取得
            console.log("\n📊 レート取得:");
            const quote = await this.getQuote(
                tokenInSymbol,
                tokenOutSymbol,
                amountIn
            );
            if (!quote.success) {
                throw new Error(`レート取得失敗: ${quote.error}`);
            }

            const expectedOut = ethers.BigNumber.from(quote.amountOut);
            const minAmountOut = this.calculateMinAmountOut(
                expectedOut,
                slippagePercent
            );

            console.log(
                `   期待出力: ${ethers.utils.formatUnits(
                    expectedOut,
                    18
                )} ${tokenOutSymbol}`
            );
            console.log(
                `   最小出力: ${ethers.utils.formatUnits(
                    minAmountOut,
                    18
                )} ${tokenOutSymbol}`
            );
            console.log(`   レート: ${quote.rate.toFixed(6)}`);

            // 5. Approval
            console.log("\n🔐 Approval:");
            const approvalResult = await this.ensureApproval(
                wallet,
                tokenInSymbol,
                amountIn
            );
            if (!approvalResult.success) {
                throw new Error(`Approval失敗: ${approvalResult.error}`);
            }

            // 6. スワップ実行
            console.log("\n🚀 スワップ実行:");
            const router = new ethers.Contract(
                this.config.router,
                this.routerABI,
                wallet
            );

            const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20分後（ChatGPT修正: 未来の時刻確保）
            const path = quote.path;

            // callStaticで事前テスト（ChatGPT修正: 実行前検証）
            console.log("   🧪 callStaticテスト...");
            try {
                const staticResult = await router.callStatic.swapExactTokensForTokens(
                    amountIn,
                    minAmountOut,
                    path,
                    wallet.address,
                    deadline
                );
                console.log(`   ✅ callStatic成功: ${ethers.utils.formatUnits(staticResult[1], 18)} ${tokenOutSymbol}`);
            } catch (staticError) {
                throw new Error(`callStatic失敗: ${staticError.message}`);
            }

            // ガス制限を設定して安全にスワップ実行
            const tx = await router.swapExactTokensForTokens(
                amountIn,
                minAmountOut,
                path,
                wallet.address,
                deadline,
                {
                    gasLimit: this.gasProtection.estimatedGasLimit,
                    gasPrice: await this.provider.getGasPrice()
                }
            );

            console.log(`   ⏳ トランザクション送信: ${tx.hash}`);

            const receipt = await tx.wait();

            console.log(`   ✅ スワップ完了: Block ${receipt.blockNumber}`);
            console.log(
                `   ガス使用量: ${receipt.gasUsed.toNumber().toLocaleString()}`
            );

            // 7. 結果確認
            console.log("\n📊 スワップ結果:");
            const newBalance = await this.getTokenBalance(
                tokenOutSymbol,
                wallet.address
            );
            if (newBalance.success) {
                console.log(
                    `   ${tokenOutSymbol}残高: ${newBalance.formatted}`
                );
            }
            
            // HYPE残高も再確認
            const finalHypeBalance = await this.checkHypeBalance(wallet.address);
            if (finalHypeBalance.success) {
                console.log(`   HYPE残高: ${finalHypeBalance.formatted} (ガス代使用後)`);
                if (!finalHypeBalance.hasSufficientGas) {
                    console.log(`   ⚠️  HYPE残高が最低必要額を下回りました`);
                }
            }

            return {
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toNumber(),
                amountIn: amountIn.toString(),
                expectedOut: expectedOut.toString(),
                minAmountOut: minAmountOut.toString(),
                rate: quote.rate,
            };
        } catch (error) {
            console.log(`\n❌ スワップ失敗: ${error.message}`);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

// CLI実行
async function main() {
    const args = process.argv.slice(2);

    if (args.includes("--help") || args.length === 0) {
        console.log(`
🔄 HyperSwap V2 スワップツール (テストネット)

使用方法:
  node custom/hyperevm-swap/v2-swap-testnet.js --tokenIn HSPX --tokenOut WETH --amount 100
  node custom/hyperevm-swap/v2-swap-testnet.js --tokenIn WETH --tokenOut PURR --amount 1 --slippage 1.0

オプション:
  --tokenIn     入力トークン（必須）
  --tokenOut    出力トークン（必須）  
  --amount      入力量（必須）
  --slippage    スリッページ % (デフォルト: 0.5)
  --quote-only  レート取得のみ
  --help        このヘルプを表示

対応トークン:
  HSPX, xHSPX, WETH, PURR, JEFF, CATBAL, HFUN, POINTS

例:
  # 100 HSPX → WETH
  node custom/hyperevm-swap/v2-swap-testnet.js --tokenIn HSPX --tokenOut WETH --amount 100
  
  # レートのみ確認
  node custom/hyperevm-swap/v2-swap-testnet.js --tokenIn HSPX --tokenOut WETH --amount 100 --quote-only
`);
        return;
    }

    // 引数解析
    const getArg = (name) => {
        const index = args.indexOf(name);
        return index !== -1 ? args[index + 1] : null;
    };

    const tokenIn = getArg("--tokenIn");
    const tokenOut = getArg("--tokenOut");
    const amount = getArg("--amount");
    const slippage = parseFloat(getArg("--slippage") || "0.5");
    const quoteOnly = args.includes("--quote-only");

    if (!tokenIn || !tokenOut || !amount) {
        console.log(
            "❌ 必須パラメータが不足しています。--help を参照してください。"
        );
        return;
    }

    try {
        const swap = new HyperSwapV2();
        const amountIn = ethers.utils.parseUnits(amount, 18);

        if (quoteOnly) {
            console.log("📊 レート取得のみ実行:\n");
            const quote = await swap.getQuote(tokenIn, tokenOut, amountIn);

            if (quote.success) {
                console.log(
                    `✅ レート: 1 ${tokenIn} = ${quote.rate.toFixed(
                        6
                    )} ${tokenOut}`
                );
                console.log(
                    `   ${amount} ${tokenIn} → ${ethers.utils.formatUnits(
                        quote.amountOut,
                        18
                    )} ${tokenOut}`
                );
            } else {
                console.log(`❌ レート取得失敗: ${quote.error}`);
            }
        } else {
            const result = await swap.swap(
                tokenIn,
                tokenOut,
                amountIn,
                slippage
            );

            if (result.success) {
                console.log("\n🎉 スワップ成功！");
                console.log(`   TX: ${result.transactionHash}`);
            } else {
                console.log("\n💥 スワップ失敗");
            }
        }
    } catch (error) {
        console.error("❌ エラー:", error.message);
    }
}

if (require.main === module) {
    main();
}

module.exports = { HyperSwapV2 };
