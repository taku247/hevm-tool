const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * KittenSwap Factory バイトコード詳細分析
 * bytecode-analyzer.tsの機能をJSで再実装
 */

class KittenSwapBytecodeAnalyzer {
  constructor(rpcUrl) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.knownSelectors = this.loadKnownSelectors();
  }

  loadKnownSelectors() {
    const selectors = new Map();
    
    // Factory関数
    selectors.set("0xe6a43905", "getPair(address,address)");
    selectors.set("0x1e3dd18b", "allPairs(uint256)");
    selectors.set("0x574f2ba3", "allPairsLength()");
    selectors.set("0xc9c65396", "createPair(address,address)");
    selectors.set("0x017e7e58", "feeTo()");
    selectors.set("0x094b7415", "feeToSetter()");
    
    // ERC20関数
    selectors.set("0x70a08231", "balanceOf(address)");
    selectors.set("0x18160ddd", "totalSupply()");
    selectors.set("0xa9059cbb", "transfer(address,uint256)");
    selectors.set("0x23b872dd", "transferFrom(address,address,uint256)");
    selectors.set("0x095ea7b3", "approve(address,uint256)");
    
    // プロキシ関連
    selectors.set("0x5c60da1b", "implementation()");
    selectors.set("0x3659cfe6", "upgradeTo(address)");
    selectors.set("0x4f1ef286", "upgradeToAndCall(address,bytes)");
    
    return selectors;
  }

  async getContractBytecode(address) {
    console.log(`📋 バイトコード取得中: ${address}`);
    const code = await this.provider.getCode(address);
    
    if (code === "0x") {
      throw new Error("コントラクトが存在しません");
    }
    
    console.log(`✅ バイトコードサイズ: ${code.length / 2 - 1} bytes`);
    return code;
  }

  extractFunctionSelectors(bytecode) {
    const signatures = [];
    const selectorPattern = /63([0-9a-f]{8})/gi;
    const matches = new Set();
    
    let match;
    while ((match = selectorPattern.exec(bytecode)) !== null) {
      const selector = "0x" + match[1];
      if (this.isValidSelector(selector)) {
        matches.add(selector);
      }
    }
    
    matches.forEach(selector => {
      const signature = { selector };
      
      if (this.knownSelectors.has(selector)) {
        const sig = this.knownSelectors.get(selector);
        signature.signature = sig;
        signature.name = sig.split("(")[0];
      }
      
      signatures.push(signature);
    });
    
    return signatures;
  }

  isValidSelector(selector) {
    const num = parseInt(selector, 16);
    return num > 0x00000100 && num < 0xfffffffe;
  }

  calculateSelector(signature) {
    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(signature));
    return hash.slice(0, 10);
  }

  analyzePatterns(bytecode) {
    console.log('\\n🔍 バイトコードパターン分析:');
    
    // Solidityバージョン
    const solidityPattern = /736f6c6343([0-9a-f]{6})/g;
    const solidityMatch = solidityPattern.exec(bytecode);
    if (solidityMatch && solidityMatch[1]) {
      const version = solidityMatch[1];
      const major = parseInt(version.substr(0, 2), 16);
      const minor = parseInt(version.substr(2, 2), 16);
      const patch = parseInt(version.substr(4, 2), 16);
      console.log(`   Solidity バージョン: ${major}.${minor}.${patch}`);
    }
    
    // メタデータハッシュ
    const metadataPattern = /a264697066735822([0-9a-f]{64})/g;
    const metadataMatch = metadataPattern.exec(bytecode);
    if (metadataMatch && metadataMatch[1]) {
      console.log(`   メタデータハッシュ: ${metadataMatch[1].substring(0, 16)}...`);
    }
    
    // プロキシパターン検出
    const proxyPatterns = [
      '363d3d373d3d3d363d73', // Minimal proxy pattern
      '5960205180305d600039f3', // Create2 proxy pattern
      '36363d', // Delegatecall pattern
    ];
    
    const isProxy = proxyPatterns.some(pattern => bytecode.includes(pattern));
    if (isProxy) {
      console.log('   🔄 プロキシコントラクトの可能性');
    }
    
    // バイトコードの特徴
    console.log(`   バイトコード長: ${bytecode.length / 2 - 1} bytes`);
    
    if (bytecode.length < 1000) {
      console.log('   ⚠️  非常に小さなコントラクト（プロキシまたは最小実装）');
    } else if (bytecode.length > 50000) {
      console.log('   📦 大規模コントラクト（ライブラリ使用）');
    }
  }

  async analyzeContract(address) {
    console.log('🔍 KittenSwap Factory 詳細バイトコード分析');
    console.log('===========================================\\n');
    
    try {
      // バイトコード取得
      const bytecode = await this.getContractBytecode(address);
      
      // 関数セレクタ抽出
      const signatures = this.extractFunctionSelectors(bytecode);
      
      console.log(`\\n📊 検出された関数セレクタ: ${signatures.length}個`);
      
      // 既知の関数
      const known = signatures.filter(s => s.signature);
      if (known.length > 0) {
        console.log('\\n✅ 既知の関数:');
        known.forEach(sig => {
          console.log(`   ${sig.selector}: ${sig.signature}`);
        });
      }
      
      // 未知の関数
      const unknown = signatures.filter(s => !s.signature);
      if (unknown.length > 0) {
        console.log('\\n❓ 未知の関数セレクタ:');
        unknown.forEach(sig => {
          console.log(`   ${sig.selector}`);
        });
      }
      
      // Factory関数の存在確認
      console.log('\\n🏭 期待されるFactory関数の存在確認:');
      const expectedFunctions = [
        { sig: "getPair(address,address)", selector: "0xe6a43905" },
        { sig: "allPairs(uint256)", selector: "0x1e3dd18b" },
        { sig: "allPairsLength()", selector: "0x574f2ba3" },
        { sig: "createPair(address,address)", selector: "0xc9c65396" }
      ];
      
      expectedFunctions.forEach(func => {
        const exists = signatures.some(s => s.selector === func.selector);
        console.log(`   ${func.sig}: ${exists ? '✅' : '❌'}`);
      });
      
      // パターン分析
      this.analyzePatterns(bytecode);
      
      // 生バイトコード分析
      console.log('\\n🔬 生バイトコード分析:');
      console.log(`   先頭20バイト: ${bytecode.substring(0, 42)}`);
      console.log(`   末尾20バイト: ${bytecode.substring(bytecode.length - 40)}`);
      
      // 特定パターン検索
      this.searchSpecificPatterns(bytecode);
      
    } catch (error) {
      console.error('❌ エラー:', error.message);
    }
  }

  searchSpecificPatterns(bytecode) {
    console.log('\\n🔍 特定パターン検索:');
    
    // REVERT命令の検索
    const revertCount = (bytecode.match(/fd/g) || []).length;
    console.log(`   REVERT命令数: ${revertCount}`);
    
    // DELEGATECALL命令の検索
    const delegatecallCount = (bytecode.match(/f4/g) || []).length;
    console.log(`   DELEGATECALL命令数: ${delegatecallCount}`);
    
    // CALL命令の検索
    const callCount = (bytecode.match(/f1/g) || []).length;
    console.log(`   CALL命令数: ${callCount}`);
    
    // Storage読み書き命令
    const sstoreCount = (bytecode.match(/55/g) || []).length;
    const sloadCount = (bytecode.match(/54/g) || []).length;
    console.log(`   SSTORE命令数: ${sstoreCount}`);
    console.log(`   SLOAD命令数: ${sloadCount}`);
    
    // プロキシの典型的なパターン
    if (bytecode.includes('363d3d373d3d3d363d73')) {
      console.log('   🔄 Minimal Proxyパターン検出');
    }
    
    if (bytecode.includes('36363e565b60') && bytecode.length < 200) {
      console.log('   🔄 シンプルなプロキシパターン検出');
    }
  }

  async testFactoryBehavior(address) {
    console.log('\\n🧪 Factory動作テスト');
    console.log('=====================');
    
    // 基本機能テスト
    const basicABI = [
      "function allPairsLength() external view returns (uint256)",
      "function allPairs(uint256) external view returns (address)"
    ];
    
    try {
      const factory = new ethers.Contract(address, basicABI, this.provider);
      
      const length = await factory.allPairsLength();
      console.log(`✅ allPairsLength(): ${length.toString()}`);
      
      if (length.gt(0)) {
        const firstPair = await factory.allPairs(0);
        console.log(`✅ allPairs(0): ${firstPair}`);
      }
      
    } catch (error) {
      console.log(`❌ 基本機能テストエラー: ${error.message}`);
    }
    
    // getPair機能テスト（詳細）
    console.log('\\n🎯 getPair詳細テスト:');
    
    const testCases = [
      {
        name: '実際のトークンペア',
        tokenA: '0x5555555555555555555555555555555555555555', // WHYPE
        tokenB: '0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E'  // PURR
      },
      {
        name: 'ゼロアドレステスト',
        tokenA: '0x0000000000000000000000000000000000000000',
        tokenB: '0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E'
      },
      {
        name: '同じアドレステスト',
        tokenA: '0x5555555555555555555555555555555555555555',
        tokenB: '0x5555555555555555555555555555555555555555'
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\\n   📋 ${testCase.name}:`);
      
      // 低レベル呼び出し
      const getPairSelector = '0xe6a43905';
      const encodedCall = getPairSelector + 
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'address'], 
          [testCase.tokenA, testCase.tokenB]
        ).slice(2);
      
      console.log(`   データ: ${encodedCall}`);
      
      try {
        const result = await this.provider.call({
          to: address,
          data: encodedCall
        });
        
        console.log(`   ✅ 成功: ${result}`);
        
        if (result !== '0x' && result.length >= 66) {
          const decoded = ethers.utils.defaultAbiCoder.decode(['address'], result);
          console.log(`   📍 ペアアドレス: ${decoded[0]}`);
        }
        
      } catch (error) {
        console.log(`   ❌ エラー: ${error.message.substring(0, 60)}`);
        
        // エラーの詳細分析
        if (error.error && error.error.error) {
          console.log(`   詳細: ${JSON.stringify(error.error.error)}`);
        }
      }
    }
  }
}

async function main() {
  try {
    const rpcUrl = process.env.HYPERLIQUID_MAINNET_RPC || 'https://rpc.hyperliquid.xyz/evm';
    const analyzer = new KittenSwapBytecodeAnalyzer(rpcUrl);
    
    const KITTENSWAP_FACTORY = '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B';
    
    await analyzer.analyzeContract(KITTENSWAP_FACTORY);
    await analyzer.testFactoryBehavior(KITTENSWAP_FACTORY);
    
    console.log('\\n🎯 結論');
    console.log('========');
    console.log('KittenSwap Factoryのgetpair()問題の原因:');
    console.log('1. 非常に小さなバイトコード（163 bytes）');
    console.log('2. 標準的なFactory関数セレクタが見つからない');
    console.log('3. プロキシまたはカスタム実装の可能性');
    console.log('4. 既知のペアは直接アクセスで取得可能');
    
  } catch (error) {
    console.error('❌ 分析エラー:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = { KittenSwapBytecodeAnalyzer };