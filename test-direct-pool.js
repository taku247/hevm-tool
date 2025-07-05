const { UniversalContractUtils } = require('./dist/templates/contract-utils');
const { ethers } = require('ethers');

/**
 * 直接プールからのレート取得テスト
 */
async function testDirectPool() {
  console.log('🧪 HYPE/UBTCプール直接アクセステスト\n');
  
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  const utils = new UniversalContractUtils(rpcUrl);
  
  // 確定情報
  const POOL_ADDRESS = '0x3a36b04bcc1d5e2e303981ef643d2668e00b43e7';
  const HYPE = '0x0000000000000000000000000000000000000000'; // Native
  const UBTC = '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463';
  
  console.log('📍 確認対象:');
  console.log(`   プールアドレス: ${POOL_ADDRESS}`);
  console.log(`   HYPE (Native): ${HYPE}`);
  console.log(`   UBTC: ${UBTC}\n`);
  
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const results = { successful: [], failed: [] };
  
  // 1. プールコントラクト存在確認
  console.log('🔍 1. プールコントラクト確認:');
  try {
    const code = await provider.getCode(POOL_ADDRESS);
    if (code && code !== '0x') {
      console.log(`   ✅ プール存在確認: ${(code.length - 2) / 2} bytes\n`);
    } else {
      console.log('   ❌ プールコントラクトが存在しません\n');
      return { success: false, error: 'Pool contract not found' };
    }
  } catch (error) {
    console.log(`   ❌ プール確認エラー: ${error.message}\n`);
    return { success: false, error: error.message };
  }
  
  // 2. V2プールとしてテスト（getReserves）
  console.log('💧 2. V2プール情報取得テスト:');
  try {
    // V2ペアのgetReserves関数を試行
    const v2PairABI = [
      {
        "name": "getReserves",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [
          { "name": "reserve0", "type": "uint112" },
          { "name": "reserve1", "type": "uint112" },
          { "name": "blockTimestampLast", "type": "uint32" }
        ]
      },
      {
        "name": "token0",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{ "name": "", "type": "address" }]
      },
      {
        "name": "token1", 
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{ "name": "", "type": "address" }]
      }
    ];
    
    // 一時的にABIファイル作成
    require('fs').writeFileSync('./abi/V2Pair.json', JSON.stringify(v2PairABI, null, 2));
    
    // token0とtoken1を取得
    const token0Result = await utils.callReadFunction({
      abiPath: './abi/V2Pair.json',
      contractAddress: POOL_ADDRESS,
      functionName: 'token0',
      args: []
    });
    
    const token1Result = await utils.callReadFunction({
      abiPath: './abi/V2Pair.json',
      contractAddress: POOL_ADDRESS,
      functionName: 'token1',
      args: []
    });
    
    if (token0Result.success && token1Result.success) {
      console.log(`   ✅ Token0: ${token0Result.result}`);
      console.log(`   ✅ Token1: ${token1Result.result}`);
      
      // getReservesを呼び出し
      const reservesResult = await utils.callReadFunction({
        abiPath: './abi/V2Pair.json',
        contractAddress: POOL_ADDRESS,
        functionName: 'getReserves',
        args: []
      });
      
      if (reservesResult.success) {
        const reserves = reservesResult.result;
        const reserve0 = reserves[0];
        const reserve1 = reserves[1];
        const timestamp = reserves[2];
        
        console.log(`   ✅ Reserve0: ${reserve0.toString()}`);
        console.log(`   ✅ Reserve1: ${reserve1.toString()}`);
        console.log(`   ✅ Timestamp: ${timestamp.toString()}`);
        
        // レート計算
        const token0Addr = token0Result.result.toLowerCase();
        const token1Addr = token1Result.result.toLowerCase();
        
        let hypeReserve, ubtcReserve;
        let hypeDecimals = 18, ubtcDecimals = 8;
        
        if (token0Addr === HYPE.toLowerCase()) {
          hypeReserve = reserve0;
          ubtcReserve = reserve1;
        } else if (token1Addr === HYPE.toLowerCase()) {
          hypeReserve = reserve1;
          ubtcReserve = reserve0;
        } else if (token0Addr === UBTC.toLowerCase()) {
          ubtcReserve = reserve0;
          hypeReserve = reserve1;
        } else if (token1Addr === UBTC.toLowerCase()) {
          ubtcReserve = reserve1;
          hypeReserve = reserve0;
        } else {
          console.log('   ⚠️  トークンアドレスが想定と異なります');
          console.log(`      Token0: ${token0Addr}`);
          console.log(`      Token1: ${token1Addr}`);
          console.log(`      Expected HYPE: ${HYPE.toLowerCase()}`);
          console.log(`      Expected UBTC: ${UBTC.toLowerCase()}`);
        }
        
        if (hypeReserve && ubtcReserve) {
          // 1 HYPE = ? UBTC
          const hypeAmount = ethers.utils.formatUnits(hypeReserve, hypeDecimals);
          const ubtcAmount = ethers.utils.formatUnits(ubtcReserve, ubtcDecimals);
          const hypeToUbtcRate = parseFloat(ubtcAmount) / parseFloat(hypeAmount);
          
          // 1 UBTC = ? HYPE  
          const ubtcToHypeRate = parseFloat(hypeAmount) / parseFloat(ubtcAmount);
          
          console.log(`\n   💰 流動性情報:`);
          console.log(`      HYPE流動性: ${parseFloat(hypeAmount).toLocaleString()} HYPE`);
          console.log(`      UBTC流動性: ${parseFloat(ubtcAmount).toLocaleString()} UBTC`);
          console.log(`\n   📊 現在レート:`);
          console.log(`      1 HYPE = ${hypeToUbtcRate.toFixed(8)} UBTC`);
          console.log(`      1 UBTC = ${ubtcToHypeRate.toFixed(2)} HYPE`);
          
          results.successful.push({
            pool: POOL_ADDRESS,
            token0: token0Result.result,
            token1: token1Result.result,
            reserve0: reserve0.toString(),
            reserve1: reserve1.toString(),
            hypeToUbtcRate,
            ubtcToHypeRate,
            hypeAmount,
            ubtcAmount
          });
        }
        
      } else {
        console.log(`   ❌ Reserves取得失敗: ${reservesResult.error}`);
      }
    } else {
      console.log('   ❌ トークンアドレス取得失敗');
    }
    
  } catch (error) {
    console.log(`   ❌ V2プールテストエラー: ${error.message}`);
    results.failed.push({ type: 'v2', error: error.message });
  }
  
  // 3. DEXルーター経由でのレート取得テスト
  console.log('\n🔄 3. DEXルーター経由レート取得テスト:');
  const testAmounts = ['0.1', '1', '10'];
  
  for (const amountStr of testAmounts) {
    try {
      const amountIn = ethers.utils.parseEther(amountStr);
      const path = [HYPE, UBTC];
      
      const result = await utils.callReadFunction({
        abiPath: './abi/UniV2Router.json',
        contractAddress: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A', // HyperSwap V2
        functionName: 'getAmountsOut',
        args: [amountIn.toString(), path]
      });
      
      if (result.success && result.result) {
        const amounts = result.result;
        const amountOut = amounts[1];
        const ubtcOut = ethers.utils.formatUnits(amountOut, 8);
        const rate = parseFloat(ubtcOut) / parseFloat(amountStr);
        
        console.log(`   ✅ ${amountStr} HYPE → ${parseFloat(ubtcOut).toFixed(8)} UBTC (Rate: ${rate.toFixed(8)})`);
        
        results.successful.push({
          type: 'router',
          dex: 'HyperSwap V2',
          amountIn: amountStr,
          amountOut: ubtcOut,
          rate
        });
        
        break; // 成功したら終了
      } else {
        console.log(`   ⚠️  ${amountStr} HYPE: ${result.error?.substring(0, 50)}...`);
      }
    } catch (error) {
      console.log(`   ❌ ${amountStr} HYPE: ${error.message.substring(0, 50)}...`);
    }
  }
  
  // 4. リアルタイム監視用設定表示
  if (results.successful.length > 0) {
    console.log('\n🎯 リアルタイム監視設定:');
    console.log('   以下の設定で監視ツールを起動できます:');
    console.log('   ');
    console.log('   ```bash');
    console.log('   node custom/monitoring/dex-rate-monitor.js \\');
    console.log('     --pool 0x3a36b04bcc1d5e2e303981ef643d2668e00b43e7 \\');
    console.log('     --tokenA 0x0000000000000000000000000000000000000000 \\');
    console.log('     --tokenB 0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463 \\');
    console.log('     --monitor');
    console.log('   ```');
  }
  
  // 結果サマリー
  console.log('\n📋 テスト結果サマリー:');
  console.log(`   成功: ${results.successful.length}`);
  console.log(`   失敗: ${results.failed.length}`);
  console.log(`   結果: ${results.successful.length > 0 ? '✅ プール動作確認済み!' : '❌ プール接続失敗'}`);
  
  return {
    success: results.successful.length > 0,
    poolAddress: POOL_ADDRESS,
    results
  };
}

// テスト実行
if (require.main === module) {
  testDirectPool()
    .then(result => {
      console.log('\n🎯 最終結果:', {
        success: result.success,
        poolFound: !!result.poolAddress,
        dataPoints: result.results?.successful?.length || 0
      });
    })
    .catch(error => {
      console.error('❌ テスト実行エラー:', error);
    });
}

module.exports = { testDirectPool };