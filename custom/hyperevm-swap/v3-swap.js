const { ethers } = require('ethers');
require('dotenv').config();

/**
 * HyperSwap V3 スワップ機能
 */
class HyperSwapV3 {
  constructor() {
    this.rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
    
    // テストネット設定
    this.config = {
      chainId: 998,
      swapRouter02: '0x51c5958FFb3e326F8d7AA945948159f1FF27e14A',
      quoter: '0x7FEd8993828A61A5985F384Cee8bDD42177Aa263',
      factory: '0x22B0768972bB7f1F5ea7a8740BB8f94b32483826',
      positionManager: '0x09Aca834543b5790DB7a52803d5F9d48c5b87e80'
    };
    
    // テストネットトークン
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
    
    // 手数料ティア
    this.feeTiers = {
      '1bps': 100,
      '5bps': 500,
      '30bps': 3000,
      '100bps': 10000
    };
    
    // V3 SwapRouter02 ABI（主要関数のみ）
    this.swapRouterABI = [
      {
        "name": "exactInputSingle",
        "type": "function",
        "stateMutability": "payable",
        "inputs": [
          {
            "name": "params",
            "type": "tuple",
            "components": [
              {"name": "tokenIn", "type": "address"},
              {"name": "tokenOut", "type": "address"},
              {"name": "fee", "type": "uint24"},
              {"name": "recipient", "type": "address"},
              {"name": "deadline", "type": "uint256"},
              {"name": "amountIn", "type": "uint256"},
              {"name": "amountOutMinimum", "type": "uint256"},
              {"name": "sqrtPriceLimitX96", "type": "uint160"}
            ]
          }
        ],
        "outputs": [
          {"name": "amountOut", "type": "uint256"}
        ]
      },
      {
        "name": "exactOutputSingle",
        "type": "function", 
        "stateMutability": "payable",
        "inputs": [
          {
            "name": "params",
            "type": "tuple",
            "components": [
              {"name": "tokenIn", "type": "address"},
              {"name": "tokenOut", "type": "address"},
              {"name": "fee", "type": "uint24"},
              {"name": "recipient", "type": "address"},
              {"name": "deadline", "type": "uint256"},
              {"name": "amountOut", "type": "uint256"},
              {"name": "amountInMaximum", "type": "uint256"},
              {"name": "sqrtPriceLimitX96", "type": "uint160"}
            ]
          }
        ],
        "outputs": [
          {"name": "amountIn", "type": "uint256"}
        ]
      }
    ];
    
    // V3 Quoter ABI
    this.quoterABI = [
      {
        "name": "quoteExactInputSingle",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
          {"name": "tokenIn", "type": "address"},
          {"name": "tokenOut", "type": "address"},
          {"name": "fee", "type": "uint24"},
          {"name": "amountIn", "type": "uint256"},
          {"name": "sqrtPriceLimitX96", "type": "uint160"}
        ],
        "outputs": [
          {"name": "amountOut", "type": "uint256"}
        ]
      },
      {
        "name": "quoteExactOutputSingle",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
          {"name": "tokenIn", "type": "address"},
          {"name": "tokenOut", "type": "address"},
          {"name": "fee", "type": "uint24"},
          {"name": "amountOut", "type": "uint256"},
          {"name": "sqrtPriceLimitX96", "type": "uint160"}
        ],
        "outputs": [
          {"name": "amountIn", "type": "uint256"}
        ]
      }
    ];
    
    // ERC20 ABI（主要関数のみ）
    this.erc20ABI = [
      {
        "name": "approve",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
          {"name": "spender", "type": "address"},
          {"name": "amount", "type": "uint256"}
        ],
        "outputs": [
          {"name": "", "type": "bool"}
        ]
      },
      {
        "name": "allowance",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
          {"name": "owner", "type": "address"},
          {"name": "spender", "type": "address"}
        ],
        "outputs": [
          {"name": "", "type": "uint256"}
        ]
      },
      {
        "name": "balanceOf",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
          {"name": "account", "type": "address"}
        ],
        "outputs": [
          {"name": "", "type": "uint256"}
        ]
      },
      {
        "name": "decimals",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [
          {"name": "", "type": "uint8"}
        ]
      },
      {
        "name": "symbol",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [
          {"name": "", "type": "string"}
        ]
      }
    ];
  }
  
  /**
   * ウォレット初期化
   */
  initWallet() {
    const privateKey = process.env.TESTNET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('TESTNET_PRIVATE_KEY not set in .env file');
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
          const amountOut = await quoter.quoteExactInputSingle(
            tokenIn,
            tokenOut,
            feeAmount,
            amountIn,
            0 // sqrtPriceLimitX96 = 0 (制限なし)
          );
          
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
   * V3スワップ実行
   */
  async swap(tokenInSymbol, tokenOutSymbol, amountIn, fee = null, slippagePercent = 0.5) {
    try {
      const wallet = this.initWallet();
      
      console.log(`🔄 V3スワップ開始: ${tokenInSymbol} → ${tokenOutSymbol}`);
      console.log(`   ウォレット: ${wallet.address}`);
      console.log(`   入力量: ${ethers.utils.formatUnits(amountIn, 18)} ${tokenInSymbol}`);
      console.log(`   スリッページ: ${slippagePercent}%\n`);
      
      // 1. 残高確認
      console.log('💰 残高確認:');
      const balanceResult = await this.getTokenBalance(tokenInSymbol, wallet.address);
      if (!balanceResult.success) {
        throw new Error(`残高確認失敗: ${balanceResult.error}`);
      }
      
      const balance = ethers.BigNumber.from(balanceResult.balance);
      if (balance.lt(amountIn)) {
        throw new Error(`残高不足: ${balanceResult.formatted} ${tokenInSymbol} < ${ethers.utils.formatUnits(amountIn, 18)}`);
      }
      
      console.log(`   ${tokenInSymbol}: ${balanceResult.formatted}`);
      
      // 2. レート取得
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
      
      // 3. Approval
      console.log('\n🔐 Approval:');
      const approvalResult = await this.ensureApproval(wallet, tokenInSymbol, amountIn);
      if (!approvalResult.success) {
        throw new Error(`Approval失敗: ${approvalResult.error}`);
      }
      
      // 4. V3スワップ実行
      console.log('\n🚀 V3スワップ実行:');
      const swapRouter = new ethers.Contract(this.config.swapRouter02, this.swapRouterABI, wallet);
      
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20分後
      
      const params = {
        tokenIn: quote.tokenIn,
        tokenOut: quote.tokenOut,
        fee: bestQuote.fee,
        recipient: wallet.address,
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: minAmountOut,
        sqrtPriceLimitX96: 0
      };
      
      const tx = await swapRouter.exactInputSingle(params);
      
      console.log(`   ⏳ トランザクション送信: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      console.log(`   ✅ スワップ完了: Block ${receipt.blockNumber}`);
      console.log(`   ガス使用量: ${receipt.gasUsed.toNumber().toLocaleString()}`);
      
      // 5. 結果確認
      console.log('\n📊 スワップ結果:');
      const newBalance = await this.getTokenBalance(tokenOutSymbol, wallet.address);
      if (newBalance.success) {
        console.log(`   ${tokenOutSymbol}残高: ${newBalance.formatted}`);
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
        rate: bestQuote.rate
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
🔄 HyperSwap V3 スワップツール

使用方法:
  node custom/hyperevm-swap/v3-swap.js --tokenIn HSPX --tokenOut WETH --amount 100
  node custom/hyperevm-swap/v3-swap.js --tokenIn HSPX --tokenOut WETH --amount 100 --fee 500

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

例:
  # 100 HSPX → WETH（最良レート自動選択）
  node custom/hyperevm-swap/v3-swap.js --tokenIn HSPX --tokenOut WETH --amount 100
  
  # 5bps手数料ティア指定
  node custom/hyperevm-swap/v3-swap.js --tokenIn HSPX --tokenOut WETH --amount 100 --fee 500
  
  # レートのみ確認
  node custom/hyperevm-swap/v3-swap.js --tokenIn HSPX --tokenOut WETH --amount 100 --quote-only
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
    const swap = new HyperSwapV3();
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
        console.log('\n🎉 V3スワップ成功！');
        console.log(`   TX: ${result.transactionHash}`);
        console.log(`   手数料ティア: ${result.fee/100}bps`);
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

module.exports = { HyperSwapV3 };