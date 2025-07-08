const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * KittenSwap Factory ABI検証
 * 実際に動作する関数を特定してABIを最適化
 */

const KITTENSWAP_V2_FACTORY = '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B';

// テスト用ABI（段階的に確認）
const TEST_ABIS = {
  basic: [
    "function allPairs(uint256) external view returns (address)",
    "function allPairsLength() external view returns (uint256)"
  ],
  
  extended: [
    "function allPairs(uint256) external view returns (address)",
    "function allPairsLength() external view returns (uint256)",
    "function feeTo() external view returns (address)",
    "function feeToSetter() external view returns (address)"
  ],
  
  withEvents: [
    "function allPairs(uint256) external view returns (address)",
    "function allPairsLength() external view returns (uint256)",
    "function feeTo() external view returns (address)", 
    "function feeToSetter() external view returns (address)",
    "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)"
  ],
  
  experimental: [
    "function allPairs(uint256) external view returns (address)",
    "function allPairsLength() external view returns (uint256)",
    "function feeTo() external view returns (address)",
    "function feeToSetter() external view returns (address)",
    "function owner() external view returns (address)",
    "function implementation() external view returns (address)"
  ]
};

class KittenSwapABIValidator {
  constructor(rpcUrl) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  }

  async validateABIs() {
    console.log('🔍 KittenSwap Factory ABI検証');
    console.log('==============================\\n');

    console.log('📊 RPC接続情報:');
    console.log(`   URL: ${this.provider.connection.url}`);
    console.log(`   Block Number: ${await this.provider.getBlockNumber()}`);
    console.log('');

    const results = {};

    for (const [name, abi] of Object.entries(TEST_ABIS)) {
      console.log(`🧪 ${name} ABI テスト:`);
      results[name] = await this.testABI(abi);
      console.log('');
    }

    // 個別関数テスト
    await this.testIndividualFunctions();

    // 最適なABI生成
    this.generateOptimalABI(results);
  }

  async testABI(abi) {
    const results = {
      success: [],
      failed: [],
      totalFunctions: 0
    };

    try {
      const factory = new ethers.Contract(KITTENSWAP_V2_FACTORY, abi, this.provider);
      
      for (const fragment of abi) {
        if (typeof fragment === 'string') {
          // 文字列形式のABIをパース
          const funcName = fragment.split('(')[0].split(' ').pop();
          results.totalFunctions++;
          
          await this.testFunction(factory, funcName, results);
        } else if (fragment.type === 'function') {
          // JSON形式のABI
          results.totalFunctions++;
          await this.testFunction(factory, fragment.name, results);
        }
      }

      console.log(`   ✅ 成功: ${results.success.length}/${results.totalFunctions}`);
      console.log(`   ❌ 失敗: ${results.failed.length}/${results.totalFunctions}`);
      
      if (results.success.length > 0) {
        console.log(`   📋 動作確認済み: ${results.success.join(', ')}`);
      }
      if (results.failed.length > 0) {
        console.log(`   ⚠️  失敗: ${results.failed.join(', ')}`);
      }

    } catch (error) {
      console.log(`   ❌ ABI全体エラー: ${error.message}`);
      results.failed.push('ABI_ERROR');
    }

    return results;
  }

  async testFunction(contract, functionName, results) {
    try {
      let result;
      
      switch (functionName) {
        case 'allPairsLength':
          result = await contract.allPairsLength();
          console.log(`     ${functionName}(): ${result.toString()}`);
          break;
          
        case 'allPairs':
          result = await contract.allPairs(0);
          console.log(`     ${functionName}(0): ${result}`);
          break;
          
        case 'feeTo':
          result = await contract.feeTo();
          console.log(`     ${functionName}(): ${result}`);
          break;
          
        case 'feeToSetter':
          result = await contract.feeToSetter();
          console.log(`     ${functionName}(): ${result}`);
          break;
          
        case 'owner':
          result = await contract.owner();
          console.log(`     ${functionName}(): ${result}`);
          break;
          
        case 'implementation':
          result = await contract.implementation();
          console.log(`     ${functionName}(): ${result}`);
          break;
          
        default:
          console.log(`     ${functionName}(): スキップ（テスト未実装）`);
          return;
      }
      
      results.success.push(functionName);
      
    } catch (error) {
      console.log(`     ${functionName}(): ❌ ${error.message.substring(0, 50)}`);
      results.failed.push(functionName);
    }
  }

  async testIndividualFunctions() {
    console.log('🎯 個別関数詳細テスト');
    console.log('====================');

    // 低レベルテスト
    const testCases = [
      {
        name: 'allPairsLength()',
        selector: '0x574f2ba3',
        params: []
      },
      {
        name: 'allPairs(uint256)',
        selector: '0x1e3dd18b',
        params: ['uint256'],
        args: [0]
      },
      {
        name: 'feeTo()',
        selector: '0x017e7e58',
        params: []
      },
      {
        name: 'feeToSetter()',
        selector: '0x094b7415',
        params: []
      },
      {
        name: 'owner()',
        selector: '0x8da5cb5b',
        params: []
      }
    ];

    for (const testCase of testCases) {
      console.log(`\\n📋 ${testCase.name}:`);
      
      try {
        let callData = testCase.selector;
        
        if (testCase.args && testCase.args.length > 0) {
          const encoded = ethers.utils.defaultAbiCoder.encode(testCase.params, testCase.args);
          callData += encoded.slice(2);
        }
        
        console.log(`   データ: ${callData}`);
        
        const result = await this.provider.call({
          to: KITTENSWAP_V2_FACTORY,
          data: callData
        });
        
        console.log(`   ✅ 結果: ${result}`);
        
        // 結果をデコード
        if (result !== '0x' && result.length > 2) {
          try {
            if (testCase.name.includes('uint256') || testCase.name === 'allPairsLength()') {
              const decoded = ethers.utils.defaultAbiCoder.decode(['uint256'], result);
              console.log(`   📊 値: ${decoded[0].toString()}`);
            } else if (testCase.name.includes('address') || testCase.name.includes('()')) {
              const decoded = ethers.utils.defaultAbiCoder.decode(['address'], result);
              console.log(`   📍 アドレス: ${decoded[0]}`);
            }
          } catch (decodeError) {
            console.log(`   ⚠️  デコードエラー: ${decodeError.message}`);
          }
        }
        
      } catch (error) {
        console.log(`   ❌ エラー: ${error.message.substring(0, 60)}`);
      }
    }
  }

  generateOptimalABI(results) {
    console.log('\\n📝 最適なABI生成');
    console.log('==================');

    // 動作確認済み関数のみでABI生成
    const workingFunctions = [];
    
    // 確実に動作する関数
    const confirmedFunctions = [
      {
        "constant": true,
        "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "name": "allPairs",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "allPairsLength",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
      }
    ];

    workingFunctions.push(...confirmedFunctions);

    // 追加で動作する関数があれば含める
    Object.values(results).forEach(result => {
      if (result.success.includes('feeTo')) {
        workingFunctions.push({
          "constant": true,
          "inputs": [],
          "name": "feeTo", 
          "outputs": [{"internalType": "address", "name": "", "type": "address"}],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
        });
      }
      
      if (result.success.includes('feeToSetter')) {
        workingFunctions.push({
          "constant": true,
          "inputs": [],
          "name": "feeToSetter",
          "outputs": [{"internalType": "address", "name": "", "type": "address"}],
          "payable": false,
          "stateMutability": "view", 
          "type": "function"
        });
      }
    });

    // 重複除去
    const uniqueFunctions = workingFunctions.filter((func, index, self) => 
      index === self.findIndex(f => f.name === func.name)
    );

    console.log('✅ 検証済みABI関数:');
    uniqueFunctions.forEach(func => {
      console.log(`   - ${func.name}(${func.inputs.map(i => i.type).join(',')})`);
    });

    // ABIファイル更新
    this.updateABIFile(uniqueFunctions);
  }

  updateABIFile(functions) {
    const fs = require('fs');
    const abiPath = path.join(__dirname, '../../abi/KittenSwapV2Factory.json');
    
    try {
      fs.writeFileSync(abiPath, JSON.stringify(functions, null, 2));
      console.log(`\\n💾 ABIファイル更新完了: ${abiPath}`);
      console.log(`📊 含まれる関数: ${functions.length}個`);
    } catch (error) {
      console.log(`❌ ABIファイル更新エラー: ${error.message}`);
    }
  }
}

async function main() {
  try {
    const rpcUrl = process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm';
    const validator = new KittenSwapABIValidator(rpcUrl);
    
    await validator.validateABIs();
    
  } catch (error) {
    console.error('❌ 検証エラー:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = { KittenSwapABIValidator };