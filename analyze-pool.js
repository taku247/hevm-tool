const { UniversalContractUtils } = require('./dist/templates/contract-utils');
const { ethers } = require('ethers');

/**
 * プール詳細分析
 */
async function analyzePool() {
  console.log('🔬 HYPE/UBTCプール詳細分析\n');
  
  const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
  const utils = new UniversalContractUtils(rpcUrl);
  
  const POOL_ADDRESS = '0x3a36b04bcc1d5e2e303981ef643d2668e00b43e7';
  const UBTC = '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463';
  
  console.log(`📍 分析対象プール: ${POOL_ADDRESS}\n`);
  
  // 複数のABIパターンでテスト
  const abiPatterns = [
    {
      name: 'V2ペア',
      functions: [
        { name: 'token0', abi: [{"name": "token0", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "address"}]}] },
        { name: 'token1', abi: [{"name": "token1", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "address"}]}] },
        { name: 'getReserves', abi: [{"name": "getReserves", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "reserve0", "type": "uint112"}, {"name": "reserve1", "type": "uint112"}, {"name": "blockTimestampLast", "type": "uint32"}]}] }
      ]
    },
    {
      name: 'V3プール',
      functions: [
        { name: 'token0', abi: [{"name": "token0", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "address"}]}] },
        { name: 'token1', abi: [{"name": "token1", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "address"}]}] },
        { name: 'fee', abi: [{"name": "fee", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "uint24"}]}] },
        { name: 'slot0', abi: [{"name": "slot0", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "sqrtPriceX96", "type": "uint160"}, {"name": "tick", "type": "int24"}, {"name": "observationIndex", "type": "uint16"}, {"name": "observationCardinality", "type": "uint16"}, {"name": "observationCardinalityNext", "type": "uint16"}, {"name": "feeProtocol", "type": "uint8"}, {"name": "unlocked", "type": "bool"}]}] }
      ]
    }
  ];
  
  for (const pattern of abiPatterns) {
    console.log(`🧪 ${pattern.name}として分析:`);
    
    const results = {};
    
    for (const func of pattern.functions) {
      try {
        // 一時的にABIファイル作成
        const abiPath = `./abi/temp_${func.name}.json`;
        require('fs').writeFileSync(abiPath, JSON.stringify(func.abi, null, 2));
        
        const result = await utils.callReadFunction({
          abiPath,
          contractAddress: POOL_ADDRESS,
          functionName: func.name,
          args: []
        });
        
        if (result.success) {
          console.log(`   ✅ ${func.name}: ${result.result}`);
          results[func.name] = result.result;
        } else {
          console.log(`   ❌ ${func.name}: ${result.error?.substring(0, 50)}...`);
        }
        
        // 一時ファイル削除
        require('fs').unlinkSync(abiPath);
        
      } catch (error) {
        console.log(`   ❌ ${func.name}: ${error.message.substring(0, 50)}...`);
      }
    }
    
    // 結果分析
    if (results.token0 && results.token1) {
      console.log(`\n   📊 トークン情報:`);
      console.log(`      Token0: ${results.token0}`);
      console.log(`      Token1: ${results.token1}`);
      
      // トークンアドレス確認
      const token0Lower = results.token0.toLowerCase();
      const token1Lower = results.token1.toLowerCase();
      const ubtcLower = UBTC.toLowerCase();
      
      if (token0Lower === ubtcLower || token1Lower === ubtcLower) {
        console.log(`   ✅ UBTCトークン確認済み`);
        
        // Token0が0x555...の場合はWETHかもしれない
        if (token0Lower.startsWith('0x555')) {
          console.log(`   💡 Token0 (${results.token0}) はWETHの可能性があります`);
          
          // WETHとUBTCペアとして分析
          console.log(`\n   🔄 WETH/UBTCペアとして再分析:`);
          
          if (pattern.name === 'V2ペア' && results.getReserves) {
            try {
              // getReservesを再試行
              const reservesABI = [{"name": "getReserves", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"name": "reserve0", "type": "uint112"}, {"name": "reserve1", "type": "uint112"}, {"name": "blockTimestampLast", "type": "uint32"}]}];
              require('fs').writeFileSync('./abi/temp_reserves.json', JSON.stringify(reservesABI, null, 2));
              
              const reservesResult = await utils.callReadFunction({
                abiPath: './abi/temp_reserves.json',
                contractAddress: POOL_ADDRESS,
                functionName: 'getReserves',
                args: []
              });
              
              require('fs').unlinkSync('./abi/temp_reserves.json');
              
              if (reservesResult.success) {
                const reserves = reservesResult.result;
                console.log(`      Reserve0: ${reserves[0].toString()}`);
                console.log(`      Reserve1: ${reserves[1].toString()}`);
                
                // レート計算
                const reserve0 = ethers.BigNumber.from(reserves[0]);
                const reserve1 = ethers.BigNumber.from(reserves[1]);
                
                if (!reserve0.isZero() && !reserve1.isZero()) {
                  // WETH(18 decimals) / UBTC(8 decimals)と仮定
                  const wethAmount = ethers.utils.formatEther(reserve0);
                  const ubtcAmount = ethers.utils.formatUnits(reserve1, 8);
                  
                  const wethToUbtcRate = parseFloat(ubtcAmount) / parseFloat(wethAmount);
                  const ubtcToWethRate = parseFloat(wethAmount) / parseFloat(ubtcAmount);
                  
                  console.log(`\n      💰 流動性:`);
                  console.log(`         WETH: ${parseFloat(wethAmount).toLocaleString()}`);
                  console.log(`         UBTC: ${parseFloat(ubtcAmount).toLocaleString()}`);
                  console.log(`\n      📊 レート:`);
                  console.log(`         1 WETH = ${wethToUbtcRate.toFixed(8)} UBTC`);
                  console.log(`         1 UBTC = ${ubtcToWethRate.toFixed(6)} WETH`);
                  
                  // ルーター経由でのテスト（WETHアドレスを使用）
                  console.log(`\n      🔄 ルーター経由テスト:`);
                  await testRouterWithTokens(utils, results.token0, results.token1);
                }
              }
            } catch (error) {
              console.log(`      ❌ Reserves分析エラー: ${error.message}`);
            }
          }
        }
      } else {
        console.log(`   ⚠️  UBTCトークンが見つかりません`);
      }
      
      if (results.fee) {
        console.log(`   📈 手数料ティア: ${results.fee/100}bps`);
      }
      
      if (results.slot0) {
        console.log(`   🎯 V3プール確認済み`);
      }
    }
    
    console.log('');
  }
  
  // 直接スワップテスト
  console.log('🚀 直接スワップシミュレーション:');
  await testDirectSwap(utils, POOL_ADDRESS);
}

async function testRouterWithTokens(utils, token0, token1) {
  const testAmounts = ['0.01', '0.1'];
  
  for (const amountStr of testAmounts) {
    try {
      const amountIn = ethers.utils.parseEther(amountStr);
      const path = [token0, token1];
      
      const result = await utils.callReadFunction({
        abiPath: './abi/UniV2Router.json',
        contractAddress: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A',
        functionName: 'getAmountsOut',
        args: [amountIn.toString(), path]
      });
      
      if (result.success) {
        const amounts = result.result;
        const amountOut = amounts[1];
        console.log(`         ✅ ${amountStr} → ${ethers.utils.formatUnits(amountOut, 8)} (V2ルーター)`);
        return true;
      }
    } catch (error) {
      console.log(`         ❌ ${amountStr}: ${error.message.substring(0, 30)}...`);
    }
  }
  return false;
}

async function testDirectSwap(utils, poolAddress) {
  // より小さい金額でテスト
  const testAmounts = ['1000000000000000', '100000000000000000']; // 0.001, 0.1 ETH in wei
  
  for (const amount of testAmounts) {
    try {
      const amountETH = ethers.utils.formatEther(amount);
      console.log(`   ${amountETH} ETH相当でのテスト...`);
      
      // getAmountsOut with smaller amount
      const result = await utils.callReadFunction({
        abiPath: './abi/UniV2Router.json',
        contractAddress: '0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A',
        functionName: 'getAmountsOut',
        args: [amount, ['0x5555555555555555555555555555555555555555', '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463']]
      });
      
      if (result.success) {
        console.log(`   ✅ ${amountETH} でスワップ成功`);
        return;
      } else {
        console.log(`   ⚠️  ${amountETH}: ${result.error?.substring(0, 40)}...`);
      }
    } catch (error) {
      console.log(`   ❌ ${ethers.utils.formatEther(amount)}: ${error.message.substring(0, 40)}...`);
    }
  }
}

// 実行
if (require.main === module) {
  analyzePool()
    .catch(error => {
      console.error('❌ 分析エラー:', error);
    });
}

module.exports = { analyzePool };