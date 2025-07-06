const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * 全トークンのdecimalsを実際のコントラクトから取得
 */

async function getTokenDecimals() {
  console.log('🔍 全トークンのdecimals取得\n');
  
  const tokens = {
    WHYPE: "0x5555555555555555555555555555555555555555",
    UBTC: "0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463",
    UETH: "0xBe6727B535545C67d5cAa73dEa54865B92CF7907",
    ADHD: "0xE3D5F45d97fee83B48c85E00c8359A2E07D68Fee",
    BUDDY: "0x47bb061C0204Af921F43DC73C7D7768d2672DdEE",
    CATBAL: "0x11735dBd0B97CfA7Accf47d005673BA185f7fd49",
    HFUN: "0xa320D9f65ec992EfF38622c63627856382Db726c"
  };
  
  // ERC20 decimals ABI
  const erc20ABI = [{
    "name": "decimals",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint8"}]
  }, {
    "name": "symbol",
    "type": "function", 
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"name": "", "type": "string"}]
  }, {
    "name": "name",
    "type": "function",
    "stateMutability": "view", 
    "inputs": [],
    "outputs": [{"name": "", "type": "string"}]
  }];
  
  const results = {};
  
  for (const [symbol, address] of Object.entries(tokens)) {
    console.log(`🔍 ${symbol} (${address}):`);
    
    try {
      const contract = new ethers.Contract(address, erc20ABI, provider);
      
      // decimals取得
      const decimals = await contract.decimals();
      
      // 追加情報も取得
      try {
        const name = await contract.name();
        const contractSymbol = await contract.symbol();
        
        console.log(`   ✅ Name: ${name}`);
        console.log(`   ✅ Symbol: ${contractSymbol}`);
        console.log(`   ✅ Decimals: ${decimals}`);
        
        results[symbol] = {
          address,
          name,
          symbol: contractSymbol,
          decimals: decimals.toString()
        };
        
      } catch (metaError) {
        // decimalsだけでも取得できれば良い
        console.log(`   ✅ Decimals: ${decimals}`);
        console.log(`   ⚠️  Name/Symbol取得失敗`);
        
        results[symbol] = {
          address,
          decimals: decimals.toString()
        };
      }
      
    } catch (error) {
      console.log(`   ❌ エラー: ${error.message.substring(0, 100)}...`);
      results[symbol] = {
        address,
        error: error.message
      };
    }
    
    console.log('');
  }
  
  console.log('📋 結果サマリー:\n');
  
  // コード用のtokenInfo生成
  console.log('const tokenInfo = {');
  for (const [symbol, info] of Object.entries(results)) {
    if (info.decimals) {
      console.log(`    ${symbol}: { decimals: ${info.decimals} },`);
    } else {
      console.log(`    // ${symbol}: { decimals: ? }, // エラー: ${info.error?.substring(0, 50)}`);
    }
  }
  console.log('};');
  
  console.log('\n📊 検証結果:');
  for (const [symbol, info] of Object.entries(results)) {
    if (info.decimals) {
      console.log(`✅ ${symbol}: ${info.decimals} decimals`);
    } else {
      console.log(`❌ ${symbol}: 取得失敗`);
    }
  }
  
  return results;
}

if (require.main === module) {
  getTokenDecimals().catch(console.error);
}

module.exports = { getTokenDecimals };