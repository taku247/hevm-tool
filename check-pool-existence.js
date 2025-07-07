const { ethers } = require("ethers");
require('dotenv').config();

const provider = new ethers.providers.JsonRpcProvider(
    "https://rpc.hyperliquid-testnet.xyz/evm"
);

// コントラクトアドレス
const FACTORY_V3 = "0x03A918028f22D9E1473B7959C927AD7425A45C7C";
const WETH_ADDRESS = "0xADcb2f358Eae6492F61A5f87eb8893d09391d160";
const PURR_ADDRESS = "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82";

// UniswapV3Factory ABI（getPool関数のみ）
const factoryABI = require('./node_modules/@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json').abi;

async function checkPoolExistence() {
    console.log("🔍 プール存在確認テスト\n");
    
    const factory = new ethers.Contract(FACTORY_V3, factoryABI, provider);
    
    // テストする手数料レベル
    const feeOptions = [
        { fee: 100, name: "0.01%" },
        { fee: 500, name: "0.05%" },
        { fee: 3000, name: "0.3%" },
        { fee: 10000, name: "1%" }
    ];
    
    console.log("📊 WETH/PURR ペアのプール存在確認:");
    console.log(`   WETH: ${WETH_ADDRESS}`);
    console.log(`   PURR: ${PURR_ADDRESS}\n`);
    
    let existingPools = [];
    
    for (const feeOption of feeOptions) {
        try {
            console.log(`   ${feeOption.name} (${feeOption.fee}): テスト中...`);
            const poolAddress = await factory.getPool(WETH_ADDRESS, PURR_ADDRESS, feeOption.fee);
            
            if (poolAddress === ethers.constants.AddressZero) {
                console.log(`   ${feeOption.name} (${feeOption.fee}): ❌ プールなし`);
            } else {
                console.log(`   ${feeOption.name} (${feeOption.fee}): ✅ プール存在 (${poolAddress})`);
                existingPools.push({
                    fee: feeOption.fee,
                    name: feeOption.name,
                    address: poolAddress
                });
                
                // プールの詳細情報を取得
                try {
                    const poolCode = await provider.getCode(poolAddress);
                    console.log(`     - バイトコードサイズ: ${poolCode.length / 2 - 1} bytes`);
                } catch (error) {
                    console.log(`     - バイトコード取得エラー: ${error.message}`);
                }
            }
        } catch (error) {
            console.log(`   ${feeOption.name} (${feeOption.fee}): ❌ エラー: ${error.message}`);
        }
    }
    
    console.log(`\n📋 結果サマリー:`);
    if (existingPools.length === 0) {
        console.log("   ❌ 利用可能なプールが見つかりません");
        console.log("   💡 他の手数料レベルを試すか、異なるトークンペアを検討してください");
    } else {
        console.log(`   ✅ ${existingPools.length}個のプールが利用可能:`);
        existingPools.forEach(pool => {
            console.log(`     - ${pool.name}: ${pool.address}`);
        });
        console.log(`\n   💡 推奨: 最初の利用可能プール ${existingPools[0].name} (fee: ${existingPools[0].fee}) を使用`);
    }
    
    // 逆順も確認（tokenAとtokenBの順序）
    console.log(`\n🔄 逆順確認 (PURR/WETH):`);
    for (const feeOption of feeOptions) {
        try {
            const poolAddress = await factory.getPool(PURR_ADDRESS, WETH_ADDRESS, feeOption.fee);
            
            if (poolAddress !== ethers.constants.AddressZero) {
                console.log(`   ${feeOption.name} (${feeOption.fee}): ✅ プール存在 (${poolAddress})`);
            }
        } catch (error) {
            // 逆順のエラーは無視
        }
    }
    
    return existingPools;
}

if (require.main === module) {
    checkPoolExistence().catch(console.error);
}

module.exports = { checkPoolExistence };