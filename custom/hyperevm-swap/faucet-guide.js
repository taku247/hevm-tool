const { ethers } = require('ethers');
require('dotenv').config();

/**
 * HyperLiquid テストネットフォーセットガイド
 */
class TestnetFaucetGuide {
  constructor() {
    this.testnetRpc = 'https://rpc.hyperliquid-testnet.xyz/evm';
    this.faucetUrls = {
      official: 'https://app.hyperliquid-testnet.xyz/drip',
      api: 'https://api.hyperliquid-testnet.xyz/info'
    };
  }
  
  /**
   * テストウォレット生成
   */
  generateTestWallet() {
    console.log('🔑 テスト用ウォレット生成\n');
    
    const wallet = ethers.Wallet.createRandom();
    
    console.log('✅ 新しいテストウォレットを生成しました:');
    console.log(`   アドレス: ${wallet.address}`);
    console.log(`   秘密鍵: ${wallet.privateKey}`);
    console.log('');
    console.log('⚠️  重要:');
    console.log('   - この秘密鍵はテストネット専用です');
    console.log('   - メインネットでは絶対に使用しないでください');
    console.log('   - .envファイルに保存してください');
    console.log('');
    console.log('.envファイルに追加:');
    console.log(`TESTNET_PRIVATE_KEY=${wallet.privateKey}`);
    
    return {
      address: wallet.address,
      privateKey: wallet.privateKey
    };
  }
  
  /**
   * フォーセット情報表示
   */
  showFaucetInfo() {
    console.log('💧 HyperLiquid テストネットフォーセット情報\n');
    
    console.log('🏛️ 公式フォーセット:');
    console.log(`   URL: ${this.faucetUrls.official}`);
    console.log('   手順:');
    console.log('   1. ウォレットを接続');
    console.log('   2. "Claim 1000 Mock USDC" をクリック');
    console.log('   制限: 4時間に1回、1000 Mock USDC');
    console.log('');
    
    console.log('🔧 API経由でのガストークン取得:');
    console.log('   以下のコマンドでETHを取得できます:');
    console.log('');
    console.log('   curl -X POST \\');
    console.log('     --header "Content-Type: application/json" \\');
    console.log('     --data \'{"type":"ethFaucet", "user": "YOUR_WALLET_ADDRESS"}\' \\');
    console.log(`     ${this.faucetUrls.api}`);
    console.log('');
    
    console.log('💡 コミュニティフォーセット:');
    console.log('   - hyperliquid-faucet.vercel.app');
    console.log('   - より高頻度で利用可能');
    console.log('   - セキュリティに注意して利用');
    console.log('');
    
    console.log('⚠️  注意事項:');
    console.log('   - 公式フォーセット優先で利用');
    console.log('   - サードパーティフォーセットは自己責任');
    console.log('   - フィッシング詐欺に注意');
  }
  
  /**
   * API経由でETH取得
   */
  async claimEthViaAPI(walletAddress) {
    try {
      console.log(`💧 API経由でETH取得: ${walletAddress}\n`);
      
      const fetch = require('node-fetch');
      
      const response = await fetch(this.faucetUrls.api, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'ethFaucet',
          user: walletAddress.toLowerCase()
        })
      });
      
      const result = await response.text();
      
      if (response.ok) {
        console.log('✅ ETH取得リクエスト成功');
        console.log(`   レスポンス: ${result}`);
        
        // 少し待ってから残高確認
        console.log('\n⏳ 5秒後に残高確認...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const provider = new ethers.providers.JsonRpcProvider(this.testnetRpc);
        const balance = await provider.getBalance(walletAddress);
        
        console.log(`💰 現在の残高: ${ethers.utils.formatEther(balance)} ETH`);
        
        return {
          success: true,
          balance: balance.toString(),
          formatted: ethers.utils.formatEther(balance)
        };
      } else {
        console.log(`❌ ETH取得失敗: ${response.status} ${response.statusText}`);
        console.log(`   レスポンス: ${result}`);
        
        return {
          success: false,
          error: `${response.status}: ${result}`
        };
      }
    } catch (error) {
      console.log(`❌ API呼び出しエラー: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * 残高確認
   */
  async checkBalance(walletAddress) {
    try {
      console.log(`💰 残高確認: ${walletAddress}\n`);
      
      const provider = new ethers.providers.JsonRpcProvider(this.testnetRpc);
      
      // ETH残高
      const ethBalance = await provider.getBalance(walletAddress);
      console.log(`   ETH: ${ethers.utils.formatEther(ethBalance)}`);
      
      // テストトークン残高確認
      const testTokens = [
        { symbol: 'HSPX', address: '0xD8c23394e2d55AA6dB9E5bb1305df54A1F83D122' },
        { symbol: 'WETH', address: '0xADcb2f358Eae6492F61A5F87eb8893d09391d160' },
        { symbol: 'PURR', address: '0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82' }
      ];
      
      const erc20ABI = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
      ];
      
      for (const token of testTokens) {
        try {
          const contract = new ethers.Contract(token.address, erc20ABI, provider);
          const balance = await contract.balanceOf(walletAddress);
          const decimals = await contract.decimals();
          const symbol = await contract.symbol();
          
          const formatted = ethers.utils.formatUnits(balance, decimals);
          console.log(`   ${symbol}: ${formatted}`);
        } catch (error) {
          console.log(`   ${token.symbol}: 確認エラー`);
        }
      }
      
      return {
        success: true,
        ethBalance: ethBalance.toString(),
        ethFormatted: ethers.utils.formatEther(ethBalance)
      };
    } catch (error) {
      console.log(`❌ 残高確認エラー: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * セットアップチェック
   */
  async setupCheck() {
    console.log('🔍 テストネットセットアップチェック\n');
    
    // 1. 環境変数確認
    const privateKey = process.env.TESTNET_PRIVATE_KEY;
    
    if (!privateKey) {
      console.log('❌ TESTNET_PRIVATE_KEY が設定されていません');
      console.log('');
      console.log('解決策:');
      console.log('1. 新しいテストウォレットを生成: node custom/hyperevm-swap/faucet-guide.js --generate');
      console.log('2. 既存の秘密鍵を.envに設定');
      return;
    }
    
    // 2. ウォレット確認
    try {
      const provider = new ethers.providers.JsonRpcProvider(this.testnetRpc);
      const wallet = new ethers.Wallet(privateKey, provider);
      
      console.log('✅ ウォレット設定OK');
      console.log(`   アドレス: ${wallet.address}`);
      
      // 3. 残高確認
      await this.checkBalance(wallet.address);
      
      // 4. ガス不足チェック
      const balance = await wallet.getBalance();
      const minGas = ethers.utils.parseEther('0.001'); // 最低0.001 ETH
      
      if (balance.lt(minGas)) {
        console.log('\n⚠️  ガス不足');
        console.log('   最低0.001 ETH必要です');
        console.log('');
        console.log('ETH取得方法:');
        console.log(`1. API経由: node custom/hyperevm-swap/faucet-guide.js --claim-eth ${wallet.address}`);
        console.log(`2. 公式フォーセット: ${this.faucetUrls.official}`);
      } else {
        console.log('\n✅ セットアップ完了！');
        console.log('   スワップテストが可能です');
        console.log('');
        console.log('次のステップ:');
        console.log('   node custom/hyperevm-swap/v2-swap.js --tokenIn HSPX --tokenOut WETH --amount 10 --quote-only');
      }
      
    } catch (error) {
      console.log(`❌ ウォレット設定エラー: ${error.message}`);
    }
  }
}

// CLI実行
async function main() {
  const args = process.argv.slice(2);
  const guide = new TestnetFaucetGuide();
  
  if (args.includes('--help') || args.length === 0) {
    console.log(`
💧 HyperLiquid テストネットフォーセットガイド

使用方法:
  node custom/hyperevm-swap/faucet-guide.js --info            # フォーセット情報表示
  node custom/hyperevm-swap/faucet-guide.js --generate        # テストウォレット生成
  node custom/hyperevm-swap/faucet-guide.js --check           # セットアップ確認
  node custom/hyperevm-swap/faucet-guide.js --claim-eth ADDR  # API経由でETH取得
  node custom/hyperevm-swap/faucet-guide.js --balance ADDR    # 残高確認

例:
  # セットアップチェック
  node custom/hyperevm-swap/faucet-guide.js --check
  
  # 新しいテストウォレット生成
  node custom/hyperevm-swap/faucet-guide.js --generate
  
  # ETH取得
  node custom/hyperevm-swap/faucet-guide.js --claim-eth 0x1234...
`);
    return;
  }
  
  if (args.includes('--info')) {
    guide.showFaucetInfo();
  } else if (args.includes('--generate')) {
    guide.generateTestWallet();
  } else if (args.includes('--check')) {
    await guide.setupCheck();
  } else if (args.includes('--claim-eth')) {
    const address = args[args.indexOf('--claim-eth') + 1];
    if (!address) {
      console.log('❌ ウォレットアドレスを指定してください');
      return;
    }
    await guide.claimEthViaAPI(address);
  } else if (args.includes('--balance')) {
    const address = args[args.indexOf('--balance') + 1];
    if (!address) {
      console.log('❌ ウォレットアドレスを指定してください');
      return;
    }
    await guide.checkBalance(address);
  } else {
    console.log('❌ 不明なオプション。--help を参照してください。');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { TestnetFaucetGuide };