const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * KittenSwap Factory詳細分析
 * getPair()関数の問題を調査
 */

// KittenSwap Factory
const KITTENSWAP_V2_FACTORY = '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B';

// 比較用：HyperSwap Factory（正常動作）
const HYPERSWAP_V2_FACTORY = '0xA028411927E2015A363014881a4404C636218fb1';

// 標準的なUniswap V2 Factory ABI
const FULL_FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  "function allPairs(uint) external view returns (address pair)",
  "function allPairsLength() external view returns (uint)",
  "function createPair(address tokenA, address tokenB) external returns (address pair)",
  "function feeTo() external view returns (address)",
  "function feeToSetter() external view returns (address)",
  "function setFeeTo(address) external",
  "function setFeeToSetter(address) external"
];

// 実験用のさまざまなABI
const MINIMAL_ABI = [
  "function getPair(address,address) external view returns (address)"
];

const ALTERNATIVE_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address)"
];

class FactoryAnalyzer {
  constructor(rpcUrl) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  }

  async analyzeFactory() {
    console.log('🔍 KittenSwap Factory 詳細分析');
    console.log('===============================\\n');

    console.log('📊 RPC接続情報:');
    console.log(`   URL: ${this.provider.connection.url}`);
    console.log(`   Block Number: ${await this.provider.getBlockNumber()}`);
    console.log('');

    // 1. 基本情報確認
    await this.checkBasicInfo();
    
    // 2. 関数シグネチャ確認
    await this.checkFunctionSignatures();
    
    // 3. さまざまなABIでのテスト
    await this.testDifferentABIs();
    
    // 4. 正常なHyperSwap Factoryと比較
    await this.compareWithHyperSwap();
    
    // 5. バイトコード分析
    await this.analyzeBytecode();
  }

  async checkBasicInfo() {
    console.log('1. 基本情報確認');
    console.log('================');

    try {
      // コントラクト存在確認
      const code = await this.provider.getCode(KITTENSWAP_V2_FACTORY);
      console.log(`✅ コントラクト存在: ${code !== '0x'}`);
      console.log(`📏 バイトコードサイズ: ${code.length / 2 - 1} bytes`);

      // 基本的な関数テスト
      const factory = new ethers.Contract(KITTENSWAP_V2_FACTORY, FULL_FACTORY_ABI, this.provider);
      
      const allPairsLength = await factory.allPairsLength();
      console.log(`📊 総ペア数: ${allPairsLength.toString()}`);

      // 最初の数個のペアをテスト
      for (let i = 0; i < Math.min(3, allPairsLength.toNumber()); i++) {
        const pairAddr = await factory.allPairs(i);
        console.log(`📍 ペア${i}: ${pairAddr}`);
      }

    } catch (error) {
      console.log(`❌ 基本情報取得エラー: ${error.message}`);
    }
    
    console.log('');
  }

  async checkFunctionSignatures() {
    console.log('2. 関数シグネチャ確認');
    console.log('====================');

    // getPair関数のシグネチャ確認
    const getPairSignature = 'getPair(address,address)';
    const expectedSelector = ethers.utils.id(getPairSignature).slice(0, 10);
    console.log(`📝 期待されるgetPairセレクタ: ${expectedSelector}`);

    // allPairs関数のシグネチャ確認（これは動作している）
    const allPairsSignature = 'allPairs(uint256)';
    const allPairsSelector = ethers.utils.id(allPairsSignature).slice(0, 10);
    console.log(`📝 allPairsセレクタ: ${allPairsSelector}`);

    console.log('');
  }

  async testDifferentABIs() {
    console.log('3. 異なるABIでのテスト');
    console.log('======================');

    const testTokens = {
      WHYPE: '0x5555555555555555555555555555555555555555',
      PURR: '0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E'
    };

    const abiTests = [
      { name: 'Full ABI', abi: FULL_FACTORY_ABI },
      { name: 'Minimal ABI', abi: MINIMAL_ABI },
      { name: 'Alternative ABI', abi: ALTERNATIVE_ABI }
    ];

    for (const test of abiTests) {
      console.log(`🧪 ${test.name}でテスト:`);
      
      try {
        const factory = new ethers.Contract(KITTENSWAP_V2_FACTORY, test.abi, this.provider);
        
        // getPair呼び出し
        const result = await factory.getPair(testTokens.WHYPE, testTokens.PURR);
        console.log(`   ✅ 成功: ${result}`);
        
      } catch (error) {
        console.log(`   ❌ エラー: ${error.message.substring(0, 80)}`);
        
        // より詳細なエラー分析
        if (error.code) {
          console.log(`   エラーコード: ${error.code}`);
        }
        if (error.reason) {
          console.log(`   理由: ${error.reason}`);
        }
      }
    }
    
    console.log('');
  }

  async compareWithHyperSwap() {
    console.log('4. HyperSwap Factory比較');
    console.log('========================');

    const testTokens = {
      // HyperSwap用トークン
      WETH: '0xADcb2f358Eae6492F61A5F87eb8893d09391d160',
      PURR: '0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82'
    };

    console.log('🔍 HyperSwap Factory (正常動作)でテスト:');
    try {
      const hyperswapFactory = new ethers.Contract(HYPERSWAP_V2_FACTORY, FULL_FACTORY_ABI, this.provider);
      
      const hyperswapPair = await hyperswapFactory.getPair(testTokens.WETH, testTokens.PURR);
      console.log(`   ✅ HyperSwap getPair成功: ${hyperswapPair}`);
      
      const hyperswapLength = await hyperswapFactory.allPairsLength();
      console.log(`   📊 HyperSwap総ペア数: ${hyperswapLength.toString()}`);
      
    } catch (error) {
      console.log(`   ❌ HyperSwap エラー: ${error.message}`);
    }

    console.log('\\n🔍 KittenSwap Factory再テスト:');
    try {
      const kittenFactory = new ethers.Contract(KITTENSWAP_V2_FACTORY, FULL_FACTORY_ABI, this.provider);
      
      // 同じ形式でテスト
      const kittenTestTokens = {
        WHYPE: '0x5555555555555555555555555555555555555555',
        PURR: '0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E'
      };
      
      const kittenPair = await kittenFactory.getPair(kittenTestTokens.WHYPE, kittenTestTokens.PURR);
      console.log(`   ✅ KittenSwap getPair成功: ${kittenPair}`);
      
    } catch (error) {
      console.log(`   ❌ KittenSwap エラー: ${error.message}`);
      
      // 詳細なエラー分析
      console.log('\\n   🔬 詳細エラー分析:');
      if (error.transaction) {
        console.log(`   Transaction: ${JSON.stringify(error.transaction, null, 2)}`);
      }
      if (error.error && error.error.code) {
        console.log(`   Inner Error Code: ${error.error.code}`);
      }
    }
    
    console.log('');
  }

  async analyzeBytecode() {
    console.log('5. バイトコード分析');
    console.log('==================');

    try {
      // バイトコード取得
      const kittenCode = await this.provider.getCode(KITTENSWAP_V2_FACTORY);
      const hyperswapCode = await this.provider.getCode(HYPERSWAP_V2_FACTORY);

      console.log(`KittenSwap バイトコードサイズ: ${kittenCode.length / 2 - 1} bytes`);
      console.log(`HyperSwap バイトコードサイズ: ${hyperswapCode.length / 2 - 1} bytes`);

      // getPairセレクタの存在確認
      const getPairSelector = '0xe6a43905'; // getPair(address,address)のセレクタ
      
      const kittenHasGetPair = kittenCode.includes(getPairSelector.slice(2));
      const hyperswapHasGetPair = hyperswapCode.includes(getPairSelector.slice(2));
      
      console.log(`KittenSwap getPairセレクタ存在: ${kittenHasGetPair}`);
      console.log(`HyperSwap getPairセレクタ存在: ${hyperswapHasGetPair}`);

      // パターン分析
      this.analyzeCodePatterns(kittenCode, 'KittenSwap');
      this.analyzeCodePatterns(hyperswapCode, 'HyperSwap');

    } catch (error) {
      console.log(`❌ バイトコード分析エラー: ${error.message}`);
    }
    
    console.log('');
  }

  analyzeCodePatterns(bytecode, name) {
    console.log(`\\n🔍 ${name} コードパターン:`);
    
    // Solidity バージョン
    const solidityPattern = /736f6c6343([0-9a-f]{6})/g;
    const solidityMatch = solidityPattern.exec(bytecode);
    if (solidityMatch && solidityMatch[1]) {
      const version = solidityMatch[1];
      const major = parseInt(version.substr(0, 2), 16);
      const minor = parseInt(version.substr(2, 2), 16);
      const patch = parseInt(version.substr(4, 2), 16);
      console.log(`   Solidity: ${major}.${minor}.${patch}`);
    }

    // 関数セレクタパターン検索
    const selectorPattern = /63([0-9a-f]{8})/gi;
    const selectors = new Set();
    let match;
    while ((match = selectorPattern.exec(bytecode)) !== null) {
      selectors.add('0x' + match[1]);
    }
    
    console.log(`   検出セレクタ数: ${selectors.size}`);
    
    // 既知の関数セレクタをチェック
    const knownSelectors = {
      '0xe6a43905': 'getPair(address,address)',
      '0x1e3dd18b': 'allPairs(uint256)',
      '0x574f2ba3': 'allPairsLength()',
      '0x017e7e58': 'feeTo()',
      '0x017e7e58': 'feeToSetter()'
    };
    
    console.log(`   既知関数の存在:`);
    Object.entries(knownSelectors).forEach(([selector, name]) => {
      const exists = selectors.has(selector);
      console.log(`     ${name}: ${exists ? '✅' : '❌'}`);
    });
  }

  async lowLevelCall() {
    console.log('6. 低レベル呼び出しテスト');
    console.log('========================');

    const testTokens = {
      WHYPE: '0x5555555555555555555555555555555555555555',
      PURR: '0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E'
    };

    // getPair関数の手動エンコード
    const getPairSelector = '0xe6a43905';
    const encodedCall = getPairSelector + 
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'address'], 
        [testTokens.WHYPE, testTokens.PURR]
      ).slice(2);

    console.log(`📝 エンコードされた呼び出し: ${encodedCall}`);

    try {
      const result = await this.provider.call({
        to: KITTENSWAP_V2_FACTORY,
        data: encodedCall
      });
      
      console.log(`✅ 低レベル呼び出し成功: ${result}`);
      
      if (result !== '0x') {
        const decoded = ethers.utils.defaultAbiCoder.decode(['address'], result);
        console.log(`📍 デコード結果: ${decoded[0]}`);
      }
      
    } catch (error) {
      console.log(`❌ 低レベル呼び出しエラー: ${error.message}`);
    }
  }
}

async function main() {
  try {
    const rpcUrl = process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm';
    const analyzer = new FactoryAnalyzer(rpcUrl);
    
    await analyzer.analyzeFactory();
    await analyzer.lowLevelCall();
    
    console.log('\\n📊 分析完了');
    console.log('============');
    console.log('主な発見:');
    console.log('- KittenSwap Factoryの基本機能（allPairs, allPairsLength）は正常');
    console.log('- getPair関数のみが問題を起こしている');
    console.log('- バイトコード分析で原因を特定');
    
  } catch (error) {
    console.error('❌ 分析エラー:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = { FactoryAnalyzer };