#!/usr/bin/env node

/**
 * KittenSwap Router調査スクリプト
 * 複数のRouter候補からgetAmountsOut関数を持つものを特定
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// bytecode-analyzerのインポート
const { BytecodeAnalyzer } = require('../utils/bytecode-analyzer');

class KittenSwapRouterInvestigator {
  constructor(rpcUrl) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.analyzer = new BytecodeAnalyzer(rpcUrl);
  }

  // KittenSwapのRouter候補一覧
  getRouterCandidates() {
    return {
      // Phase 1
      'Router': '0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802',
      
      // Phase 2
      'SwapRouter': '0x8fFDB06039B1b8188c2C721Dc3C435B5773D7346',
      'QuoterV2': '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF',
      
      // Factoryも念のため確認
      'PairFactory': '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B',
      'CLFactory': '0x2E08F5Ff603E4343864B14599CAeDb19918BDCaF',
      'FactoryRegistry': '0x8C142521ebB1aC1cC1F0958037702A69b6f608e4'
    };
  }

  // Router関連の既知関数セレクタ
  getRouterSelectors() {
    return {
      // Uniswap V2 Router
      '0xd06ca61f': 'getAmountsOut(uint256,address[])',
      '0x1f00ca74': 'getAmountsIn(uint256,address[])',
      '0xad5c4648': 'WETH()',
      '0xc45a0155': 'factory()',
      '0x38ed1739': 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
      '0x8803dbee': 'swapTokensForExactTokens(uint256,uint256,address[],address,uint256)',
      
      // Uniswap V3 SwapRouter
      '0x414bf389': 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))',
      '0xdb3e2198': 'exactOutputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))',
      '0xc04b8d59': 'exactInput((bytes,address,uint256,uint256,uint256))',
      '0xf28c0498': 'exactOutput((bytes,address,uint256,uint256,uint256))',
      
      // QuoterV2
      '0xc6a5026a': 'quoteExactInputSingle((address,address,uint256,uint24,uint160))',
      '0xbd21704a': 'quoteExactOutputSingle(address,address,uint24,uint256,uint160)',
      '0xcdca1753': 'quoteExactInput(bytes,uint256)',
      '0x2f80bb1d': 'quoteExactOutput(bytes,uint256)'
    };
  }

  async investigateAllRouters() {
    console.log('🔍 KittenSwap Router調査\n');
    
    console.log('📊 RPC接続情報:');
    console.log(`   URL: ${this.provider.connection.url}`);
    console.log(`   Block Number: ${await this.provider.getBlockNumber()}`);
    console.log('');
    
    const candidates = this.getRouterCandidates();
    const routerSelectors = this.getRouterSelectors();
    const results = {};
    
    for (const [name, address] of Object.entries(candidates)) {
      console.log(`\n🏦 ${name} 調査`);
      console.log(`📍 アドレス: ${address}`);
      
      try {
        // バイトコード取得
        const code = await this.provider.getCode(address);
        const exists = code !== '0x';
        const size = exists ? code.length / 2 - 1 : 0;
        
        console.log(`   存在: ${exists ? '✅' : '❌'}`);
        if (!exists) continue;
        
        console.log(`   サイズ: ${size} bytes`);
        
        // 関数セレクタ抽出
        const signatures = await this.analyzer.extractFunctionSignatures(address);
        console.log(`   関数数: ${signatures.length}個`);
        
        // Router関連関数の存在確認
        const foundFunctions = [];
        for (const [selector, funcName] of Object.entries(routerSelectors)) {
          if (signatures.some(sig => sig.selector === selector)) {
            foundFunctions.push({ selector, funcName });
            console.log(`   ✅ ${funcName}`);
          }
        }
        
        results[name] = {
          address,
          size,
          totalFunctions: signatures.length,
          routerFunctions: foundFunctions,
          hasGetAmountsOut: foundFunctions.some(f => f.funcName.includes('getAmountsOut')),
          signatures
        };
        
        // getAmountsOut が見つかった場合、実際にテスト
        if (results[name].hasGetAmountsOut) {
          console.log('\n   🧪 getAmountsOut テスト:');
          await this.testGetAmountsOut(address);
        }
        
      } catch (error) {
        console.log(`   ❌ エラー: ${error.message}`);
        results[name] = { error: error.message };
      }
    }
    
    // 結果サマリー
    console.log('\n\n📋 調査結果サマリー');
    console.log('==================\n');
    
    const routerCapable = Object.entries(results).filter(([_, r]) => r.hasGetAmountsOut);
    if (routerCapable.length > 0) {
      console.log('✅ getAmountsOut を持つコントラクト:');
      routerCapable.forEach(([name, result]) => {
        console.log(`   ${name}: ${result.address}`);
        console.log(`     - 関数数: ${result.totalFunctions}`);
        console.log(`     - Router関数数: ${result.routerFunctions.length}`);
      });
    } else {
      console.log('❌ getAmountsOut を持つコントラクトが見つかりませんでした');
    }
    
    // ABI生成
    for (const [name, result] of Object.entries(results)) {
      if (result.hasGetAmountsOut && result.signatures) {
        console.log(`\n📄 ${name} の推定ABI生成中...`);
        await this.generateAndSaveABI(name, result.address, result.signatures);
      }
    }
    
    return results;
  }

  async testGetAmountsOut(address) {
    const abi = [
      "function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)"
    ];
    
    const router = new ethers.Contract(address, abi, this.provider);
    
    // 実際のトークンでテスト
    const WHYPE = '0x5555555555555555555555555555555555555555';
    const PAWS = '0xe3C80b7A1A8631E8cFd59c61E2a74Eb497dB28F6';
    
    try {
      const amountIn = ethers.utils.parseEther('1');
      const path = [WHYPE, PAWS];
      
      console.log(`     テストパス: WHYPE → PAWS`);
      console.log(`     投入量: 1.0 ETH`);
      
      const amounts = await router.callStatic.getAmountsOut(amountIn, path);
      console.log(`     ✅ 成功! 出力: ${ethers.utils.formatEther(amounts[1])} PAWS`);
      
    } catch (error) {
      console.log(`     ❌ 失敗: ${error.message.substring(0, 50)}...`);
      
      // エラー詳細分析
      if (error.message.includes('missing revert data')) {
        console.log(`     💡 原因: 実装が不完全か、異なるシグネチャ`);
      }
    }
  }

  async generateAndSaveABI(name, address, signatures) {
    // Router関連の関数のみでABI生成
    const routerSelectors = this.getRouterSelectors();
    const relevantSignatures = signatures.filter(sig => 
      Object.keys(routerSelectors).includes(sig.selector)
    );
    
    if (relevantSignatures.length === 0) {
      console.log('   Router関連関数が見つかりません');
      return;
    }
    
    // ABI形式に変換
    const abi = relevantSignatures.map(sig => {
      const funcName = routerSelectors[sig.selector];
      if (!funcName) return null;
      
      // 簡易的なABI生成（実際の型は推定）
      const match = funcName.match(/^(\w+)\((.*)\)$/);
      if (!match) return null;
      
      return {
        name: match[1],
        type: 'function',
        stateMutability: 'view', // 仮定
        inputs: [], // 詳細は手動で設定必要
        outputs: []
      };
    }).filter(Boolean);
    
    console.log(`   生成されたABI関数: ${abi.length}個`);
    
    // ファイルに保存
    const fs = require('fs');
    const abiPath = path.join(__dirname, `../../abi/KittenSwap${name}.json`);
    fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
    console.log(`   💾 保存先: ${abiPath}`);
  }
}

async function main() {
  try {
    const rpcUrl = process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm';
    const investigator = new KittenSwapRouterInvestigator(rpcUrl);
    
    const results = await investigator.investigateAllRouters();
    
    // 詳細な関数リストを別ファイルに保存
    const fs = require('fs');
    const outputPath = path.join(__dirname, 'kittenswap-router-investigation-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 詳細結果保存: ${outputPath}`);
    
    console.log('\n🏁 KittenSwap Router調査完了');
    
  } catch (error) {
    console.error('❌ 調査エラー:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = { KittenSwapRouterInvestigator };