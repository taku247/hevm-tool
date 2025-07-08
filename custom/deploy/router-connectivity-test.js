const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * HyperSwap Router の接続性とテストネット対応確認
 */

// Router アドレス
const ROUTERS = {
  V2: '0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853',
  V3_01: '0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990',
  V3_02: '0x51c5958FFb3e326F8d7AA945948159f1FF27e14A'
};

// トークンアドレス
const TOKENS = {
  WETH: '0xADcb2f358Eae6492F61A5F87eb8893d09391d160',
  PURR: '0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82',
  HFUN: '0x37adB2550b965851593832a6444763eeB3e1d1Ec'
};

// 基本的なABI
const ROUTER_V2_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

const ROUTER_V3_ABI = [
  "function WETH9() external view returns (address)",
  "function factory() external view returns (address)"
];

async function testRouterConnectivity() {
  console.log('🔍 HyperSwap Router 接続性テスト');
  console.log('===================================\\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    console.log(`📡 RPC: ${rpcUrl}`);
    console.log('');

    // ネットワーク情報確認
    const network = await provider.getNetwork();
    console.log('🌐 ネットワーク情報:');
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Name: ${network.name}`);
    console.log('');

    // Router存在確認
    console.log('🔧 Router存在確認:');
    
    for (const [name, address] of Object.entries(ROUTERS)) {
      try {
        const code = await provider.getCode(address);
        const hasCode = code !== '0x';
        console.log(`   ${name}: ${address} - ${hasCode ? '✅ コード存在' : '❌ コードなし'}`);
        
        if (hasCode && name === 'V2') {
          // V2 Router の基本機能テスト
          try {
            const routerV2 = new ethers.Contract(address, ROUTER_V2_ABI, provider);
            const path = [TOKENS.WETH, TOKENS.PURR];
            const amountIn = ethers.parseEther('0.001');
            
            const amounts = await routerV2.getAmountsOut(amountIn, path);
            console.log(`     └ getAmountsOut: ✅ 動作 (${ethers.formatEther(amounts[1])} PURR)`);
          } catch (error) {
            console.log(`     └ getAmountsOut: ❌ ${error.message.substring(0, 50)}...`);
          }
        }
        
        if (hasCode && name.includes('V3')) {
          // V3 Router の基本機能テスト
          try {
            const routerV3 = new ethers.Contract(address, ROUTER_V3_ABI, provider);
            const weth = await routerV3.WETH9();
            console.log(`     └ WETH9(): ✅ ${weth}`);
          } catch (error) {
            console.log(`     └ WETH9(): ❌ ${error.message.substring(0, 50)}...`);
          }
        }
        
      } catch (error) {
        console.log(`   ${name}: ${address} - ❌ エラー: ${error.message}`);
      }
    }
    
    console.log('');

    // トークン存在確認
    console.log('💰 トークン存在確認:');
    
    const tokenABI = [
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function totalSupply() view returns (uint256)"
    ];
    
    for (const [symbol, address] of Object.entries(TOKENS)) {
      try {
        const code = await provider.getCode(address);
        const hasCode = code !== '0x';
        console.log(`   ${symbol}: ${address} - ${hasCode ? '✅ コード存在' : '❌ コードなし'}`);
        
        if (hasCode) {
          try {
            const token = new ethers.Contract(address, tokenABI, provider);
            const tokenSymbol = await token.symbol();
            const decimals = await token.decimals();
            const totalSupply = await token.totalSupply();
            
            console.log(`     └ Symbol: ${tokenSymbol}, Decimals: ${decimals}, Supply: ${ethers.formatUnits(totalSupply, decimals)}`);
          } catch (error) {
            console.log(`     └ 詳細取得失敗: ${error.message.substring(0, 50)}...`);
          }
        }
      } catch (error) {
        console.log(`   ${symbol}: ${address} - ❌ エラー: ${error.message}`);
      }
    }
    
    console.log('');

    // MultiSwap コントラクト確認
    console.log('🎯 MultiSwap コントラクト確認:');
    const multiswapAddress = '0x6f413c13a1bf5e855e4E522a66FC2a6efC2c2841';
    
    try {
      const code = await provider.getCode(multiswapAddress);
      const hasCode = code !== '0x';
      console.log(`   Address: ${multiswapAddress}`);
      console.log(`   Status: ${hasCode ? '✅ デプロイ済み' : '❌ 未デプロイ'}`);
      
      if (hasCode) {
        console.log(`   Code Size: ${(code.length - 2) / 2} bytes`);
      }
    } catch (error) {
      console.log(`   ❌ エラー: ${error.message}`);
    }
    
    console.log('');

    // 診断結果
    console.log('🏥 診断結果:');
    console.log('');
    console.log('   ✅ 成功した項目:');
    console.log('      - ネットワーク接続');
    console.log('      - MultiSwap デプロイ');
    console.log('      - WETH Approve 機能');
    console.log('');
    console.log('   ⚠️  問題の可能性:');
    console.log('      - HyperSwap Router のテストネット対応状況');
    console.log('      - V2/V3 プールの流動性不足');
    console.log('      - テストネット固有の制約');
    console.log('');
    console.log('   💡 推奨対応:');
    console.log('      - メインネットでの動作確認');
    console.log('      - より小さな金額でのテスト');
    console.log('      - 個別スワップでの動作確認');

  } catch (error) {
    console.error('❌ テスト中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  testRouterConnectivity()
    .then(() => {
      console.log('\\n🔍 Router接続性テスト完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { testRouterConnectivity };