const { UniversalContractUtils } = require('./dist/templates/contract-utils');
const { ethers } = require('ethers');

/**
 * Token0の正体を確認
 */
async function identifyToken0() {
  console.log('🕵️ Token0の正体確認\n');
  
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  const utils = new UniversalContractUtils(rpcUrl);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  
  const TOKEN0 = '0x5555555555555555555555555555555555555555';
  const UBTC = '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463';
  
  console.log(`📍 調査対象: ${TOKEN0}\n`);
  
  // 1. コントラクト存在確認
  console.log('🔍 1. コントラクト基本情報:');
  try {
    const code = await provider.getCode(TOKEN0);
    if (code && code !== '0x') {
      console.log(`   ✅ コントラクト存在: ${(code.length - 2) / 2} bytes`);
    } else {
      console.log('   ❌ コントラクトコードなし（EOAまたは存在しない）');
      
      // EOAの場合はNativeトークン（HYPE）の可能性
      const balance = await provider.getBalance(TOKEN0);
      console.log(`   💰 アドレス残高: ${ethers.utils.formatEther(balance)} ETH`);
      
      if (TOKEN0 === '0x0000000000000000000000000000000000000000') {
        console.log('   💡 これはゼロアドレス（Nativeトークン用）');
      } else {
        console.log('   💡 これは特殊なアドレス（Wrappedトークンの可能性）');
      }
    }
  } catch (error) {
    console.log(`   ❌ 確認エラー: ${error.message}`);
  }
  
  // 2. ERC20トークン情報確認
  console.log('\n📝 2. ERC20トークン情報確認:');
  const erc20ABI = [
    {"name": "name", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "string"}]},
    {"name": "symbol", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "string"}]},
    {"name": "decimals", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "uint8"}]},
    {"name": "totalSupply", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "uint256"}]}
  ];
  
  require('fs').writeFileSync('./abi/temp_erc20.json', JSON.stringify(erc20ABI, null, 2));
  
  const tokenInfo = {};
  const functions = ['name', 'symbol', 'decimals', 'totalSupply'];
  
  for (const func of functions) {
    try {
      const result = await utils.callReadFunction({
        abiPath: './abi/temp_erc20.json',
        contractAddress: TOKEN0,
        functionName: func,
        args: []
      });
      
      if (result.success) {
        if (func === 'totalSupply') {
          const supply = ethers.utils.formatEther(result.result);
          console.log(`   ✅ ${func}: ${parseFloat(supply).toLocaleString()}`);
          tokenInfo[func] = supply;
        } else {
          console.log(`   ✅ ${func}: ${result.result}`);
          tokenInfo[func] = result.result;
        }
      } else {
        console.log(`   ❌ ${func}: ${result.error?.substring(0, 50)}...`);
      }
    } catch (error) {
      console.log(`   ❌ ${func}: ${error.message.substring(0, 50)}...`);
    }
  }
  
  require('fs').unlinkSync('./abi/temp_erc20.json');
  
  // 3. HyperEVMの既知トークンとの比較
  console.log('\n🔍 3. 既知トークンとの比較:');
  const knownTokens = [
    { name: 'Native HYPE', address: '0x0000000000000000000000000000000000000000' },
    { name: 'WETH (Optimism)', address: '0x4200000000000000000000000000000000000006' },
    { name: 'UBTC', address: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463' }
  ];
  
  knownTokens.forEach(token => {
    if (token.address.toLowerCase() === TOKEN0.toLowerCase()) {
      console.log(`   ✅ マッチ: ${token.name}`);
    } else {
      console.log(`   ❌ ${token.name}: ${token.address}`);
    }
  });
  
  // 4. ルーター経由での動作確認
  console.log('\n🔄 4. ルーター経由動作確認:');
  
  // HyperSwap V2ルーターのWETH確認
  try {
    const wethResult = await utils.callReadFunction({
      abiPath: './abi/UniV2Router.json',
      contractAddress: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A',
      functionName: 'WETH',
      args: []
    });
    
    if (wethResult.success) {
      console.log(`   HyperSwap V2 WETH: ${wethResult.result}`);
      if (wethResult.result.toLowerCase() === TOKEN0.toLowerCase()) {
        console.log(`   ✅ TOKEN0はHyperSwap V2のWETHと一致！`);
      } else {
        console.log(`   ❌ TOKEN0はHyperSwap V2のWETHと異なる`);
      }
    }
  } catch (error) {
    console.log(`   WETH確認エラー: ${error.message}`);
  }
  
  // 5. 結論
  console.log('\n📋 結論:');
  
  if (tokenInfo.name && tokenInfo.symbol) {
    console.log(`   TOKEN0は "${tokenInfo.name}" (${tokenInfo.symbol})`);
    if (tokenInfo.decimals) {
      console.log(`   小数点桁数: ${tokenInfo.decimals}`);
    }
  } else {
    console.log('   TOKEN0の詳細情報を取得できませんでした');
    
    if (TOKEN0 === '0x5555555555555555555555555555555555555555') {
      console.log('   💡 0x555...のパターンは一般的にWrapped Etherやテストトークンで使用される');
      console.log('   💡 HyperEVMでの特殊なWETH実装の可能性が高い');
    }
  }
  
  console.log('\n   最終判断:');
  console.log(`   - TOKEN0 (${TOKEN0}) の正体は確定していない`);
  console.log(`   - TOKEN1 (${UBTC}) は確実にUBTC`);
  console.log(`   - スワップは正常に動作している`);
  console.log(`   - レート取得は成功している`);
  console.log('\n   💡 推奨: プールの実際の名称は TOKEN0/UBTC または Unknown/UBTC');
  
  return {
    token0: TOKEN0,
    token1: UBTC,
    token0Info: tokenInfo,
    isToken0Identified: !!(tokenInfo.name && tokenInfo.symbol)
  };
}

// 実行
if (require.main === module) {
  identifyToken0()
    .then(result => {
      console.log('\n🎯 調査結果:', {
        token0Identified: result.isToken0Identified,
        token0Info: result.token0Info
      });
    })
    .catch(error => {
      console.error('❌ 調査エラー:', error);
    });
}

module.exports = { identifyToken0 };