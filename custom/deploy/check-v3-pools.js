const { ethers } = require('ethers');
require('dotenv').config({ path: '../../.env' });

/**
 * V3プールの存在確認
 */

async function checkV3Pools() {
  console.log('🔍 HyperSwap V3プール存在確認');
  console.log('===============================\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Token addresses
    const WETH = '0xADcb2f358Eae6492F61A5F87eb8893d09391d160';
    const PURR = '0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82';
    const HFUN = '0x37adB2550b965851593832a6444763eeB3e1d1Ec';

    // HyperSwap V3 Factory (推定アドレス - 実際は異なる可能性)
    const V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984'; // 標準Uniswap V3 Factory

    console.log('📋 確認対象:');
    console.log(`   WETH: ${WETH}`);
    console.log(`   PURR: ${PURR}`);
    console.log(`   HFUN: ${HFUN}`);
    console.log('');

    // V3 Factory ABI (getPool関数のみ)
    const factoryAbi = [
      "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
    ];

    try {
      const factory = new ethers.Contract(V3_FACTORY, factoryAbi, provider);

      // 1. WETH/PURR プール確認
      console.log('🔍 1. WETH/PURR V3プール確認:');
      
      const wethPurrPool500 = await factory.getPool(WETH, PURR, 500);
      const wethPurrPool3000 = await factory.getPool(WETH, PURR, 3000);
      const wethPurrPool10000 = await factory.getPool(WETH, PURR, 10000);
      
      console.log(`   Fee 500 (0.05%): ${wethPurrPool500}`);
      console.log(`   Fee 3000 (0.3%): ${wethPurrPool3000}`);
      console.log(`   Fee 10000 (1%): ${wethPurrPool10000}`);
      
      const wethPurrExists = wethPurrPool500 !== ethers.ZeroAddress || 
                            wethPurrPool3000 !== ethers.ZeroAddress || 
                            wethPurrPool10000 !== ethers.ZeroAddress;
      
      console.log(`   存在: ${wethPurrExists ? '✅' : '❌'}`);
      console.log('');

      // 2. PURR/HFUN プール確認
      console.log('🔍 2. PURR/HFUN V3プール確認:');
      
      const purrHfunPool500 = await factory.getPool(PURR, HFUN, 500);
      const purrHfunPool3000 = await factory.getPool(PURR, HFUN, 3000);
      const purrHfunPool10000 = await factory.getPool(PURR, HFUN, 10000);
      
      console.log(`   Fee 500 (0.05%): ${purrHfunPool500}`);
      console.log(`   Fee 3000 (0.3%): ${purrHfunPool3000}`);
      console.log(`   Fee 10000 (1%): ${purrHfunPool10000}`);
      
      const purrHfunExists = purrHfunPool500 !== ethers.ZeroAddress || 
                            purrHfunPool3000 !== ethers.ZeroAddress || 
                            purrHfunPool10000 !== ethers.ZeroAddress;
      
      console.log(`   存在: ${purrHfunExists ? '✅' : '❌'}`);
      console.log('');

      // 3. 代替ルート確認: WETH/HFUN 直接
      console.log('🔍 3. WETH/HFUN V3プール確認（代替ルート）:');
      
      const wethHfunPool500 = await factory.getPool(WETH, HFUN, 500);
      const wethHfunPool3000 = await factory.getPool(WETH, HFUN, 3000);
      const wethHfunPool10000 = await factory.getPool(WETH, HFUN, 10000);
      
      console.log(`   Fee 500 (0.05%): ${wethHfunPool500}`);
      console.log(`   Fee 3000 (0.3%): ${wethHfunPool3000}`);
      console.log(`   Fee 10000 (1%): ${wethHfunPool10000}`);
      
      const wethHfunExists = wethHfunPool500 !== ethers.ZeroAddress || 
                            wethHfunPool3000 !== ethers.ZeroAddress || 
                            wethHfunPool10000 !== ethers.ZeroAddress;
      
      console.log(`   存在: ${wethHfunExists ? '✅' : '❌'}`);
      console.log('');

      // 結論
      console.log('🎯 分析結果:');
      
      if (!purrHfunExists) {
        console.log('   ❌ PURR/HFUN V3プールが存在しない');
        console.log('   💡 これがマルチスワップ失敗の根本原因');
        console.log('   💡 V2でも同様の問題の可能性');
        
        if (wethHfunExists) {
          console.log('\n   ✅ 代替案: WETH→HFUNの直接スワップは可能');
          console.log('   💡 WETH→PURR→HFUNではなく、別のルートを検討');
        }
      } else {
        console.log('   ✅ PURR/HFUN V3プール存在');
        console.log('   💡 プール流動性不足または手数料設定問題');
      }

    } catch (factoryError) {
      console.log('❌ V3 Factory接続失敗（Factoryアドレス不正の可能性）');
      console.log(`   エラー: ${factoryError.message}`);
      console.log('\n💡 HyperSwap独自のFactoryアドレスを確認する必要あり');
    }

  } catch (error) {
    console.error('❌ プール確認中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  checkV3Pools()
    .then(() => {
      console.log('\n🔍 V3プール確認完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { checkV3Pools };