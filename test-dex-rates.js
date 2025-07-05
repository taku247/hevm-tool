const { UniversalContractUtils } = require('./dist/templates/contract-utils');
const { ethers } = require('ethers');

/**
 * DEXレート取得テスト
 */
async function testDEXRates() {
  console.log('🧪 DEXレート取得テスト\n');
  
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  const utils = new UniversalContractUtils(rpcUrl);
  
  // DEX設定
  const dexConfigs = [
    {
      name: 'HyperSwap V2',
      type: 'v2',
      contract: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A',
      abi: './abi/UniV2Router.json'
    },
    {
      name: 'KittenSwap V2', 
      type: 'v2',
      contract: '0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802',
      abi: './abi/UniV2Router.json'
    },
    {
      name: 'HyperSwap V3',
      type: 'v3',
      contract: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
      abi: './abi/KittenQuoterV2.json'
    },
    {
      name: 'KittenSwap CL',
      type: 'v3',
      contract: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF',
      abi: './abi/KittenQuoterV2.json'
    }
  ];
  
  // テスト用の仮想トークンペア（実際には存在しない可能性あり）
  const testPairs = [
    {
      name: 'NATIVE/WETH',
      tokenA: '0x0000000000000000000000000000000000000000', // Native
      tokenB: '0x4200000000000000000000000000000000000006', // Optimism WETH
      decimalsA: 18,
      decimalsB: 18
    },
    {
      name: 'WETH/NATIVE',
      tokenA: '0x4200000000000000000000000000000000000006', // WETH
      tokenB: '0x0000000000000000000000000000000000000000', // Native
      decimalsA: 18,
      decimalsB: 18
    }
  ];
  
  const results = {
    successful: [],
    failed: [],
    summary: {}
  };
  
  console.log('📊 各DEXでのレート取得テスト開始...\n');
  
  for (const dex of dexConfigs) {
    console.log(`🔍 ${dex.name} テスト中...`);
    
    for (const pair of testPairs) {
      const testName = `${dex.name} - ${pair.name}`;
      
      try {
        if (dex.type === 'v2') {
          // V2テスト
          const amountIn = ethers.utils.parseUnits('1', pair.decimalsA);
          const path = [pair.tokenA, pair.tokenB];
          
          const result = await utils.callReadFunction({
            abiPath: dex.abi,
            contractAddress: dex.contract,
            functionName: 'getAmountsOut',
            args: [amountIn.toString(), path]
          });
          
          if (result.success && result.result) {
            const amounts = result.result;
            const amountOut = amounts[1];
            const rate = parseFloat(ethers.utils.formatUnits(amountOut, pair.decimalsB));
            
            console.log(`   ✅ ${pair.name}: 1 ${pair.name.split('/')[0]} = ${rate.toFixed(6)} ${pair.name.split('/')[1]}`);
            
            results.successful.push({
              dex: dex.name,
              pair: pair.name,
              rate,
              type: 'v2',
              amountIn: amountIn.toString(),
              amountOut: amountOut.toString()
            });
          } else {
            console.log(`   ❌ ${pair.name}: ${result.error?.substring(0, 50)}...`);
            results.failed.push({
              dex: dex.name,
              pair: pair.name,
              type: 'v2',
              error: result.error
            });
          }
        } else if (dex.type === 'v3') {
          // V3テスト（複数手数料ティア）
          const fees = [100, 500, 2500, 10000];
          let hasSuccess = false;
          
          for (const fee of fees) {
            try {
              const amountIn = ethers.utils.parseUnits('1', pair.decimalsA);
              
              const result = await utils.callReadFunction({
                abiPath: dex.abi,
                contractAddress: dex.contract,
                functionName: 'quoteExactInputSingle',
                args: [
                  pair.tokenA,
                  pair.tokenB,
                  fee,
                  amountIn.toString(),
                  0
                ]
              });
              
              if (result.success && result.result) {
                const amountOut = result.result;
                const rate = parseFloat(ethers.utils.formatUnits(amountOut, pair.decimalsB));
                
                console.log(`   ✅ ${pair.name} (${fee/100}bps): 1 ${pair.name.split('/')[0]} = ${rate.toFixed(6)} ${pair.name.split('/')[1]}`);
                
                results.successful.push({
                  dex: dex.name,
                  pair: pair.name,
                  rate,
                  type: 'v3',
                  fee,
                  amountIn: amountIn.toString(),
                  amountOut: amountOut.toString()
                });
                
                hasSuccess = true;
              } else {
                console.log(`   ⚠️  ${pair.name} (${fee/100}bps): プールなし`);
              }
            } catch (feeError) {
              console.log(`   ⚠️  ${pair.name} (${fee/100}bps): ${feeError.message.substring(0, 30)}...`);
            }
          }
          
          if (!hasSuccess) {
            results.failed.push({
              dex: dex.name,
              pair: pair.name,
              type: 'v3',
              error: 'All fee tiers failed'
            });
          }
        }
        
      } catch (error) {
        console.log(`   ❌ ${pair.name}: 例外 - ${error.message.substring(0, 50)}...`);
        results.failed.push({
          dex: dex.name,
          pair: pair.name,
          type: dex.type,
          error: error.message
        });
      }
    }
    
    console.log('');
  }
  
  // 結果サマリー
  results.summary = {
    totalTests: dexConfigs.length * testPairs.length,
    successfulRates: results.successful.length,
    failedTests: results.failed.length,
    successRate: (results.successful.length / (dexConfigs.length * testPairs.length * 3)) * 100 // V3は複数ティアがあるため概算
  };
  
  console.log('📋 テスト結果サマリー');
  console.log('==================');
  console.log(`成功したレート取得: ${results.successful.length}`);
  console.log(`失敗したテスト: ${results.failed.length}`);
  console.log(`全体的な結果: ${results.successful.length > 0 ? '一部成功' : '全て失敗'}`);
  
  if (results.successful.length > 0) {
    console.log('\n✅ 成功したレート:');
    results.successful.forEach(r => {
      const feeInfo = r.fee ? ` (${r.fee/100}bps)` : '';
      console.log(`   ${r.dex}${feeInfo}: ${r.pair} = ${r.rate.toFixed(6)}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ 失敗したテスト:');
    results.failed.slice(0, 5).forEach(f => { // 最初の5つのみ表示
      console.log(`   ${f.dex}: ${f.pair} - ${f.error?.substring(0, 60)}...`);
    });
    if (results.failed.length > 5) {
      console.log(`   ... および他 ${results.failed.length - 5} 件`);
    }
  }
  
  console.log('\n💡 実際のトークンペアで流動性があるペアを見つける必要があります');
  console.log('   HyperEVMエクスプローラーまたはPurrsecで確認してください');
  
  return results;
}

// テスト実行
if (require.main === module) {
  testDEXRates()
    .then(results => {
      console.log('\n🎯 最終結果:', {
        success: results.successful.length > 0,
        rates: results.successful.length,
        failures: results.failed.length
      });
    })
    .catch(error => {
      console.error('❌ テスト実行エラー:', error);
    });
}

module.exports = { testDEXRates };