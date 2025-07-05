const { ethers } = require('ethers');
const fetch = require('node-fetch');
require('dotenv').config();

/**
 * HyperLiquid フォーセット取得方法の比較
 */
class FaucetMethods {
  constructor() {
    this.testnetRpc = 'https://rpc.hyperliquid-testnet.xyz/evm';
    this.walletAddress = process.env.TESTNET_WALLET_ADDRESS || 'YOUR_TESTNET_WALLET_ADDRESS_HERE';
  }

  /**
   * 方法1: 公式API試行（複数パターン）
   */
  async tryOfficialAPI() {
    console.log('🔧 方法1: 公式API試行\n');
    
    const apiMethods = [
      {
        name: 'ethFaucet endpoint',
        url: 'https://api.hyperliquid-testnet.xyz/info',
        body: {
          type: 'ethFaucet',
          user: this.walletAddress.toLowerCase()
        }
      },
      {
        name: 'Direct ethFaucet',
        url: 'https://api.hyperliquid-testnet.xyz/ethFaucet',
        body: {
          address: this.walletAddress.toLowerCase()
        }
      },
      {
        name: 'Faucet endpoint',
        url: 'https://api.hyperliquid-testnet.xyz/faucet',
        body: {
          address: this.walletAddress.toLowerCase(),
          type: 'eth'
        }
      }
    ];

    for (const method of apiMethods) {
      try {
        console.log(`   ${method.name} を試行中...`);
        
        const response = await fetch(method.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'HyperSwap-CLI/1.0'
          },
          body: JSON.stringify(method.body)
        });

        const result = await response.text();
        
        if (response.ok) {
          console.log(`   ✅ 成功: ${result}`);
          
          // 残高確認
          await this.checkBalance();
          return true;
        } else {
          console.log(`   ❌ 失敗 (${response.status}): ${result}`);
        }
      } catch (error) {
        console.log(`   ❌ エラー: ${error.message}`);
      }
    }
    
    return false;
  }

  /**
   * 方法2: コミュニティフォーセット試行
   */
  async tryCommunityFaucets() {
    console.log('\n🌐 方法2: コミュニティフォーセット試行\n');
    
    const communityFaucets = [
      {
        name: 'HyperLiquid Faucet (Vercel)',
        url: 'https://hyperliquid-faucet.vercel.app/api/faucet',
        body: {
          address: this.walletAddress,
          network: 'hyperliquid-testnet'
        }
      }
    ];

    for (const faucet of communityFaucets) {
      try {
        console.log(`   ${faucet.name} を試行中...`);
        
        const response = await fetch(faucet.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(faucet.body)
        });

        const result = await response.text();
        
        if (response.ok) {
          console.log(`   ✅ 成功: ${result}`);
          
          await this.checkBalance();
          return true;
        } else {
          console.log(`   ❌ 失敗 (${response.status}): ${result}`);
        }
      } catch (error) {
        console.log(`   ❌ エラー: ${error.message}`);
      }
    }
    
    return false;
  }

  /**
   * 方法3: ブラウザ自動化（Puppeteer風の説明）
   */
  showBrowserAutomation() {
    console.log('\n🤖 方法3: ブラウザ自動化（理論的）\n');
    
    console.log('   Puppeteerを使用した自動化は技術的に可能ですが、');
    console.log('   以下の理由で推奨されません:');
    console.log('');
    console.log('   ❌ リスク:');
    console.log('      - フォーセットの利用規約違反');
    console.log('      - Cloudflare等のボット検出');
    console.log('      - IPアドレスブロック');
    console.log('      - 倫理的問題');
    console.log('');
    console.log('   📝 実装例（参考のみ）:');
    console.log('   ```javascript');
    console.log('   const puppeteer = require("puppeteer");');
    console.log('   // 1. ブラウザ起動');
    console.log('   // 2. MetaMask接続');
    console.log('   // 3. フォーセットページアクセス');
    console.log('   // 4. クレームボタンクリック');
    console.log('   ```');
  }

  /**
   * 方法4: 手動ブラウザ操作ガイド
   */
  showManualBrowserGuide() {
    console.log('\n👤 方法4: 手動ブラウザ操作（推奨）\n');
    
    console.log('   📍 テストウォレット情報:');
    console.log(`      アドレス: ${this.walletAddress}`);
    console.log('      秘密鍵: ${process.env.TESTNET_PRIVATE_KEY || "YOUR_TESTNET_PRIVATE_KEY_HERE"}');
    console.log('');
    console.log('   🔧 MetaMask設定:');
    console.log('      ネットワーク名: HyperLiquid Testnet');
    console.log('      RPC URL: https://rpc.hyperliquid-testnet.xyz/evm');
    console.log('      チェーンID: 998');
    console.log('      通貨シンボル: ETH');
    console.log('');
    console.log('   🌐 フォーセットアクセス:');
    console.log('      1. https://app.hyperliquid-testnet.xyz/drip にアクセス');
    console.log('      2. MetaMaskでテストウォレットを接続');
    console.log('      3. ネットワークをHyperLiquid Testnetに切り替え');
    console.log('      4. フォーセットボタンをクリック');
    console.log('      5. 取引を承認');
    console.log('');
    console.log('   ⏱️  制限事項:');
    console.log('      - 4時間に1回の制限');
    console.log('      - 1回あたり一定量のETH');
  }

  /**
   * 残高確認
   */
  async checkBalance() {
    try {
      console.log('\n💰 残高確認中...');
      
      const provider = new ethers.providers.JsonRpcProvider(this.testnetRpc);
      const balance = await provider.getBalance(this.walletAddress);
      const formatted = ethers.utils.formatEther(balance);
      
      console.log(`   現在の残高: ${formatted} ETH`);
      
      if (parseFloat(formatted) > 0) {
        console.log('   ✅ ETH取得成功！スワップテスト可能です');
        return true;
      } else {
        console.log('   ⚠️  まだETHが反映されていません');
        return false;
      }
    } catch (error) {
      console.log(`   ❌ 残高確認エラー: ${error.message}`);
      return false;
    }
  }

  /**
   * 全方法実行
   */
  async tryAllMethods() {
    console.log('🎯 HyperLiquid Testnet ETH取得 - 全方法試行\n');
    console.log(`対象ウォレット: ${this.walletAddress}\n`);

    // 初期残高確認
    console.log('📊 初期残高確認:');
    const hasInitialBalance = await this.checkBalance();
    
    if (hasInitialBalance) {
      console.log('\n🎉 既にETHを保有しています！');
      return true;
    }

    // 方法1: 公式API
    const apiSuccess = await this.tryOfficialAPI();
    if (apiSuccess) return true;

    // 方法2: コミュニティフォーセット
    const communitySuccess = await this.tryCommunityFaucets();
    if (communitySuccess) return true;

    // 方法3: ブラウザ自動化の説明
    this.showBrowserAutomation();

    // 方法4: 手動ガイド
    this.showManualBrowserGuide();

    console.log('\n📋 結論:');
    console.log('   API経由での自動取得は現在利用できません');
    console.log('   ブラウザでの手動取得が最も確実です');
    console.log('');
    console.log('🎯 次のアクション:');
    console.log('   1. MetaMaskでテストウォレットをインポート');
    console.log('   2. HyperLiquid Testnetネットワークを追加');
    console.log('   3. 公式フォーセットで手動取得');
    console.log('   4. 取得後: node custom/hyperevm-swap/faucet-guide.js --check');

    return false;
  }
}

// CLI実行
async function main() {
  const args = process.argv.slice(2);
  const faucet = new FaucetMethods();

  if (args.includes('--help')) {
    console.log(`
💧 HyperLiquid フォーセット取得方法

使用方法:
  node custom/hyperevm-swap/faucet-methods.js                # 全方法試行
  node custom/hyperevm-swap/faucet-methods.js --api-only     # API方法のみ
  node custom/hyperevm-swap/faucet-methods.js --manual-guide # 手動ガイドのみ
  node custom/hyperevm-swap/faucet-methods.js --balance      # 残高確認のみ

推奨:
  最初に全方法試行を実行してください
`);
    return;
  }

  if (args.includes('--api-only')) {
    await faucet.tryOfficialAPI();
    await faucet.tryCommunityFaucets();
  } else if (args.includes('--manual-guide')) {
    faucet.showManualBrowserGuide();
  } else if (args.includes('--balance')) {
    await faucet.checkBalance();
  } else {
    await faucet.tryAllMethods();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { FaucetMethods };