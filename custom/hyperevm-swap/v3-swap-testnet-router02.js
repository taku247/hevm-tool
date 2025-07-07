const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * HyperSwap V3 スワップ機能（SwapRouter02版）
 * ChatGPT検証済み: deadline無し、7パラメータ
 */
class HyperSwapV3Router02 {
  constructor() {
    this.rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
    
    // テストネット設定（ChatGPT検証済み）
    this.config = {
      chainId: 998,
      swapRouter02: '0x51c5958FFb3e326F8d7AA945948159f1FF27e14A', // deadline無し版
      quoter: '0x7FEd8993828A61A5985F384Cee8bDD42177Aa263',
      factory: '0x03A918028f22D9E1473B7959C927AD7425A45C7C'
    };
    
    // トークン設定をconfig/token-config.jsonから読み込み
    this.loadTokenConfig();
    
    // 手数料ティア
    this.feeTiers = {
      '1bps': 100,
      '5bps': 500,
      '30bps': 3000,
      '100bps': 10000
    };
    
    // ガス代保護設定
    this.gasProtection = {
      minHypeBalance: ethers.utils.parseEther("0.1"), // 最低0.1 HYPE保持
      maxGasPrice: ethers.utils.parseUnits("10", "gwei"), // 最大ガス価格
      estimatedGasLimit: 250000, // V3は少し多めに見積もり
    };
    
    // SwapRouter02専用ABI（deadline無し）
    this.swapRouterABI = require('../../abi/HyperSwapV3SwapRouter02.json');
    
    // V3 Quoter ABI (Struct引数版)
    this.quoterABI = require('../../abi/HyperSwapQuoterV2.json');
    
    // ERC20 ABI
    this.erc20ABI = require('../../examples/sample-abi/ERC20.json');
  }
  
  /**
   * トークン設定読み込み
   */
  loadTokenConfig() {
    try {
      const configPath = path.join(__dirname, '../../config/token-config.json');
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // テストネット用のトークン情報を取得
      const testnetTokens = configData.networks['hyperevm-testnet'].tokens;
      
      // アドレスマップとdecimalsマップを作成
      this.tokens = {};
      this.tokenDecimals = {};
      
      for (const [symbol, tokenInfo] of Object.entries(testnetTokens)) {
        this.tokens[symbol] = tokenInfo.address;
        this.tokenDecimals[symbol] = tokenInfo.decimals;
      }
      
    } catch (error) {
      // フォールバック: 従来の設定
      this.tokens = {
        'HSPX': '0xD8c23394e2d55AA6dB9E5bb1305df54A1F83D122',
        'xHSPX': '0x91483330b5953895757b65683d1272d86d6430B3',
        'WETH': '0xADcb2f358Eae6492F61A5F87eb8893d09391d160',
        'PURR': '0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82',
        'JEFF': '0xbF7C8201519EC22512EB1405Db19C427DF64fC91',
        'CATBAL': '0x26272928f2395452090143Cf347aa85f78cDa3E8',
        'HFUN': '0x37adB2550b965851593832a6444763eeB3e1d1Ec',
        'POINTS': '0xFe1E6dAC7601724768C5d84Eb8E1b2f6F1314BDe'
      };
      this.tokenDecimals = {
        'HSPX': 18, 'xHSPX': 18, 'WETH': 18, 'PURR': 18,
        'JEFF': 18, 'CATBAL': 18, 'HFUN': 18, 'POINTS': 18
      };
    }
  }
  
  /**
   * ウォレット初期化
   */
  initWallet() {
    const privateKey = process.env.PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY or TESTNET_PRIVATE_KEY not set in .env file');
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
    return address.toLowerCase(); // ChatGPT修正: 小文字化
  }
  
  /**
   * 手数料ティア解析
   */
  parseFee(feeInput) {
    if (typeof feeInput === 'number') {
      return feeInput;
    }
    
    if (typeof feeInput === 'string') {
      const fee = this.feeTiers[feeInput.toLowerCase()];
      if (fee) return fee;
      
      const numFee = parseInt(feeInput);
      if (!isNaN(numFee)) return numFee;
    }
    
    throw new Error(`Invalid fee: ${feeInput}. Use 100, 500, 3000, 10000 or '1bps', '5bps', '30bps', '100bps'`);
  }
  
  /**
   * V3レート取得（複数手数料ティア対応）
   */
  async getQuote(tokenInSymbol, tokenOutSymbol, amountIn, fee = null) {
    try {
      const tokenIn = this.getTokenAddress(tokenInSymbol);
      const tokenOut = this.getTokenAddress(tokenOutSymbol);
      
      console.log(`📊 V3レート取得: ${tokenInSymbol} → ${tokenOutSymbol}`);
      console.log(`   入力量: ${ethers.utils.formatUnits(amountIn, 18)}`);
      
      const quoter = new ethers.Contract(this.config.quoter, this.quoterABI, this.provider);
      const results = [];
      
      // 手数料ティア指定がある場合は単一、ない場合は全ティア
      const feesToTest = fee ? [this.parseFee(fee)] : Object.values(this.feeTiers);
      
      for (const feeAmount of feesToTest) {
        try {
          const result = await quoter.quoteExactInputSingle({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            fee: feeAmount,
            sqrtPriceLimitX96: 0 // 制限なし
          });
          
          // QuoterV2は複数の値を返す [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate]
          const amountOut = result.amountOut || result[0];
          
          const rate = parseFloat(ethers.utils.formatUnits(amountOut, 18)) / 
                      parseFloat(ethers.utils.formatUnits(amountIn, 18));
          
          results.push({
            fee: feeAmount,
            feePercent: feeAmount / 10000,
            amountOut: amountOut.toString(),
            rate,
            formatted: ethers.utils.formatUnits(amountOut, 18)
          });
          
          console.log(`   ${feeAmount/100}bps: ${ethers.utils.formatUnits(amountOut, 18)} (Rate: ${rate.toFixed(6)})`);
          
        } catch (error) {
          console.log(`   ${feeAmount/100}bps: プールなし`);
        }
      }
      
      if (results.length === 0) {
        return {
          success: false,
          error: 'No pools found for any fee tier'
        };
      }
      
      // 最良レートを選択
      const best = results.reduce((prev, current) => 
        current.rate > prev.rate ? current : prev
      );
      
      console.log(`   🏆 最良: ${best.fee/100}bps (Rate: ${best.rate.toFixed(6)})`);
      
      return {
        success: true,
        bestQuote: best,
        allQuotes: results,
        tokenIn,
        tokenOut
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
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
   * スリッページ計算
   */
  calculateMinAmountOut(amountOut, slippagePercent) {
    const slippageFactor = ethers.BigNumber.from(10000 - Math.floor(slippagePercent * 100));
    return ethers.BigNumber.from(amountOut).mul(slippageFactor).div(10000);
  }
  
  /**
   * トークン残高確認
   */
  async getTokenBalance(tokenSymbol, walletAddress) {
    try {
      const tokenAddress = this.getTokenAddress(tokenSymbol);
      const token = new ethers.Contract(tokenAddress, this.erc20ABI, this.provider);
      
      const balance = await token.balanceOf(walletAddress);
      const decimals = await token.decimals();
      const symbol = await token.symbol();
      
      return {
        success: true,
        balance: balance.toString(),
        formatted: ethers.utils.formatUnits(balance, decimals),
        decimals,
        symbol
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Approve確認・実行
   */
  async ensureApproval(wallet, tokenSymbol, amount) {
    try {
      const tokenAddress = this.getTokenAddress(tokenSymbol);
      const token = new ethers.Contract(tokenAddress, this.erc20ABI, wallet);
      
      console.log(`🔐 Approval確認: ${tokenSymbol}`);
      
      // 現在のAllowance確認
      const currentAllowance = await token.allowance(wallet.address, this.config.swapRouter02);
      
      if (currentAllowance.gte(amount)) {
        console.log(`   ✅ 既にApproval済み: ${ethers.utils.formatUnits(currentAllowance, 18)}`);
        return { success: true, alreadyApproved: true };
      }
      
      console.log(`   📝 Approval実行中...`);
      
      // 無制限Approval
      const maxAmount = ethers.constants.MaxUint256;
      const tx = await token.approve(this.config.swapRouter02, maxAmount);
      
      console.log(`   ⏳ トランザクション送信: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      console.log(`   ✅ Approval完了: Block ${receipt.blockNumber}`);
      
      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * V3スワップ実行（SwapRouter02 - deadline無し）
   */
  async swap(tokenInSymbol, tokenOutSymbol, amountIn, fee = null, slippagePercent = 0.5) {
    try {
      const wallet = this.initWallet();
      
      console.log(`🔄 V3スワップ開始 (Router02): ${tokenInSymbol} → ${tokenOutSymbol}`);
      console.log(`   ウォレット: ${wallet.address}`);
      console.log(`   入力量: ${ethers.utils.formatUnits(amountIn, 18)} ${tokenInSymbol}`);
      console.log(`   スリッページ: ${slippagePercent}%\n`);
      
      // 1. HYPE残高確認（ガス代保護）
      console.log('⛽ HYPE残高確認（ガス代保護）:');
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
      
      // 2. トークン残高確認
      console.log('\n💰 トークン残高確認:');
      const balanceResult = await this.getTokenBalance(tokenInSymbol, wallet.address);
      if (!balanceResult.success) {
        throw new Error(`残高確認失敗: ${balanceResult.error}`);
      }
      
      const balance = ethers.BigNumber.from(balanceResult.balance);
      if (balance.lt(amountIn)) {
        throw new Error(`残高不足: ${balanceResult.formatted} ${tokenInSymbol} < ${ethers.utils.formatUnits(amountIn, 18)}`);
      }
      
      console.log(`   ${tokenInSymbol}: ${balanceResult.formatted}`);
      
      // 3. レート取得
      console.log('\n📊 レート取得:');
      const quote = await this.getQuote(tokenInSymbol, tokenOutSymbol, amountIn, fee);
      if (!quote.success) {
        throw new Error(`レート取得失敗: ${quote.error}`);
      }
      
      const bestQuote = quote.bestQuote;
      const expectedOut = ethers.BigNumber.from(bestQuote.amountOut);
      const minAmountOut = this.calculateMinAmountOut(expectedOut, slippagePercent);
      
      console.log(`   使用手数料: ${bestQuote.fee/100}bps (${bestQuote.feePercent}%)`);
      console.log(`   期待出力: ${bestQuote.formatted} ${tokenOutSymbol}`);
      console.log(`   最小出力: ${ethers.utils.formatUnits(minAmountOut, 18)} ${tokenOutSymbol}`);
      console.log(`   レート: ${bestQuote.rate.toFixed(6)}`);
      
      // 4. Approval
      console.log('\n🔐 Approval:');
      const approvalResult = await this.ensureApproval(wallet, tokenInSymbol, amountIn);
      if (!approvalResult.success) {
        throw new Error(`Approval失敗: ${approvalResult.error}`);
      }
      
      // 5. V3スワップ実行（Router02専用）
      console.log('\n🚀 V3スワップ実行 (SwapRouter02):');
      const swapRouter = new ethers.Contract(this.config.swapRouter02, this.swapRouterABI, wallet);
      
      // ChatGPT修正: Router02はdeadline無し
      const params = {
        tokenIn: quote.tokenIn,
        tokenOut: quote.tokenOut,
        fee: bestQuote.fee,
        recipient: wallet.address,
        // deadline無し（ChatGPT修正: Router02は7パラメータ）
        amountIn: amountIn,
        amountOutMinimum: minAmountOut,
        sqrtPriceLimitX96: 0
      };
      
      // callStaticで事前テスト（ChatGPT修正: 実行前検証）
      console.log("   🧪 callStaticテスト...");
      try {
        const staticResult = await swapRouter.callStatic.exactInputSingle(params);
        console.log(`   ✅ callStatic成功: ${ethers.utils.formatUnits(staticResult, 18)} ${tokenOutSymbol}`);
      } catch (staticError) {
        throw new Error(`callStatic失敗: ${staticError.message}`);
      }
      
      // ガス制限を設定して安全にスワップ実行
      const tx = await swapRouter.exactInputSingle(params, {
        gasLimit: this.gasProtection.estimatedGasLimit,
        gasPrice: await this.provider.getGasPrice()
      });
      
      console.log(`   ⏳ トランザクション送信: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log(`   ✅ スワップ完了: Block ${receipt.blockNumber}`);
        console.log(`   ガス使用量: ${receipt.gasUsed.toNumber().toLocaleString()}`);
      } else {
        throw new Error(`スワップ失敗: status=${receipt.status}`);
      }
      
      // 6. 結果確認
      console.log('\n📊 スワップ結果:');
      const newBalance = await this.getTokenBalance(tokenOutSymbol, wallet.address);
      if (newBalance.success) {
        console.log(`   ${tokenOutSymbol}残高: ${newBalance.formatted}`);
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
        fee: bestQuote.fee,
        amountIn: amountIn.toString(),
        expectedOut: expectedOut.toString(),
        minAmountOut: minAmountOut.toString(),
        rate: bestQuote.rate,
        router: 'SwapRouter02'
      };
      
    } catch (error) {
      console.log(`\n❌ スワップ失敗: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// CLI実行
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.length === 0) {
    console.log(`
🔄 HyperSwap V3 スワップツール (SwapRouter02版)

ChatGPT検証済み: deadline無し、7パラメータ
実績: ✅ 106,609 gas成功

使用方法:
  node custom/hyperevm-swap/v3-swap-testnet-router02.js --tokenIn WETH --tokenOut PURR --amount 0.001
  node custom/hyperevm-swap/v3-swap-testnet-router02.js --tokenIn HSPX --tokenOut WETH --amount 100 --fee 500

オプション:
  --tokenIn     入力トークン（必須）
  --tokenOut    出力トークン（必須）  
  --amount      入力量（必須）
  --fee         手数料ティア（省略時は最良を自動選択）
  --slippage    スリッページ % (デフォルト: 0.5)
  --quote-only  レート取得のみ
  --help        このヘルプを表示

手数料ティア:
  100    (1bps)   - 超低手数料
  500    (5bps)   - 低手数料
  3000   (30bps)  - 標準
  10000  (100bps) - 高手数料

対応トークン:
  HSPX, xHSPX, WETH, PURR, JEFF, CATBAL, HFUN, POINTS

成功例:
  # 0.001 WETH → PURR（ChatGPT修正後成功）
  node custom/hyperevm-swap/v3-swap-testnet-router02.js --tokenIn WETH --tokenOut PURR --amount 0.001
`);
    return;
  }
  
  // 引数解析
  const getArg = (name) => {
    const index = args.indexOf(name);
    return index !== -1 ? args[index + 1] : null;
  };
  
  const tokenIn = getArg('--tokenIn');
  const tokenOut = getArg('--tokenOut');
  const amount = getArg('--amount');
  const fee = getArg('--fee');
  const slippage = parseFloat(getArg('--slippage') || '0.5');
  const quoteOnly = args.includes('--quote-only');
  
  if (!tokenIn || !tokenOut || !amount) {
    console.log('❌ 必須パラメータが不足しています。--help を参照してください。');
    return;
  }
  
  try {
    const swap = new HyperSwapV3Router02();
    const amountIn = ethers.utils.parseUnits(amount, 18);
    
    if (quoteOnly) {
      console.log('📊 V3レート取得のみ実行:\n');
      const quote = await swap.getQuote(tokenIn, tokenOut, amountIn, fee);
      
      if (quote.success) {
        console.log(`\n✅ 最良レート: 1 ${tokenIn} = ${quote.bestQuote.rate.toFixed(6)} ${tokenOut}`);
        console.log(`   手数料ティア: ${quote.bestQuote.fee/100}bps`);
        console.log(`   ${amount} ${tokenIn} → ${quote.bestQuote.formatted} ${tokenOut}`);
        
        if (quote.allQuotes.length > 1) {
          console.log('\n📊 全手数料ティア比較:');
          quote.allQuotes.forEach(q => {
            console.log(`   ${q.fee/100}bps: ${q.rate.toFixed(6)} ${tokenOut}/${tokenIn}`);
          });
        }
      } else {
        console.log(`❌ レート取得失敗: ${quote.error}`);
      }
    } else {
      const result = await swap.swap(tokenIn, tokenOut, amountIn, fee, slippage);
      
      if (result.success) {
        console.log('\n🎉 V3スワップ成功！(SwapRouter02)');
        console.log(`   TX: ${result.transactionHash}`);
        console.log(`   手数料ティア: ${result.fee/100}bps`);
        console.log(`   ガス使用量: ${result.gasUsed.toLocaleString()}`);
      } else {
        console.log('\n💥 V3スワップ失敗');
      }
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { HyperSwapV3Router02 };