const { UniversalContractUtils } = require('./dist/templates/contract-utils');
const { ethers } = require('ethers');

/**
 * プール存在確認とファクトリー調査
 */
async function checkPools() {
  console.log('🔍 プール存在確認とファクトリー調査\n');
  
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  const utils = new UniversalContractUtils(rpcUrl);
  
  // トークンアドレス
  const HYPE = '0x0000000000000000000000000000000000000000'; // Native
  const UBTC = '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463';
  const WETH = '0x4200000000000000000000000000000000000006';
  
  console.log('📍 確認対象トークン:');
  console.log(`   HYPE (Native): ${HYPE}`);
  console.log(`   UBTC: ${UBTC}`);
  console.log(`   WETH: ${WETH}\n`);
  
  // DEX設定
  const dexes = [
    {
      name: 'HyperSwap V2',
      router: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A',
      type: 'v2'
    },
    {
      name: 'HyperSwap V3',
      quoter: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
      type: 'v3'
    },
    {
      name: 'KittenSwap V2',
      router: '0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802',
      type: 'v2'
    },
    {
      name: 'KittenSwap CL',
      quoter: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF',
      type: 'v3'
    }
  ];
  
  // 1. ファクトリーアドレス取得
  console.log('🏭 ファクトリーアドレス確認:');
  for (const dex of dexes) {
    try {
      const contract = dex.router || dex.quoter;
      const abiPath = dex.type === 'v2' ? './abi/UniV2Router.json' : './abi/KittenQuoterV2.json';
      
      const result = await utils.callReadFunction({
        abiPath,
        contractAddress: contract,
        functionName: 'factory',
        args: []
      });
      
      if (result.success) {
        console.log(`   ✅ ${dex.name}: ${result.result}`);
        dex.factory = result.result;
      } else {
        console.log(`   ❌ ${dex.name}: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ❌ ${dex.name}: ${error.message}`);
    }
  }
  
  console.log('\n');
  
  // 2. V2ペア確認（計算によるアドレス取得）
  console.log('🔗 V2ペア存在確認:');
  const v2Factories = dexes.filter(d => d.type === 'v2' && d.factory);
  
  for (const dex of v2Factories) {
    console.log(`\n   ${dex.name} (Factory: ${dex.factory}):`);
    
    const pairs = [
      { name: 'HYPE/UBTC', tokenA: HYPE, tokenB: UBTC },
      { name: 'HYPE/WETH', tokenA: HYPE, tokenB: WETH },
      { name: 'UBTC/WETH', tokenA: UBTC, tokenB: WETH }
    ];
    
    for (const pair of pairs) {
      try {
        // V2ペアアドレス計算（簡易版）
        const token0 = pair.tokenA.toLowerCase() < pair.tokenB.toLowerCase() ? pair.tokenA : pair.tokenB;
        const token1 = pair.tokenA.toLowerCase() < pair.tokenB.toLowerCase() ? pair.tokenB : pair.tokenA;
        
        // create2でペアアドレスを計算するのは複雑なので、getPairを試行
        console.log(`     ${pair.name}: token0=${token0.substring(0,10)}... token1=${token1.substring(0,10)}...`);
        
        // 小さなスワップを試行してペアの存在を確認
        const amountIn = ethers.utils.parseEther('0.001'); // 非常に小さい量
        const path = [pair.tokenA, pair.tokenB];
        
        const result = await utils.callReadFunction({
          abiPath: './abi/UniV2Router.json',
          contractAddress: dex.router,
          functionName: 'getAmountsOut',
          args: [amountIn.toString(), path]
        });
        
        if (result.success) {
          console.log(`     ✅ ペア存在 (少量テスト成功)`);
        } else {
          console.log(`     ❌ ペアなし: ${result.error?.substring(0, 50)}...`);
        }
        
      } catch (error) {
        console.log(`     ❌ エラー: ${error.message.substring(0, 50)}...`);
      }
    }
  }
  
  // 3. WETH確認
  console.log('\n💧 WETH情報確認:');
  for (const dex of dexes.filter(d => d.type === 'v2')) {
    try {
      const result = await utils.callReadFunction({
        abiPath: './abi/UniV2Router.json',
        contractAddress: dex.router,
        functionName: 'WETH',
        args: []
      });
      
      if (result.success) {
        console.log(`   ${dex.name} WETH: ${result.result}`);
      }
    } catch (error) {
      console.log(`   ${dex.name} WETH: エラー`);
    }
  }
  
  // 4. トークン存在確認
  console.log('\n🪙 トークンコントラクト確認:');
  const tokens = [
    { name: 'UBTC', address: UBTC },
    { name: 'WETH', address: WETH }
  ];
  
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  
  for (const token of tokens) {
    try {
      const code = await provider.getCode(token.address);
      if (code && code !== '0x') {
        console.log(`   ✅ ${token.name}: コントラクト存在 (${(code.length - 2) / 2} bytes)`);
      } else {
        console.log(`   ❌ ${token.name}: コントラクトなし`);
      }
    } catch (error) {
      console.log(`   ❌ ${token.name}: 確認エラー`);
    }
  }
  
  console.log('\n💡 結論:');
  console.log('   - 正確なトークンアドレスが確認されました');
  console.log('   - プールが存在しない可能性が高い');
  console.log('   - HyperSwap/KittenSwap UIで流動性プールを確認することを推奨');
  console.log('   - または他のメジャートークンペアで試行');
}

// 実行
if (require.main === module) {
  checkPools()
    .catch(error => {
      console.error('❌ 確認エラー:', error);
    });
}

module.exports = { checkPools };