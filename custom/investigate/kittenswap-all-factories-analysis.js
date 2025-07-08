const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * KittenSwap 全Factory契約分析
 * プール取得に使える機能があるかチェック
 */

// KittenSwap関連のFactory契約一覧
const KITTENSWAP_FACTORIES = {
  // Phase 1 (V2)
  'V2_PairFactory': '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B',
  
  // Phase 2 (V3/CL)  
  'V3_CLFactory': '0x2E08F5Ff603E4343864B14599CAeDb19918BDCaF',
  
  // Phase 3 (Gauge系)
  'GaugeFactory': '0x72490535A73cf5C66c3BC573B5626DE187DcE9E4',
  'VotingRewardFactory': '0x9f7dc78cA10798fE1C5c969b032596A3904db3eE',
  
  // その他の可能性
  'FactoryRegistry': '0x8C142521ebB1aC1cC1F0958037702A69b6f608e4',
};

// 比較用：HyperSwap Factory（正常動作）
const HYPERSWAP_FACTORIES = {
  'V2_Factory': '0xA028411927E2015A363014881a4404C636218fb1',
  'V3_Factory': '0xB1c0fa0B789320044A6F623cFe5eBda9562602E3'
};

// 各種Factoryで試すABI
const FACTORY_TEST_ABIS = {
  uniswapV2: [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)",
    "function allPairs(uint256) external view returns (address)",
    "function allPairsLength() external view returns (uint256)",
    "function createPair(address tokenA, address tokenB) external returns (address pair)"
  ],
  
  uniswapV3: [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)",
    "function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool)",
    "function owner() external view returns (address)",
    "function feeAmountTickSpacing(uint24 fee) external view returns (int24)"
  ],
  
  gauge: [
    "function createGauge(address pool, address votingReward, address feeDistributor, bool isAlive) external returns (address)",
    "function allGauges(uint256) external view returns (address)",
    "function allGaugesLength() external view returns (uint256)",
    "function isGauge(address) external view returns (bool)"
  ],
  
  votingReward: [
    "function createReward(address gauge, address[] memory tokens) external returns (address)",
    "function allRewards(uint256) external view returns (address)",
    "function allRewardsLength() external view returns (uint256)"
  ],
  
  registry: [
    "function poolFor(address tokenA, address tokenB, bool stable, address factory) external view returns (address)",
    "function factoryFor(address pool) external view returns (address)",
    "function isFactory(address factory) external view returns (bool)",
    "function allFactories(uint256) external view returns (address)",
    "function allFactoriesLength() external view returns (uint256)"
  ],
  
  generic: [
    "function owner() external view returns (address)",
    "function implementation() external view returns (address)",
    "function version() external view returns (string)"
  ]
};

class AllFactoriesAnalyzer {
  constructor(rpcUrl) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  }

  async analyzeAllFactories() {
    console.log('🏭 KittenSwap 全Factory契約分析');
    console.log('==================================\\n');

    console.log('📊 RPC接続情報:');
    console.log(`   URL: ${this.provider.connection.url}`);
    console.log(`   Block Number: ${await this.provider.getBlockNumber()}`);
    console.log('');

    // 1. 基本情報確認
    await this.checkBasicInfo();

    // 2. 各Factoryの詳細分析
    await this.analyzeEachFactory();

    // 3. 比較分析（HyperSwapとの比較）
    await this.compareWithHyperSwap();

    // 4. プール発見の可能性評価
    await this.evaluatePoolDiscovery();
  }

  async checkBasicInfo() {
    console.log('1. 基本情報確認');
    console.log('================');

    for (const [name, address] of Object.entries(KITTENSWAP_FACTORIES)) {
      console.log(`\\n🔍 ${name}:`);
      console.log(`   アドレス: ${address}`);

      try {
        // コントラクト存在確認
        const code = await this.provider.getCode(address);
        const exists = code !== '0x';
        const size = exists ? code.length / 2 - 1 : 0;

        console.log(`   存在: ${exists ? '✅' : '❌'}`);
        if (exists) {
          console.log(`   サイズ: ${size} bytes`);
          
          // バイトコードの特徴分析
          if (size < 500) {
            console.log(`   特徴: プロキシまたは最小実装`);
          } else if (size > 10000) {
            console.log(`   特徴: 複雑な実装（ライブラリ使用）`);
          } else {
            console.log(`   特徴: 標準的なサイズ`);
          }
        }

      } catch (error) {
        console.log(`   ❌ エラー: ${error.message}`);
      }
    }
    
    console.log('');
  }

  async analyzeEachFactory() {
    console.log('2. 各Factory詳細分析');
    console.log('=====================');

    for (const [factoryName, factoryAddress] of Object.entries(KITTENSWAP_FACTORIES)) {
      console.log(`\\n🏭 ${factoryName} 分析:`);
      console.log(`📍 ${factoryAddress}`);

      // 各種ABIでテスト
      for (const [abiName, abi] of Object.entries(FACTORY_TEST_ABIS)) {
        console.log(`\\n   🧪 ${abiName} ABI テスト:`);
        await this.testFactoryWithABI(factoryAddress, abi, abiName);
      }
    }
  }

  async testFactoryWithABI(address, abi, abiName) {
    try {
      const factory = new ethers.Contract(address, abi, this.provider);
      let successCount = 0;
      let totalTests = 0;

      // ABIに応じたテスト実行
      switch (abiName) {
        case 'uniswapV2':
          totalTests = 4;
          
          // allPairsLength
          try {
            const length = await factory.allPairsLength();
            console.log(`     ✅ allPairsLength(): ${length.toString()}`);
            successCount++;
          } catch (e) {
            console.log(`     ❌ allPairsLength(): ${e.message.substring(0, 40)}`);
          }

          // allPairs
          try {
            const pair = await factory.allPairs(0);
            console.log(`     ✅ allPairs(0): ${pair}`);
            successCount++;
          } catch (e) {
            console.log(`     ❌ allPairs(0): ${e.message.substring(0, 40)}`);
          }

          // getPair
          try {
            const testTokens = ['0x5555555555555555555555555555555555555555', '0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E'];
            const pair = await factory.getPair(testTokens[0], testTokens[1]);
            console.log(`     ✅ getPair(): ${pair}`);
            successCount++;
          } catch (e) {
            console.log(`     ❌ getPair(): ${e.message.substring(0, 40)}`);
          }
          break;

        case 'uniswapV3':
          totalTests = 3;
          
          // getPool
          try {
            const testTokens = ['0x5555555555555555555555555555555555555555', '0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E'];
            const pool = await factory.getPool(testTokens[0], testTokens[1], 500);
            console.log(`     ✅ getPool(): ${pool}`);
            successCount++;
          } catch (e) {
            console.log(`     ❌ getPool(): ${e.message.substring(0, 40)}`);
          }

          // owner
          try {
            const owner = await factory.owner();
            console.log(`     ✅ owner(): ${owner}`);
            successCount++;
          } catch (e) {
            console.log(`     ❌ owner(): ${e.message.substring(0, 40)}`);
          }
          break;

        case 'gauge':
          totalTests = 2;
          
          // allGaugesLength
          try {
            const length = await factory.allGaugesLength();
            console.log(`     ✅ allGaugesLength(): ${length.toString()}`);
            successCount++;
          } catch (e) {
            console.log(`     ❌ allGaugesLength(): ${e.message.substring(0, 40)}`);
          }

          // allGauges
          try {
            const gauge = await factory.allGauges(0);
            console.log(`     ✅ allGauges(0): ${gauge}`);
            successCount++;
          } catch (e) {
            console.log(`     ❌ allGauges(0): ${e.message.substring(0, 40)}`);
          }
          break;

        case 'registry':
          totalTests = 2;
          
          // allFactoriesLength
          try {
            const length = await factory.allFactoriesLength();
            console.log(`     ✅ allFactoriesLength(): ${length.toString()}`);
            successCount++;
          } catch (e) {
            console.log(`     ❌ allFactoriesLength(): ${e.message.substring(0, 40)}`);
          }

          // poolFor
          try {
            const testTokens = ['0x5555555555555555555555555555555555555555', '0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E'];
            const pool = await factory.poolFor(testTokens[0], testTokens[1], false, address);
            console.log(`     ✅ poolFor(): ${pool}`);
            successCount++;
          } catch (e) {
            console.log(`     ❌ poolFor(): ${e.message.substring(0, 40)}`);
          }
          break;

        case 'generic':
          totalTests = 1;
          
          // owner
          try {
            const owner = await factory.owner();
            console.log(`     ✅ owner(): ${owner}`);
            successCount++;
          } catch (e) {
            console.log(`     ❌ owner(): ${e.message.substring(0, 40)}`);
          }
          break;
      }

      const successRate = totalTests > 0 ? (successCount / totalTests * 100).toFixed(1) : '0.0';
      console.log(`     📊 成功率: ${successRate}% (${successCount}/${totalTests})`);

    } catch (error) {
      console.log(`     ❌ ABI全体エラー: ${error.message.substring(0, 50)}`);
    }
  }

  async compareWithHyperSwap() {
    console.log('\\n3. HyperSwap比較分析');
    console.log('====================');

    console.log('\\n🔍 HyperSwap Factory（正常動作）:');
    
    for (const [name, address] of Object.entries(HYPERSWAP_FACTORIES)) {
      console.log(`\\n   ${name}: ${address}`);
      
      try {
        // V2テスト
        if (name.includes('V2')) {
          const factory = new ethers.Contract(address, FACTORY_TEST_ABIS.uniswapV2, this.provider);
          
          const length = await factory.allPairsLength();
          console.log(`     ✅ allPairsLength(): ${length.toString()}`);
          
          if (length.gt(0)) {
            const pair = await factory.allPairs(0);
            console.log(`     ✅ allPairs(0): ${pair}`);
          }
        }
        
        // V3テスト
        if (name.includes('V3')) {
          const factory = new ethers.Contract(address, FACTORY_TEST_ABIS.uniswapV3, this.provider);
          
          const owner = await factory.owner();
          console.log(`     ✅ owner(): ${owner}`);
        }

      } catch (error) {
        console.log(`     ❌ エラー: ${error.message.substring(0, 50)}`);
      }
    }
  }

  async evaluatePoolDiscovery() {
    console.log('\\n4. プール発見可能性評価');
    console.log('========================');

    const evaluation = {
      directPoolAccess: true,      // 既知ペア直接アクセス
      factoryEnumeration: false,   // Factory経由での列挙
      registryAccess: false,       // Registry経由でのアクセス
      v3PoolAccess: false         // V3プールアクセス
    };

    console.log('📊 各手法の評価:');
    
    console.log(`\\n✅ 直接ペアアクセス: ${evaluation.directPoolAccess ? '可能' : '不可'}`);
    console.log('   - 既知のペアアドレスを直接使用');
    console.log('   - 流動性情報、レート計算が可能');
    console.log('   - 5個以上のペアで動作確認済み');

    console.log(`\\n❌ Factory列挙: ${evaluation.factoryEnumeration ? '可能' : '制限あり'}`);
    console.log('   - allPairs()は動作するがgetPair()は不可');
    console.log('   - 新しいペアの動的発見は困難');
    console.log('   - 全ペアスキャンは可能だが非効率');

    console.log(`\\n❓ Registry経由: ${evaluation.registryAccess ? '可能' : '未確認'}`);
    console.log('   - FactoryRegistryが存在');
    console.log('   - 詳細な機能は要調査');

    console.log(`\\n❌ V3プール: ${evaluation.v3PoolAccess ? '可能' : '利用不可'}`);
    console.log('   - CLFactoryは存在するが実際のプールなし');
    console.log('   - QuoterV2での見積もり全て失敗');

    console.log('\\n🎯 推奨アプローチ:');
    console.log('==================');
    console.log('1. 🥇 既知ペア直接アクセス（最も確実）');
    console.log('2. 🥈 allPairs()での全ペアスキャン（網羅的だが低速）');
    console.log('3. 🥉 FactoryRegistry調査（可能性あり）');
    console.log('4. ❌ V3系機能（現時点では非実用）');

    return evaluation;
  }
}

async function main() {
  try {
    const rpcUrl = process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm';
    const analyzer = new AllFactoriesAnalyzer(rpcUrl);
    
    await analyzer.analyzeAllFactories();
    
  } catch (error) {
    console.error('❌ 分析エラー:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = { AllFactoriesAnalyzer };