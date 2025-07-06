const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * トークン残高確認ツール
 * 指定したウォレットアドレスの全トークン残高を表示
 */
class TokenBalanceChecker {
  constructor(network = 'testnet') {
    this.network = network;
    
    if (network === 'testnet') {
      this.rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
      this.networkKey = 'hyperevm-testnet';
      this.chainId = 998;
    } else {
      this.rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
      this.networkKey = 'hyperevm-mainnet';
      this.chainId = 999;
    }
    
    this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
    
    // トークン設定をconfig/token-config.jsonから読み込み
    this.loadTokenConfig();
    
    // ERC20 ABI（残高確認用）
    this.erc20ABI = [
      {
        "name": "balanceOf",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}]
      },
      {
        "name": "decimals",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint8"}]
      },
      {
        "name": "symbol",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "string"}]
      },
      {
        "name": "name",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "string"}]
      }
    ];
  }
  
  /**
   * トークン設定読み込み
   */
  loadTokenConfig() {
    try {
      const configPath = path.join(__dirname, '../../config/token-config.json');
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // 指定ネットワークのトークン情報を取得
      const networkTokens = configData.networks[this.networkKey].tokens;
      
      // アドレスマップとトークン情報マップを作成
      this.tokens = {};
      this.tokenInfo = {};
      
      for (const [symbol, tokenInfo] of Object.entries(networkTokens)) {
        this.tokens[symbol] = tokenInfo.address;
        this.tokenInfo[symbol] = tokenInfo;
      }
      
    } catch (error) {
      console.error('❌ トークン設定読み込み失敗:', error.message);
      // フォールバック設定は省略（必要に応じて追加）
      this.tokens = {};
      this.tokenInfo = {};
    }
  }
  
  /**
   * HYPE残高取得（ネイティブトークン）
   */
  async getHypeBalance(walletAddress) {
    try {
      const balance = await this.provider.getBalance(walletAddress);
      return {
        success: true,
        symbol: 'HYPE',
        balance: balance.toString(),
        formatted: ethers.utils.formatEther(balance),
        decimals: 18,
        hasBalance: !balance.isZero()
      };
    } catch (error) {
      return {
        success: false,
        symbol: 'HYPE',
        error: error.message
      };
    }
  }
  
  /**
   * 単一トークン残高取得
   */
  async getTokenBalance(tokenSymbol, walletAddress) {
    try {
      const tokenAddress = this.tokens[tokenSymbol];
      if (!tokenAddress) {
        throw new Error(`Unknown token: ${tokenSymbol}`);
      }
      
      // ネイティブトークン（0x000...）はスキップ
      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        return {
          success: false,
          symbol: tokenSymbol,
          error: 'Native token - use HYPE balance check'
        };
      }
      
      const token = new ethers.Contract(tokenAddress, this.erc20ABI, this.provider);
      
      const [balance, decimals, symbol, name] = await Promise.all([
        token.balanceOf(walletAddress),
        token.decimals(),
        token.symbol().catch(() => tokenSymbol), // symbol取得失敗時はフォールバック
        token.name().catch(() => this.tokenInfo[tokenSymbol]?.name || tokenSymbol)
      ]);
      
      return {
        success: true,
        symbol: symbol,
        name: name,
        address: tokenAddress,
        balance: balance.toString(),
        formatted: ethers.utils.formatUnits(balance, decimals),
        decimals: decimals,
        hasBalance: !balance.isZero()
      };
    } catch (error) {
      return {
        success: false,
        symbol: tokenSymbol,
        address: this.tokens[tokenSymbol],
        error: error.message
      };
    }
  }
  
  /**
   * 全トークン残高取得
   */
  async getAllTokenBalances(walletAddress, onlyWithBalance = false) {
    try {
      console.log(`🔍 ウォレット残高確認: ${walletAddress}`);
      console.log(`🌐 ネットワーク: ${this.network} (${this.networkKey})`);
      console.log(`📡 RPC: ${this.rpcUrl}\n`);
      
      const results = [];
      
      // HYPE残高を最初に取得（ネイティブトークン）
      console.log('💰 HYPE残高:');
      const hypeBalance = await this.getHypeBalance(walletAddress);
      if (hypeBalance.success) {
        console.log(`   HYPE: ${hypeBalance.formatted}`);
        results.push(hypeBalance);
      } else {
        console.log(`   HYPE: ❌ ${hypeBalance.error}`);
      }
      
      console.log('\n💎 トークン残高:');
      
      // 各トークンの残高を並列取得
      const tokenSymbols = Object.keys(this.tokens).filter(
        symbol => this.tokens[symbol] !== '0x0000000000000000000000000000000000000000'
      );
      
      const tokenPromises = tokenSymbols.map(symbol => 
        this.getTokenBalance(symbol, walletAddress)
      );
      
      const tokenResults = await Promise.all(tokenPromises);
      
      for (const result of tokenResults) {
        if (result.success) {
          if (!onlyWithBalance || result.hasBalance) {
            const balanceDisplay = result.hasBalance ? 
              `${result.formatted} ${result.symbol}` : 
              `0 ${result.symbol}`;
            console.log(`   ${balanceDisplay}`);
            results.push(result);
          }
        } else {
          if (!onlyWithBalance) {
            console.log(`   ${result.symbol}: ❌ ${result.error.substring(0, 50)}...`);
          }
        }
      }
      
      // サマリー表示
      const tokensWithBalance = results.filter(r => r.success && r.hasBalance).length;
      const totalTokens = results.filter(r => r.success).length;
      
      console.log(`\n📊 サマリー:`);
      console.log(`   残高あり: ${tokensWithBalance}/${totalTokens} トークン`);
      
      if (tokensWithBalance > 0) {
        console.log('\n💰 残高があるトークン:');
        results
          .filter(r => r.success && r.hasBalance)
          .forEach(r => {
            console.log(`   ${r.symbol}: ${r.formatted}`);
          });
      }
      
      return {
        success: true,
        walletAddress,
        network: this.network,
        results,
        summary: {
          totalTokens,
          tokensWithBalance,
          hasAnyBalance: tokensWithBalance > 0
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * 指定トークンのみの残高取得
   */
  async checkSpecificTokens(walletAddress, tokenSymbols) {
    console.log(`🔍 指定トークン残高確認: ${walletAddress}`);
    console.log(`🎯 対象トークン: ${tokenSymbols.join(', ')}\n`);
    
    const results = [];
    
    for (const symbol of tokenSymbols) {
      const result = await this.getTokenBalance(symbol, walletAddress);
      if (result.success) {
        console.log(`${symbol}: ${result.formatted}`);
        results.push(result);
      } else {
        console.log(`${symbol}: ❌ ${result.error}`);
      }
    }
    
    return results;
  }
}

// CLI実行
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.length === 0) {
    console.log(`
💰 トークン残高確認ツール

使用方法:
  node custom/utils/check-token-balances.js --address 0x123...
  node custom/utils/check-token-balances.js --address 0x123... --tokens HSPX,WETH,PURR

オプション:
  --address     ウォレットアドレス（必須）
  --tokens      特定トークンのみ確認（カンマ区切り）
  --network     ネットワーク (testnet|mainnet, デフォルト: testnet)
  --only-balance 残高があるトークンのみ表示
  --help        このヘルプを表示

例:
  # 全トークン残高確認
  node custom/utils/check-token-balances.js --address YOUR_WALLET_ADDRESS
  
  # 特定トークンのみ
  node custom/utils/check-token-balances.js --address YOUR_WALLET_ADDRESS --tokens HSPX,WETH
  
  # 残高があるもののみ
  node custom/utils/check-token-balances.js --address YOUR_WALLET_ADDRESS --only-balance
  
  # メインネット
  node custom/utils/check-token-balances.js --address YOUR_WALLET_ADDRESS --network mainnet
`);
    return;
  }
  
  // 引数解析
  const getArg = (name) => {
    const index = args.indexOf(name);
    return index !== -1 ? args[index + 1] : null;
  };
  
  const address = getArg('--address');
  const tokensArg = getArg('--tokens');
  const network = getArg('--network') || 'testnet';
  const onlyBalance = args.includes('--only-balance');
  
  if (!address) {
    console.log('❌ --address パラメータが必要です。--help を参照してください。');
    return;
  }
  
  // アドレス形式の簡易チェック
  if (!ethers.utils.isAddress(address)) {
    console.log('❌ 無効なアドレス形式です。');
    return;
  }
  
  try {
    const checker = new TokenBalanceChecker(network);
    
    if (tokensArg) {
      // 特定トークンのみ確認
      const tokens = tokensArg.split(',').map(t => t.trim().toUpperCase());
      await checker.checkSpecificTokens(address, tokens);
    } else {
      // 全トークン確認
      await checker.getAllTokenBalances(address, onlyBalance);
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { TokenBalanceChecker };