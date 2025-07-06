const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * QuoterV2バイトコード解析 - 実際の関数シグネチャを特定
 */

async function analyzeQuoterV2Bytecode() {
  console.log('🔍 HyperSwap V3 QuoterV2 バイトコード解析\n');
  
  const quoterV2Address = '0x03A918028f22D9E1473B7959C927AD7425A45C7C';
  const quoterV1Address = '0xF865716B90f09268fF12B6B620e14bEC390B8139';
  
  // 1. バイトコード取得と基本分析
  console.log('📊 1. バイトコード基本情報\n');
  
  try {
    const v1Code = await provider.getCode(quoterV1Address);
    const v2Code = await provider.getCode(quoterV2Address);
    
    console.log(`QuoterV1 code length: ${v1Code.length} bytes`);
    console.log(`QuoterV2 code length: ${v2Code.length} bytes`);
    console.log(`Code difference: ${v2Code.length - v1Code.length} bytes\n`);
    
    // 関数セレクタの抽出試行
    console.log('🔍 2. 知られた関数セレクタの検索\n');
    
    const knownSelectors = {
      // QuoterV1のセレクタ
      'quoteExactInputSingle(address,address,uint24,uint256,uint160)': '0xf7729d4f',
      'quoteExactInput(bytes,uint256)': '0xcdca1753',
      
      // QuoterV2のセレクタ (tuple版)
      'quoteExactInputSingle((address,address,uint24,uint256,uint160))': '0x414bf389',
      'quoteExactInput(bytes,uint256)': '0xcdca1753',
      
      // 基本関数
      'factory()': '0xc45a0155',
      'WETH9()': '0x4aa4a4fc',
      
      // 代替パターン
      'getQuoteExactInputSingle((address,address,uint24,uint256,uint160))': '0x123456789', // example
    };
    
    for (const [signature, selector] of Object.entries(knownSelectors)) {
      const found = v2Code.includes(selector.slice(2));
      console.log(`${found ? '✅' : '❌'} ${signature}: ${selector}`);
    }
    
    console.log('\n🔍 3. 実際の関数呼び出しテスト\n');
    
    // 実際の関数呼び出しテスト
    const testCases = [
      {
        name: 'V1形式直接',
        selector: '0xf7729d4f',
        data: encodeFunctionCall_V1Style()
      },
      {
        name: 'V2形式直接',
        selector: '0x414bf389', 
        data: encodeFunctionCall_V2Style()
      }
    ];
    
    for (const testCase of testCases) {
      try {
        console.log(`🧪 Testing: ${testCase.name}`);
        
        const result = await provider.call({
          to: quoterV2Address,
          data: testCase.data
        });
        
        console.log(`   ✅ 成功: ${result}`);
        
        // 結果をデコード
        if (result !== '0x') {
          const decoded = ethers.utils.defaultAbiCoder.decode(['uint256'], result);
          console.log(`   📊 Decoded amount: ${decoded[0].toString()}`);
        }
        
      } catch (error) {
        console.log(`   ❌ 失敗: ${error.message.substring(0, 100)}...`);
      }
    }
    
  } catch (error) {
    console.error('Error analyzing bytecode:', error.message);
  }
  
  // 関数エンコード用のヘルパー関数
  function encodeFunctionCall_V1Style() {
    // quoteExactInputSingle(address,address,uint24,uint256,uint160)
    const selector = '0xf7729d4f';
    const tokens = {
      WHYPE: '0x5555555555555555555555555555555555555555',
      UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463'
    };
    const amount = ethers.utils.parseEther('1').toString();
    
    const encoded = ethers.utils.defaultAbiCoder.encode(
      ['address', 'address', 'uint24', 'uint256', 'uint160'],
      [tokens.WHYPE, tokens.UBTC, 3000, amount, 0]
    );
    
    return selector + encoded.slice(2);
  }
  
  function encodeFunctionCall_V2Style() {
    // quoteExactInputSingle((address,address,uint24,uint256,uint160))
    const selector = '0x414bf389';
    const tokens = {
      WHYPE: '0x5555555555555555555555555555555555555555',
      UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463'
    };
    const amount = ethers.utils.parseEther('1').toString();
    
    const encoded = ethers.utils.defaultAbiCoder.encode(
      ['tuple(address,address,uint24,uint256,uint160)'],
      [[tokens.WHYPE, tokens.UBTC, 3000, amount, 0]]
    );
    
    return selector + encoded.slice(2);
  }
  
  console.log('\n🔍 4. 既知の動作する関数での比較\n');
  
  // 既知の動作する関数 (factory) での比較
  try {
    const factorySelector = '0xc45a0155'; // factory()
    
    const v1FactoryResult = await provider.call({
      to: quoterV1Address,
      data: factorySelector
    });
    
    const v2FactoryResult = await provider.call({
      to: quoterV2Address,
      data: factorySelector
    });
    
    console.log(`V1 factory(): ${v1FactoryResult}`);
    console.log(`V2 factory(): ${v2FactoryResult}`);
    console.log(`Factory results match: ${v1FactoryResult === v2FactoryResult}`);
    
  } catch (error) {
    console.log(`Factory test error: ${error.message}`);
  }
}

if (require.main === module) {
  analyzeQuoterV2Bytecode().catch(console.error);
}

module.exports = { analyzeQuoterV2Bytecode };