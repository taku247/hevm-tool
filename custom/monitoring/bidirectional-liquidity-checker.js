#!/usr/bin/env node

/**
 * 双方向流動性チェッカー
 *
 * 両方向のレートを同時に確認し、流動性の非対称性を検出
 * アービトラージの実行可能性を事前に評価
 */

const { ethers } = require("ethers");
const fs = require("fs").promises;
const path = require("path");
const XLSX = require("xlsx");
const Table = require("cli-table3");
const colors = require("colors");

class BidirectionalLiquidityChecker {
    constructor(options = {}) {
        this.rpcUrl =
            process.env.HYPEREVM_RPC_URL || "https://rpc.hyperliquid.xyz/evm";
        this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
        this.silent = options.silent || false; // 🆕 ログ抑制オプション

        // デフォルトコントラクト（config読み込み失敗時のフォールバック）
        this.contracts = {
            hyperswap: {
                v2Router: null,
                v2Factory: null,
                v3QuoterV2: null,
                v3Factory: null,
            },
            kittenswap: {
                v2Router: null,
                v2Factory: null,
                v3QuoterV2: null,
                v3Factory: null,
            },
        };

        // トークン情報キャッシュ
        this.tokenCache = new Map();
    }

    async loadDexConfig() {
        try {
            const configPath = path.join(__dirname, "../../config/dex-config.json");
            const config = JSON.parse(await fs.readFile(configPath, "utf8"));
            
            const network = config.networks["hyperevm-mainnet"];
            
            // HyperSwap V2設定
            if (network.dexes.hyperswap_v2) {
                this.contracts.hyperswap.v2Router = network.dexes.hyperswap_v2.router;
                this.contracts.hyperswap.v2Factory = network.dexes.hyperswap_v2.factory;
            }
            
            // HyperSwap V3設定
            if (network.dexes.hyperswap_v3) {
                this.contracts.hyperswap.v3QuoterV2 = network.dexes.hyperswap_v3.quoterV2;
                this.contracts.hyperswap.v3Factory = network.dexes.hyperswap_v3.factory;
            }
            
            // KittenSwap V2設定
            if (network.dexes.kittenswap_v2) {
                this.contracts.kittenswap.v2Router = network.dexes.kittenswap_v2.router;
                this.contracts.kittenswap.v2Factory = network.dexes.kittenswap_v2.factory;
            }
            
            // KittenSwap V3設定
            if (network.dexes.kittenswap_cl) {
                this.contracts.kittenswap.v3QuoterV2 = network.dexes.kittenswap_cl.quoter;
                this.contracts.kittenswap.v3Factory = network.dexes.kittenswap_cl.factory;
            }
            
            console.log("✅ DEX設定を読み込みました:");
            console.log(`   HyperSwap V2 Router: ${this.contracts.hyperswap.v2Router}`);
            console.log(`   HyperSwap V3 QuoterV2: ${this.contracts.hyperswap.v3QuoterV2}`);
            console.log(`   KittenSwap V2 Router: ${this.contracts.kittenswap.v2Router}`);
            console.log(`   KittenSwap V3 QuoterV2: ${this.contracts.kittenswap.v3QuoterV2}`);
            
        } catch (error) {
            console.error("⚠️ DEX設定の読み込みに失敗しました:", error.message);
            console.log("⚠️ デフォルト設定を使用します");
            
            // フォールバック設定
            this.contracts = {
                hyperswap: {
                    v2Router: "0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A",
                    v2Factory: "0x724412C00059bf7d6ee7d4a1d0D5cd4de3ea1C48",
                    v3QuoterV2: "0x03A918028f22D9E1473B7959C927AD7425A45C7C",
                    v3Factory: "0xB1c0fa0B789320044A6F623cFe5eBda9562602E3",
                },
                kittenswap: {
                    v2Router: "0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802",
                    v2Factory: "0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B",
                    v3QuoterV2: "0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF",
                    v3Factory: "0x2E08F5Ff603E4343864B14599CAeDb19918BDCaF",
                },
            };
        }
    }

    async setupContracts() {
        // DEX設定を読み込み
        await this.loadDexConfig();
        
        // V2 Router ABI (共通)
        this.v2RouterABI = [
            "function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory amounts)"
        ];
        
        // Hyperswap QuoterV2 ABI
        this.hyperswapQuoterV2ABI = [
            {
                name: "quoteExactInputSingle",
                type: "function",
                stateMutability: "view",
                inputs: [
                    {
                        components: [
                            { name: "tokenIn", type: "address" },
                            { name: "tokenOut", type: "address" },
                            { name: "amountIn", type: "uint256" },
                            { name: "fee", type: "uint24" },
                            { name: "sqrtPriceLimitX96", type: "uint160" },
                        ],
                        name: "params",
                        type: "tuple",
                    },
                ],
                outputs: [
                    { name: "amountOut", type: "uint256" },
                    { name: "sqrtPriceX96After", type: "uint160" },
                    { name: "initializedTicksCrossed", type: "uint32" },
                    { name: "gasEstimate", type: "uint256" },
                ],
            },
        ];

        // KittenSwap V3 QuoterV2 ABI
        const quoterABIPath = path.join(
            __dirname,
            "../../abi/KittenQuoterV2.json"
        );
        const kittenswapV3QuoterABI = JSON.parse(
            await fs.readFile(quoterABIPath, "utf8")
        );

        // V2コントラクト初期化
        this.hyperswapV2Contract = new ethers.Contract(
            this.contracts.hyperswap.v2Router,
            this.v2RouterABI,
            this.provider
        );

        this.kittenswapV2Contract = new ethers.Contract(
            this.contracts.kittenswap.v2Router,
            this.v2RouterABI,
            this.provider
        );

        // V3コントラクト初期化
        this.hyperswapV3Contract = new ethers.Contract(
            this.contracts.hyperswap.v3QuoterV2,
            this.hyperswapQuoterV2ABI,
            this.provider
        );

        this.kittenswapV3Contract = new ethers.Contract(
            this.contracts.kittenswap.v3QuoterV2,
            kittenswapV3QuoterABI,
            this.provider
        );

        console.log("✅ V2/V3コントラクト初期化完了");
    }

    async getTokenInfo(tokenAddress) {
        if (this.tokenCache.has(tokenAddress)) {
            return this.tokenCache.get(tokenAddress);
        }

        try {
            const tokenABI = [
                "function decimals() view returns (uint8)",
                "function symbol() view returns (string)",
                "function name() view returns (string)",
            ];
            const tokenContract = new ethers.Contract(
                tokenAddress,
                tokenABI,
                this.provider
            );

            const [decimals, symbol, name] = await Promise.all([
                tokenContract.decimals(),
                tokenContract.symbol().catch(() => "UNKNOWN"),
                tokenContract.name().catch(() => "Unknown Token"),
            ]);

            const info = { decimals, symbol, name };
            this.tokenCache.set(tokenAddress, info);
            return info;
        } catch (error) {
            if (!this.silent) {
                console.warn(
                    `⚠️ トークン情報取得失敗 ${tokenAddress}: ${error.message}`
                );
            }
            const fallbackInfo = {
                decimals: 18,
                symbol: "UNKNOWN",
                name: "Unknown Token",
            };
            this.tokenCache.set(tokenAddress, fallbackInfo);
            return fallbackInfo;
        }
    }

    async getQuote(dex, protocol, tokenIn, tokenOut, amountInWei, config) {
        // 詳細なログ形式（元の形式に戻す）
        const amountFormatted = ethers.utils.formatEther(amountInWei);
        
        // 🔍 FLY/WHYPEペア専用の詳細ログ
        const isFlyWhypePair = (tokenIn.toLowerCase() === '0x3f244819a8359145a8e7cf0272955e4918a50627' && 
                               tokenOut.toLowerCase() === '0x5555555555555555555555555555555555555555') ||
                              (tokenOut.toLowerCase() === '0x3f244819a8359145a8e7cf0272955e4918a50627' && 
                               tokenIn.toLowerCase() === '0x5555555555555555555555555555555555555555');
        
        if (isFlyWhypePair) {
            console.log(`\n🔍 FLY/WHYPE スキャン時プロトコル詳細:`);
            console.log(`   DEX: ${dex.toUpperCase()}`);
            console.log(`   Protocol: ${protocol.toUpperCase()}`);
            console.log(`   Fee/Config: ${JSON.stringify(config)}`);
            console.log(`   AmountIn: ${amountFormatted} tokens`);
            console.log(`   TokenIn: ${tokenIn}`);
            console.log(`   TokenOut: ${tokenOut}`);
        }
        
        if (!this.silent) {
            if (protocol === "v2") {
                console.log(`\n🔄 ${dex.toUpperCase()} V2 Router 見積もり:`);
                console.log(`   入力: ${amountFormatted} tokens (${tokenIn})`);
                console.log(`   出力先: ${tokenOut}`);
            } else if (protocol === "v3") {
                const feeInfo = config.fee ? ` (手数料: ${config.fee}bps)` : config.tickSpacing ? ` (TickSpacing: ${config.tickSpacing})` : '';
                console.log(`\n🔄 ${dex.toUpperCase()} V3 QuoterV2 見積もり${feeInfo}:`);
                console.log(`   入力: ${amountFormatted} tokens (${tokenIn})`);
                console.log(`   出力先: ${tokenOut}`);
            }
        }
        
        try {
            let result;

            if (dex === "hyperswap") {
                if (protocol === "v2") {
                    // V2: Router.getAmountsOut使用
                    const path = [tokenIn, tokenOut];
                    const amounts = await this.hyperswapV2Contract.getAmountsOut(amountInWei, path);
                    result = {
                        amountOut: amounts[1],
                        gasEstimate: ethers.BigNumber.from(150000), // V2推定ガス
                    };
                } else {
                    // V3: QuoterV2使用
                    const params = {
                        tokenIn: tokenIn,
                        tokenOut: tokenOut,
                        amountIn: amountInWei,
                        fee: config.fee,
                        sqrtPriceLimitX96: 0,
                    };
                    result = await this.hyperswapV3Contract.callStatic.quoteExactInputSingle(params);
                }
            } else if (dex === "kittenswap") {
                if (protocol === "v2") {
                    // V2: Router.getAmountsOut使用
                    const path = [tokenIn, tokenOut];
                    const amounts = await this.kittenswapV2Contract.getAmountsOut(amountInWei, path);
                    result = {
                        amountOut: amounts[1],
                        gasEstimate: ethers.BigNumber.from(120000), // V2推定ガス
                    };
                } else {
                    // V3: QuoterV2使用
                    const params = {
                        tokenIn: tokenIn,
                        tokenOut: tokenOut,
                        amountIn: amountInWei,
                        tickSpacing: config.tickSpacing,
                        sqrtPriceLimitX96: 0,
                    };
                    result = await this.kittenswapV3Contract.callStatic.quoteExactInputSingle(params);
                }
            }

            if (result && result.amountOut && result.amountOut.gt(0)) {
                const outputFormatted = ethers.utils.formatEther(result.amountOut);
                if (!this.silent) {
                    console.log(`   ✅ 結果: ${outputFormatted} tokens`);
                }
                
                // 🔍 FLY/WHYPEペア専用の結果詳細ログ
                if (isFlyWhypePair) {
                    console.log(`\n🔍 FLY/WHYPE スキャン時結果詳細:`);
                    console.log(`   AmountOut (wei): ${result.amountOut.toString()}`);
                    console.log(`   AmountOut (formatted): ${outputFormatted}`);
                    console.log(`   Rate: ${parseFloat(outputFormatted) / parseFloat(amountFormatted)}`);
                }
                
                return {
                    success: true,
                    amountOut: result.amountOut,
                    gasEstimate: result.gasEstimate || ethers.BigNumber.from(150000),
                };
            }

            if (!this.silent) {
                console.log(`   ❌ エラー: 出力なし`);
            }
            return {
                success: false,
                error: "No output or zero amount",
                amountOut: null,
                exclusionReason: "Zero or invalid output amount"
            };
        } catch (error) {
            // エラー分類
            let exclusionReason = "Unknown error";
            if (error.message.includes("execution reverted")) {
                exclusionReason = "Pool does not exist or insufficient liquidity";
            } else if (error.message.includes("missing revert data")) {
                exclusionReason = "Contract call failed - likely no pool";
            } else if (error.message.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
                exclusionReason = "Insufficient output amount";
            } else if (error.message.includes("INSUFFICIENT_LIQUIDITY")) {
                exclusionReason = "Insufficient liquidity";
            }

            if (!this.silent) {
                console.log(`   ❌ エラー: ${exclusionReason}`);
            }
            return {
                success: false,
                error: error.message,
                amountOut: null,
                exclusionReason: exclusionReason
            };
        }
    }

    /**
     * プロトコル詳細情報を取得
     */
    async getProtocolDetails(protocol) {
        // プロトコル詳細情報を取得する処理
        return {
            dex: protocol.dex,
            version: protocol.version,
            params: protocol.params
        };
    }

    /**
     * 双方向レート取得
     */
    async checkBidirectionalRates(pair, inputAmount) {
        const { tokenA, tokenB } = pair;
        const timestamp = new Date().toISOString();
        
        try {
            // 入力量をWeiに変換
            const amountInWei = ethers.utils.parseUnits(
                inputAmount.toString(), 
                tokenA.decimals
            );
            
            // 現在のクォート取得
            const currentQuote = await this.getQuote(
                'hyperswap',
                'v2',
                tokenA.address,
                tokenB.address,
                amountInWei,
                {}
            );
            
            if (!currentQuote.success) {
                throw new Error(`クォート取得失敗: ${currentQuote.exclusionReason}`);
            }
            
            const outputAmount = parseFloat(ethers.utils.formatUnits(
                currentQuote.amountOut,
                tokenB.decimals
            ));
            
            const rate = outputAmount / inputAmount;
            
            // 結果を返す
            return {
                success: true,
                rate: rate,
                outputAmount: outputAmount,
                timestamp: timestamp
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: timestamp
            };
        }
    }

    /**
     * 設定ファイルを読み込み
     */
    async loadConfig() {
        const configPath = path.join(__dirname, "../../config/trading-pairs-mainnet-v2-v3-integrated.json");
        const config = JSON.parse(await fs.readFile(configPath, "utf8"));
        return config;
    }

    /**
     * 通貨ペアの取得クォート
     */

    async checkBidirectionalRates(pairConfig, inputAmount) {
        await this.setupContracts();

        // V2/V3統合ファイルのデータ構造に対応
        const { tokenA, tokenB, hyperswapV2Available, hyperswapV3Available, 
                hyperswapAvailableFees, kittenswapV2Available, kittenswapV3Available,
                kittenswapAvailableTickSpacings } = pairConfig;

        // トークン情報取得
        const tokenAInfo = await this.getTokenInfo(tokenA.address);
        const tokenBInfo = await this.getTokenInfo(tokenB.address);

        console.log("\n🔄 V2/V3双方向流動性チェック");
        console.log("════════════════════════════════════════════════════════════════");
        console.log(`💰 ペア: ${tokenAInfo.symbol}/${tokenBInfo.symbol}`);
        console.log(`💰 入力量: ${inputAmount} トークン`);
        console.log(`📊 利用可能プロトコル:`);
        console.log(`   HyperSwap V2: ${hyperswapV2Available ? '✅' : '❌'}`);
        console.log(`   HyperSwap V3: ${hyperswapV3Available ? '✅' : '❌'} ${hyperswapV3Available ? `(手数料: ${hyperswapAvailableFees?.map(f => (f/10000).toFixed(2)+'%').join(', ')})` : ''}`);
        console.log(`   KittenSwap V2: ${kittenswapV2Available ? '✅' : '❌'}`);
        console.log(`   KittenSwap V3: ${kittenswapV3Available ? '✅' : '❌'} ${kittenswapV3Available ? `(TickSpacing: ${kittenswapAvailableTickSpacings?.join(', ')})` : ''}`);
        console.log("════════════════════════════════════════════════════════════════");

        const amountAWei = ethers.utils.parseUnits(
            inputAmount.toString(),
            tokenAInfo.decimals
        );
        const amountBWei = ethers.utils.parseUnits(
            inputAmount.toString(),
            tokenBInfo.decimals
        );

        console.log("\n📊 全プロトコル×全方向レート取得中...");

        // 利用可能な全プロトコルで並列取得
        const promises = [];
        const protocolInfo = [];

        // HyperSwap V2
        if (hyperswapV2Available) {
            promises.push(
                this.getQuote("hyperswap", "v2", tokenA.address, tokenB.address, amountAWei, {}),
                this.getQuote("hyperswap", "v2", tokenB.address, tokenA.address, amountBWei, {})
            );
            protocolInfo.push({ dex: "hyperswap", protocol: "v2", direction: "A→B" });
            protocolInfo.push({ dex: "hyperswap", protocol: "v2", direction: "B→A" });
        }

        // HyperSwap V3 - 全てのfee tierで取得
        if (hyperswapV3Available && hyperswapAvailableFees?.length > 0) {
            for (const fee of hyperswapAvailableFees) {
                promises.push(
                    this.getQuote("hyperswap", "v3", tokenA.address, tokenB.address, amountAWei, { fee }),
                    this.getQuote("hyperswap", "v3", tokenB.address, tokenA.address, amountBWei, { fee })
                );
                protocolInfo.push({ dex: "hyperswap", protocol: "v3", direction: "A→B", fee });
                protocolInfo.push({ dex: "hyperswap", protocol: "v3", direction: "B→A", fee });
            }
        }

        // KittenSwap V2
        if (kittenswapV2Available) {
            promises.push(
                this.getQuote("kittenswap", "v2", tokenA.address, tokenB.address, amountAWei, {}),
                this.getQuote("kittenswap", "v2", tokenB.address, tokenA.address, amountBWei, {})
            );
            protocolInfo.push({ dex: "kittenswap", protocol: "v2", direction: "A→B" });
            protocolInfo.push({ dex: "kittenswap", protocol: "v2", direction: "B→A" });
        }

        // KittenSwap V3 - 全てのtick spacingで取得
        if (kittenswapV3Available && kittenswapAvailableTickSpacings?.length > 0) {
            for (const tickSpacing of kittenswapAvailableTickSpacings) {
                promises.push(
                    this.getQuote("kittenswap", "v3", tokenA.address, tokenB.address, amountAWei, { tickSpacing }),
                    this.getQuote("kittenswap", "v3", tokenB.address, tokenA.address, amountBWei, { tickSpacing })
                );
                protocolInfo.push({ dex: "kittenswap", protocol: "v3", direction: "A→B", tickSpacing });
                protocolInfo.push({ dex: "kittenswap", protocol: "v3", direction: "B→A", tickSpacing });
            }
        }

        const quoteResults = await Promise.all(promises);

        // 結果を整理して表示
        console.log("\n📊 取得結果:");
        
        for (let i = 0; i < quoteResults.length; i++) {
            const result = quoteResults[i];
            const info = protocolInfo[i];
            const protocolName = info.protocol === "v3" 
                ? `${info.dex.toUpperCase()} V3 (${info.fee || info.tickSpacing})`
                : `${info.dex.toUpperCase()} V2`;
            
            console.log(`\n${info.direction} - ${protocolName}:`);
            if (result.success) {
                const outputFormatted = ethers.utils.formatUnits(
                    result.amountOut,
                    info.direction === "A→B" ? tokenBInfo.decimals : tokenAInfo.decimals
                );
                console.log(`   ✅ 成功: ${parseFloat(outputFormatted).toFixed(6)} トークン`);
                console.log(`   ⛽ ガス見積もり: ${result.gasEstimate.toString()}`);
                if (info.fee) {
                    console.log(`   💰 手数料: ${(info.fee / 10000).toFixed(2)}%`);
                }
                if (info.tickSpacing) {
                    console.log(`   🎯 TickSpacing: ${info.tickSpacing}`);
                }
            } else {
                console.log(`   ❌ 失敗: ${result.error}`);
            }
        }

        // アービトラージ機会分析
        this.analyzeArbitrageOpportunities(quoteResults, protocolInfo, tokenAInfo, tokenBInfo, inputAmount);
        
        return {
            success: true,
            protocolResults: quoteResults.map((result, i) => ({
                ...result,
                ...protocolInfo[i]
            }))
        };
    }

    analyzeArbitrageOpportunities(results, protocolInfo, tokenAInfo, tokenBInfo, inputAmount) {
        console.log("\n🚀 アービトラージ機会分析:");
        console.log("════════════════════════════════════════════════════════════════");
        
        // A→B方向の結果を収集
        const aToB_Results = [];
        const bToA_Results = [];
        
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const info = protocolInfo[i];
            
            if (result.success) {
                const outputFormatted = parseFloat(ethers.utils.formatUnits(
                    result.amountOut,
                    info.direction === "A→B" ? tokenBInfo.decimals : tokenAInfo.decimals
                ));
                
                const protocolName = info.protocol === "v3" 
                    ? `${info.dex.toUpperCase()} V3 (${info.fee || info.tickSpacing})`
                    : `${info.dex.toUpperCase()} V2`;
                
                if (info.direction === "A→B") {
                    aToB_Results.push({
                        protocol: protocolName,
                        output: outputFormatted,
                        rate: outputFormatted / inputAmount,
                        gasEstimate: result.gasEstimate,
                        dex: info.dex,
                        protocolVersion: info.protocol,
                        fee: info.fee,
                        tickSpacing: info.tickSpacing
                    });
                } else {
                    bToA_Results.push({
                        protocol: protocolName,
                        output: outputFormatted,
                        rate: outputFormatted / inputAmount,
                        gasEstimate: result.gasEstimate,
                        dex: info.dex,
                        protocolVersion: info.protocol,
                        fee: info.fee,
                        tickSpacing: info.tickSpacing
                    });
                }
            }
        }
        
        // A→B方向での最良・最悪レート
        if (aToB_Results.length > 1) {
            const bestA2B = aToB_Results.reduce((best, current) => 
                current.rate > best.rate ? current : best
            );
            const worstA2B = aToB_Results.reduce((worst, current) => 
                current.rate < worst.rate ? current : worst
            );
            
            // 異常値フィルター付きスプレッド計算
            const spreadA2B = worstA2B.rate < 1e-6 ? 0 : ((bestA2B.rate - worstA2B.rate) / worstA2B.rate * 100);
            
            console.log(`\n📈 ${tokenAInfo.symbol} → ${tokenBInfo.symbol} 方向:`);
            console.log(`   🏆 最良: ${bestA2B.protocol} - レート ${bestA2B.rate.toFixed(6)}`);
            console.log(`   📉 最悪: ${worstA2B.protocol} - レート ${worstA2B.rate.toFixed(6)}`);
            console.log(`   📊 スプレッド: ${spreadA2B.toFixed(2)}%`);
            
            if (spreadA2B > 1.0) {
                console.log(`   🚀 アービトラージ機会あり! (1%以上のスプレッド)`);
            }
            
            // 🆕 全組み合わせのアービトラージ機会表示
            console.log(`\n   🔄 全アービトラージ組み合わせ (閾値1%以上):`);
            const opportunities = [];
            for (let i = 0; i < aToB_Results.length; i++) {
                for (let j = 0; j < aToB_Results.length; j++) {
                    if (i === j) continue;
                    
                    const buyRate = aToB_Results[i];
                    const sellRate = aToB_Results[j];
                    
                    // 異常値フィルター
                    if (buyRate.rate < 1e-6 || sellRate.rate < 1e-6) continue;
                    
                    const spread = ((sellRate.rate - buyRate.rate) / buyRate.rate * 100);
                    
                    if (spread > 1.0) {
                        opportunities.push({
                            buyProtocol: buyRate.protocol,
                            sellProtocol: sellRate.protocol,
                            spread: spread
                        });
                    }
                }
            }
            
            // スプレッド降順でソート
            opportunities.sort((a, b) => b.spread - a.spread);
            
            if (opportunities.length > 0) {
                opportunities.slice(0, 5).forEach((opp, index) => {
                    console.log(`     ${index + 1}. ${opp.buyProtocol} → ${opp.sellProtocol}: ${opp.spread.toFixed(2)}%`);
                });
                if (opportunities.length > 5) {
                    console.log(`     ... 他${opportunities.length - 5}個の機会`);
                }
            } else {
                console.log(`     機会なし (1%未満)`);
            }
        }
        
        // B→A方向での最良・最悪レート
        if (bToA_Results.length > 1) {
            const bestB2A = bToA_Results.reduce((best, current) => 
                current.rate > best.rate ? current : best
            );
            const worstB2A = bToA_Results.reduce((worst, current) => 
                current.rate < worst.rate ? current : worst
            );
            
            // 異常値フィルター付きスプレッド計算
            const spreadB2A = worstB2A.rate < 1e-6 ? 0 : ((bestB2A.rate - worstB2A.rate) / worstB2A.rate * 100);
            
            console.log(`\n📈 ${tokenBInfo.symbol} → ${tokenAInfo.symbol} 方向:`);
            console.log(`   🏆 最良: ${bestB2A.protocol} - レート ${bestB2A.rate.toFixed(6)}`);
            console.log(`   📉 最悪: ${worstB2A.protocol} - レート ${worstB2A.rate.toFixed(6)}`);
            console.log(`   📊 スプレッド: ${spreadB2A.toFixed(2)}%`);
            
            if (spreadB2A > 1.0) {
                console.log(`   🚀 アービトラージ機会あり! (1%以上のスプレッド)`);
            }
            
            // 🆕 全組み合わせのアービトラージ機会表示
            console.log(`\n   🔄 全アービトラージ組み合わせ (閾値1%以上):`);
            const opportunitiesB2A = [];
            for (let i = 0; i < bToA_Results.length; i++) {
                for (let j = 0; j < bToA_Results.length; j++) {
                    if (i === j) continue;
                    
                    const buyRate = bToA_Results[i];
                    const sellRate = bToA_Results[j];
                    
                    // 異常値フィルター
                    if (buyRate.rate < 1e-6 || sellRate.rate < 1e-6) continue;
                    
                    const spread = ((sellRate.rate - buyRate.rate) / buyRate.rate * 100);
                    
                    if (spread > 1.0) {
                        opportunitiesB2A.push({
                            buyProtocol: buyRate.protocol,
                            sellProtocol: sellRate.protocol,
                            spread: spread
                        });
                    }
                }
            }
            
            // スプレッド降順でソート
            opportunitiesB2A.sort((a, b) => b.spread - a.spread);
            
            if (opportunitiesB2A.length > 0) {
                opportunitiesB2A.slice(0, 5).forEach((opp, index) => {
                    console.log(`     ${index + 1}. ${opp.buyProtocol} → ${opp.sellProtocol}: ${opp.spread.toFixed(2)}%`);
                });
                if (opportunitiesB2A.length > 5) {
                    console.log(`     ... 他${opportunitiesB2A.length - 5}個の機会`);
                }
            } else {
                console.log(`     機会なし (1%未満)`);
            }
        }
        
        return {
            aToB: aToB_Results,
            bToA: bToA_Results,
            bestA2B: aToB_Results.length > 1 ? aToB_Results.reduce((best, current) => current.rate > best.rate ? current : best) : null,
            bestB2A: bToA_Results.length > 1 ? bToA_Results.reduce((best, current) => current.rate > best.rate ? current : best) : null,
            spreadA2B: aToB_Results.length > 1 ? ((aToB_Results.reduce((best, current) => current.rate > best.rate ? current : best).rate - aToB_Results.reduce((worst, current) => current.rate < worst.rate ? current : worst).rate) / aToB_Results.reduce((worst, current) => current.rate < worst.rate ? current : worst).rate * 100) : 0,
            spreadB2A: bToA_Results.length > 1 ? ((bToA_Results.reduce((best, current) => current.rate > best.rate ? current : best).rate - bToA_Results.reduce((worst, current) => current.rate < worst.rate ? current : worst).rate) / bToA_Results.reduce((worst, current) => current.rate < worst.rate ? current : worst).rate * 100) : 0
        };
    }

    // 設定ファイルを読み込む既存メソッド（既存のままで動作）
    async loadConfig() {
        const configPath = path.join(
            __dirname,
            "../../config/trading-pairs-mainnet-v2-v3-integrated.json"
        );
        const data = JSON.parse(await fs.readFile(configPath, "utf8"));

        // V2/V3統合データから利用可能ペアのみフィルタ
        const availablePairs = data.verifiedPairs.filter(pair => 
            (pair.hyperswapV2Available || pair.hyperswapV3Available || 
             pair.kittenswapV2Available || pair.kittenswapV3Available) &&
            pair.availableOn.length > 0
        );

        console.log(`📋 V2/V3統合データ読み込み: ${availablePairs.length}個のペア設定`);
        console.log(`✅ 利用可能プロトコル: V2/V3両対応`);

        return availablePairs;
    }

    async generateProtocolCombinations(pairConfig) {
        const combinations = [];
        const availableProtocols = [];
        
        // 利用可能なプロトコルを収集
        if (pairConfig.hyperswapV2Available) {
            availableProtocols.push({ dex: "hyperswap", protocol: "v2" });
        }
        if (pairConfig.hyperswapV3Available && pairConfig.hyperswapAvailableFees?.length > 0) {
            availableProtocols.push({ dex: "hyperswap", protocol: "v3", fee: pairConfig.hyperswapAvailableFees[0] });
        }
        if (pairConfig.kittenswapV2Available) {
            availableProtocols.push({ dex: "kittenswap", protocol: "v2" });
        }
        if (pairConfig.kittenswapV3Available && pairConfig.kittenswapAvailableTickSpacings?.length > 0) {
            availableProtocols.push({ dex: "kittenswap", protocol: "v3", tickSpacing: pairConfig.kittenswapAvailableTickSpacings[0] });
        }
        
        // 全ての組み合わせを生成（同じDEXの異なるバージョンも含む）
        for (let i = 0; i < availableProtocols.length; i++) {
            for (let j = i + 1; j < availableProtocols.length; j++) {
                combinations.push({
                    from: availableProtocols[i],
                    to: availableProtocols[j]
                });
            }
        }
        
        return combinations;
    }

    async checkArbitrageForPair(pairConfig, tokenAmount, threshold = 1.0) {
        const { tokenA, tokenB } = pairConfig;
        const tokenAInfo = await this.getTokenInfo(tokenA.address);
        const tokenBInfo = await this.getTokenInfo(tokenB.address);
        
        const amountWei = ethers.utils.parseUnits(
            tokenAmount.toString(),
            tokenAInfo.decimals
        );
        
        // 全プロトコルでのレート取得
        const quotes = [];
        const protocolInfo = [];
        const exclusions = [];
        
        // HyperSwap V2
        if (pairConfig.hyperswapV2Available) {
            const quote = await this.getQuote("hyperswap", "v2", tokenA.address, tokenB.address, amountWei, {});
            quotes.push(quote);
            protocolInfo.push({ dex: "hyperswap", protocol: "v2" });
            if (!quote.success) {
                exclusions.push(`HyperSwap V2: ${quote.exclusionReason || quote.error}`);
            }
        }
        
        // HyperSwap V3 - 全てのfee tierで取得
        if (pairConfig.hyperswapV3Available && pairConfig.hyperswapAvailableFees?.length > 0) {
            for (const fee of pairConfig.hyperswapAvailableFees) {
                const quote = await this.getQuote("hyperswap", "v3", tokenA.address, tokenB.address, amountWei, { fee });
                quotes.push(quote);
                protocolInfo.push({ dex: "hyperswap", protocol: "v3", fee });
                if (!quote.success) {
                    exclusions.push(`HyperSwap V3 (${fee}): ${quote.exclusionReason || quote.error}`);
                }
            }
        }
        
        // KittenSwap V2
        if (pairConfig.kittenswapV2Available) {
            const quote = await this.getQuote("kittenswap", "v2", tokenA.address, tokenB.address, amountWei, {});
            quotes.push(quote);
            protocolInfo.push({ dex: "kittenswap", protocol: "v2" });
            if (!quote.success) {
                exclusions.push(`KittenSwap V2: ${quote.exclusionReason || quote.error}`);
            }
        }
        
        // KittenSwap V3 - 全てのtick spacingで取得
        if (pairConfig.kittenswapV3Available && pairConfig.kittenswapAvailableTickSpacings?.length > 0) {
            for (const tickSpacing of pairConfig.kittenswapAvailableTickSpacings) {
                const quote = await this.getQuote("kittenswap", "v3", tokenA.address, tokenB.address, amountWei, { tickSpacing });
                quotes.push(quote);
                protocolInfo.push({ dex: "kittenswap", protocol: "v3", tickSpacing });
                if (!quote.success) {
                    exclusions.push(`KittenSwap V3 (tick ${tickSpacing}): ${quote.exclusionReason || quote.error}`);
                }
            }
        }
        
        // 成功したレートの中から最良・最悪を計算
        const successfulQuotes = quotes
            .map((quote, i) => ({ ...quote, ...protocolInfo[i] }))
            .filter(q => q.success && q.amountOut !== null);
        
        // 全組み合わせ（表示用）は成功したクォートが1つでも計算する
        const allCombinations = this.calculateAllCombinationsForDisplay(
            successfulQuotes.map(q => {
                const outputFormatted = parseFloat(ethers.utils.formatUnits(
                    q.amountOut,
                    tokenBInfo.decimals
                ));
                const protocolLabel = q.protocol === "v3" 
                    ? `${q.dex.toUpperCase()} V3 (${q.fee || q.tickSpacing})`
                    : `${q.dex.toUpperCase()} V2`;
                return {
                    ...q,
                    rate: outputFormatted / tokenAmount,
                    output: outputFormatted,
                    protocol: protocolLabel
                };
            }),
            tokenAmount,
            tokenAInfo,
            tokenBInfo
        );

        if (successfulQuotes.length < 2) {
            return { 
                hasOpportunity: false, 
                spread: 0,
                exclusions: exclusions,
                validProtocols: successfulQuotes.length,
                configProtocols: quotes.length,
                allOpportunities: [],
                allCombinations: allCombinations,
                allRates: successfulQuotes.map(q => {
                    const outputFormatted = parseFloat(ethers.utils.formatUnits(
                        q.amountOut,
                        tokenBInfo.decimals
                    ));
                    const protocolLabel = q.protocol === "v3" 
                        ? `${q.dex.toUpperCase()} V3 (${q.fee || q.tickSpacing})`
                        : `${q.dex.toUpperCase()} V2`;
                    return {
                        ...q,
                        rate: outputFormatted / tokenAmount,
                        output: outputFormatted,
                        protocol: protocolLabel
                    };
                }),
                totalCombinations: allCombinations.length
            };
        }
        
        const rates = successfulQuotes.map(q => {
            const outputFormatted = parseFloat(ethers.utils.formatUnits(
                q.amountOut,
                tokenBInfo.decimals
            ));
            const protocolLabel = q.protocol === "v3" 
                ? `${q.dex.toUpperCase()} V3 (${q.fee || q.tickSpacing})`
                : `${q.dex.toUpperCase()} V2`;
            return {
                ...q,
                rate: outputFormatted / tokenAmount,
                output: outputFormatted,
                protocolLabel
            };
        });
        
        // 全ての組み合わせでアービトラージ機会を計算
        const allOpportunities = [];
        for (let i = 0; i < rates.length; i++) {
            for (let j = 0; j < rates.length; j++) {
                if (i === j) continue;
                
                const buyRate = rates[i];
                const sellRate = rates[j];
                
                // 異常値フィルター
                if (buyRate.rate < 1e-6 || sellRate.rate < 1e-6) continue;
                if (buyRate.output < 0.000001 || sellRate.output < 0.000001) continue;
                
                const rateRatio = Math.max(buyRate.rate, sellRate.rate) / Math.min(buyRate.rate, sellRate.rate);
                if (rateRatio > 100) continue;
                
                const spread = ((sellRate.rate - buyRate.rate) / buyRate.rate * 100);
                
                // スプレッドが異常または闾値未満の場合はスキップ
                if (spread > 100 || spread < threshold) continue;
                
                allOpportunities.push({
                    buyProtocol: buyRate.protocolLabel,
                    sellProtocol: sellRate.protocolLabel,
                    buyRate: buyRate.rate,
                    sellRate: sellRate.rate,
                    spread,
                    profit: spread // 以降の拡張用
                });
            }
        }
        
        // スプレッド降順でソート
        allOpportunities.sort((a, b) => b.spread - a.spread);
        
        // 最良・最悪も計算（後方互換性のため）
        const bestRate = rates.reduce((best, current) => 
            current.rate > best.rate ? current : best
        );
        const worstRate = rates.reduce((worst, current) => 
            current.rate < worst.rate ? current : worst
        );
        
        const maxSpread = allOpportunities.length > 0 ? allOpportunities[0].spread : 0;
        
        return {
            hasOpportunity: allOpportunities.length > 0,
            spread: maxSpread, // 最大スプレッド
            bestProtocol: bestRate.protocolLabel,
            worstProtocol: worstRate.protocolLabel,
            bestRate: bestRate.rate,
            worstRate: worstRate.rate,
            tokenAmount,
            pairName: pairConfig.name,
            exclusions: exclusions,
            validProtocols: successfulQuotes.length,
            configProtocols: quotes.length,
            allOpportunities // 全てのアービトラージ機会
        };
    }

    async getAllProtocolRates(pairConfig, tokenAmount) {
        const { tokenA, tokenB } = pairConfig;
        const tokenAInfo = await this.getTokenInfo(tokenA.address);
        const tokenBInfo = await this.getTokenInfo(tokenB.address);
        
        const amountWei = ethers.utils.parseUnits(
            tokenAmount.toString(),
            tokenAInfo.decimals
        );
        
        const allRates = [];
        const exclusions = [];
        
        // HyperSwap V2
        if (pairConfig.hyperswapV2Available) {
            const quote = await this.getQuote("hyperswap", "v2", tokenA.address, tokenB.address, amountWei, {});
            if (quote.success) {
                const outputFormatted = parseFloat(ethers.utils.formatUnits(
                    quote.amountOut,
                    tokenBInfo.decimals
                ));
                allRates.push({
                    protocol: "HYPERSWAP V2",
                    rate: outputFormatted / tokenAmount,
                    output: outputFormatted,
                    dex: "hyperswap",
                    version: "v2",
                    gasEstimate: quote.gasEstimate
                });
            } else {
                exclusions.push(`HyperSwap V2: ${quote.exclusionReason || quote.error}`);
            }
        }
        
        // HyperSwap V3 - 全てのfee tierで取得
        if (pairConfig.hyperswapV3Available && pairConfig.hyperswapAvailableFees?.length > 0) {
            for (const fee of pairConfig.hyperswapAvailableFees) {
                const quote = await this.getQuote("hyperswap", "v3", tokenA.address, tokenB.address, amountWei, { fee });
                if (quote.success) {
                    const outputFormatted = parseFloat(ethers.utils.formatUnits(
                        quote.amountOut,
                        tokenBInfo.decimals
                    ));
                    allRates.push({
                        protocol: `HYPERSWAP V3 (${fee})`,
                        rate: outputFormatted / tokenAmount,
                        output: outputFormatted,
                        dex: "hyperswap",
                        version: "v3",
                        fee: fee,
                        gasEstimate: quote.gasEstimate
                    });
                } else {
                    exclusions.push(`HyperSwap V3 (${fee}): ${quote.exclusionReason || quote.error}`);
                }
            }
        }
        
        // KittenSwap V2
        if (pairConfig.kittenswapV2Available) {
            const quote = await this.getQuote("kittenswap", "v2", tokenA.address, tokenB.address, amountWei, {});
            if (quote.success) {
                const outputFormatted = parseFloat(ethers.utils.formatUnits(
                    quote.amountOut,
                    tokenBInfo.decimals
                ));
                allRates.push({
                    protocol: "KITTENSWAP V2",
                    rate: outputFormatted / tokenAmount,
                    output: outputFormatted,
                    dex: "kittenswap",
                    version: "v2",
                    gasEstimate: quote.gasEstimate
                });
            } else {
                exclusions.push(`KittenSwap V2: ${quote.exclusionReason || quote.error}`);
            }
        }
        
        // KittenSwap V3 - 全てのtick spacingで取得
        if (pairConfig.kittenswapV3Available && pairConfig.kittenswapAvailableTickSpacings?.length > 0) {
            for (const tickSpacing of pairConfig.kittenswapAvailableTickSpacings) {
                const quote = await this.getQuote("kittenswap", "v3", tokenA.address, tokenB.address, amountWei, { tickSpacing });
                if (quote.success) {
                    const outputFormatted = parseFloat(ethers.utils.formatUnits(
                        quote.amountOut,
                        tokenBInfo.decimals
                    ));
                    allRates.push({
                        protocol: `KITTENSWAP V3 (${tickSpacing})`,
                        rate: outputFormatted / tokenAmount,
                        output: outputFormatted,
                        dex: "kittenswap",
                        version: "v3",
                        tickSpacing: tickSpacing,
                        gasEstimate: quote.gasEstimate
                    });
                } else {
                    exclusions.push(`KittenSwap V3 (tick ${tickSpacing}): ${quote.exclusionReason || quote.error}`);
                }
            }
        }
        
        return { allRates, exclusions };
    }

    calculateAllPriceDifferenceCombinations(allRates, threshold = 1.0) {
        const opportunities = [];
        
        // 全ペア間の組み合わせ (nC2方式)
        for (let i = 0; i < allRates.length; i++) {
            for (let j = 0; j < allRates.length; j++) {
                if (i === j) continue;
                
                const buyProtocol = allRates[i];
                const sellProtocol = allRates[j];
                
                // 異常値フィルター
                if (buyProtocol.rate < 1e-6 || sellProtocol.rate < 1e-6) continue;
                if (buyProtocol.output < 0.000001 || sellProtocol.output < 0.000001) continue;
                
                const rateRatio = Math.max(buyProtocol.rate, sellProtocol.rate) / Math.min(buyProtocol.rate, sellProtocol.rate);
                if (rateRatio > 100) continue;
                
                // buyRate < sellRate の場合のみ処理（正しい価格差のみ）
                if (buyProtocol.rate < sellProtocol.rate) {
                    const spread = ((sellProtocol.rate - buyProtocol.rate) / buyProtocol.rate * 100);
                    
                    if (spread >= threshold && spread <= 100) { // 100%以下のスプレッドのみ
                        opportunities.push({
                            buyProtocol: buyProtocol.protocol,
                            sellProtocol: sellProtocol.protocol,
                            buyRate: buyProtocol.rate,
                            sellRate: sellProtocol.rate,
                            spread: spread,
                            buyDex: buyProtocol.dex,
                            sellDex: sellProtocol.dex,
                            crossDex: buyProtocol.dex !== sellProtocol.dex,
                            estimatedGasCost: (buyProtocol.gasEstimate || 0) + (sellProtocol.gasEstimate || 0),
                            profit: spread, // 基本利益（ガス費用は別途計算）
                            _debug: {
                                comparison: `${buyProtocol.protocol}(${buyProtocol.rate.toFixed(6)}) → ${sellProtocol.protocol}(${sellProtocol.rate.toFixed(6)})`,
                                rateRatio: (sellProtocol.rate / buyProtocol.rate).toFixed(4)
                            }
                        });
                    }
                }
            }
        }
        
        // スプレッド降順でソート
        return opportunities.sort((a, b) => b.spread - a.spread);
    }

    /**
     * 全組み合わせを計算（閾値フィルタリングなし）
     * ダッシュボードの「全組み合わせ」タブ用
     */
    calculateAllCombinationsForDisplay(allRates, tokenAmount = 1, tokenA = null, tokenB = null, isArbitrage = false) {
        const combinations = [];
        
        // レートが1つの場合はそのプロトコル情報のみを表示
        if (allRates.length === 1) {
            const protocol = allRates[0];
            combinations.push({
                buyProtocol: protocol.protocol,
                sellProtocol: "N/A",
                buyRate: protocol.rate,
                sellRate: 0,
                spread: 0,
                buyDex: protocol.dex,
                sellDex: "N/A",
                crossDex: false,
                estimatedGasCost: protocol.gasEstimate || 0,
                profit: 0,
                _debug: {
                    comparison: `${protocol.protocol} (単一プロトコル)`,
                    rateRatio: "1.0000",
                    buyRateDetail: isArbitrage && tokenA ? `<div style="font-family: monospace; white-space: pre-line; background: #fff3cd; padding: 15px; border-radius: 8px;">
📈 <strong>買い注文詳細 (単一プロトコル)</strong>

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔸 <strong>入力金額:</strong>     ${tokenAmount.toLocaleString()} ${tokenA.symbol}
┃ 🔸 <strong>出力金額:</strong>     ${protocol.output.toLocaleString()} ${tokenB?.symbol || 'TOKEN'}
┃ 🔸 <strong>プロトコル:</strong>   ${protocol.protocol}
┃ 🔸 <strong>交換レート:</strong>   1 ${tokenA.symbol} = ${protocol.rate.toFixed(6)} ${tokenB?.symbol || 'TOKEN'}
┃ 🔸 <strong>ガス見積もり:</strong> ${protocol.gasEstimate?.toLocaleString() || 'N/A'} gas
┃ ✅ <em>実際のコントラクトクォート使用</em>
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

<div style="background: #ffeaa7; padding: 10px; border-radius: 5px; margin-top: 10px; border-left: 4px solid #fdcb6e;">
ℹ️ <strong>注意:</strong> 他のプロトコルが利用不可のため、アービトラージ不可能
</div>
</div>` : `1 → ${protocol.rate.toFixed(6)}`,
                    sellRateDetail: "N/A (単一プロトコル)"
                }
            });
            return combinations;
        }
        
        // 全ペア間の組み合わせ (nC2方式)
        for (let i = 0; i < allRates.length; i++) {
            for (let j = 0; j < allRates.length; j++) {
                if (i === j) continue;
                
                const buyProtocol = allRates[i];
                const sellProtocol = allRates[j];
                
                // 最小限の基本チェックのみ（ほぼ全て通す）
                const isValidBuyRate = buyProtocol.rate > 0 && !isNaN(buyProtocol.rate) && isFinite(buyProtocol.rate);
                const isValidSellRate = sellProtocol.rate > 0 && !isNaN(sellProtocol.rate) && isFinite(sellProtocol.rate);
                const isValidBuyOutput = buyProtocol.output > 0 && !isNaN(buyProtocol.output) && isFinite(buyProtocol.output);
                const isValidSellOutput = sellProtocol.output > 0 && !isNaN(sellProtocol.output) && isFinite(sellProtocol.output);
                
                // 数値として有効でない場合のみ除外
                if (!isValidBuyRate || !isValidSellRate || !isValidBuyOutput || !isValidSellOutput) continue;

                // 全ての組み合わせを表示（spread計算）
                const spread = buyProtocol.rate < sellProtocol.rate ? 
                    ((sellProtocol.rate - buyProtocol.rate) / buyProtocol.rate * 100) :
                    ((buyProtocol.rate - sellProtocol.rate) / sellProtocol.rate * 100) * -1; // 負のスプレッド
                
                // 数値として有効でない場合のみ除外
                if (!isNaN(spread) && isFinite(spread)) {
                    combinations.push({
                        buyProtocol: buyProtocol.protocol,
                        sellProtocol: sellProtocol.protocol,
                        buyRate: buyProtocol.rate,
                        sellRate: sellProtocol.rate,
                        spread: spread,
                        buyDex: buyProtocol.dex,
                        sellDex: sellProtocol.dex,
                        crossDex: buyProtocol.dex !== sellProtocol.dex,
                        estimatedGasCost: (buyProtocol.gasEstimate || 0) + (sellProtocol.gasEstimate || 0),
                        profit: spread > 0 ? spread : 0, // 正のスプレッドのみ利益とみなす
                        _debug: {
                            comparison: `${buyProtocol.protocol}(${buyProtocol.rate.toFixed(6)}) → ${sellProtocol.protocol}(${sellProtocol.rate.toFixed(6)})`,
                            rateRatio: (Math.max(buyProtocol.rate, sellProtocol.rate) / Math.min(buyProtocol.rate, sellProtocol.rate)).toFixed(4),
                            buyRateDetail: isArbitrage && tokenA ? `<div style="font-family: monospace; white-space: pre-line; background: #d4edda; padding: 15px; border-radius: 8px;">
📈 <strong>買い注文詳細 (Step 1: A→B)</strong>
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔸 <strong>入力金額:</strong>     ${tokenAmount.toLocaleString()} ${tokenA.symbol}
┃ 🔸 <strong>出力金額:</strong>     ${buyProtocol.output.toLocaleString()} ${tokenB?.symbol || 'TOKEN'}
┃ 🔸 <strong>プロトコル:</strong>   ${buyProtocol.protocol}
┃ 🔸 <strong>交換レート:</strong>   1 ${tokenA.symbol} = ${buyProtocol.rate.toFixed(6)} ${tokenB?.symbol || 'TOKEN'}
┃ 🔸 <strong>ガス見積もり:</strong> ${buyProtocol.gasEstimate?.toLocaleString() || 'N/A'} gas
┃ ✅ <em>実際のコントラクトクォート使用</em>
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
</div>` : `1 → ${buyProtocol.rate.toFixed(6)}`,
                            sellRateDetail: isArbitrage && tokenB ? `<div style="font-family: monospace; white-space: pre-line; background: #f8d7da; padding: 15px; border-radius: 8px;">
📉 <strong>売り注文詳細 (Step 2: B→A)</strong>
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔸 <strong>入力金額:</strong>     ${buyProtocol.output.toFixed(6)} ${tokenB.symbol} (買い注文の出力)
┃ 🔸 <strong>出力金額:</strong>     ${(buyProtocol.output * sellProtocol.rate).toFixed(6)} ${tokenA?.symbol || 'TOKEN'}
┃ 🔸 <strong>プロトコル:</strong>   ${sellProtocol.protocol}
┃ 🔸 <strong>交換レート:</strong>   1 ${tokenB.symbol} = ${sellProtocol.rate.toFixed(6)} ${tokenA?.symbol || 'TOKEN'}
┃ 🔸 <strong>ガス見積もり:</strong> ${sellProtocol.gasEstimate?.toLocaleString() || 'N/A'} gas
┃ ⚠️ <em>注意: 概算値（実際の流動性影響は考慮されていません）</em>
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
</div>` : `1 → ${sellProtocol.rate.toFixed(6)}`
                        }
                    });
                }
            }
        }
        
        // スプレッド降順でソート（負のスプレッドも含む）
        return combinations.sort((a, b) => b.spread - a.spread);
    }

    /**
     * 真のアービトラージ機会を計算（双方向レート）
     * A→B（買い）+ B→A（売り）のラウンドトリップ
     */
    async calculateTrueArbitrageCombinationsV2(pairConfig, tokenAmount, threshold = 0.1) {
        const tokenA = await this.getTokenInfo(pairConfig.tokenA.address);
        const tokenB = await this.getTokenInfo(pairConfig.tokenB.address);
        
        // A→B方向のプール取得（買い注文用）
        const { allRates: forwardPools, exclusions: forwardExclusions } = 
            await this.getAllProtocolRates(pairConfig, tokenAmount);
        
        // B→A方向のプール取得（売り注文用）
        const reversePairConfig = {
            ...pairConfig,
            tokenA: pairConfig.tokenB,
            tokenB: pairConfig.tokenA
        };
        const { allRates: reversePools, exclusions: reverseExclusions } = 
            await this.getAllProtocolRates(reversePairConfig, tokenAmount);

        const opportunities = [];
        const allExecutionResults = []; // 全ての実行結果を記録（利益・損失問わず）
        const allExclusions = [...forwardExclusions, ...reverseExclusions];

        // 各プール組み合わせでA→B→A実行
        if (!this.silent) {
            console.log(`\n🔄 真のアービトラージ計算: ${pairConfig.name} (${tokenAmount}トークン)`);
            console.log(`   利用可能プール: ${forwardPools.length}買い × ${reversePools.length}売り = ${forwardPools.length * reversePools.length}組み合わせ`);
        }
        
        for (const buyPool of forwardPools) {
            for (const sellPool of reversePools) {
                // A→B→A実行計算
                if (buyPool.rate < 1e-6 || sellPool.rate < 1e-6) continue;
                if (buyPool.output < 0.000001 || sellPool.output < 0.000001) continue;

                // 真のアービトラージ計算
                // Step 1: tokenAmount A → buyPool.output B (買い) - 実際のコントラクトクォート
                const intermediateB = buyPool.output;  // A→Bで得られるB量（実際のコントラクト出力）
                
                // Step 2: 実際の買い注文出力量でB→Aの売り注文クォートを取得
                const sellDex = sellPool.dex;
                const sellVersion = sellPool.version;
                const sellTokenA = pairConfig.tokenB.address;  // 売り注文ではB→A
                const sellTokenB = pairConfig.tokenA.address;  // 売り注文ではB→A
                const sellAmountWei = ethers.utils.parseUnits(intermediateB.toString(), tokenB.decimals);
                
                // 簡潔なアービトラージ計算ログ
                const crossDex = buyPool.dex !== sellPool.dex;
                const dexIndicator = crossDex ? '🔄' : '🔁';
                if (!this.silent) {
                    console.log(`   ${dexIndicator} ${buyPool.protocol} → ${sellPool.protocol} (${intermediateB.toFixed(6)} ${tokenB.symbol})`);
                }
                
                // 実際のコントラクトから売り注文クォート取得
                let sellQuote;
                if (sellVersion === "v3") {
                    // DEX種類に応じて正しいパラメータを使用
                    let sellOptions;
                    if (sellDex === "hyperswap") {
                        // HyperSwap V3はfeeパラメータ使用
                        sellOptions = { fee: sellPool.fee };
                    } else if (sellDex === "kittenswap") {
                        // KittenSwap V3はtickSpacingパラメータ使用
                        sellOptions = { tickSpacing: sellPool.tickSpacing };
                    }
                    sellQuote = await this.getQuote(sellDex, sellVersion, sellTokenA, sellTokenB, sellAmountWei, sellOptions);
                } else {
                    sellQuote = await this.getQuote(sellDex, sellVersion, sellTokenA, sellTokenB, sellAmountWei, {});
                }
                
                if (!sellQuote.success) {
                    if (!this.silent) {
                        console.log(`     ❌ 売り注文失敗: ${sellQuote.exclusionReason || sellQuote.error}`);
                    }
                    
                    // 売り注文失敗も実行結果として記録
                    const failedExecutionResult = {
                        buyProtocol: buyPool.protocol,
                        sellProtocol: sellPool.protocol,
                        buyRate: buyPool.rate,
                        sellRate: 0, // 失敗
                        spread: -100, // 失敗を示す
                        profitPercentage: -100,
                        profit: -tokenAmount, // 全額損失
                        buyDex: buyPool.dex,
                        sellDex: sellPool.dex,
                        crossDex: buyPool.dex !== sellPool.dex,
                        estimatedGasCost: (buyPool.gasEstimate || 0),
                        executionStatus: "売りで失敗", // 🆕 実行状態を追加
                        _debug: {
                            // 🆕 フロー表示用データ（失敗ケース）
                            initialAmount: tokenAmount,
                            intermediateAmount: intermediateB,
                            finalAmount: 0, // 失敗
                            tokenASymbol: tokenA.symbol,
                            tokenBSymbol: tokenB.symbol,
                            step2Failed: true,
                            sellFailureReason: sellQuote.exclusionReason || sellQuote.error,
                            
                            // 既存のデータ
                            step1: `${tokenAmount} ${tokenA.symbol} → ${buyPool.output.toFixed(6)} ${tokenB.symbol}`,
                            step2: `売り注文失敗: ${sellQuote.exclusionReason || sellQuote.error}`,
                            finalProfit: `失敗`,
                            profitPercentage: `-100%`,
                            comparison: `${buyPool.protocol} → ${sellPool.protocol} (失敗)`,
                            rateRatio: "0.0000",
                            buyRateDetail: `📈 買い注文詳細 (Step 1: A→B) ✅ 成功
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔸 入力金額:     ${tokenAmount.toLocaleString()} ${tokenA.symbol}                                                                    ┃
┃ 🔸 出力金額:     ${buyPool.output.toLocaleString()} ${tokenB.symbol}                                                             ┃
┃ 🔸 プロトコル:   ${buyPool.protocol}                                                                     ┃
┃ 🔸 交換レート:   1 ${tokenA.symbol} = ${buyPool.rate.toFixed(6)} ${tokenB.symbol}                                              ┃
┃ 🔸 ガス見積もり: ${buyPool.gasEstimate?.toLocaleString() || 'N/A'} gas                                                        ┃
┃ ✅ 実際のコントラクトクォート使用                                                                             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`,
                            sellRateDetail: `📉 売り注文詳細 (Step 2: B→A) ❌ 失敗
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔸 入力金額:     ${intermediateB.toLocaleString()} ${tokenB.symbol} (買い注文の出力)                                               ┃
┃ ❌ 出力金額:     失敗                                                                                          ┃
┃ 🔸 プロトコル:   ${sellPool.protocol}                                                                    ┃
┃ ❌ 交換レート:   失敗                                                                                          ┃
┃ ❌ ガス見積もり: N/A                                                                                           ┃
┃ ⚠️  失敗理由:    ${sellQuote.exclusionReason || sellQuote.error}                                             ┃
┃ ✅ 実際のコントラクトクォート使用                                                                             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
💰 ラウンドトリップ結果
  初期投資: ${tokenAmount.toLocaleString()} ${tokenA.symbol}
  最終回収: 0 ${tokenA.symbol} (売り注文失敗)
  純利益:   -${tokenAmount.toLocaleString()} ${tokenA.symbol} (-100.00%)
  総ガス:   ${buyPool.gasEstimate?.toLocaleString() || 'N/A'} gas (買い注文のみ)`
                        }
                    };
                    
                    allExecutionResults.push(failedExecutionResult);
                    continue;  // 成功ケースの処理はスキップ
                }
                
                const finalA = parseFloat(ethers.utils.formatUnits(sellQuote.amountOut, tokenA.decimals));  // 実際のコントラクト出力
                
                const profit = finalA - tokenAmount;  // 純利益
                const profitPercentage = (profit / tokenAmount) * 100;

                if (!this.silent) {
                    const profitIndicator = profit > 0 ? '💰' : '📉';
                    console.log(`     ${profitIndicator} ${finalA.toFixed(6)} ${tokenA.symbol} (利益: ${profitPercentage.toFixed(2)}%)`);
                }

                // 異常値フィルター削除 - すべての組み合わせを表示

                // 全ての実行結果を記録（異常値検証通過後）
                const executionResult = {
                    buyProtocol: buyPool.protocol,
                    sellProtocol: sellPool.protocol,
                    buyRate: buyPool.rate,        // A→B レート
                    sellRate: sellPool.rate,      // B→A レート（元のレート）
                    spread: profitPercentage,
                    profitPercentage: profitPercentage, // 実際の利益率
                    profit: profit,
                    buyDex: buyPool.dex,
                    sellDex: sellPool.dex,
                    crossDex: buyPool.dex !== sellPool.dex,
                    estimatedGasCost: (buyPool.gasEstimate || 0) + (sellQuote.gasEstimate || 0),
                    executionStatus: "成功", // 🆕 実行状態を追加
                    _debug: {
                        // 🆕 フロー表示用データ（新機能）
                        initialAmount: tokenAmount,
                        intermediateAmount: intermediateB,
                        finalAmount: finalA,
                        tokenASymbol: tokenA.symbol,
                        tokenBSymbol: tokenB.symbol,
                        step2Failed: false,
                        
                        // 既存のデータ
                        step1: `${tokenAmount} ${tokenA.symbol} → ${buyPool.output.toFixed(6)} ${tokenB.symbol}`,
                        step2: `${buyPool.output.toFixed(6)} ${tokenB.symbol} → ${finalA.toFixed(6)} ${tokenA.symbol}`,
                        finalProfit: `${profit.toFixed(6)} ${tokenA.symbol}`,
                        profitPercentage: `${profitPercentage.toFixed(2)}%`,
                        comparison: `${buyPool.protocol}(${buyPool.rate.toFixed(6)}) → ${sellPool.protocol}(${(finalA / intermediateB).toFixed(6)})`,
                        rateRatio: (Math.max(buyPool.rate, finalA / intermediateB) / Math.min(buyPool.rate, finalA / intermediateB)).toFixed(4),
                        buyRateDetail: `📈 買い注文詳細 (Step 1: A→B)
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔸 入力金額:     ${tokenAmount.toLocaleString()} ${tokenA.symbol}                                                                    ┃
┃ 🔸 出力金額:     ${buyPool.output.toLocaleString()} ${tokenB.symbol}                                                             ┃
┃ 🔸 プロトコル:   ${buyPool.protocol}                                                                     ┃
┃ 🔸 交換レート:   1 ${tokenA.symbol} = ${buyPool.rate.toFixed(6)} ${tokenB.symbol}                                              ┃
┃ 🔸 ガス見積もり: ${buyPool.gasEstimate?.toLocaleString() || 'N/A'} gas                                                        ┃
┃ ✅ 実際のコントラクトクォート使用                                                                             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`,
                        sellRateDetail: `📉 売り注文詳細 (Step 2: B→A)
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔸 入力金額:     ${intermediateB.toLocaleString()} ${tokenB.symbol} (買い注文の出力)                                               ┃
┃ 🔸 出力金額:     ${finalA.toLocaleString()} ${tokenA.symbol}                                                                       ┃
┃ 🔸 プロトコル:   ${sellPool.protocol}                                                                    ┃
┃ 🔸 交換レート:   1 ${tokenB.symbol} = ${(finalA / intermediateB).toFixed(6)} ${tokenA.symbol}                                     ┃
┃ 🔸 ガス見積もり: ${sellQuote.gasEstimate?.toLocaleString() || 'N/A'} gas                                                         ┃
┃ ✅ 実際のコントラクトクォート使用                                                                             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
💰 ラウンドトリップ結果
  初期投資: ${tokenAmount.toLocaleString()} ${tokenA.symbol}
  最終回収: ${finalA.toLocaleString()} ${tokenA.symbol}
  純利益:   ${profit > 0 ? '+' : ''}${profit.toFixed(6)} ${tokenA.symbol} (${profitPercentage > 0 ? '+' : ''}${profitPercentage.toFixed(2)}%)
  総ガス:   ${((buyPool.gasEstimate || 0) + (sellQuote.gasEstimate || 0)).toLocaleString()} gas`
                    }
                };
                
                // 全ての実行結果を記録
                allExecutionResults.push(executionResult);

                // 機会検出は閾値0.1%以上で判定
                if (profitPercentage >= threshold) {
                    if (!this.silent) {
                        console.log(`   ✅ アービトラージ機会発見: ${profitPercentage.toFixed(2)}%`);
                    }
                    opportunities.push(executionResult);
                }
            }
        }

        // 利益率降順でソート
        const sortedOpportunities = opportunities.sort((a, b) => b.spread - a.spread);
        
        // 最良・最悪プロトコルを特定（ダッシュボード表示用）
        let bestProtocol = 'N/A';
        let worstProtocol = 'N/A';
        
        if (sortedOpportunities.length > 0) {
            const bestOpp = sortedOpportunities[0];
            const worstOpp = sortedOpportunities[sortedOpportunities.length - 1];
            bestProtocol = `${bestOpp.buyProtocol} + ${bestOpp.sellProtocol}`;
            worstProtocol = `${worstOpp.buyProtocol} + ${worstOpp.sellProtocol}`;
        }
        
        return {
            opportunities: sortedOpportunities,
            allExecutionResults: allExecutionResults, // 全ての実行結果（利益・損失問わず）
            exclusions: allExclusions,
            forwardRatesCount: forwardPools.length,
            reverseRatesCount: reversePools.length,
            bestProtocol: bestProtocol,
            worstProtocol: worstProtocol,
            spread: sortedOpportunities.length > 0 ? sortedOpportunities[0].spread : 0
        };
    }

    /**
     * 真のアービトラージチェック（双方向レート使用）
     */
    async checkTrueArbitrageForPair(pairConfig, tokenAmount, threshold = 1.0) {
        const tokenA = await this.getTokenInfo(pairConfig.tokenA.address);
        const tokenB = await this.getTokenInfo(pairConfig.tokenB.address);
        
        const result = await this.calculateTrueArbitrageCombinationsV2(pairConfig, tokenAmount, threshold);
        
        // 真のアービトラージモードでは、すべての実行結果（利益・損失に関係なく）をallCombinationsとして表示
        let allCombinations = [];
        
        // resultに実行された全ての組み合わせ結果を追加する必要がある
        // まず、結果から全実行結果を取得
        if (result.allExecutionResults && result.allExecutionResults.length > 0) {
            // 全実行結果を表示（利益・損失問わず）
            allCombinations = result.allExecutionResults.map(res => ({
                buyProtocol: res.buyProtocol,
                sellProtocol: res.sellProtocol,
                buyRate: res.buyRate,
                sellRate: res.sellRate, // 実際のレート使用
                spread: res.profitPercentage || res.spread,
                buyDex: res.buyDex,
                sellDex: res.sellDex,
                crossDex: res.crossDex,
                estimatedGasCost: res.estimatedGasCost,
                profit: res.profit,
                _debug: res._debug
            }));
        } else if (result.opportunities.length > 0) {
            // アービトラージ機会があるプロトコル組み合わせを表示
            allCombinations = result.opportunities.map(opp => ({
                buyProtocol: opp.buyProtocol,
                sellProtocol: opp.sellProtocol,
                buyRate: opp.buyRate,
                sellRate: opp.sellRate,
                spread: opp.spread,
                buyDex: opp.buyDex,
                sellDex: opp.sellDex,
                crossDex: opp.crossDex,
                estimatedGasCost: opp.estimatedGasCost,
                profit: opp.profit,
                _debug: opp._debug
            }));
        } else {
            // 実行可能な組み合わせがない場合は空の配列を返す（N/Aエントリを削除）
            allCombinations = [];
        }
        
        return {
            hasOpportunity: result.opportunities.length > 0,
            spread: result.spread || 0,
            exclusions: result.exclusions,
            validProtocols: result.forwardRatesCount + result.reverseRatesCount,
            configProtocols: this.getAvailableProtocolCount(pairConfig) * 2, // 双方向なので2倍
            allOpportunities: result.opportunities,
            allCombinations: allCombinations, // ダッシュボード表示用の全組み合わせ
            forwardRatesCount: result.forwardRatesCount,
            reverseRatesCount: result.reverseRatesCount,
            pairName: `${tokenA.symbol}/${tokenB.symbol}`,
            arbitrageType: "true_arbitrage", // 真のアービトラージを示すフラグ
            bestProtocol: result.bestProtocol,
            worstProtocol: result.worstProtocol
        };
    }

    async checkArbitrageForPairEnhanced(pairConfig, tokenAmount, threshold = 1.0) {
        const { allRates, exclusions } = await this.getAllProtocolRates(pairConfig, tokenAmount);
        
        if (allRates.length < 2) {
            return { 
                hasOpportunity: false, 
                spread: 0,
                exclusions: exclusions,
                validProtocols: allRates.length,
                configProtocols: this.getAvailableProtocolCount(pairConfig),
                allOpportunities: [],
                allRates: allRates
            };
        }
        
        // 全組み合わせの価格差分析を計算（閾値フィルタリングあり）
        const allOpportunities = this.calculateAllPriceDifferenceCombinations(allRates, threshold);
        
        // 全組み合わせ（閾値フィルタリングなし）- ダッシュボード表示用
        const allCombinations = this.calculateAllCombinationsForDisplay(allRates);
        
        // 最良・最悪も計算（後方互換性のため）
        const bestRate = allRates.reduce((best, current) => 
            current.rate > best.rate ? current : best
        );
        const worstRate = allRates.reduce((worst, current) => 
            current.rate < worst.rate ? current : worst
        );
        
        const maxSpread = allOpportunities.length > 0 ? allOpportunities[0].spread : 0;
        
        return {
            hasOpportunity: allOpportunities.length > 0,
            spread: maxSpread,
            bestProtocol: bestRate.protocol,
            worstProtocol: worstRate.protocol,
            bestRate: bestRate.rate,
            worstRate: worstRate.rate,
            tokenAmount,
            pairName: pairConfig.name,
            exclusions: exclusions,
            validProtocols: allRates.length,
            configProtocols: this.getAvailableProtocolCount(pairConfig),
            allOpportunities: allOpportunities, // 閾値以上の機会のみ
            allCombinations: allCombinations, // 全組み合わせ（閾値フィルタリングなし）
            allRates: allRates, // 🆕 全プロトコルレート
            totalCombinations: allCombinations.length // 全組み合わせ数
        };
    }

    async processAllPairs(options = {}) {
        const {
            spreadThreshold = 1.0, // デフォルト1%
            batchSize = 10,
            saveResults = true,
            trueArbitrage = false, // 🆕 真のアービトラージフラグ
            silent = false, // 🆕 警告ログ抑制フラグ
            outputPath = path.join(__dirname, `../../results/arbitrage-scan-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
        } = options;
        
        // silentオプションを反映
        this.silent = silent;
        await this.setupContracts();
        const pairs = await this.loadConfig();
        
        console.log(`\n🚀 包括的アービトラージスキャン開始`);
        console.log(`📊 総ペア数: ${pairs.length}`);
        console.log(`🎯 スプレッド閾値: ${spreadThreshold}%`);
        console.log(`📦 バッチサイズ: ${batchSize}`);
        console.log(`🔄 アービトラージタイプ: ${trueArbitrage ? '真のアービトラージ (双方向)' : '価格差分析 (同方向)'}`);
        if (!this.silent) {
            console.log(`🔇 詳細ログ: 有効`);
        }
        console.log("════════════════════════════════════════════════════════════════\n");
        
        const results = [];
        const startTime = Date.now();
        
        // バッチ処理
        for (let i = 0; i < pairs.length; i += batchSize) {
            const batch = pairs.slice(i, Math.min(i + batchSize, pairs.length));
            const batchPromises = [];
            
            for (const pair of batch) {
                // Stage 1: 1トークンで検証
                const checkMethod = trueArbitrage ? 
                    this.checkTrueArbitrageForPair.bind(this) : 
                    this.checkArbitrageForPair.bind(this);
                
                batchPromises.push(
                    checkMethod(pair, 1, spreadThreshold)
                        .then(async (result) => {
                            const pairResult = {
                                pair: pair.name,
                                tokenA: pair.tokenA,
                                tokenB: pair.tokenB,
                                availableProtocols: this.getAvailableProtocolCount(pair),
                                stage1: result,
                                arbitrageType: trueArbitrage ? "true_arbitrage" : "price_difference"
                            };
                            
                            // 🆕 1トークンのみの実行（3段階テスト削除）
                            pairResult.hasOpportunity = result.hasOpportunity;
                            
                            return pairResult;
                        })
                        .catch(error => ({
                            pair: pair.name,
                            error: error.message,
                            hasOpportunity: false
                        }))
                );
            }
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            const progress = Math.min(100, ((i + batchSize) / pairs.length * 100));
            const processedCount = Math.min(i + batchSize, pairs.length);
            
            // 有望なペアを即座に報告
            const opportunities = batchResults.filter(r => r.hasOpportunity && !r.error);
            console.log(`📈 進捗: ${progress.toFixed(1)}% (${processedCount}/${pairs.length}) - 機会発見: ${opportunities.length}件`);
            
            if (opportunities.length > 0) {
                console.log(`   🎯 アービトラージ機会発見:`);
                opportunities.forEach(opp => {
                    const spread = opp.stage1?.spread || 0;
                    console.log(`     ${opp.pair}: ${spread.toFixed(2)}% スプレッド`);
                });
                console.log("");
            }
        }
        
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        // 結果集計
        const opportunityCount = results.filter(r => r.hasOpportunity).length;
        const topOpportunities = results
            .filter(r => r.hasOpportunity)
            .sort((a, b) => (b.stage1?.spread || 0) - (a.stage1?.spread || 0))
            .slice(0, 10);
        
        // 美化されたターミナル出力
        this.displayBeautifulResults(pairs.length, opportunityCount, duration, topOpportunities);
        
        // 結果保存
        if (saveResults) {
            const outputDir = path.dirname(outputPath);
            await fs.mkdir(outputDir, { recursive: true });
            
            const report = {
                metadata: {
                    timestamp: new Date().toISOString(),
                    duration: duration,
                    totalPairs: pairs.length,
                    opportunityCount: opportunityCount,
                    spreadThreshold: spreadThreshold,
                    batchSize: batchSize
                },
                summary: {
                    topOpportunities: topOpportunities,
                    successRate: (opportunityCount / pairs.length * 100).toFixed(1) + '%'
                },
                fullResults: results
            };
            
            await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
            console.log(`\n💾 結果保存: ${path.basename(outputPath)}`);
            
            // CSV形式でも保存
            const csvPath = outputPath.replace('.json', '.csv');
            const csvContent = this.generateCSV(results);
            await fs.writeFile(csvPath, csvContent);
            console.log(`📄 CSV保存: ${path.basename(csvPath)}`);
            
            // Markdownレポート生成
            const mdPath = outputPath.replace('.json', '.md');
            const mdContent = this.generateMarkdownReport(report);
            await fs.writeFile(mdPath, mdContent);
            console.log(`📝 レポート保存: ${path.basename(mdPath)}`);
            
            // Excelレポート生成
            const xlsxPath = outputPath.replace('.json', '.xlsx');
            await this.generateExcelReport(report, xlsxPath);
            console.log(`📊 Excelレポート保存: ${path.basename(xlsxPath)}`);
            
            // HTMLダッシュボード生成
            const htmlPath = outputPath.replace('.json', '.html');
            await this.generateHTMLDashboard(report, htmlPath);
            console.log(`🌐 HTMLダッシュボード保存: ${path.basename(htmlPath)}`);
            console.log(`🔗 ダッシュボードURL: file://${htmlPath}`);
        }
        
        return {
            results,
            summary: {
                duration,
                totalPairs: pairs.length,
                opportunityCount,
                topOpportunities
            }
        };
    }

    getAvailableProtocolCount(pair) {
        let count = 0;
        if (pair.hyperswapV2Available) count++;
        if (pair.hyperswapV3Available) count++;
        if (pair.kittenswapV2Available) count++;
        if (pair.kittenswapV3Available) count++;
        return count;
    }

    generateCSV(results) {
        const headers = [
            'Pair Name',
            'Token A Symbol',
            'Token B Symbol',
            'Config Protocols',
            'Valid Protocols',
            'Has Opportunity',
            '1 Token Spread (%)',
            '1 Best Protocol',
            '1 Worst Protocol',
            'Exclusion Reasons'
        ];
        
        const rows = results.map(r => [
            r.pair,
            r.tokenA?.symbol || 'N/A',
            r.tokenB?.symbol || 'N/A',
            r.stage1?.configProtocols || r.availableProtocols || 0,
            r.stage1?.validProtocols || 0,
            r.hasOpportunity ? 'Yes' : 'No',
            r.stage1?.spread?.toFixed(2) || '0',
            r.stage1?.bestProtocol || 'N/A',
            r.stage1?.worstProtocol || 'N/A',
            (r.stage1?.exclusions || []).join('; ') || 'None'
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    generateMarkdownReport(report) {
        const { metadata, summary, fullResults } = report;
        
        let content = `# アービトラージスキャンレポート\n\n`;
        content += `**生成日時**: ${metadata.timestamp}\n`;
        content += `**処理時間**: ${metadata.duration.toFixed(1)}秒\n`;
        content += `**総ペア数**: ${metadata.totalPairs}\n`;
        content += `**アービトラージ機会**: ${metadata.opportunityCount}ペア (${summary.successRate})\n`;
        content += `**スプレッド閾値**: ${metadata.spreadThreshold}%\n\n`;
        
        content += `## 🏆 トップアービトラージ機会\n\n`;
        content += `| 順位 | ペア | 0.01トークン | 1トークン | 10トークン |\n`;
        content += `|------|------|-------------|-----------|------------|\n`;
        
        summary.topOpportunities.forEach((opp, i) => {
            content += `| ${i + 1} | ${opp.pair} | ${opp.stage1?.spread?.toFixed(2)}% | `;
            content += `${opp.stage2?.spread?.toFixed(2) || 'N/A'}% | `;
            content += `${opp.stage3?.spread?.toFixed(2) || 'N/A'}% |\n`;
        });
        
        content += `\n## 📊 プロトコル別統計\n\n`;
        const protocolStats = this.calculateProtocolStats(fullResults);
        content += `| プロトコル | 最良レート回数 | 最悪レート回数 |\n`;
        content += `|------------|---------------|---------------|\n`;
        
        Object.entries(protocolStats).forEach(([protocol, stats]) => {
            content += `| ${protocol} | ${stats.best} | ${stats.worst} |\n`;
        });
        
        return content;
    }

    async generateExcelReport(report, xlsxPath) {
        const { metadata, summary, fullResults } = report;
        
        // 新しいワークブックを作成
        const workbook = XLSX.utils.book_new();
        
        // 1. Summary シート
        const summaryData = [
            ['HyperEVM アービトラージスキャン結果'],
            [''],
            ['指標', '値'],
            ['生成日時', metadata.timestamp],
            ['処理時間', `${metadata.duration.toFixed(1)}秒`],
            ['総ペア数', metadata.totalPairs],
            ['アービトラージ機会', `${metadata.opportunityCount}ペア`],
            ['成功率', summary.successRate],
            ['スプレッド閾値', `${metadata.spreadThreshold}%`],
            ['バッチサイズ', metadata.batchSize],
            [''],
            ['トップ機会 (上位10件)'],
            ['順位', 'ペア名', 'スプレッド(%)', '最良プロトコル', '最悪プロトコル']
        ];
        
        // トップ10機会を追加
        summary.topOpportunities.forEach((opp, index) => {
            summaryData.push([
                index + 1,
                opp.pair,
                opp.stage1?.spread?.toFixed(2) || '0',
                opp.stage1?.bestProtocol || 'N/A',
                opp.stage1?.worstProtocol || 'N/A'
            ]);
        });
        
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        
        // セル幅を設定
        summarySheet['!cols'] = [
            { width: 25 }, // A列: 指標名
            { width: 30 }, // B列: 値
            { width: 15 }, // C列: スプレッド
            { width: 20 }, // D列: 最良
            { width: 20 }  // E列: 最悪
        ];
        
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
        
        // 2. Details シート - 詳細データ
        const detailsHeaders = [
            'ペア名', 'Token A', 'Token B', '設定プロトコル数', '有効プロトコル数',
            '機会あり', '0.01 スプレッド(%)', '0.01 最良', '0.01 最悪',
            '1 スプレッド(%)', '1 最良', '1 最悪',
            '10 スプレッド(%)', '10 最良', '10 最悪', '除外理由'
        ];
        
        const detailsData = [detailsHeaders];
        fullResults.forEach(r => {
            detailsData.push([
                r.pair,
                r.tokenA?.symbol || 'N/A',
                r.tokenB?.symbol || 'N/A',
                r.stage1?.configProtocols || r.availableProtocols || 0,
                r.stage1?.validProtocols || 0,
                r.hasOpportunity ? 'はい' : 'いいえ',
                r.stage1?.spread?.toFixed(2) || '0',
                r.stage1?.bestProtocol || 'N/A',
                r.stage1?.worstProtocol || 'N/A',
                r.stage2?.spread?.toFixed(2) || 'N/A',
                r.stage2?.bestProtocol || 'N/A',
                r.stage2?.worstProtocol || 'N/A',
                r.stage3?.spread?.toFixed(2) || 'N/A',
                r.stage3?.bestProtocol || 'N/A',
                r.stage3?.worstProtocol || 'N/A',
                (r.stage1?.exclusions || []).join('; ') || 'なし'
            ]);
        });
        
        const detailsSheet = XLSX.utils.aoa_to_sheet(detailsData);
        
        // 詳細シートの列幅設定
        detailsSheet['!cols'] = [
            { width: 15 }, // ペア名
            { width: 10 }, // Token A
            { width: 10 }, // Token B
            { width: 12 }, // 設定プロトコル数
            { width: 12 }, // 有効プロトコル数
            { width: 10 }, // 機会あり
            { width: 12 }, // 0.01 スプレッド
            { width: 18 }, // 0.01 最良
            { width: 18 }, // 0.01 最悪
            { width: 12 }, // 1 スプレッド
            { width: 18 }, // 1 最良
            { width: 18 }, // 1 最悪
            { width: 12 }, // 10 スプレッド
            { width: 18 }, // 10 最良
            { width: 18 }, // 10 最悪
            { width: 50 }  // 除外理由
        ];
        
        XLSX.utils.book_append_sheet(workbook, detailsSheet, 'Details');
        
        // 3. Charts データシート - グラフ用データ
        const chartData = [
            ['スプレッド分布'],
            ['範囲', '件数'],
            ['0-1%', 0],
            ['1-2%', 0],
            ['2-5%', 0],
            ['5-10%', 0],
            ['10%+', 0],
            [''],
            ['プロトコル別成功数'],
            ['プロトコル', '最良回数', '最悪回数']
        ];
        
        // スプレッド分布の計算
        const spreads = fullResults
            .filter(r => r.hasOpportunity && r.stage1?.spread)
            .map(r => r.stage1.spread);
        
        chartData[2][1] = spreads.filter(s => s < 1).length;
        chartData[3][1] = spreads.filter(s => s >= 1 && s < 2).length;
        chartData[4][1] = spreads.filter(s => s >= 2 && s < 5).length;
        chartData[5][1] = spreads.filter(s => s >= 5 && s < 10).length;
        chartData[6][1] = spreads.filter(s => s >= 10).length;
        
        // プロトコル統計の計算
        const protocolStats = this.calculateProtocolStats(fullResults);
        Object.entries(protocolStats).forEach(([protocol, stats]) => {
            chartData.push([protocol, stats.best, stats.worst]);
        });
        
        const chartsSheet = XLSX.utils.aoa_to_sheet(chartData);
        chartsSheet['!cols'] = [{ width: 20 }, { width: 15 }, { width: 15 }];
        
        XLSX.utils.book_append_sheet(workbook, chartsSheet, 'Charts');
        
        // 4. Exclusions シート - 除外理由分析
        const exclusionsData = [
            ['除外理由分析'],
            [''],
            ['理由', '件数', 'ペア例']
        ];
        
        const exclusionStats = {};
        fullResults.forEach(r => {
            if (r.stage1?.exclusions) {
                r.stage1.exclusions.forEach(reason => {
                    if (!exclusionStats[reason]) {
                        exclusionStats[reason] = { count: 0, examples: [] };
                    }
                    exclusionStats[reason].count++;
                    if (exclusionStats[reason].examples.length < 3) {
                        exclusionStats[reason].examples.push(r.pair);
                    }
                });
            }
        });
        
        Object.entries(exclusionStats).forEach(([reason, stats]) => {
            exclusionsData.push([
                reason,
                stats.count,
                stats.examples.join(', ')
            ]);
        });
        
        const exclusionsSheet = XLSX.utils.aoa_to_sheet(exclusionsData);
        exclusionsSheet['!cols'] = [{ width: 40 }, { width: 10 }, { width: 30 }];
        
        XLSX.utils.book_append_sheet(workbook, exclusionsSheet, 'Exclusions');
        
        // ファイルに書き込み
        XLSX.writeFile(workbook, xlsxPath);
    }

    async generateHTMLDashboard(report, htmlPath) {
        const { metadata, summary, fullResults } = report;
        
        // スプレッド分布データ
        const spreads = fullResults
            .filter(r => r.hasOpportunity && r.stage1?.spread)
            .map(r => r.stage1.spread);
        
        const spreadDistribution = {
            '0-1%': spreads.filter(s => s < 1).length,
            '1-2%': spreads.filter(s => s >= 1 && s < 2).length,
            '2-5%': spreads.filter(s => s >= 2 && s < 5).length,
            '5-10%': spreads.filter(s => s >= 5 && s < 10).length,
            '10%+': spreads.filter(s => s >= 10).length
        };
        
        // プロトコル統計
        const protocolStats = this.calculateProtocolStats(fullResults);
        
        const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HyperEVM アービトラージ ダッシュボード</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://cdn.plot.ly/plotly-2.32.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js"></script>
    <style>
        .summary-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .opportunity-card { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; }
        .spread-high { background-color: #d4edda; }
        .spread-medium { background-color: #fff3cd; }
        .spread-low { background-color: #f8d7da; }
        .table-responsive { max-height: 600px; overflow-y: auto; }
        .filter-section { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .pair-link:hover { text-decoration: underline !important; color: #0d6efd !important; }
    </style>
</head>
<body>
    <div class="container-fluid">
        <header class="row mb-4">
            <div class="col-12">
                <h1 class="text-center text-primary">🚀 HyperEVM アービトラージ ダッシュボード</h1>
                <p class="text-center text-muted">生成日時: ${metadata.timestamp}</p>
            </div>
        </header>

        <!-- サマリーカード -->
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card summary-card">
                    <div class="card-body text-center">
                        <h3>${metadata.totalPairs}</h3>
                        <p>総ペア数</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card opportunity-card">
                    <div class="card-body text-center">
                        <h3>${metadata.opportunityCount}</h3>
                        <p>アービトラージ機会</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-info text-white">
                    <div class="card-body text-center">
                        <h3>${summary.successRate}</h3>
                        <p>成功率</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-success text-white">
                    <div class="card-body text-center">
                        <h3>${metadata.duration.toFixed(1)}s</h3>
                        <p>処理時間</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- フィルター -->
        <div class="filter-section">
            <div class="row">
                <div class="col-md-4">
                    <label for="spreadFilter" class="form-label">スプレッド範囲:</label>
                    <select id="spreadFilter" class="form-select">
                        <option value="">全て</option>
                        <option value="0-1">0-1%</option>
                        <option value="1-2">1-2%</option>
                        <option value="2-5">2-5%</option>
                        <option value="5-10">5-10%</option>
                        <option value="10+">10%+</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <label for="protocolFilter" class="form-label">プロトコル:</label>
                    <select id="protocolFilter" class="form-select">
                        <option value="">全て</option>
                        <option value="HYPERSWAP V2">HyperSwap V2</option>
                        <option value="HYPERSWAP V3">HyperSwap V3</option>
                        <option value="KITTENSWAP V2">KittenSwap V2</option>
                        <option value="KITTENSWAP V3">KittenSwap V3</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <label for="opportunityFilter" class="form-label">機会フィルター:</label>
                    <select id="opportunityFilter" class="form-select">
                        <option value="">全て</option>
                        <option value="yes">機会あり</option>
                        <option value="no">機会なし</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- チャート -->
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h5>📊 スプレッド分布</h5>
                    </div>
                    <div class="card-body">
                        <div id="spreadDistChart"></div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h5>🎯 プロトコル別パフォーマンス</h5>
                    </div>
                    <div class="card-body">
                        <div id="protocolPerfChart"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- タブナビゲーション -->
        <div class="row">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <ul class="nav nav-tabs card-header-tabs" id="dataTabs" role="tablist">
                            <li class="nav-item" role="presentation">
                                <button class="nav-link active" id="summary-tab" data-bs-toggle="tab" data-bs-target="#summary-pane" type="button" role="tab">📋 サマリー</button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" id="combinations-tab" data-bs-toggle="tab" data-bs-target="#combinations-pane" type="button" role="tab">🔄 全組み合わせ</button>
                            </li>
                        </ul>
                    </div>
                    <div class="card-body">
                        <div class="tab-content" id="dataTabContent">
                            <!-- サマリータブ -->
                            <div class="tab-pane fade show active" id="summary-pane" role="tabpanel">
                                <div class="table-responsive">
                                    <table class="table table-hover" id="summaryTable">
                                        <thead class="table-dark">
                                            <tr>
                                                <th onclick="sortTable('summaryTable', 0)">ペア名 ⇅</th>
                                                <th onclick="sortTable('summaryTable', 1)">Token A ⇅</th>
                                                <th onclick="sortTable('summaryTable', 2)">Token B ⇅</th>
                                                <th onclick="sortTable('summaryTable', 3)">機会 ⇅</th>
                                                <th onclick="sortTable('summaryTable', 4)">最大スプレッド(%) ⇅</th>
                                                <th onclick="sortTable('summaryTable', 5)">組み合わせ数 ⇅</th>
                                                <th onclick="sortTable('summaryTable', 6)">最良プロトコル ⇅</th>
                                                <th onclick="sortTable('summaryTable', 7)">最悪プロトコル ⇅</th>
                                                <th>除外理由</th>
                                            </tr>
                                        </thead>
                                        <tbody id="summaryTableBody">
                                            ${fullResults.map(r => {
                                                const spreadClass = r.stage1?.spread > 5 ? 'spread-high' : 
                                                                  r.stage1?.spread > 2 ? 'spread-medium' : 'spread-low';
                                                const combinationCount = (r.stage1?.allOpportunities || []).length;
                                                return `<tr class="${spreadClass}" data-opportunity="${r.hasOpportunity ? 'yes' : 'no'}" 
                                                       data-protocol="${r.stage1?.bestProtocol || ''}" 
                                                       data-spread="${r.stage1?.spread || 0}" 
                                                       data-pair="${r.pair}">
                                                    <td><strong>${r.pair}</strong></td>
                                                    <td>${r.tokenA?.symbol || 'N/A'}</td>
                                                    <td>${r.tokenB?.symbol || 'N/A'}</td>
                                                    <td>${r.hasOpportunity ? '✅' : '❌'}</td>
                                                    <td><strong>${r.stage1?.spread?.toFixed(2) || '0'}%</strong></td>
                                                    <td><span class="badge bg-primary">${combinationCount}</span></td>
                                                    <td><span class="badge bg-success">${r.stage1?.bestProtocol || 'N/A'}</span></td>
                                                    <td><span class="badge bg-warning">${r.stage1?.worstProtocol || 'N/A'}</span></td>
                                                    <td><small>${(r.stage1?.exclusions || []).join('; ') || 'なし'}</small></td>
                                                </tr>`;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <!-- 全組み合わせタブ -->
                            <div class="tab-pane fade" id="combinations-pane" role="tabpanel">
                                <div class="mb-3">
                                    <div class="row">
                                        <div class="col-md-3">
                                            <label for="pairFilterCombination" class="form-label">ペア選択:</label>
                                            <select id="pairFilterCombination" class="form-select" onchange="filterCombinations()">
                                                <option value="">全ペア</option>
                                                ${fullResults.filter(r => r.hasOpportunity && (r.stage1?.allOpportunities || []).length > 0)
                                                    .map(r => `<option value="${r.pair}">${r.pair}</option>`).join('')}
                                            </select>
                                        </div>
                                        <div class="col-md-3">
                                            <label for="testAmountFilter" class="form-label">テスト量:</label>
                                            <select id="testAmountFilter" class="form-select" onchange="filterCombinations()">
                                                <option value="">全てのテスト量</option>
                                                <option value="stage1">1トークン</option>
                                                <option value="stage2">3トークン</option>
                                                <option value="stage3">10トークン</option>
                                            </select>
                                        </div>
                                        <div class="col-md-3">
                                            <label for="spreadFilterCombination" class="form-label">最小スプレッド:</label>
                                            <input type="number" id="spreadFilterCombination" class="form-control" placeholder="例: 1.0" step="0.1" onchange="filterCombinations()">
                                        </div>
                                        <div class="col-md-3">
                                            <label for="crossDexFilter" class="form-label">クロスDEX:</label>
                                            <select id="crossDexFilter" class="form-select" onchange="filterCombinations()">
                                                <option value="">全て</option>
                                                <option value="true">クロスDEXのみ</option>
                                                <option value="false">同一DEXのみ</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div class="table-responsive">
                                    <table class="table table-hover table-sm" id="combinationsTable">
                                        <thead class="table-dark">
                                            <tr>
                                                <th onclick="sortTable('combinationsTable', 0)">ペア名 ⇅</th>
                                                <th onclick="sortTable('combinationsTable', 1)">買いプロトコル ⇅</th>
                                                <th onclick="sortTable('combinationsTable', 2)">売りプロトコル ⇅</th>
                                                <th onclick="sortTable('combinationsTable', 3)">スプレッド(%) ⇅</th>
                                                <th onclick="sortTable('combinationsTable', 4)">初期枚数 ⇅</th>
                                                <th onclick="sortTable('combinationsTable', 5)">中間枚数 ⇅</th>
                                                <th onclick="sortTable('combinationsTable', 6)">最終枚数 ⇅</th>
                                                <th onclick="sortTable('combinationsTable', 7)">クロスDEX ⇅</th>
                                                <th>テスト量</th>
                                                <th>実行</th>
                                            </tr>
                                        </thead>
                                        <tbody id="combinationsTableBody">
                                            ${fullResults.flatMap(r => {
                                                const allCombinations = [];
                                                ['stage1', 'stage2', 'stage3'].forEach(stage => {
                                                    // 全組み合わせタブでは常にallCombinationsを優先して全ペア表示
                                                    // アービトラージ機会がある場合はallOpportunitiesも追加
                                                    let combinationsToShow = [];
                                                    
                                                    if (r.arbitrageType === 'true_arbitrage') {
                                                        // 真のアービトラージ：allOpportunitiesがあればそれを優先、なければallCombinations
                                                        if (r[stage]?.allOpportunities && r[stage].allOpportunities.length > 0) {
                                                            combinationsToShow = r[stage].allOpportunities;
                                                        } else if (r[stage]?.allCombinations && r[stage].allCombinations.length > 0) {
                                                            combinationsToShow = r[stage].allCombinations;
                                                        }
                                                    } else {
                                                        // 価格差分析：stage1でallCombinations、他はallOpportunities
                                                        combinationsToShow = (stage === 'stage1' && r[stage]?.allCombinations) ? 
                                                            r[stage].allCombinations : r[stage]?.allOpportunities;
                                                    }
                                                    if (combinationsToShow) {
                                                        combinationsToShow.forEach(opp => {
                                                            const spreadClass = opp.spread > 5 ? 'spread-high' : 
                                                                              opp.spread > 2 ? 'spread-medium' : 'spread-low';
                                                            const crossDex = opp.buyProtocol.includes('HYPERSWAP') !== opp.sellProtocol.includes('HYPERSWAP');
                                                            allCombinations.push(`<tr class="${spreadClass}" 
                                                                data-pair="${r.pair}" 
                                                                data-spread="${opp.spread}" 
                                                                data-cross-dex="${crossDex}" 
                                                                data-stage="${stage}"
                                                                data-token-a-address="${r.tokenA?.address || ''}"
                                                                data-token-b-address="${r.tokenB?.address || ''}"
                                                                data-buy-protocol="${opp.buyProtocol || ''}"
                                                                data-sell-protocol="${opp.sellProtocol || ''}"
                                                                data-buy-rate="${opp.buyRate || 0}"
                                                                data-sell-rate="${opp.sellRate || 0}"
                                                                data-final-amount="${opp._debug?.finalAmount || 0}">
                                                                <td><a href="#" class="pair-link" data-pair="${r.pair}" style="text-decoration: none; color: inherit; cursor: pointer;"><strong>${r.pair}</strong></a></td>
                                                                <td><span class="badge bg-success">${opp.buyProtocol}</span></td>
                                                                <td><span class="badge bg-warning">${opp.sellProtocol}</span></td>
                                                                <td><strong>${opp.spread.toFixed(2)}%</strong></td>
                                                                <td><a href="#" class="flow-link" data-flow-type="initial" data-flow-detail="${(opp._debug?.buyRateDetail || '').replace(/"/g, '&quot;')}" onclick="showFlowDetail(this)" style="text-decoration: none; color: #28a745; cursor: pointer;">${(opp._debug?.initialAmount || 0).toFixed(6)} ${opp._debug?.tokenASymbol || ''}</a></td>
                                                                <td><a href="#" class="flow-link" data-flow-type="intermediate" data-flow-detail="${(opp._debug?.buyRateDetail || '').replace(/"/g, '&quot;')}" onclick="showFlowDetail(this)" style="text-decoration: none; color: #ffc107; cursor: pointer;">${(opp._debug?.intermediateAmount || 0).toFixed(6)} ${opp._debug?.tokenBSymbol || ''}</a></td>
                                                                <td><a href="#" class="flow-link" data-flow-type="final" data-flow-detail="${(opp._debug?.sellRateDetail || '').replace(/"/g, '&quot;')}" onclick="showFlowDetail(this)" style="text-decoration: none; color: ${opp._debug?.step2Failed ? '#dc3545' : '#17a2b8'}; cursor: pointer;">${opp._debug?.step2Failed ? '失敗' : (opp._debug?.finalAmount || 0).toFixed(6) + ' ' + (opp._debug?.tokenASymbol || '')}</a></td>
                                                                <td><span class="badge ${opp.executionStatus === '成功' ? 'bg-success' : opp.executionStatus === '売りで失敗' ? 'bg-danger' : 'bg-secondary'}">${opp.executionStatus || '成功'}</span></td>
                                                                <td>${crossDex ? '🔄' : '🔁'}</td>
                                                                <td><span class="badge ${stage === 'stage1' ? 'bg-info' : stage === 'stage2' ? 'bg-primary' : 'bg-secondary'}" title="${stage === 'stage1' ? '1トークンでテスト' : stage === 'stage2' ? '3トークンでテスト' : '10トークンでテスト'}">${stage === 'stage1' ? '1' : stage === 'stage2' ? '3' : '10'}トークン</span></td>
                                                                <td class="text-center">
                                                                    <div class="btn-group" role="group">
                                                                        <button class="btn btn-sm btn-outline-primary" 
                                                                                onclick="openExecutionModal(this, 'buy')" 
                                                                                title="買いスワップ実行">
                                                                            📈
                                                                        </button>
                                                                        <button class="btn btn-sm btn-outline-warning" 
                                                                                onclick="openExecutionModal(this, 'sell')" 
                                                                                title="売りスワップ実行">
                                                                            📉
                                                                        </button>
                                                                        <button class="btn btn-sm btn-outline-success" 
                                                                                onclick="openExecutionModal(this, 'arbitrage')" 
                                                                                title="アービトラージ実行">
                                                                            🔄
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>`);
                                                        });
                                                    }
                                                });
                                                return allCombinations;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                                <div class="mt-3">
                                    <div class="alert alert-info">
                                        <h6>📋 表示説明:</h6>
                                        <ul class="mb-0">
                                            <li><strong>🔄 クロスDEX機会</strong>: HyperSwap ⇄ KittenSwap間でのアービトラージ</li>
                                            <li><strong>🔁 同一DEX内機会</strong>: 同じDEX内の異なるプロトコル間でのアービトラージ</li>
                                            <li><strong>テスト量</strong>: 
                                                <span class="badge bg-info">1トークン</span> = 小額テスト、
                                                <span class="badge bg-primary">3トークン</span> = 中額テスト，
                                                <span class="badge bg-secondary">10トークン</span> = 大額テスト
                                            </li>
                                            <li><strong>流動性の影響</strong>: テスト量が大きいほど流動性不足でスプレッドが変動しやすい</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- レート詳細モーダル -->
    <div class="modal fade" id="rateDetailModal" tabindex="-1" aria-labelledby="rateDetailModalTitle" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="rateDetailModalTitle">レート詳細</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body" id="rateDetailModalBody">
                    <!-- 動的に内容が設定されます -->
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">閉じる</button>
                </div>
            </div>
        </div>
    </div>

    <!-- 統一リアルタイム実行モーダル -->
    <div class="modal fade" id="unifiedExecutionModal" tabindex="-1" aria-labelledby="unifiedExecutionModalTitle" aria-hidden="true">
        <div class="modal-dialog modal-xl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="unifiedExecutionModalTitle">
                        <span id="executionIcon">🚀</span>
                        <span id="executionTypeTitle">リアルタイム実行</span>
                        <span class="badge bg-info ms-2" id="executionModeBadge">実行モード</span>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <!-- 実行設定パネル -->
                    <div class="row mb-4">
                        <div class="col-md-3">
                            <label for="executionAmount" class="form-label">実行量:</label>
                            <input type="number" id="executionAmount" class="form-control" step="0.001" value="1" min="0.001">
                        </div>
                        <div class="col-md-3">
                            <label for="executionMode" class="form-label">実行モード:</label>
                            <select id="executionMode" class="form-select">
                                <option value="test">🧪 テスト（シミュレーション）</option>
                                <option value="live">🔴 実際実行（注意）</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label for="slippage" class="form-label">スリッページ許容度:</label>
                            <input type="number" id="slippage" class="form-control" value="0.5" step="0.1" min="0.1">
                        </div>
                        <div class="col-md-3 d-flex align-items-end">
                            <button class="btn btn-primary w-100" onclick="executeRealTimeAction()">
                                <span id="executeButtonText">実行</span>
                                <span id="executeButtonIcon">⚡</span>
                            </button>
                        </div>
                    </div>

                    <!-- タブナビゲーション -->
                    <ul class="nav nav-tabs mb-3" id="executionTabs">
                        <li class="nav-item">
                            <button class="nav-link active" id="historical-tab" data-bs-toggle="tab" data-bs-target="#historical-pane">
                                📊 履歴データ
                            </button>
                        </li>
                        <li class="nav-item">
                            <button class="nav-link" id="realtime-tab" data-bs-toggle="tab" data-bs-target="#realtime-pane">
                                ⚡ リアルタイム実行
                            </button>
                        </li>
                        <li class="nav-item">
                            <button class="nav-link" id="comparison-tab" data-bs-toggle="tab" data-bs-target="#comparison-pane">
                                📈 比較分析
                            </button>
                        </li>
                    </ul>

                    <!-- タブコンテンツ -->
                    <div class="tab-content" id="executionTabContent">
                        <!-- 履歴データタブ -->
                        <div class="tab-pane fade show active" id="historical-pane">
                            <div id="historicalContent">
                                <div class="text-center py-4">
                                    <div class="spinner-border text-muted" role="status">
                                        <span class="visually-hidden">読み込み中...</span>
                                    </div>
                                    <p class="mt-2">履歴データを読み込み中...</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- リアルタイム実行タブ -->
                        <div class="tab-pane fade" id="realtime-pane">
                            <div id="realtimeContent">
                                <div class="text-center py-4">
                                    <p class="text-muted">「実行」ボタンをクリックしてリアルタイム実行を開始してください。</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 比較分析タブ -->
                        <div class="tab-pane fade" id="comparison-pane">
                            <div id="comparisonContent">
                                <div class="text-center py-4">
                                    <p class="text-muted">リアルタイム実行後に比較分析が表示されます。</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">閉じる</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // スプレッド分布チャート
        const spreadData = {
            x: ${JSON.stringify(Object.keys(spreadDistribution))},
            y: ${JSON.stringify(Object.values(spreadDistribution))},
            type: 'bar',
            marker: {
                color: ['#28a745', '#ffc107', '#fd7e14', '#dc3545', '#6f42c1']
            }
        };
        
        Plotly.newPlot('spreadDistChart', [spreadData], {
            title: 'スプレッド分布',
            xaxis: { title: 'スプレッド範囲' },
            yaxis: { title: '件数' }
        });

        // プロトコル別パフォーマンスチャート
        const protocolLabels = ${JSON.stringify(Object.keys(protocolStats))};
        const bestCounts = ${JSON.stringify(Object.values(protocolStats).map(s => s.best))};
        const worstCounts = ${JSON.stringify(Object.values(protocolStats).map(s => s.worst))};
        
        const protocolData = [
            {
                x: protocolLabels,
                y: bestCounts,
                name: '最良レート',
                type: 'bar',
                marker: { color: '#28a745' }
            },
            {
                x: protocolLabels,
                y: worstCounts,
                name: '最悪レート',
                type: 'bar',
                marker: { color: '#dc3545' }
            }
        ];
        
        Plotly.newPlot('protocolPerfChart', protocolData, {
            title: 'プロトコル別パフォーマンス',
            xaxis: { title: 'プロトコル' },
            yaxis: { title: '回数' },
            barmode: 'group'
        });

        // フィルタリング機能
        function applyFilters() {
            const spreadFilter = document.getElementById('spreadFilter').value;
            const protocolFilter = document.getElementById('protocolFilter').value;
            const opportunityFilter = document.getElementById('opportunityFilter').value;
            
            const rows = document.querySelectorAll('#summaryTableBody tr');
            
            rows.forEach(row => {
                let show = true;
                
                // スプレッドフィルター
                if (spreadFilter) {
                    const spread = parseFloat(row.dataset.spread);
                    switch(spreadFilter) {
                        case '0-1': show = show && (spread < 1); break;
                        case '1-2': show = show && (spread >= 1 && spread < 2); break;
                        case '2-5': show = show && (spread >= 2 && spread < 5); break;
                        case '5-10': show = show && (spread >= 5 && spread < 10); break;
                        case '10+': show = show && (spread >= 10); break;
                    }
                }
                
                // プロトコルフィルター
                if (protocolFilter) {
                    show = show && row.dataset.protocol.includes(protocolFilter);
                }
                
                // 機会フィルター
                if (opportunityFilter) {
                    show = show && (row.dataset.opportunity === opportunityFilter);
                }
                
                row.style.display = show ? '' : 'none';
            });
        }
        
        // 組み合わせフィルタリング機能
        function filterCombinations() {
            const pairFilter = document.getElementById('pairFilterCombination').value;
            const testAmountFilter = document.getElementById('testAmountFilter').value;
            const spreadFilter = parseFloat(document.getElementById('spreadFilterCombination').value) || 0;
            const crossDexFilter = document.getElementById('crossDexFilter').value;
            
            const rows = document.querySelectorAll('#combinationsTableBody tr');
            let visibleCount = 0;
            
            rows.forEach(row => {
                let show = true;
                
                // ペアフィルター
                if (pairFilter) {
                    show = show && (row.dataset.pair === pairFilter);
                }
                
                // テスト量フィルター
                if (testAmountFilter) {
                    show = show && (row.dataset.stage === testAmountFilter);
                }
                
                // スプレッドフィルター
                if (spreadFilter > 0) {
                    const spread = parseFloat(row.dataset.spread);
                    show = show && (spread >= spreadFilter);
                }
                
                // クロスDEXフィルター
                if (crossDexFilter) {
                    const isCrossDex = row.dataset.crossDex === 'true';
                    show = show && (isCrossDex === (crossDexFilter === 'true'));
                }
                
                row.style.display = show ? '' : 'none';
                if (show) visibleCount++;
            });
            
            // フィルター結果表示
            updateFilterResultDisplay(visibleCount);
        }
        
        // フィルター結果表示の更新
        function updateFilterResultDisplay(visibleCount) {
            const totalCount = document.querySelectorAll('#combinationsTableBody tr').length;
            let resultDiv = document.getElementById('filterResult');
            
            if (!resultDiv) {
                resultDiv = document.createElement('div');
                resultDiv.id = 'filterResult';
                resultDiv.className = 'alert alert-info mt-2';
                document.querySelector('#combinations-pane .table-responsive').parentNode.insertBefore(
                    resultDiv, 
                    document.querySelector('#combinations-pane .table-responsive')
                );
            }
            
            if (visibleCount === totalCount) {
                resultDiv.style.display = 'none';
            } else {
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = "📊 フィルター結果: " + visibleCount + " / " + totalCount + " 組み合わせを表示中";
            }
        }

        // ソート機能
        function sortTable(tableId, columnIndex) {
            const table = document.getElementById(tableId);
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            
            rows.sort((a, b) => {
                const aVal = a.cells[columnIndex].textContent.trim();
                const bVal = b.cells[columnIndex].textContent.trim();
                
                // 数値の場合 (スプレッド、レートなど)
                if (columnIndex === 4 || columnIndex === 3 || columnIndex === 5) {
                    return parseFloat(bVal) - parseFloat(aVal);
                }
                
                // 文字列の場合
                return aVal.localeCompare(bVal);
            });
            
            // テーブルを再構築
            rows.forEach(row => tbody.appendChild(row));
        }

        // イベントリスナー
        document.getElementById('spreadFilter').addEventListener('change', applyFilters);
        document.getElementById('protocolFilter').addEventListener('change', applyFilters);
        document.getElementById('opportunityFilter').addEventListener('change', applyFilters);
        
        // Bootstrap tab切り替え時の処理
        document.addEventListener('DOMContentLoaded', function() {
            // RealTimeExecutorの初期化（クラス定義後に実行）
            setTimeout(() => {
                if (typeof BidirectionalLiquidityChecker !== 'undefined' && BidirectionalLiquidityChecker.RealTimeExecutor) {
                    try {
                        // BidirectionalLiquidityCheckerのインスタンスを作成
                        const checker = new BidirectionalLiquidityChecker();
                        
                        // コントラクト情報を設定
                        checker.contracts = {
                            hyperswap: {
                                v2Router: "${this.contracts.hyperswap.v2Router}",
                                v2Factory: "${this.contracts.hyperswap.v2Factory}",
                                v3QuoterV2: "${this.contracts.hyperswap.v3QuoterV2}",
                                v3Factory: "${this.contracts.hyperswap.v3Factory}"
                            },
                            kittenswap: {
                                v2Router: "${this.contracts.kittenswap.v2Router}",
                                v2Factory: "${this.contracts.kittenswap.v2Factory}",
                                v3QuoterV2: "${this.contracts.kittenswap.v3QuoterV2}",
                                v3Factory: "${this.contracts.kittenswap.v3Factory}"
                            }
                        };
                        
                        window.realTimeExecutor = new BidirectionalLiquidityChecker.RealTimeExecutor(checker);
                        console.log('✅ RealTimeExecutor initialized successfully');
                    } catch (error) {
                        console.warn('⚠️ RealTimeExecutor initialization failed:', error.message);
                        console.warn('   フォールバック: 従来のモーダル実行を使用します');
                    }
                } else {
                    console.warn('⚠️ BidirectionalLiquidityChecker class not found, using fallback modal execution');
                }
            }, 100);
            
            // Bootstrap JSを有効化
            const triggerTabList = [].slice.call(document.querySelectorAll('#dataTabs button'));
            triggerTabList.forEach(function (triggerEl) {
                const tabTrigger = new bootstrap.Tab(triggerEl);
                
                triggerEl.addEventListener('click', function (event) {
                    event.preventDefault();
                    tabTrigger.show();
                });
            });
            
            // ペア名クリックイベントの追加
            document.addEventListener('click', function(event) {
                if (event.target.closest('.pair-link')) {
                    event.preventDefault();
                    const link = event.target.closest('.pair-link');
                    const pairName = link.dataset.pair;
                    
                    // ペアフィルターに値を設定
                    const pairFilter = document.getElementById('pairFilterCombination');
                    if (pairFilter) {
                        pairFilter.value = pairName;
                        // フィルター適用
                        filterCombinations();
                        
                        // 全組み合わせタブに切り替え
                        const combinationsTab = document.getElementById('combinations-tab');
                        if (combinationsTab) {
                            const tabTrigger = new bootstrap.Tab(combinationsTab);
                            tabTrigger.show();
                        }
                    }
                }
            });
        });
        
        // レート詳細表示関数
        function showRateDetail(element) {
            event.preventDefault();
            const rateType = element.dataset.rateType;
            const rateValue = element.dataset.rateValue;
            const rateDetail = element.dataset.rateDetail;
            
            // モーダルタイトルと内容を設定
            const modalTitle = document.getElementById('rateDetailModalTitle');
            const modalBody = document.getElementById('rateDetailModalBody');
            
            modalTitle.textContent = rateType === 'buy' ? '🔵 買いレート詳細' : '🔴 売りレート詳細';
            
            // HTMLが含まれている場合はそのまま表示、プレーンテキストの場合はpreタグでフォーマット
            const isHtml = rateDetail.includes('<div') || rateDetail.includes('<strong>');
            const displayContent = isHtml ? rateDetail : \`<pre style="white-space: pre-wrap; font-family: monospace; background: #f8f9fa; padding: 15px; border-radius: 8px;">\${rateDetail}</pre>\`;
            
            modalBody.innerHTML = \`
                <div class="card">
                    <div class="card-header bg-\${rateType === 'buy' ? 'primary' : 'danger'} text-white">
                        <h6 class="mb-0">\${rateType === 'buy' ? '買い' : '売り'}レート計算結果</h6>
                    </div>
                    <div class="card-body">
                        <p><strong>レート値:</strong> <code>\${rateValue}</code></p>
                        <p><strong>計算詳細:</strong></p>
                        <div class="alert alert-\${rateType === 'buy' ? 'primary' : 'danger'}" role="alert">
                            <h6>\${rateType === 'buy' ? '💰 買い注文' : '💸 売り注文'}</h6>
                            <div class="mb-0">\${displayContent}</div>
                        </div>
                        <small class="text-muted">
                            \${rateType === 'buy' ? 
                                '※ 買いレート: 入力トークンを別のトークンに交換する際のレート' : 
                                '※ 売りレート: 中間トークンを最終トークンに戻す際のレート'}
                        </small>
                    </div>
                </div>
            \`;
            
            // モーダルを表示
            const modal = new bootstrap.Modal(document.getElementById('rateDetailModal'));
            modal.show();
        }

        // フロー詳細表示機能 🆕
        window.showFlowDetail = function(element) {
            event.preventDefault();
            const flowType = element.dataset.flowType;
            const flowDetail = element.dataset.flowDetail;
            
            // モーダルタイトルを設定
            const modalTitle = document.getElementById('rateDetailModalLabel');
            const flowTypeNames = {
                'initial': '初期枚数',
                'intermediate': '中間枚数', 
                'final': '最終枚数'
            };
            modalTitle.textContent = (flowTypeNames[flowType] || flowType) + '詳細';
            
            // モーダル本文を設定
            const modalBody = document.getElementById('rateDetailContent');
            modalBody.innerHTML = \`
                <div class="flow-detail-container">
                    <div class="alert alert-info">
                        <h6><i class="bi bi-info-circle"></i> フロー詳細情報</h6>
                        <div class="flow-detail-content">
                            \${flowDetail || 'フロー詳細情報がありません'}
                        </div>
                    </div>
                    <div class="mt-3">
                        <small class="text-muted">
                            <i class="bi bi-clock"></i> 
                            \${new Date().toLocaleString('ja-JP')}に生成
                        </small>
                    </div>
                </div>
            \`;
            
            // モーダルを表示
            const modal = new bootstrap.Modal(document.getElementById('rateDetailModal'));
            modal.show();
        };

        // ====================
        // 🆕 統一モーダル制御関数群
        // ====================

        // プロトコル情報パース（グローバルアクセス可能、ブラウザ環境のみ）
        if (typeof window !== 'undefined') {
            window.parseProtocolInfo = function parseProtocolInfo(protocolString) {
            if (!protocolString || protocolString === 'N/A') {
                return { dex: 'N/A', version: 'N/A', parameter: 'N/A' };
            }
            
            const str = protocolString.toLowerCase();
            
            // 🔍 デバッグログ
            console.log(\`🔍 parseProtocolInfo: "\${protocolString}" → "\${str}"\`);
            
            // HyperSwap判定
            if (str.includes('hyperswap')) {
                if (str.includes('v2')) {
                    return { dex: 'hyperswap', version: 'v2', parameter: 'standard' };
                } else if (str.includes('v3')) {
                    // Fee tier抽出 - 括弧内の数字を抽出
                    let parameter = '3000';
                    const startIdx = str.indexOf('(');
                    const endIdx = str.indexOf(')');
                    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                        const bracketContent = str.substring(startIdx + 1, endIdx);
                        const numberMatch = bracketContent.match(/[0-9]+/);
                        if (numberMatch) {
                            parameter = numberMatch[0];
                        }
                    }
                    console.log(\`🔍 HyperSwap V3 fee抽出: startIdx=\${startIdx}, endIdx=\${endIdx}, parameter=\${parameter}\`);
                    return { dex: 'hyperswap', version: 'v3', parameter: parameter };
                }
            }
            
            // KittenSwap判定
            if (str.includes('kittenswap')) {
                if (str.includes('v2')) {
                    return { dex: 'kittenswap', version: 'v2', parameter: 'standard' };
                } else if (str.includes('v3')) {
                    // Tick spacing抽出 - TS:数字または括弧内の数字を抽出
                    const tickMatch = str.match(/ts[:\s]*(\d+)|\(ts[:\s]*(\d+)\)|\((\d+)\)/);
                    const parameter = tickMatch ? (tickMatch[1] || tickMatch[2] || tickMatch[3]) : '200';
                    return { dex: 'kittenswap', version: 'v3', parameter: parameter };
                }
            }
            
            return { dex: 'unknown', version: 'unknown', parameter: 'unknown' };
            };
        }

        // テーブル行からデータ抽出
        function extractRowData(buttonElement) {
            const row = buttonElement.closest('tr');
            if (!row) {
                console.error('No table row found for button element');
                return null;
            }
            
            // どのタブにいるかを判定
            const isInSummaryTab = row.closest('#summaryTableBody') !== null;
            const isInCombinationsTab = row.closest('#combinationsTableBody') !== null;
            
            // data-attributes からデータ取得（複数の方法を試行）
            const pairText = row.dataset.pair;
            
            // トークンアドレスの取得（複数の方法でフォールバック）
            let tokenAAddress = row.dataset.tokenAAddress || 
                               row.getAttribute('data-token-a-address') || 
                               row.dataset['token-a-address'];
            let tokenBAddress = row.dataset.tokenBAddress || 
                               row.getAttribute('data-token-b-address') || 
                               row.dataset['token-b-address'];
            
            // プロトコル情報の取得
            const buyProtocol = row.dataset.buyProtocol || row.getAttribute('data-buy-protocol');
            const sellProtocol = row.dataset.sellProtocol || row.getAttribute('data-sell-protocol');
            
            // 数値データの取得
            const spread = parseFloat(row.dataset.spread || row.getAttribute('data-spread')) || 0;
            const buyRate = parseFloat(row.dataset.buyRate || row.getAttribute('data-buy-rate')) || 0;
            const sellRate = parseFloat(row.dataset.sellRate || row.getAttribute('data-sell-rate')) || 0;
            const finalAmount = parseFloat(row.dataset.finalAmount || row.getAttribute('data-final-amount')) || 0;
            
            // デバッグログ
            console.log('Tab detection:', { isInSummaryTab, isInCombinationsTab });
            console.log('Row dataset:', row.dataset);
            console.log('Row attributes check:');
            console.log('  data-token-a-address:', row.getAttribute('data-token-a-address'));
            console.log('  data-token-b-address:', row.getAttribute('data-token-b-address'));
            console.log('Final values:');
            console.log('  tokenAAddress:', tokenAAddress);
            console.log('  tokenBAddress:', tokenBAddress);
            console.log('  buyProtocol:', buyProtocol);
            console.log('  sellProtocol:', sellProtocol);
            
            // 必須データの存在確認
            if (!tokenAAddress || !tokenBAddress) {
                console.error('Missing token addresses! TokenA:', tokenAAddress, 'TokenB:', tokenBAddress);
                if (isInSummaryTab) {
                    console.error('ERROR: Execution attempted from Summary tab which does not have execution buttons or complete data attributes!');
                }
            }
            
            return {
                pair: pairText,
                tokenA: tokenAAddress,
                tokenB: tokenBAddress,
                buyProtocol: buyProtocol,
                sellProtocol: sellProtocol,
                spread: spread,
                buyRate: buyRate,
                sellRate: sellRate,
                finalAmount: finalAmount,
                sourceTab: isInSummaryTab ? 'summary' : isInCombinationsTab ? 'combinations' : 'unknown'
            };
        }

        // データ検証
        function validateExecutionData(data) {
            const errors = [];
            
            if (!data) {
                errors.push('行データが取得できませんでした');
                return errors;
            }
            
            // ソースタブの確認
            if (data.sourceTab === 'summary') {
                errors.push('❌ エラー: サマリータブからは実行できません。「🔄 全組み合わせ」タブをクリックして、そこから実行してください。');
                return errors;
            }
            
            // トークンアドレスの存在確認
            if (!data.tokenA) {
                errors.push('TokenAアドレスが取得できませんでした');
                console.error('Missing tokenA address:', data);
            }
            
            if (!data.tokenB) {
                errors.push('TokenBアドレスが取得できませんでした');
                console.error('Missing tokenB address:', data);
            }
            
            // アドレス形式の検証（アドレスが存在する場合のみ）
            if (data.tokenA && !ethers.utils.isAddress(data.tokenA)) {
                errors.push(\`TokenAアドレスの形式が正しくありません: \${data.tokenA}\`);
            }
            
            if (data.tokenB && !ethers.utils.isAddress(data.tokenB)) {
                errors.push(\`TokenBアドレスの形式が正しくありません: \${data.tokenB}\`);
            }
            
            // プロトコル情報の確認
            if (!data.buyProtocol || data.buyProtocol === 'N/A' || data.buyProtocol === '') {
                errors.push('買いプロトコルが設定されていません');
            }
            
            if (!data.sellProtocol || data.sellProtocol === 'N/A' || data.sellProtocol === '') {
                errors.push('売りプロトコルが設定されていません');
            }
            
            // ペア名の確認
            if (!data.pair) {
                errors.push('ペア名が取得できませんでした');
            }
            
            return errors;
        }

        // 統一モーダル開く（グローバルスコープ）
        window.openExecutionModal = function(buttonElement, executionType) {
            const rowData = extractRowData(buttonElement);
            const validationErrors = validateExecutionData(rowData);
            
            if (validationErrors.length > 0) {
                alert('データエラー:\\n' + validationErrors.join('\\n'));
                return;
            }
            
            // モーダルタイトル設定
            const modalTitle = document.getElementById('unifiedExecutionModalTitle');
            const typeNames = {
                'buy': '📈 買いスワップ',
                'sell': '📉 売りスワップ', 
                'arbitrage': '🔄 アービトラージ'
            };
            modalTitle.textContent = typeNames[executionType] + ' - ' + rowData.pair;
            
            // データをモーダルに保存
            const modal = document.getElementById('unifiedExecutionModal');
            modal.dataset.executionType = executionType;
            modal.dataset.rowData = JSON.stringify(rowData);
            
            // 履歴データタブを表示
            displayHistoricalData(rowData, executionType);
            
            // モーダル表示
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();
        };

        // 履歴データ表示
        function displayHistoricalData(rowData, executionType) {
            const content = document.getElementById('historicalContent');
            
            const buyProtocolInfo = parseProtocolInfo(rowData.buyProtocol);
            const sellProtocolInfo = parseProtocolInfo(rowData.sellProtocol);
            
            content.innerHTML = \`
                <div class="card mb-3">
                    <div class="card-header bg-info text-white">
                        <h6 class="mb-0">📊 ペア情報</h6>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <p><strong>ペア:</strong> \${rowData.pair}</p>
                                <p><strong>トークンA:</strong> <code>\${rowData.tokenA}</code></p>
                                <p><strong>トークンB:</strong> <code>\${rowData.tokenB}</code></p>
                            </div>
                            <div class="col-md-6">
                                <p><strong>スプレッド:</strong> <span class="badge bg-success">\${rowData.spread}%</span></p>
                                <p><strong>買いレート:</strong> \${rowData.buyRate}</p>
                                <p><strong>売りレート:</strong> \${rowData.sellRate}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card mb-3">
                    <div class="card-header bg-primary text-white">
                        <h6 class="mb-0">🔵 買いプロトコル詳細</h6>
                    </div>
                    <div class="card-body">
                        <p><strong>プロトコル:</strong> \${buyProtocolInfo.dex.toUpperCase()} \${buyProtocolInfo.version.toUpperCase()}</p>
                        <p><strong>パラメータ:</strong> \${buyProtocolInfo.parameter}</p>
                        <p><strong>実行内容:</strong> \${rowData.tokenA} → \${rowData.tokenB}</p>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header bg-danger text-white">
                        <h6 class="mb-0">🔴 売りプロトコル詳細</h6>
                    </div>
                    <div class="card-body">
                        <p><strong>プロトコル:</strong> \${sellProtocolInfo.dex.toUpperCase()} \${sellProtocolInfo.version.toUpperCase()}</p>
                        <p><strong>パラメータ:</strong> \${sellProtocolInfo.parameter}</p>
                        <p><strong>実行内容:</strong> \${rowData.tokenB} → \${rowData.tokenA}</p>
                    </div>
                </div>
            \`;
        }

        // リアルタイム実行
        window.executeRealTimeAction = async function() {
            const modal = document.getElementById('unifiedExecutionModal');
            const executionType = modal.dataset.executionType;
            const rowData = JSON.parse(modal.dataset.rowData);
            
            const content = document.getElementById('realtimeContent');
            const inputAmount = document.getElementById('executionAmount').value || '1';
            const testMode = document.getElementById('executionMode').value === 'test';
            
            // 🔍 実行開始時の入力量ログ
            console.log(\`🔍 executeRealTimeAction 開始:\`);
            console.log(\`  - executionType: \${executionType}\`);
            console.log(\`  - inputAmount (raw): "\${inputAmount}" (type: \${typeof inputAmount})\`);
            console.log(\`  - testMode: \${testMode}\`);
            console.log(\`  - rowData.pair: \${rowData.pair}\`);
            
            content.innerHTML = \`
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">実行中...</span>
                    </div>
                    <p class="mt-2">\${testMode ? 'テスト' : '実際の'}実行中...</p>
                </div>
            \`;
            
            try {
                // リアルタイムコントラクト実行
                content.innerHTML = \`
                    <div class="text-center py-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">コントラクト実行中...</span>
                        </div>
                        <p class="mt-2">コントラクトREAD関数を実行中...</p>
                    </div>
                \`;
                
                let result;
                const amountNum = parseFloat(inputAmount);
                
                // 🔍 数値変換ログ
                console.log(\`🔍 数値変換:\`);
                console.log(\`  - inputAmount: "\${inputAmount}"\`);
                console.log(\`  - amountNum: \${amountNum} (type: \${typeof amountNum})\`);
                console.log(\`  - isNaN(amountNum): \${isNaN(amountNum)}\`);
                
                switch(executionType) {
                    case 'buy':
                        result = await executeBuySwap(rowData, amountNum, testMode);
                        break;
                    case 'sell':
                        result = await executeSellSwap(rowData, amountNum, testMode);
                        break;
                    case 'arbitrage':
                        result = await executeArbitrageSwap(rowData, amountNum, testMode);
                        break;
                }
                
                displayRealtimeResult(result, executionType, testMode);
                
            } catch (error) {
                content.innerHTML = \`
                    <div class="alert alert-danger">
                        <h6>❌ 実行エラー</h6>
                        <p>\${error.message}</p>
                        <small class="text-muted">詳細: \${error.stack}</small>
                    </div>
                \`;
            }
        };

        // 簡易版トークン情報取得関数
        async function getTokenInfoSimple(tokenAddress) {
            try {
                const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
                const tokenAbi = [
                    "function decimals() view returns (uint8)",
                    "function symbol() view returns (string)",
                    "function name() view returns (string)"
                ];
                const contract = new ethers.Contract(tokenAddress, tokenAbi, provider);
                
                const [decimals, symbol, name] = await Promise.all([
                    contract.decimals().catch(() => 18),
                    contract.symbol().catch(() => 'UNKNOWN'),
                    contract.name().catch(() => 'Unknown Token')
                ]);
                
                return { decimals, symbol, name };
            } catch (error) {
                console.warn(\`Failed to get token info for \${tokenAddress}:\`, error.message);
                return { decimals: 18, symbol: 'UNKNOWN', name: 'Unknown Token' };
            }
        }

        // コントラクト実行関数群
        async function executeBuySwap(rowData, amountNum, testMode) {
            const startTime = Date.now();
            
            // RealTimeExecutorを使用する場合
            if (window.realTimeExecutor) {
                // 実行モードを設定
                window.realTimeExecutor.setExecutionMode(testMode);
                
                // 拡張されたrowDataを構築
                const enrichedRowData = await window.enrichRowData(rowData);
                return await window.realTimeExecutor.executeBuySwap(enrichedRowData, amountNum);
            }
            
            // 従来の実装（フォールバック）
            let tokenAAddress = rowData?.tokenA;
            let tokenBAddress = rowData?.tokenB;
            
            try {
                // データ存在確認
                if (!tokenAAddress || !tokenBAddress) {
                    throw new Error(\`トークンアドレスが取得できませんでした。TokenA: \${tokenAAddress}, TokenB: \${tokenBAddress}\`);
                }
                
                // プロトコル情報解析
                const protocolInfo = parseProtocolInfo(rowData.buyProtocol);
                
                // アドレス形式検証
                if (!ethers.utils.isAddress(tokenAAddress)) {
                    throw new Error(\`TokenAアドレスが無効です: \${tokenAAddress}\`);
                }
                if (!ethers.utils.isAddress(tokenBAddress)) {
                    throw new Error(\`TokenBアドレスが無効です: \${tokenBAddress}\`);
                }
                
                // デシマル情報取得 - 簡易版
                const tokenAInfo = await getTokenInfoSimple(tokenAAddress);
                const tokenBInfo = await getTokenInfoSimple(tokenBAddress);
                
                const amountIn = ethers.utils.parseUnits(amountNum.toString(), tokenAInfo.decimals);
                
                let contractResult;
                
                if (protocolInfo.version === 'v2') {
                    // V2スワップ実行
                    const routerAbi = [
                        "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
                    ];
                    const routerAddress = protocolInfo.dex === 'hyperswap' ? 
                        '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A' : 
                        '0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802';
                    
                    const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
                    const contract = new ethers.Contract(routerAddress, routerAbi, provider);
                    
                    const path = [tokenAAddress, tokenBAddress];
                    const amounts = await contract.getAmountsOut(amountIn, path);
                    
                    contractResult = {
                        contract: routerAddress,
                        function: 'getAmountsOut',
                        arguments: {
                            amountIn: amountIn.toString(),
                            path: path
                        },
                        returnValue: amounts.map(a => a.toString()),
                        outputAmount: ethers.utils.formatUnits(amounts[1], 18)
                    };
                    
                } else {
                    // V3スワップ実行
                    const quoterAbi = [
                        "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)"
                    ];
                    const quoterAddress = protocolInfo.dex === 'hyperswap' ? 
                        '0x03A918028f22D9E1473B7959C927AD7425A45C7C' : 
                        '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF';
                    
                    const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
                    const contract = new ethers.Contract(quoterAddress, quoterAbi, provider);
                    
                    const fee = parseInt(protocolInfo.parameter) || 3000;
                    const amountOut = await contract.callStatic.quoteExactInputSingle(
                        tokenAAddress, tokenBAddress, fee, amountIn, 0
                    );
                    
                    contractResult = {
                        contract: quoterAddress,
                        function: 'quoteExactInputSingle',
                        arguments: {
                            tokenIn: tokenAAddress,
                            tokenOut: tokenBAddress,
                            fee: fee,
                            amountIn: amountIn.toString(),
                            sqrtPriceLimitX96: 0
                        },
                        returnValue: amountOut.toString(),
                        outputAmount: ethers.utils.formatUnits(amountOut, 18)
                    };
                }
                
                const executionTime = Date.now() - startTime;
                
                return {
                    success: true,
                    type: 'buy',
                    inputAmount: amountNum,
                    outputAmount: parseFloat(contractResult.outputAmount),
                    executionTime: executionTime,
                    protocol: rowData.buyProtocol,
                    contractDetails: contractResult,
                    simulation: testMode
                };
                
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    errorDetails: {
                        code: error.code,
                        reason: error.reason,
                        method: error.method,
                        transaction: error.transaction
                    },
                    executionTime: Date.now() - startTime,
                    protocol: rowData.buyProtocol,
                    inputAmount: amountNum,
                    tokenIn: tokenAAddress,
                    tokenOut: tokenBAddress
                };
            }
        }

        async function executeSellSwap(rowData, amountNum, testMode) {
            const startTime = Date.now();
            
            // RealTimeExecutorを使用する場合
            if (window.realTimeExecutor) {
                // 実行モードを設定
                window.realTimeExecutor.setExecutionMode(testMode);
                
                // 拡張されたrowDataを構築
                const enrichedRowData = await window.enrichRowData(rowData);
                return await window.realTimeExecutor.executeSellSwap(enrichedRowData, amountNum);
            }
            
            // 従来の実装（フォールバック）
            let tokenAAddress = rowData?.tokenB; // 売りなので逆向き
            let tokenBAddress = rowData?.tokenA;
            
            try {
                // データ存在確認
                if (!rowData?.tokenA || !rowData?.tokenB) {
                    throw new Error(\`トークンアドレスが取得できませんでした。TokenA: \${rowData?.tokenA}, TokenB: \${rowData?.tokenB}\`);
                }
                
                // プロトコル情報解析
                const protocolInfo = parseProtocolInfo(rowData.sellProtocol);
                
                // アドレス形式検証
                if (!ethers.utils.isAddress(tokenAAddress)) {
                    throw new Error(\`TokenAアドレス（売り用）が無効です: \${tokenAAddress}\`);
                }
                if (!ethers.utils.isAddress(tokenBAddress)) {
                    throw new Error(\`TokenBアドレス（売り用）が無効です: \${tokenBAddress}\`);
                }
                
                // トークン情報取得（decimals含む）
                const tokenAInfo = await getTokenInfoSimple(tokenAAddress);
                const tokenBInfo = await getTokenInfoSimple(tokenBAddress);
                
                // 極小値チェック（0のみ）
                if (amountNum <= 0) {
                    throw new Error(\`入力量が0または負の値です: \${amountNum}\`);
                }
                
                // 🔍 詳細な入力量追跡ログ
                console.log(\`🔍 入力量追跡開始:\`);
                console.log(\`  - Parsed amountNum: \${amountNum} (type: \${typeof amountNum})\`);
                console.log(\`  - TokenA decimals: \${tokenAInfo.decimals}\`);
                console.log(\`  - TokenB decimals: \${tokenBInfo.decimals}\`);
                
                const amountIn = ethers.utils.parseUnits(amountNum.toString(), tokenAInfo.decimals);
                console.log(\`  - amountIn (wei): \${amountIn.toString()}\`);
                console.log(\`  - amountIn (decimal): \${ethers.utils.formatUnits(amountIn, tokenAInfo.decimals)}\`);
                
                let contractResult;
                
                if (protocolInfo.version === 'v2') {
                    // V2スワップ実行
                    const routerAbi = [
                        "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
                    ];
                    const routerAddress = protocolInfo.dex === 'hyperswap' ? 
                        '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A' : 
                        '0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802';
                    
                    const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
                    const contract = new ethers.Contract(routerAddress, routerAbi, provider);
                    
                    const path = [tokenAAddress, tokenBAddress];
                    
                    // 🔍 HyperSwap V2 コントラクト呼び出し追跡
                    console.log(\`🔍 HyperSwap V2 コントラクト呼び出し:\`);
                    console.log(\`  - Router: \${routerAddress}\`);
                    console.log(\`  - Path: [\${tokenAAddress}, \${tokenBAddress}]\`);
                    console.log(\`  - AmountIn: \${amountIn.toString()}\`);
                    
                    const amounts = await contract.getAmountsOut(amountIn, path);
                    
                    console.log(\`🔍 HyperSwap V2 結果:\`);
                    console.log(\`  - Amounts[0] (input): \${amounts[0].toString()}\`);
                    console.log(\`  - Amounts[1] (output): \${amounts[1].toString()}\`);
                    console.log(\`  - Output (formatted): \${ethers.utils.formatUnits(amounts[1], tokenBInfo.decimals)}\`);
                    
                    // ゼロ出力チェック
                    if (!amounts[1] || amounts[1].eq(0)) {
                        console.warn(\`⚠️ HyperSwap V2 returned zero output\`);
                        throw new Error(\`HyperSwap V2 returned zero output - insufficient liquidity or pool does not exist\`);
                    }
                    
                    contractResult = {
                        contract: routerAddress,
                        function: 'getAmountsOut',
                        arguments: {
                            amountIn: amountIn.toString(),
                            path: path
                        },
                        returnValue: amounts.map(a => a.toString()),
                        outputAmount: ethers.utils.formatUnits(amounts[1], tokenBInfo.decimals)
                    };
                    
                } else {
                    // V3スワップ実行
                    const quoterAbi = [
                        "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)"
                    ];
                    const quoterAddress = protocolInfo.dex === 'hyperswap' ? 
                        '0x03A918028f22D9E1473B7959C927AD7425A45C7C' : 
                        '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF';
                    
                    const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
                    const contract = new ethers.Contract(quoterAddress, quoterAbi, provider);
                    
                    const fee = parseInt(protocolInfo.parameter) || 3000;
                    const amountOut = await contract.callStatic.quoteExactInputSingle(
                        tokenAAddress, tokenBAddress, fee, amountIn, 0
                    );
                    
                    contractResult = {
                        contract: quoterAddress,
                        function: 'quoteExactInputSingle',
                        arguments: {
                            tokenIn: tokenAAddress,
                            tokenOut: tokenBAddress,
                            fee: fee,
                            amountIn: amountIn.toString(),
                            sqrtPriceLimitX96: 0
                        },
                        returnValue: amountOut.toString(),
                        outputAmount: ethers.utils.formatUnits(amountOut, tokenBInfo.decimals)
                    };
                }
                
                const executionTime = Date.now() - startTime;
                
                return {
                    success: true,
                    type: 'sell',
                    inputAmount: amountNum,
                    outputAmount: parseFloat(contractResult.outputAmount),
                    executionTime: executionTime,
                    protocol: rowData.sellProtocol,
                    contractDetails: contractResult,
                    simulation: testMode
                };
                
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    errorDetails: {
                        code: error.code,
                        reason: error.reason,
                        method: error.method,
                        transaction: error.transaction
                    },
                    executionTime: Date.now() - startTime,
                    protocol: rowData.sellProtocol,
                    inputAmount: amountNum,
                    tokenIn: tokenAAddress,
                    tokenOut: tokenBAddress
                };
            }
        }

        async function executeArbitrageSwap(rowData, amountNum, testMode) {
            const startTime = Date.now();
            
            // RealTimeExecutorを使用する場合
            if (window.realTimeExecutor) {
                // 実行モードを設定
                window.realTimeExecutor.setExecutionMode(testMode);
                
                const enrichedRowData = await window.enrichRowData(rowData);
                return await window.realTimeExecutor.executeArbitrage(enrichedRowData, amountNum);
            }
            
            // 従来の実装（フォールバック）
            try {
                // Step 1: 買いスワップ実行
                const buyResult = await executeBuySwap(rowData, amountNum, testMode);
                if (!buyResult.success) {
                    return {
                        success: false,
                        error: \`買いスワップ失敗: \${buyResult.error}\`,
                        executionTime: Date.now() - startTime
                    };
                }
                
                // 出力量が0の場合のみエラー（極小値は有効）
                if (buyResult.outputAmount <= 0) {
                    return {
                        success: false,
                        error: \`買いスワップの出力量が0です: \${buyResult.outputAmount}\`,
                        executionTime: Date.now() - startTime,
                        step1: buyResult,
                        zeroOutput: true
                    };
                }
                
                // Step 2: 売りスワップ実行（買いスワップの出力量を入力）
                const sellResult = await executeSellSwap(rowData, buyResult.outputAmount, testMode);
                if (!sellResult.success) {
                    return {
                        success: false,
                        error: \`売りスワップ失敗: \${sellResult.error}\`,
                        errorDetails: sellResult.errorDetails,
                        executionTime: Date.now() - startTime,
                        step1: buyResult,
                        step2: sellResult,
                        partialSuccess: true
                    };
                }
                
                const executionTime = Date.now() - startTime;
                const profit = sellResult.outputAmount - amountNum;
                const profitPercentage = (profit / amountNum) * 100;
                
                return {
                    success: true,
                    type: 'arbitrage',
                    initialAmount: amountNum,
                    intermediateAmount: buyResult.outputAmount,
                    finalAmount: sellResult.outputAmount,
                    profit: profit,
                    profitPercentage: profitPercentage,
                    executionTime: executionTime,
                    step1: buyResult,
                    step2: sellResult,
                    simulation: testMode
                };
                
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    executionTime: Date.now() - startTime
                };
            }
        }

        // リアルタイム結果表示
        function displayRealtimeResult(result, executionType, testMode) {
            const content = document.getElementById('realtimeContent');
            const modal = document.getElementById('unifiedExecutionModal');
            const rowData = JSON.parse(modal.dataset.rowData);
            const inputAmount = document.getElementById('executionAmount').value || '1';
            
            console.log('🔍 displayRealtimeResult called with:', { success: result.success, error: result.error, retryable: result.retryable });
            
            // エラー結果の場合の処理
            if (!result.success) {
                console.error('🚨 displayRealtimeResult: Error result detected');
                content.innerHTML = \`
                    <div class="alert alert-danger">
                        <h6>❌ 実行失敗</h6>
                        <p><strong>エラー:</strong> \${result.error || 'Unknown error'}</p>
                        \${result.details ? '<small class="text-muted">詳細: ' + JSON.stringify(result.details) + '</small>' : ''}
                        <div class="mt-3">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">閉じる</button>
                        </div>
                    </div>
                \`;
                return;
            }
            
            const typeNames = {
                'buy': '📈 買いスワップ',
                'sell': '📉 売りスワップ',
                'arbitrage': '🔄 アービトラージ'
            };
            
            // RealTimeExecutorの結果の場合は特別処理
            if (result.realTime) {
                displayRealTimeExecutorResult(result, executionType, testMode);
                return;
            }
        }

        // RealTimeExecutor専用結果表示関数
        function displayRealTimeExecutorResult(result, executionType, testMode) {
            // デバッグログ追加
            console.log('🔍 displayRealTimeExecutorResult呼び出し:', {
                result: result,
                executionType: executionType,
                testMode: testMode,
                timestamp: new Date().toISOString()
            });
            
            // モーダルからrowDataを取得
            const modal = document.getElementById('unifiedExecutionModal');
            const rowData = JSON.parse(modal.dataset.rowData);
            const content = document.getElementById('realtimeContent');
            const typeNames = {
                'buy': '📈 買いスワップ',
                'sell': '📉 売りスワップ',
                'arbitrage': '🔄 アービトラージ'
            };

            if (!result.success) {
                content.innerHTML = \`
                    <div class="alert alert-danger">
                        <h6>❌ \${typeNames[executionType]} 失敗</h6>
                        <p><strong>エラー:</strong> \${result.error}</p>
                        <small class="text-muted">発生時刻: \${result.timestamp}</small>
                    </div>
                \`;
                return;
            }

            if (executionType === 'arbitrage') {
                const { realTime } = result;
                content.innerHTML = \`
                    <div class="alert alert-info mb-3">
                        <strong>🔍 リアルタイム実行:</strong> コントラクトREAD関数を使用して実際のブロックチェーンデータを取得しています。
                    </div>
                    <div class="card">
                        <div class="card-header bg-info text-white">
                            <h6 class="mb-0">🔍 \${typeNames[executionType]} リアルタイム実行結果</h6>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6 class="text-primary">📊 アービトラージサマリー</h6>
                                    <p><strong>初期金額:</strong> \${realTime.summary.initialAmount}</p>
                                    <p><strong>最終金額:</strong> \${realTime.summary.finalAmount}</p>
                                    <p><strong>利益:</strong> <span class="badge bg-\${realTime.summary.statusColor}">\${realTime.summary.profit} (\${realTime.summary.profitPercentage})</span></p>
                                    <p><strong>総ガス使用量:</strong> \${realTime.summary.totalGasUsed}</p>
                                    <p><strong>実行時刻:</strong> \${realTime.timestamp}</p>
                                </div>
                                <div class="col-md-6">
                                    <h6 class="text-info">🔧 実行詳細</h6>
                                    <div class="mb-2">
                                        <strong>Step 1 - \${realTime.step1.action}:</strong><br>
                                        <small>\${realTime.step1.protocol}</small><br>
                                        \${realTime.step1.input} → \${realTime.step1.output}<br>
                                        <small>Gas: \${realTime.step1.gasUsed}</small>
                                    </div>
                                    <div>
                                        <strong>Step 2 - \${realTime.step2.action}:</strong><br>
                                        <small>\${realTime.step2.protocol}</small><br>
                                        \${realTime.step2.input} → \${realTime.step2.output}<br>
                                        <small>Gas: \${realTime.step2.gasUsed}</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                \`;
            } else {
                // 買い・売りスワップの場合
                const { realTime } = result;
                content.innerHTML = \`
                    <div class="alert alert-info mb-3">
                        <strong>🔍 リアルタイム実行:</strong> コントラクトREAD関数を使用して実際のブロックチェーンデータを取得しています。
                    </div>
                    <div class="card">
                        <div class="card-header bg-info text-white">
                            <h6 class="mb-0">🔍 \${typeNames[executionType]} リアルタイム実行結果</h6>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6 class="text-primary">📊 実行結果</h6>
                                    <p><strong>入力:</strong> \${realTime.input}</p>
                                    <p><strong>出力:</strong> \${realTime.output}</p>
                                    <p><strong>レート:</strong> \${realTime.rate}</p>
                                    <p><strong>ガス使用量:</strong> \${realTime.gasUsed}</p>
                                    <p><strong>実行時刻:</strong> \${realTime.timestamp}</p>
                                </div>
                                <div class="col-md-6">
                                    <h6 class="text-info">🔧 プロトコル詳細</h6>
                                    <p><strong>プロトコル:</strong> \${realTime.protocol}</p>
                                    <p><strong>パラメータ:</strong> \${realTime.protocolDetails}</p>
                                    <p><strong>ステータス:</strong> <span class="badge bg-success">\${realTime.status}</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                \`;
            }
            
            // 実行時間は実際のRealTimeExecutorから取得
            const executionTime = result.realTime?.executionTime || 'データなし';
            
            if (executionType === 'arbitrage' && result.success) {
                const summary = result.realTime?.summary || {};
                const step1 = result.realTime?.step1 || {};
                const step2 = result.realTime?.step2 || {};
                
                content.innerHTML = \`
                    <div class="card">
                        <div class="card-header bg-success text-white">
                            <h6 class="mb-0">✅ \${typeNames[executionType]} 結果 \${testMode ? '(テストモード)' : '(リアルタイムデータ)'}</h6>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6 class="text-primary">📊 実行サマリー</h6>
                                    <p><strong>初期入力:</strong> \${summary.initialAmount || 'データなし'}</p>
                                    <p><strong>中間出力:</strong> \${step1.output || 'データなし'}</p>
                                    <p><strong>最終出力:</strong> \${summary.finalAmount || 'データなし'}</p>
                                    <p><strong>純利益:</strong> <span class="badge bg-\${(summary.profit && summary.profit.startsWith('+')) ? 'success' : 'danger'}">\${summary.profit || 'データなし'} (\${summary.profitPercentage || 'データなし'})</span></p>
                                    <p><strong>データソース:</strong> \${result.realTime?.mode === 'read-only' ? 'コントラクトREAD関数' : 'リアルタイム実行'}</p>
                                </div>
                                <div class="col-md-6">
                                    <h6 class="text-info">🔧 Step 1: 買いスワップ</h6>
                                    <p><strong>プロトコル:</strong> \${step1.protocol || 'データなし'}</p>
                                    <p><strong>入力:</strong> \${step1.input || 'データなし'}</p>
                                    <p><strong>出力:</strong> \${step1.output || 'データなし'}</p>
                                    <p><strong>ガス:</strong> \${step1.gasUsed || 'データなし'}</p>
                                    
                                    <h6 class="text-warning mt-3">🔧 Step 2: 売りスワップ</h6>
                                    <p><strong>プロトコル:</strong> \${step2.protocol || 'データなし'}</p>
                                    <p><strong>入力:</strong> \${step2.input || 'データなし'}</p>
                                    <p><strong>出力:</strong> \${step2.output || 'データなし'}</p>
                                    <p><strong>ガス:</strong> \${step2.gasUsed || 'データなし'}</p>
                                </div>
                            </div>
                            
                            <div class="mt-3">
                                <h6 class="text-secondary">📋 詳細なコントラクト情報</h6>
                                <div class="accordion" id="contractDetails">
                                    <div class="accordion-item">
                                        <h2 class="accordion-header" id="step1Header">
                                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#step1Details">
                                                Step 1: 買いスワップ詳細
                                            </button>
                                        </h2>
                                        <div id="step1Details" class="accordion-collapse collapse" data-bs-parent="#contractDetails">
                                            <div class="accordion-body">
                                                <p><strong>アクション:</strong> \${step1.action || 'データなし'}</p>
                                                <p><strong>プロトコル:</strong> \${step1.protocol || 'データなし'}</p>
                                                <p><strong>ステータス:</strong> \${step1.status || 'データなし'}</p>
                                                <p><strong>実行時刻:</strong> \${result.realTime?.timestamp || 'データなし'}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="accordion-item">
                                        <h2 class="accordion-header" id="step2Header">
                                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#step2Details">
                                                Step 2: 売りスワップ詳細
                                            </button>
                                        </h2>
                                        <div id="step2Details" class="accordion-collapse collapse" data-bs-parent="#contractDetails">
                                            <div class="accordion-body">
                                                <p><strong>アクション:</strong> \${step2.action || 'データなし'}</p>
                                                <p><strong>プロトコル:</strong> \${step2.protocol || 'データなし'}</p>
                                                <p><strong>ステータス:</strong> \${step2.status || 'データなし'}</p>
                                                <p><strong>実行時刻:</strong> \${result.realTime?.timestamp || 'データなし'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                \`;
            } else if (result.success) {
                // 買い・売りスワップの場合
                const inputToken = executionType === 'buy' ? rowData.pair.split('/')[0] : rowData.pair.split('/')[1];
                const outputToken = executionType === 'buy' ? rowData.pair.split('/')[1] : rowData.pair.split('/')[0];
                const realTimeData = result.realTime || {};
                
                content.innerHTML = \`
                    <div class="card">
                        <div class="card-header bg-success text-white">
                            <h6 class="mb-0">✅ \${typeNames[executionType]} 結果 \${testMode ? '(テストモード)' : '(リアルタイムデータ)'}</h6>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6 class="text-primary">📊 実行サマリー</h6>
                                    <p><strong>入力:</strong> \${realTimeData.input || 'データなし'}</p>
                                    <p><strong>出力:</strong> \${realTimeData.output || 'データなし'}</p>
                                    <p><strong>レート:</strong> \${realTimeData.rate || 'データなし'}</p>
                                    <p><strong>ガス:</strong> \${realTimeData.gasUsed || 'データなし'}</p>
                                    <p><strong>データソース:</strong> \${realTimeData.dataSource || realTimeData.mode || 'データなし'}</p>
                                </div>
                                <div class="col-md-6">
                                    <h6 class="text-info">🔧 コントラクト情報</h6>
                                    <p><strong>プロトコル:</strong> \${realTimeData.protocol || result.protocol || 'データなし'}</p>
                                    <p><strong>ステータス:</strong> \${realTimeData.status || 'データなし'}</p>
                                    <p><strong>実行時刻:</strong> \${realTimeData.timestamp || 'データなし'}</p>
                                    <p><strong>🔍 実行ID:</strong> \${realTimeData.debugInfo?.executionSequence || 'なし'}</p>
                                </div>
                            </div>
                            
                            <div class="mt-3">
                                <h6 class="text-secondary">📋 詳細なコントラクト情報</h6>
                                <div class="accordion" id="contractDetailsAccordion">
                                    <div class="accordion-item">
                                        <h2 class="accordion-header" id="contractDetailsHeader">
                                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#contractDetailsBody">
                                                コントラクト詳細を表示
                                            </button>
                                        </h2>
                                        <div id="contractDetailsBody" class="accordion-collapse collapse" data-bs-parent="#contractDetailsAccordion">
                                            <div class="accordion-body">
                                                <p><strong>実行モード:</strong> \${realTimeData.mode || 'データなし'}</p>
                                                <p><strong>データソース:</strong> \${realTimeData.dataSource || 'データなし'}</p>
                                                <p><strong>実行時刻:</strong> \${realTimeData.timestamp || 'データなし'}</p>
                                                <p><strong>実際実行時刻:</strong> \${realTimeData.debugInfo?.actualTimestamp || 'データなし'}</p>
                                                <p><strong>実行ID:</strong> \${realTimeData.debugInfo?.executionSequence || 'データなし'}</p>
                                                <p><strong>プロトコル:</strong> \${realTimeData.protocol || 'データなし'}</p>
                                                <p><strong>警告:</strong> \${realTimeData.warning || 'なし'}</p>
                                                <p><strong>実行遅延:</strong> \${realTimeData.executionDelay || 'なし'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                \`;
            } else {
                // エラーの場合
                content.innerHTML = \`
                    <div class="card">
                        <div class="card-header bg-danger text-white">
                            <h6 class="mb-0">❌ \${typeNames[executionType]} 実行失敗</h6>
                        </div>
                        <div class="card-body">
                            <div class="alert alert-danger">
                                <h6>エラー詳細:</h6>
                                <p>\${result.error}</p>
                                <p><strong>実行時間:</strong> \${result.executionTime}ms</p>
                                \${result.errorDetails ? \`
                                    <div class="mt-2">
                                        <small><strong>エラーコード:</strong> \${result.errorDetails.code || 'N/A'}</small><br>
                                        <small><strong>理由:</strong> \${result.errorDetails.reason || 'N/A'}</small>
                                    </div>
                                \` : ''}
                                \${result.inputAmount ? \`
                                    <div class="mt-2">
                                        <small><strong>入力量:</strong> \${result.inputAmount}</small><br>
                                        <small><strong>TokenIn:</strong> \${result.tokenIn}</small><br>
                                        <small><strong>TokenOut:</strong> \${result.tokenOut}</small>
                                    </div>
                                \` : ''}
                                \${result.step1 ? \`
                                    <hr>
                                    <h6>Step 1 (買いスワップ):</h6>
                                    <p class="text-success">✅ 成功: \${result.step1.output || 'データなし'}</p>
                                    \${result.step2 ? \`
                                        <h6>Step 2 (売りスワップ):</h6>
                                        <p class="text-danger">❌ 失敗</p>
                                        <small>入力量が少なすぎる可能性があります（\${result.step1.output || 'データなし'}）</small>
                                    \` : ''}
                                \` : ''}
                            </div>
                        </div>
                    </div>
                \`;
            }
        }
        
        // ====================
        // 🆕 BidirectionalLiquidityChecker & RealTimeExecutor クラス定義
        // ====================
        
        // enrichRowData関数（グローバル）
        window.enrichRowData = async function enrichRowData(rowData) {
            try {
                const checker = window.realTimeExecutor?.checker;
                if (!checker) {
                    throw new Error('RealTimeExecutor not initialized');
                }
                
                // tokenA, tokenBの詳細情報を取得
                const tokenAInfo = await checker.getTokenInfo(rowData.tokenA);
                const tokenBInfo = await checker.getTokenInfo(rowData.tokenB);
                
                // プロトコル情報の解析
                const buyProtocolInfo = window.parseProtocolInfo ? 
                    window.parseProtocolInfo(rowData.buyProtocol) : 
                    { dex: 'unknown', version: 'unknown', parameter: 'unknown' };
                const sellProtocolInfo = window.parseProtocolInfo ? 
                    window.parseProtocolInfo(rowData.sellProtocol) : 
                    { dex: 'unknown', version: 'unknown', parameter: 'unknown' };
                
                return {
                    ...rowData,
                    tokenA: {
                        address: rowData.tokenA,
                        decimals: tokenAInfo.decimals,
                        symbol: tokenAInfo.symbol,
                        name: tokenAInfo.name
                    },
                    tokenB: {
                        address: rowData.tokenB,
                        decimals: tokenBInfo.decimals,
                        symbol: tokenBInfo.symbol,
                        name: tokenBInfo.name
                    },
                    buyProtocol: {
                        dex: buyProtocolInfo.dex,
                        version: buyProtocolInfo.version,
                        params: buyProtocolInfo.version === 'v3' ? 
                            { fee: parseInt(buyProtocolInfo.parameter) } : 
                            {}
                    },
                    sellProtocol: {
                        dex: sellProtocolInfo.dex,
                        version: sellProtocolInfo.version,
                        params: sellProtocolInfo.version === 'v3' ? 
                            { fee: parseInt(sellProtocolInfo.parameter) } : 
                            {}
                    }
                };
                
            } catch (error) {
                console.error('enrichRowData エラー:', error);
                // フォールバック: 既存のrowDataをそのまま返す
                return rowData;
            }
        };
        
        // 簡略版 BidirectionalLiquidityChecker（HTMLダッシュボード用）
        class BidirectionalLiquidityChecker {
            constructor() {
                this.rpcUrl = "https://rpc.hyperliquid.xyz/evm";
                this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
                this.tokenCache = new Map();
            }
            
            async getTokenInfo(tokenAddress) {
                if (this.tokenCache.has(tokenAddress)) {
                    return this.tokenCache.get(tokenAddress);
                }
                
                try {
                    const tokenAbi = [
                        "function decimals() view returns (uint8)",
                        "function symbol() view returns (string)",
                        "function name() view returns (string)"
                    ];
                    const contract = new ethers.Contract(tokenAddress, tokenAbi, this.provider);
                    
                    const [decimals, symbol, name] = await Promise.all([
                        contract.decimals().catch(() => 18),
                        contract.symbol().catch(() => 'UNKNOWN'),
                        contract.name().catch(() => 'Unknown Token')
                    ]);
                    
                    const info = { decimals, symbol, name };
                    this.tokenCache.set(tokenAddress, info);
                    return info;
                } catch (error) {
                    console.warn(\`Failed to get token info for \${tokenAddress}:\`, error.message);
                    const fallback = { decimals: 18, symbol: 'UNKNOWN', name: 'Unknown Token' };
                    this.tokenCache.set(tokenAddress, fallback);
                    return fallback;
                }
            }
            
            async getQuote(dex, version, tokenIn, tokenOut, amountIn, params) {
                // 実際のコントラクトREAD関数を呼び出して出力量を取得
                console.log(\`🔄 \${dex.toUpperCase()} \${version.toUpperCase()} クォート取得中...\`);
                console.log('📍 HTMLダッシュボード内getQuote:', {
                    dex,
                    version,
                    tokenIn: tokenIn.substring(0, 10) + '...',
                    tokenOut: tokenOut.substring(0, 10) + '...',
                    amount: ethers.utils.formatUnits(amountIn, 18),
                    timestamp: new Date().toISOString()
                });
                
                try {
                    let result;
                    
                    if (dex === 'hyperswap') {
                        if (version === 'v2') {
                            // HyperSwap V2: Router.getAmountsOut使用
                            const routerAbi = [
                                "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
                            ];
                            const router = new ethers.Contract(this.contracts.hyperswap.v2Router, routerAbi, this.provider);
                            const path = [tokenIn, tokenOut];
                            console.log('📡 HyperSwap V2 Router呼び出し前...');
                            const amounts = await router.getAmountsOut(amountIn, path);
                            console.log('✅ HyperSwap V2 Router結果:', ethers.utils.formatUnits(amounts[1], 18));
                            
                            // 重要: 0.0の結果チェックを追加
                            if (!amounts[1] || amounts[1].eq(0)) {
                                console.warn('⚠️ HyperSwap V2 returned zero output');
                                throw new Error('HyperSwap V2 returned zero output - insufficient liquidity or pool does not exist');
                            }
                            
                            result = {
                                amountOut: amounts[1],
                                gasEstimate: ethers.BigNumber.from(150000)
                            };
                        } else {
                            // HyperSwap V3: QuoterV2使用
                            const quoterAbi = [
                                "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
                            ];
                            const quoter = new ethers.Contract(this.contracts.hyperswap.v3QuoterV2, quoterAbi, this.provider);
                            const actualFee = params.fee || 3000;
                            console.log(\`🔍 HTMLダッシュボード QuoterV2 呼び出し詳細:\`);
                            console.log(\`  params.fee: \${params.fee}\`);
                            console.log(\`  actualFee: \${actualFee}\`);
                            console.log(\`  tokenIn: \${tokenIn}\`);
                            console.log(\`  tokenOut: \${tokenOut}\`);
                            console.log(\`  amountIn: \${amountIn.toString()}\`);
                            
                            const quoteParams = {
                                tokenIn: tokenIn,
                                tokenOut: tokenOut,
                                amountIn: amountIn,
                                fee: actualFee,
                                sqrtPriceLimitX96: 0
                            };
                            // LOKエラー対策: リトライ機能付きで実行
                            result = await this.retryQuoterCall(quoter, quoteParams, 'hyperswap');
                        }
                    } else if (dex === 'kittenswap') {
                        if (version === 'v2') {
                            // KittenSwap V2: Router.getAmountsOut使用
                            const routerAbi = [
                                "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
                            ];
                            const router = new ethers.Contract(this.contracts.kittenswap.v2Router, routerAbi, this.provider);
                            const path = [tokenIn, tokenOut];
                            const amounts = await router.getAmountsOut(amountIn, path);
                            
                            result = {
                                amountOut: amounts[1],
                                gasEstimate: ethers.BigNumber.from(120000)
                            };
                        } else {
                            // KittenSwap V3: QuoterV2使用
                            const quoterAbi = [
                                "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 tickSpacing, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
                            ];
                            const quoter = new ethers.Contract(this.contracts.kittenswap.v3QuoterV2, quoterAbi, this.provider);
                            const quoteParams = {
                                tokenIn: tokenIn,
                                tokenOut: tokenOut,
                                amountIn: amountIn,
                                tickSpacing: params.tickSpacing || 200,
                                sqrtPriceLimitX96: 0
                            };
                            // LOKエラー対策: リトライ機能付きで実行
                            result = await this.retryQuoterCall(quoter, quoteParams, 'kittenswap');
                        }
                    }
                    
                    if (result && result.amountOut && result.amountOut.gt(0)) {
                        return {
                            success: true,
                            amountOut: result.amountOut,
                            gasEstimate: result.gasEstimate || (version === 'v2' ? 150000 : 200000),
                            realData: true
                        };
                    } else {
                        console.warn(\`⚠️ \${dex} \${version} returned zero or invalid amount\`);
                        return {
                            success: false,
                            exclusionReason: 'getQuote returned zero or invalid amount',
                            realData: false,
                            amountOut: ethers.BigNumber.from(0)
                        };
                    }
                    
                } catch (error) {
                    console.warn(\`getQuote エラー (\${dex} \${version}):\`, error.message);
                    
                    // LOKエラーの場合は特別なメッセージを提供
                    let userFriendlyError = error.message;
                    if (error.message.includes('LOK')) {
                        userFriendlyError = 'プールが一時的にロックされています。数秒後に再試行してください。';
                    }
                    
                    return {
                        success: false,
                        exclusionReason: \`getQuote failed: \${userFriendlyError}\`,
                        realData: false,
                        originalError: error.message
                    };
                }
            }

            // LOKエラー対策: リトライ機能付きQuoterV2呼び出し
            async retryQuoterCall(quoter, quoteParams, dexName, maxRetries = 3) {
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        console.log(\`🔄 \${dexName} QuoterV2 呼び出し試行 \${attempt}/\${maxRetries}\`);
                        const result = await quoter.callStatic.quoteExactInputSingle(quoteParams);
                        console.log(\`✅ \${dexName} QuoterV2 成功 (試行 \${attempt})\`);
                        return result;
                    } catch (error) {
                        console.warn(\`⚠️ \${dexName} QuoterV2 失敗 (試行 \${attempt}): \${error.message}\`);
                        
                        // LOKエラーの場合は少し待機してリトライ
                        if (error.message.includes('LOK') && attempt < maxRetries) {
                            const delay = 200 * attempt; // 200ms, 400ms, 600ms
                            console.log(\`⏳ LOKエラーによりリトライ前に\${delay}ms待機...\`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            continue;
                        }
                        
                        // 最後の試行でも失敗した場合はエラーをスロー
                        if (attempt === maxRetries) {
                            throw error;
                        }
                    }
                }
            }
        }
        
        // RealTimeExecutor クラス（HTMLダッシュボード用 - 実際のREAD関数呼び出し）
        BidirectionalLiquidityChecker.RealTimeExecutor = class RealTimeExecutor {
            constructor(bidirectionalChecker) {
                this.checker = bidirectionalChecker;
                this.provider = bidirectionalChecker.provider;
                this.testMode = true; // READ関数のみ使用（WRITE関数は使用しない）
                
                console.log('🔍 RealTimeExecutor initialized - READ関数でリアルタイムクォート取得');
                console.log('   コントラクトREAD関数を使用して実際の出力量を計算します');
            }

            setExecutionMode(testMode) {
                this.testMode = testMode;
                console.log('🔄 実行モード設定: ' + (testMode ? 'テスト（READ専用）' : '実際実行（WRITE含む）'));
                if (!testMode) {
                    console.warn('⚠️  実際実行モードは資金移動を伴います。十分注意してください。');
                }
            }

            async executeBuySwap(rowData, inputAmount) {
                const { tokenA, tokenB, buyProtocol } = rowData;
                const timestamp = new Date().toISOString();
                
                try {
                    const amountInWei = ethers.utils.parseUnits(
                        inputAmount.toString(), 
                        tokenA.decimals
                    );
                    
                    let currentQuote;
                    let outputAmount;
                    let rate;
                    
                    // デバッグログ追加
                    console.log('🔍 executeBuySwap実行:', {
                        testMode: this.testMode,
                        tokenA: tokenA.symbol,
                        tokenB: tokenB.symbol,
                        inputAmount: inputAmount,
                        protocol: buyProtocol.dex + ' ' + buyProtocol.version,
                        timestamp: new Date().toISOString()
                    });
                    
                    if (this.testMode) {
                        // テストモード: READ関数のみ
                        console.log('📖 テストモード: getQuote呼び出し開始...');
                        currentQuote = await this.checker.getQuote(
                            buyProtocol.dex,
                            buyProtocol.version,
                            tokenA.address,
                            tokenB.address,
                            amountInWei,
                            buyProtocol.params
                        );
                        
                        if (!currentQuote.success) {
                            return {
                                success: false,
                                error: 'クォート取得失敗: ' + currentQuote.exclusionReason,
                                timestamp: timestamp,
                                retryable: false,
                                details: {
                                    dex: buyProtocol.dex,
                                    version: buyProtocol.version,
                                    exclusionReason: currentQuote.exclusionReason
                                }
                            };
                        }
                        
                        // 重要: 出力量が0の場合の処理を追加
                        if (!currentQuote.amountOut || currentQuote.amountOut.eq(0)) {
                            console.warn(\`⚠️ Zero output detected from \${buyProtocol.dex} \${buyProtocol.version}\`);
                            return {
                                success: false,
                                error: 'ゼロ出力: 流動性不足またはプール未存在',
                                timestamp: timestamp,
                                retryable: false,
                                details: {
                                    dex: buyProtocol.dex,
                                    version: buyProtocol.version,
                                    exclusionReason: 'Zero output amount',
                                    amountOut: '0'
                                }
                            };
                        }
                        
                        outputAmount = parseFloat(ethers.utils.formatUnits(
                            currentQuote.amountOut,
                            tokenB.decimals
                        ));
                        rate = outputAmount / inputAmount;
                        console.log('✅ テストモード結果:', { outputAmount, rate });
                        
                        // 極小出力量チェック（数値精度の問題を防ぐ）
                        console.log('🔍 極小値チェック:', { outputAmount, threshold: 0.000001, isSmall: outputAmount < 0.000001 });
                        if (outputAmount < 0.000000001 || outputAmount === 0 || !isFinite(outputAmount)) {
                            console.error(\`🚨 STOPPING: Extremely small or invalid output detected: \${outputAmount}\`);
                            console.error('🚨 RETURNING ERROR OBJECT NOW');
                            const errorResult = {
                                success: false,
                                error: '極小出力量: 実質的にゼロに近い出力',
                                timestamp: timestamp,
                                retryable: false,
                                details: {
                                    dex: buyProtocol.dex,
                                    version: buyProtocol.version,
                                    exclusionReason: 'Extremely small output',
                                    outputAmount: outputAmount.toString()
                                }
                            };
                            console.error('🚨 ERROR RESULT:', errorResult);
                            return errorResult;
                        }
                        
                    } else {
                        // 実際実行モード: 少し待機してから再度READ関数を実行（市場変動を捉える）
                        console.log('🔴 実際実行モード: 100ms待機...');
                        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms待機
                        
                        console.log('🔴 実際実行モード: getQuote呼び出し開始...');
                        currentQuote = await this.checker.getQuote(
                            buyProtocol.dex,
                            buyProtocol.version,
                            tokenA.address,
                            tokenB.address,
                            amountInWei,
                            buyProtocol.params
                        );
                        
                        if (!currentQuote.success) {
                            return {
                                success: false,
                                error: '実際実行準備失敗: ' + currentQuote.exclusionReason,
                                timestamp: timestamp,
                                retryable: false,
                                details: {
                                    dex: buyProtocol.dex,
                                    version: buyProtocol.version,
                                    exclusionReason: currentQuote.exclusionReason,
                                    mode: 'live'
                                }
                            };
                        }
                        
                        // 重要: 出力量が0の場合の処理を追加（実際実行モード）
                        if (!currentQuote.amountOut || currentQuote.amountOut.eq(0)) {
                            console.warn(\`⚠️ Zero output detected from \${buyProtocol.dex} \${buyProtocol.version} (LIVE MODE)\`);
                            return {
                                success: false,
                                error: 'ゼロ出力: 流動性不足またはプール未存在（実際実行不可）',
                                timestamp: timestamp,
                                retryable: false,
                                details: {
                                    dex: buyProtocol.dex,
                                    version: buyProtocol.version,
                                    exclusionReason: 'Zero output amount',
                                    amountOut: '0',
                                    mode: 'live'
                                }
                            };
                        }
                        
                        // 実際実行モードでも同じREAD関数の結果を使用
                        outputAmount = parseFloat(ethers.utils.formatUnits(
                            currentQuote.amountOut,
                            tokenB.decimals
                        ));
                        rate = outputAmount / inputAmount;
                        console.log('✅ 実際実行モード結果:', { outputAmount, rate });
                        
                        // 極小出力量チェック（数値精度の問題を防ぐ）- 実際実行モード
                        console.log('🔍 極小値チェック(LIVE):', { outputAmount, threshold: 0.000001, isSmall: outputAmount < 0.000001 });
                        if (outputAmount < 0.000000001 || outputAmount === 0 || !isFinite(outputAmount)) {
                            console.error(\`🚨 STOPPING (LIVE): Extremely small or invalid output detected: \${outputAmount}\`);
                            console.error('🚨 RETURNING ERROR OBJECT NOW (LIVE)');
                            const errorResult = {
                                success: false,
                                error: '極小出力量: 実質的にゼロに近い出力（実際実行不可）',
                                timestamp: timestamp,
                                retryable: false,
                                details: {
                                    dex: buyProtocol.dex,
                                    version: buyProtocol.version,
                                    exclusionReason: 'Extremely small output',
                                    outputAmount: outputAmount.toString(),
                                    mode: 'live'
                                }
                            };
                            console.error('🚨 ERROR RESULT (LIVE):', errorResult);
                            return errorResult;
                        }
                    }
                    
                    const executionResult = {
                        input: inputAmount + ' ' + tokenA.symbol,
                        output: outputAmount.toFixed(6) + ' ' + tokenB.symbol,
                        rate: rate.toFixed(6),
                        gasUsed: currentQuote.gasEstimate.toString(),
                        timestamp: timestamp,
                        status: this.testMode ? 
                            (currentQuote.realData ? '✅ READ関数テスト成功' : '⚠️ テストデータ取得失敗') :
                            (currentQuote.realData ? '🔴 実際実行用READ関数実行完了' : '❌ 実際実行不可'),
                        mode: this.testMode ? 'test-mode' : 'live-mode',
                        protocol: buyProtocol.dex.toUpperCase() + ' ' + buyProtocol.version.toUpperCase(),
                        protocolDetails: buyProtocol.params,
                        dataSource: this.testMode ? 'READ関数（テスト）' : 'READ関数（実際実行確認）',
                        warning: this.testMode ? null : '⚠️ 実際実行時は同じREAD関数結果を使用',
                        executionDelay: this.testMode ? null : '100ms待機後に実行（市場変動考慮）',
                        // デバッグ情報を追加
                        debugInfo: {
                            actualTimestamp: new Date().toISOString(),
                            outputAmountRaw: outputAmount,
                            rateRaw: rate,
                            executionSequence: Math.random().toString(36).substr(2, 9)
                        }
                    };
                    
                    // デバッグログ追加
                    console.log('🔍 executeBuySwap実行結果:', {
                        outputAmount: outputAmount,
                        rate: rate,
                        timestamp: timestamp,
                        testMode: this.testMode,
                        sequence: executionResult.debugInfo.executionSequence
                    });
                    
                    return {
                        success: true,
                        realTime: executionResult
                    };
                    
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        timestamp: timestamp,
                        retryable: false,
                        details: {
                            type: 'unexpected_error',
                            originalError: error.message
                        }
                    };
                }
            }

            async executeSellSwap(rowData, inputAmount) {
                const { tokenA, tokenB, sellProtocol } = rowData;
                const timestamp = new Date().toISOString();
                
                try {
                    const intermediateAmount = rowData.debug?.intermediateAmount || inputAmount;
                    
                    const amountInWei = ethers.utils.parseUnits(
                        intermediateAmount.toString(), 
                        tokenB.decimals
                    );
                    
                    let currentQuote;
                    let outputAmount;
                    let rate;
                    
                    if (this.testMode) {
                        // テストモード: READ関数のみ
                        currentQuote = await this.checker.getQuote(
                            sellProtocol.dex,
                            sellProtocol.version,
                            tokenB.address,
                            tokenA.address,
                            amountInWei,
                            sellProtocol.params
                        );
                        
                        if (!currentQuote.success) {
                            throw new Error('クォート取得失敗: ' + currentQuote.exclusionReason);
                        }
                        
                        outputAmount = parseFloat(ethers.utils.formatUnits(
                            currentQuote.amountOut,
                            tokenA.decimals
                        ));
                        rate = outputAmount / intermediateAmount;
                        
                    } else {
                        // 実際実行モード: 少し待機してから再度READ関数を実行（市場変動を捉える）
                        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms待機
                        
                        currentQuote = await this.checker.getQuote(
                            sellProtocol.dex,
                            sellProtocol.version,
                            tokenB.address,
                            tokenA.address,
                            amountInWei,
                            sellProtocol.params
                        );
                        
                        if (!currentQuote.success) {
                            throw new Error('実際実行準備失敗: ' + currentQuote.exclusionReason);
                        }
                        
                        // 実際実行モードでも同じREAD関数の結果を使用
                        outputAmount = parseFloat(ethers.utils.formatUnits(
                            currentQuote.amountOut,
                            tokenA.decimals
                        ));
                        rate = outputAmount / intermediateAmount;
                    }
                    
                    const executionResult = {
                        input: intermediateAmount.toFixed(6) + ' ' + tokenB.symbol,
                        output: outputAmount.toFixed(6) + ' ' + tokenA.symbol,
                        rate: rate.toFixed(6),
                        gasUsed: currentQuote.gasEstimate.toString(),
                        timestamp: timestamp,
                        status: this.testMode ? 
                            (currentQuote.realData ? '✅ READ関数テスト成功' : '⚠️ テストデータ取得失敗') :
                            (currentQuote.realData ? '🔴 実際実行用READ関数実行完了' : '❌ 実際実行不可'),
                        mode: this.testMode ? 'test-mode' : 'live-mode',
                        protocol: sellProtocol.dex.toUpperCase() + ' ' + sellProtocol.version.toUpperCase(),
                        protocolDetails: sellProtocol.params,
                        dataSource: this.testMode ? 'READ関数（テスト）' : 'READ関数（実際実行確認）',
                        warning: this.testMode ? null : '⚠️ 実際実行時は同じREAD関数結果を使用',
                        executionDelay: this.testMode ? null : '100ms待機後に実行（市場変動考慮）'
                    };
                    
                    return {
                        success: true,
                        realTime: executionResult
                    };
                    
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        timestamp: timestamp
                    };
                }
            }

            async executeArbitrage(rowData, inputAmount) {
                const timestamp = new Date().toISOString();
                
                try {
                    const buyResult = await this.executeBuySwap(rowData, inputAmount);
                    
                    if (!buyResult.success) {
                        throw new Error(\`買いスワップ失敗: \${buyResult.error}\`);
                    }
                    
                    const intermediateAmount = parseFloat(
                        buyResult.realTime.output.split(' ')[0]
                    );
                    
                    const sellResult = await this.executeSellSwap(rowData, intermediateAmount);
                    
                    if (!sellResult.success) {
                        throw new Error(\`売りスワップ失敗: \${sellResult.error}\`);
                    }
                    
                    const finalAmount = parseFloat(
                        sellResult.realTime.output.split(' ')[0]
                    );
                    
                    const profit = finalAmount - inputAmount;
                    const profitPercentage = (profit / inputAmount) * 100;
                    const totalGasUsed = parseInt(buyResult.realTime.gasUsed) + parseInt(sellResult.realTime.gasUsed);
                    
                    return {
                        success: true,
                        realTime: {
                            timestamp: timestamp,
                            mode: 'simulation',
                            step1: {
                                action: '買いスワップ',
                                protocol: buyResult.realTime.protocol,
                                input: buyResult.realTime.input,
                                output: buyResult.realTime.output,
                                gasUsed: buyResult.realTime.gasUsed,
                                status: 'success'
                            },
                            step2: {
                                action: '売りスワップ',
                                protocol: sellResult.realTime.protocol,
                                input: sellResult.realTime.input,
                                output: sellResult.realTime.output,
                                gasUsed: sellResult.realTime.gasUsed,
                                status: 'success'
                            },
                            summary: {
                                initialAmount: \`\${inputAmount} \${rowData.tokenA.symbol}\`,
                                finalAmount: \`\${finalAmount.toFixed(6)} \${rowData.tokenA.symbol}\`,
                                profit: \`\${profit > 0 ? '+' : ''}\${profit.toFixed(6)} \${rowData.tokenA.symbol}\`,
                                profitPercentage: \`\${profitPercentage > 0 ? '+' : ''}\${profitPercentage.toFixed(2)}%\`,
                                totalGasUsed: totalGasUsed.toString(),
                                status: profit > 0 ? 'profitable' : 'loss',
                                statusColor: profit > 0 ? 'success' : 'danger'
                            }
                        }
                    };
                    
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        timestamp: timestamp
                    };
                }
            }
        };
        
        // 🚀 即座にRealTimeExecutorを初期化
        if (typeof BidirectionalLiquidityChecker !== 'undefined') {
            try {
                const checker = new BidirectionalLiquidityChecker();
                
                // コントラクト情報を設定
                checker.contracts = {
                    hyperswap: {
                        v2Router: "${this.contracts.hyperswap.v2Router}",
                        v2Factory: "${this.contracts.hyperswap.v2Factory}",
                        v3QuoterV2: "${this.contracts.hyperswap.v3QuoterV2}",
                        v3Factory: "${this.contracts.hyperswap.v3Factory}"
                    },
                    kittenswap: {
                        v2Router: "${this.contracts.kittenswap.v2Router}",
                        v2Factory: "${this.contracts.kittenswap.v2Factory}",
                        v3QuoterV2: "${this.contracts.kittenswap.v3QuoterV2}",
                        v3Factory: "${this.contracts.kittenswap.v3Factory}"
                    }
                };
                
                window.realTimeExecutor = new BidirectionalLiquidityChecker.RealTimeExecutor(checker);
                console.log('✅ RealTimeExecutor initialized immediately');
            } catch (error) {
                console.warn('⚠️ Immediate RealTimeExecutor initialization failed:', error.message);
            }
        }
    </script>
</body>
</html>`;

        await fs.writeFile(htmlPath, htmlContent);
    }

    displayBeautifulResults(totalPairs, opportunityCount, duration, topOpportunities) {
        // ヘッダー
        console.log('\n' + '═'.repeat(80).cyan);
        console.log('🚀 HyperEVM アービトラージスキャン完了'.cyan);
        console.log('═'.repeat(80).cyan);
        
        // サマリーテーブル
        const summaryTable = new Table({
            head: ['指標', '値'],
            style: {
                head: ['cyan'],
                border: ['grey']
            },
            colWidths: [25, 25]
        });
        
        summaryTable.push(
            ['📊 総ペア数', totalPairs.toString().green],
            ['🎯 アービトラージ機会', `${opportunityCount}ペア`.yellow],
            ['📈 成功率', `${(opportunityCount / totalPairs * 100).toFixed(1)}%`.magenta],
            ['⏱️ 処理時間', `${duration.toFixed(1)}秒`.blue]
        );
        
        console.log(summaryTable.toString());
        
        // トップ機会テーブル
        if (topOpportunities.length > 0) {
            console.log('\n🏆 トップアービトラージ機会'.yellow);
            console.log('─'.repeat(80).grey);
            
            const opportunityTable = new Table({
                head: [
                    '順位',
                    'ペア名',
                    'スプレッド(%)',
                    '最良プロトコル',
                    '最悪プロトコル',
                    '状態'
                ],
                style: {
                    head: ['cyan'],
                    border: ['grey']
                },
                colWidths: [6, 18, 12, 22, 22, 8]
            });
            
            topOpportunities.forEach((opp, index) => {
                const rank = (index + 1).toString();
                const pair = opp.pair;
                const spread = opp.stage1?.spread?.toFixed(2) || '0';
                const best = opp.stage1?.bestProtocol || 'N/A';
                const worst = opp.stage1?.worstProtocol || 'N/A';
                
                // スプレッドに応じた色分け
                let spreadColored;
                let statusIcon;
                if (parseFloat(spread) >= 5) {
                    spreadColored = `${spread}%`.red;
                    statusIcon = '🔥'.red;
                } else if (parseFloat(spread) >= 2) {
                    spreadColored = `${spread}%`.yellow;
                    statusIcon = '⚡'.yellow;
                } else {
                    spreadColored = `${spread}%`.green;
                    statusIcon = '💎'.green;
                }
                
                opportunityTable.push([
                    rank.cyan,
                    pair.white,
                    spreadColored,
                    best.length > 20 ? best.substring(0, 18) + '..' : best,
                    worst.length > 20 ? worst.substring(0, 18) + '..' : worst,
                    statusIcon
                ]);
            });
            
            console.log(opportunityTable.toString());
            
            // 段階的テスト結果表示
            console.log('\n📋 段階的テスト詳細'.blue);
            console.log('─'.repeat(80).grey);
            
            const stageTable = new Table({
                head: [
                    'ペア名',
                    '1トークン',
                    '3トークン',
                    '10トークン',
                    'トレンド'
                ],
                style: {
                    head: ['cyan'],
                    border: ['grey']
                },
                colWidths: [18, 12, 12, 12, 10]
            });
            
            topOpportunities.slice(0, 5).forEach(opp => {
                const stage1 = opp.stage1?.spread?.toFixed(2) || '0';
                const stage2 = opp.stage2?.spread?.toFixed(2) || 'N/A';
                const stage3 = opp.stage3?.spread?.toFixed(2) || 'N/A';
                
                // トレンド計算
                let trend = '─';
                if (stage2 !== 'N/A' && stage3 !== 'N/A') {
                    const s1 = parseFloat(stage1);
                    const s2 = parseFloat(stage2);
                    const s3 = parseFloat(stage3);
                    
                    if (s3 > s2 && s2 > s1) trend = '📈'.green; // 上昇
                    else if (s3 < s2 && s2 < s1) trend = '📉'.red; // 下降
                    else trend = '📊'.yellow; // 混合
                }
                
                stageTable.push([
                    opp.pair.substring(0, 16),
                    `${stage1}%`.cyan,
                    stage2 !== 'N/A' ? `${stage2}%`.yellow : 'N/A'.grey,
                    stage3 !== 'N/A' ? `${stage3}%`.magenta : 'N/A'.grey,
                    trend
                ]);
            });
            
            console.log(stageTable.toString());
        }
        
        // フッター
        console.log('\n' + '═'.repeat(80).cyan);
        console.log('💡 ヒント:'.yellow);
        console.log('  🔥 5%+ = 高収益機会    ⚡ 2-5% = 中程度    💎 1-2% = 安定機会'.grey);
        console.log('  📈 上昇トレンド = 流動性増加    📉 下降 = 流動性減少    📊 混合 = 変動'.grey);
        console.log('═'.repeat(80).cyan + '\n');
    }

    calculateProtocolStats(results) {
        const stats = {};
        
        results.forEach(r => {
            if (r.stage1?.bestProtocol) {
                stats[r.stage1.bestProtocol] = stats[r.stage1.bestProtocol] || { best: 0, worst: 0 };
                stats[r.stage1.bestProtocol].best++;
            }
            if (r.stage1?.worstProtocol) {
                stats[r.stage1.worstProtocol] = stats[r.stage1.worstProtocol] || { best: 0, worst: 0 };
                stats[r.stage1.worstProtocol].worst++;
            }
        });
        
        return stats;
    }
};

        // Note: enrichRowData関数はHTMLダッシュボード内で定義されます

// RealTimeExecutorをBidirectionalLiquidityCheckerに追加
BidirectionalLiquidityChecker.RealTimeExecutor = class RealTimeExecutor {
    constructor(bidirectionalChecker) {
        this.checker = bidirectionalChecker;
        this.provider = bidirectionalChecker.provider;
        this.testMode = true; // デフォルトはテストモード
    }

    /**
     * 実行モードを設定
     */
    setExecutionMode(testMode) {
        this.testMode = testMode;
    }

    /**
     * 買いスワップのリアルタイム実行
     */
    async executeBuySwap(rowData, inputAmount) {
        const { tokenA, tokenB, buyProtocol } = rowData;
        const timestamp = new Date().toISOString();
        
        try {
            // 入力量をWeiに変換
            const amountInWei = ethers.utils.parseUnits(
                inputAmount.toString(), 
                tokenA.decimals
            );
            
            // 現在のクォート取得
            const currentQuote = await this.checker.getQuote(
                buyProtocol.dex,
                buyProtocol.version,
                tokenA.address,
                tokenB.address,
                amountInWei,
                buyProtocol.params
            );
            
            if (!currentQuote.success) {
                throw new Error(`クォート取得失敗: ${currentQuote.exclusionReason}`);
            }
            
            const outputAmount = parseFloat(ethers.utils.formatUnits(
                currentQuote.amountOut,
                tokenB.decimals
            ));
            
            const rate = outputAmount / inputAmount;
            
            // 実行結果をシミュレート
            const executionResult = {
                input: `${inputAmount} ${tokenA.symbol}`,
                output: `${outputAmount.toFixed(6)} ${tokenB.symbol}`,
                rate: rate.toFixed(6),
                gasUsed: currentQuote.gasEstimate.toString(),
                timestamp: timestamp,
                status: this.testMode ? 'テスト成功' : '実行成功',
                mode: this.testMode ? 'test' : 'live',
                protocol: `${buyProtocol.dex.toUpperCase()} ${buyProtocol.version.toUpperCase()}`,
                protocolDetails: buyProtocol.params
            };
            
            return {
                success: true,
                historical: rowData.debug?.buyRateDetail || '履歴データなし',
                realTime: executionResult
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: timestamp
            };
        }
    }

    /**
     * 売りスワップのリアルタイム実行
     */
    async executeSellSwap(rowData, inputAmount) {
        const { tokenA, tokenB, sellProtocol } = rowData;
        const timestamp = new Date().toISOString();
        
        try {
            // 中間量を使用（買いスワップの出力量と想定）
            const intermediateAmount = rowData.debug?.intermediateAmount || inputAmount;
            
            // 入力量をWeiに変換（B→A方向なのでtokenBのdecimals使用）
            const amountInWei = ethers.utils.parseUnits(
                intermediateAmount.toString(), 
                tokenB.decimals
            );
            
            // 現在のクォート取得（B→A方向）
            const currentQuote = await this.checker.getQuote(
                sellProtocol.dex,
                sellProtocol.version,
                tokenB.address,
                tokenA.address,
                amountInWei,
                sellProtocol.params
            );
            
            // 改善されたエラーハンドリング
            if (!currentQuote.success) {
                console.error(`🚨 executeSellSwap: Quote failed for ${sellProtocol.dex} ${sellProtocol.version}`, {
                    tokenB: tokenB.symbol,
                    tokenA: tokenA.symbol,
                    intermediateAmount: intermediateAmount,
                    exclusionReason: currentQuote.exclusionReason,
                    timestamp: timestamp
                });
                
                return {
                    success: false,
                    error: `クォート取得失敗: ${currentQuote.exclusionReason}`,
                    timestamp: timestamp,
                    retryable: false, // 重要: リトライ不可を明示
                    details: {
                        dex: sellProtocol.dex,
                        version: sellProtocol.version,
                        tokenPair: `${tokenB.symbol}/${tokenA.symbol}`,
                        exclusionReason: currentQuote.exclusionReason
                    }
                };
            }
            
            // 出力量が0の場合もエラーとして扱う
            if (!currentQuote.amountOut || currentQuote.amountOut.eq(0)) {
                console.error(`🚨 executeSellSwap: Zero output amount detected`, {
                    tokenB: tokenB.symbol,
                    tokenA: tokenA.symbol,
                    amountOut: currentQuote.amountOut?.toString() || '0',
                    timestamp: timestamp
                });
                
                return {
                    success: false,
                    error: `出力量がゼロです: ${sellProtocol.dex} ${sellProtocol.version}`,
                    timestamp: timestamp,
                    retryable: false,
                    details: {
                        dex: sellProtocol.dex,
                        version: sellProtocol.version,
                        tokenPair: `${tokenB.symbol}/${tokenA.symbol}`,
                        amountOut: currentQuote.amountOut?.toString() || '0'
                    }
                };
            }
            
            const outputAmount = parseFloat(ethers.utils.formatUnits(
                currentQuote.amountOut,
                tokenA.decimals
            ));
            
            const rate = outputAmount / intermediateAmount;
            
            // 実行結果をシミュレート
            const executionResult = {
                input: `${intermediateAmount.toFixed(6)} ${tokenB.symbol}`,
                output: `${outputAmount.toFixed(6)} ${tokenA.symbol}`,
                rate: rate.toFixed(6),
                gasUsed: currentQuote.gasEstimate.toString(),
                timestamp: timestamp,
                status: this.testMode ? 'テスト成功' : '実行成功',
                mode: this.testMode ? 'test' : 'live',
                protocol: `${sellProtocol.dex.toUpperCase()} ${sellProtocol.version.toUpperCase()}`,
                protocolDetails: sellProtocol.params
            };
            
            return {
                success: true,
                historical: rowData.debug?.sellRateDetail || '履歴データなし',
                realTime: executionResult
            };
            
        } catch (error) {
            console.error(`🚨 executeSellSwap: Unexpected error`, {
                error: error.message,
                stack: error.stack,
                timestamp: timestamp
            });
            
            return {
                success: false,
                error: error.message,
                timestamp: timestamp,
                retryable: false, // 重要: リトライ不可を明示
                details: {
                    type: 'unexpected_error',
                    originalError: error.message
                }
            };
        }
    }

    /**
     * アービトラージのリアルタイム実行
     */
    async executeArbitrage(rowData, inputAmount) {
        const timestamp = new Date().toISOString();
        
        try {
            // Step 1: 買いスワップ実行
            const buyResult = await this.executeBuySwap(rowData, inputAmount);
            
            if (!buyResult.success) {
                // リトライ不可エラーの場合は即座に返す
                if (buyResult.retryable === false) {
                    console.error(`🚨 executeArbitrage: 買いスワップ失敗（リトライ不可）`, {
                        error: buyResult.error,
                        details: buyResult.details,
                        timestamp: timestamp
                    });
                    
                    return {
                        success: false,
                        error: `買いスワップ失敗（リトライ不可）: ${buyResult.error}`,
                        timestamp: timestamp,
                        retryable: false,
                        details: buyResult.details || {},
                        step1Failed: true
                    };
                }
                throw new Error(`買いスワップ失敗: ${buyResult.error}`);
            }
            
            // Step 1の出力量を取得
            const intermediateAmount = parseFloat(
                buyResult.realTime.output.split(' ')[0]
            );
            
            // Step 2: 売りスワップ実行
            const sellResult = await this.executeSellSwap(rowData, intermediateAmount);
            
            if (!sellResult.success) {
                // リトライ不可エラーの場合は即座に返す
                if (sellResult.retryable === false) {
                    console.error(`🚨 executeArbitrage: 売りスワップ失敗（リトライ不可）`, {
                        error: sellResult.error,
                        details: sellResult.details,
                        timestamp: timestamp
                    });
                    
                    return {
                        success: false,
                        error: `売りスワップ失敗（リトライ不可）: ${sellResult.error}`,
                        timestamp: timestamp,
                        retryable: false,
                        details: sellResult.details || {},
                        step1Complete: true, // 買いスワップは成功した
                        step2Failed: true,
                        step1Result: buyResult.realTime
                    };
                }
                throw new Error(`売りスワップ失敗: ${sellResult.error}`);
            }
            
            // 最終結果を取得
            const finalAmount = parseFloat(
                sellResult.realTime.output.split(' ')[0]
            );
            
            // 利益計算
            const profit = finalAmount - inputAmount;
            const profitPercentage = (profit / inputAmount) * 100;
            const totalGasUsed = parseInt(buyResult.realTime.gasUsed) + parseInt(sellResult.realTime.gasUsed);
            
            return {
                success: true,
                historical: {
                    buy: rowData.debug?.buyRateDetail || '買い履歴データなし',
                    sell: rowData.debug?.sellRateDetail || '売り履歴データなし',
                    summary: rowData.debug?.comparison || 'サマリーなし'
                },
                realTime: {
                    timestamp: timestamp,
                    mode: this.testMode ? 'test' : 'live',
                    step1: {
                        action: '買いスワップ',
                        protocol: buyResult.realTime.protocol,
                        input: buyResult.realTime.input,
                        output: buyResult.realTime.output,
                        gasUsed: buyResult.realTime.gasUsed,
                        status: 'success'
                    },
                    step2: {
                        action: '売りスワップ',
                        protocol: sellResult.realTime.protocol,
                        input: sellResult.realTime.input,
                        output: sellResult.realTime.output,
                        gasUsed: sellResult.realTime.gasUsed,
                        status: 'success'
                    },
                    summary: {
                        initialAmount: `${inputAmount} ${rowData.tokenA.symbol}`,
                        finalAmount: `${finalAmount.toFixed(6)} ${rowData.tokenA.symbol}`,
                        profit: `${profit > 0 ? '+' : ''}${profit.toFixed(6)} ${rowData.tokenA.symbol}`,
                        profitPercentage: `${profitPercentage > 0 ? '+' : ''}${profitPercentage.toFixed(2)}%`,
                        totalGasUsed: totalGasUsed.toString(),
                        status: profit > 0 ? 'profitable' : 'loss',
                        statusColor: profit > 0 ? 'success' : 'danger'
                    }
                }
            };
            
        } catch (error) {
            console.error(`🚨 executeArbitrage: Unexpected error`, {
                error: error.message,
                stack: error.stack,
                timestamp: timestamp
            });
            
            return {
                success: false,
                error: error.message,
                timestamp: timestamp,
                retryable: false, // 予期しないエラーもリトライ不可
                details: {
                    type: 'unexpected_error',
                    originalError: error.message
                }
            };
        }
    }
};

// メイン実行関数
async function main() {
    try {
        // コマンドライン引数を先に解析
        const args = process.argv.slice(2);
        const silentMode = args.includes('--silent');
        
        const checker = new BidirectionalLiquidityChecker({ silent: silentMode });
        
        const mode = args[0] || 'test';
        
        if (mode === 'test') {
            // テストモード: 最初のクロスDEXペアでテスト
            const pairs = await checker.loadConfig();
            const testPair = pairs.find(p => p.category === "cross-dex") || pairs[0];
            const inputAmount = 1;
            
            console.log(`🚀 テスト実行: ${testPair.name} (${inputAmount}トークン)`);
            await checker.checkBidirectionalRates(testPair, inputAmount);
            console.log("\n✅ V2/V3双方向流動性チェック完了!");
            
        } else if (mode === 'scan') {
            // フルスキャンモード: 全ペアを処理
            const options = {
                spreadThreshold: parseFloat(args[1]) || 1.0,
                batchSize: parseInt(args[2]) || 10,
                trueArbitrage: true, // 🆕 真のアービトラージをデフォルトとする
                silent: args.includes('--silent') // 🆕 警告ログ抑制オプション
            };
            
            await checker.processAllPairs(options);
            
        } else if (mode === 'quick') {
            // クイックモード: 最初の10ペアのみ
            const pairs = await checker.loadConfig();
            const limitedPairs = pairs.slice(0, 10);
            
            // loadConfigメソッドを一時的に上書き
            checker.loadConfig = async () => limitedPairs;
            
            await checker.processAllPairs({
                spreadThreshold: 1.0,
                trueArbitrage: true, // 🆕 真のアービトラージをデフォルトとする
                batchSize: 20
            });
            
        } else if (mode === 'test-single') {
            // テストモード: 単一ペアのみ
            const pairs = await checker.loadConfig();
            const limitedPairs = pairs.slice(0, 1);
            
            // loadConfigメソッドを一時的に上書き
            checker.loadConfig = async () => limitedPairs;
            
            await checker.processAllPairs({
                spreadThreshold: 1.0,
                trueArbitrage: true,
                batchSize: 20
            });
            
        } else if (mode === 'test-few') {
            // テストモード: 少数ペアのみ
            const pairs = await checker.loadConfig();
            const limitedPairs = pairs.slice(0, 5);
            
            // loadConfigメソッドを一時的に上書き
            checker.loadConfig = async () => limitedPairs;
            
            await checker.processAllPairs({
                spreadThreshold: 1.0,
                trueArbitrage: true,
                batchSize: 20
            });
            
        } else {
            console.log("使用方法:");
            console.log("  node bidirectional-liquidity-checker.js test              # テストモード");
            console.log("  node bidirectional-liquidity-checker.js test-single       # 単一ペアテスト");
            console.log("  node bidirectional-liquidity-checker.js test-few          # 少数ペアテスト(5ペア)");
            console.log("  node bidirectional-liquidity-checker.js scan [閾値] [バッチ]  # フルスキャン");
            console.log("  node bidirectional-liquidity-checker.js quick             # クイックスキャン(10ペア)");
            console.log("");
            console.log("オプション:");
            console.log("  --silent           # 警告ログを抑制");
            console.log("");
            console.log("注意: 真のアービトラージモードはデフォルトで有効です。");
        }
        
    } catch (error) {
        console.error("❌ チェックエラー:", error.message);
        console.error(error);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { BidirectionalLiquidityChecker };
