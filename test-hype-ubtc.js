const { UniversalContractUtils } = require('./dist/templates/contract-utils');
const { ethers } = require('ethers');

/**
 * HYPE/UBTCペアでのレート取得テスト
 */
async function testHypeUbtcPair() {
  console.log('🧪 HYPE/UBTCペア レート取得テスト\n');
  
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  const utils = new UniversalContractUtils(rpcUrl);
  
  // HyperEVMの正確なトークンアドレス
  const tokenPairs = [
    {
      name: 'HYPE/UBTC',
      tokenA: '0x0000000000000000000000000000000000000000', // Native HYPE
      tokenB: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463', // UBTC (正確なアドレス)
      decimalsA: 18,
      decimalsB: 8
    },
    {
      name: 'UBTC/HYPE',
      tokenA: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463', // UBTC
      tokenB: '0x0000000000000000000000000000000000000000', // Native HYPE
      decimalsA: 8,
      decimalsB: 18
    },
    // WETHを経由するパスも試行
    {
      name: 'HYPE/WETH',
      tokenA: '0x0000000000000000000000000000000000000000', // Native HYPE
      tokenB: '0x4200000000000000000000000000000000000006', // WETH
      decimalsA: 18,
      decimalsB: 18
    }
  ];
  
  // DEX設定
  const dexConfigs = [
    {
      name: 'HyperSwap V2',
      type: 'v2',
      contract: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A',
      abi: './abi/UniV2Router.json'
    },
    {
      name: 'HyperSwap V3',
      type: 'v3',
      contract: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
      abi: './abi/KittenQuoterV2.json'
    },
    {
      name: 'KittenSwap V2',
      type: 'v2',
      contract: '0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802',
      abi: './abi/UniV2Router.json'
    },
    {
      name: 'KittenSwap CL',
      type: 'v3',
      contract: '0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF',
      abi: './abi/KittenQuoterV2.json'
    }
  ];
  
  const results = {
    successful: [],
    failed: [],
    summary: {}
  };
  
  console.log('📊 HYPE/UBTCペアでのレート取得テスト開始...\n');
  
  for (const dex of dexConfigs) {
    console.log(`🔍 ${dex.name} テスト中...`);
    
    for (const pair of tokenPairs) {
      try {
        if (dex.type === 'v2') {
          // V2テスト - 複数の金額で試行
          const testAmounts = ['0.1', '1', '10'];
          
          for (const amountStr of testAmounts) {
            try {
              const amountIn = ethers.utils.parseUnits(amountStr, pair.decimalsA);
              const path = [pair.tokenA, pair.tokenB];
              
              console.log(`   💰 ${amountStr} ${pair.name.split('/')[0]} → ${pair.name.split('/')[1]} テスト中...`);
              
              const result = await utils.callReadFunction({
                abiPath: dex.abi,
                contractAddress: dex.contract,
                functionName: 'getAmountsOut',
                args: [amountIn.toString(), path]
              });
              
              if (result.success && result.result && Array.isArray(result.result)) {
                const amounts = result.result;
                const amountOut = amounts[1];
                const rate = parseFloat(ethers.utils.formatUnits(amountOut, pair.decimalsB)) / 
                           parseFloat(amountStr);
                
                console.log(`   ✅ ${pair.name}: ${amountStr} → ${(parseFloat(ethers.utils.formatUnits(amountOut, pair.decimalsB))).toFixed(6)} (Rate: ${rate.toFixed(6)})`);
                
                results.successful.push({
                  dex: dex.name,
                  pair: pair.name,
                  amountIn: amountStr,
                  amountOut: ethers.utils.formatUnits(amountOut, pair.decimalsB),
                  rate,
                  type: 'v2',
                  tokenA: pair.tokenA,
                  tokenB: pair.tokenB
                });
                
                break; // 成功したら次のペアへ
              } else {
                console.log(`   ⚠️  ${amountStr}: ${result.error?.substring(0, 50)}...`);
              }
            } catch (amountError) {
              console.log(`   ⚠️  ${amountStr}: ${amountError.message.substring(0, 50)}...`);
            }
          }
        } else if (dex.type === 'v3') {
          // V3テスト - 複数手数料ティアと金額で試行
          const fees = [100, 500, 2500, 10000]; // 1bps, 5bps, 25bps, 100bps
          const testAmounts = ['0.1', '1', '10'];
          let hasSuccess = false;
          
          for (const fee of fees) {
            for (const amountStr of testAmounts) {
              try {
                const amountIn = ethers.utils.parseUnits(amountStr, pair.decimalsA);
                
                console.log(`   💰 ${amountStr} ${pair.name.split('/')[0]} → ${pair.name.split('/')[1]} (${fee/100}bps) テスト中...`);
                
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
                  const rate = parseFloat(ethers.utils.formatUnits(amountOut, pair.decimalsB)) / 
                             parseFloat(amountStr);
                  
                  console.log(`   ✅ ${pair.name} (${fee/100}bps): ${amountStr} → ${(parseFloat(ethers.utils.formatUnits(amountOut, pair.decimalsB))).toFixed(6)} (Rate: ${rate.toFixed(6)})`);
                  
                  results.successful.push({
                    dex: dex.name,
                    pair: pair.name,
                    amountIn: amountStr,
                    amountOut: ethers.utils.formatUnits(amountOut, pair.decimalsB),
                    rate,
                    fee,
                    type: 'v3',
                    tokenA: pair.tokenA,
                    tokenB: pair.tokenB
                  });
                  
                  hasSuccess = true;
                  break; // 成功したら次のフィーティアへ
                } else {
                  console.log(`   ⚠️  ${amountStr} (${fee/100}bps): プールなし`);
                }
              } catch (feeError) {
                console.log(`   ⚠️  ${amountStr} (${fee/100}bps): ${feeError.message.substring(0, 30)}...`);
              }
            }
            if (hasSuccess) break; // 成功したら次のペアへ
          }
          
          if (!hasSuccess) {
            results.failed.push({
              dex: dex.name,
              pair: pair.name,
              type: 'v3',
              error: 'All fee tiers and amounts failed'
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
  console.log('📋 HYPE/UBTCテスト結果サマリー');
  console.log('===============================');
  console.log(`成功したレート取得: ${results.successful.length}`);
  console.log(`失敗したテスト: ${results.failed.length}`);
  console.log(`全体的な結果: ${results.successful.length > 0 ? '成功' : '失敗'}`);
  
  if (results.successful.length > 0) {
    console.log('\n✅ 成功したレート:');
    results.successful.forEach(r => {
      const feeInfo = r.fee ? ` (${r.fee/100}bps)` : '';
      console.log(`   ${r.dex}${feeInfo}: ${r.amountIn} ${r.pair.split('/')[0]} = ${parseFloat(r.amountOut).toFixed(6)} ${r.pair.split('/')[1]} (Rate: ${r.rate.toFixed(6)})`);
      console.log(`      Token A: ${r.tokenA}`);
      console.log(`      Token B: ${r.tokenB}`);
    });
  }
  
  if (results.failed.length > 0 && results.successful.length === 0) {
    console.log('\n❌ 主な失敗理由:');
    const uniqueErrors = [...new Set(results.failed.map(f => f.error?.substring(0, 100)))];
    uniqueErrors.slice(0, 3).forEach(error => {
      console.log(`   - ${error}...`);
    });
  }
  
  if (results.successful.length === 0) {
    console.log('\n💡 推奨アクション:');
    console.log('   1. HyperEVMエクスプローラーで実際のトークンアドレスを確認');
    console.log('   2. 流動性があるペアを特定');
    console.log('   3. 正確なトークンアドレスでテスト再実行');
  } else {
    console.log('\n🎯 監視ツール準備完了！');
    console.log('   実際の監視を開始できます：');
    console.log('   node custom/monitoring/dex-rate-monitor.ts --monitor');
  }
  
  return results;
}

// テスト実行
if (require.main === module) {
  testHypeUbtcPair()
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

module.exports = { testHypeUbtcPair };