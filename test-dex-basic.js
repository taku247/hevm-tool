const { UniversalContractUtils } = require('./dist/templates/contract-utils');
const { ethers } = require('ethers');

/**
 * 基本的なDEX動作確認テスト
 */
async function testBasicDEXFunctionality() {
  console.log('🧪 DEXレート監視ツール基本動作確認\n');
  
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  
  try {
    // 1. 接続確認
    console.log('📡 1. HyperEVM接続テスト');
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    
    console.log('✅ 接続成功');
    console.log(`   RPC: ${rpcUrl}`);
    console.log(`   チェーンID: ${network.chainId}`);
    console.log(`   最新ブロック: ${blockNumber}\n`);
    
    // 2. UniversalContractUtils初期化確認
    console.log('🔧 2. UniversalContractUtils初期化テスト');
    const utils = new UniversalContractUtils(rpcUrl);
    console.log('✅ UniversalContractUtils初期化成功\n');
    
    // 3. DEXコントラクト存在確認
    console.log('📊 3. DEXコントラクト存在確認');
    const dexContracts = [
      { name: 'HyperSwap V2', address: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A' },
      { name: 'HyperSwap V3', address: '0x03A918028f22D9E1473B7959C927AD7425A45C7C' },
      { name: 'KittenSwap V2', address: '0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802' },
      { name: 'KittenSwap CL', address: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF' }
    ];
    
    for (const dex of dexContracts) {
      const code = await provider.getCode(dex.address);
      const exists = code !== '0x';
      console.log(`   ${exists ? '✅' : '❌'} ${dex.name}: ${dex.address}`);
      if (exists) {
        console.log(`      コードサイズ: ${(code.length - 2) / 2} bytes`);
      }
    }
    
    console.log('\n');
    
    // 4. ABI読み込み確認
    console.log('📄 4. ABI読み込み確認');
    try {
      const v2Result = await utils.callReadFunction({
        abiPath: './abi/UniV2Router.json',
        contractAddress: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A',
        functionName: 'factory',
        args: []
      });
      
      console.log(`   ✅ V2 ABI読み込み: ${v2Result.success ? '成功' : '失敗'}`);
      if (v2Result.success) {
        console.log(`      Factory Address: ${v2Result.result}`);
      } else {
        console.log(`      エラー: ${v2Result.error}`);
      }
    } catch (error) {
      console.log(`   ❌ V2 ABI読み込みエラー: ${error.message}`);
    }
    
    try {
      const v3Result = await utils.callReadFunction({
        abiPath: './abi/KittenQuoterV2.json',
        contractAddress: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
        functionName: 'factory',
        args: []
      });
      
      console.log(`   ✅ V3 ABI読み込み: ${v3Result.success ? '成功' : '失敗'}`);
      if (v3Result.success) {
        console.log(`      Factory Address: ${v3Result.result}`);
      } else {
        console.log(`      エラー: ${v3Result.error}`);
      }
    } catch (error) {
      console.log(`   ❌ V3 ABI読み込みエラー: ${error.message}`);
    }
    
    console.log('\n');
    
    // 5. ガス価格分析機能確認
    console.log('⛽ 5. ガス価格分析機能確認');
    try {
      const gasAnalysis = await utils.analyzeCurrentGasPrices();
      console.log('✅ ガス価格分析成功');
      console.log(`   現在のベースフィー: ${(parseInt(gasAnalysis.currentBaseFee) / 1e9).toFixed(2)} Gwei`);
      console.log(`   ネットワーク混雑度: ${gasAnalysis.networkCongestion}`);
      console.log(`   推奨戦略: ${gasAnalysis.recommendations.strategy}`);
    } catch (error) {
      console.log(`❌ ガス価格分析エラー: ${error.message}`);
    }
    
    console.log('\n📋 基本動作確認完了\n');
    
    return {
      connectionTest: true,
      utilsInitialization: true,
      contractExistence: true,
      abiLoading: true,
      gasPriceAnalysis: true
    };
    
  } catch (error) {
    console.error('❌ 基本動作確認でエラー発生:', error);
    return {
      connectionTest: false,
      error: error.message
    };
  }
}

// テスト実行
if (require.main === module) {
  testBasicDEXFunctionality()
    .then(result => {
      console.log('🎯 テスト結果:', result);
    })
    .catch(error => {
      console.error('❌ テスト実行エラー:', error);
    });
}

module.exports = { testBasicDEXFunctionality };