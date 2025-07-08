const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

/**
 * 公式GitHub ABI vs 現在使用中ABIの詳細比較
 */

async function compareOfficialABI() {
  console.log('🔍 公式GitHub ABI vs 現在使用ABI 比較');
  console.log('==========================================\\n');

  try {
    // 1. 現在使用中のABI読み込み
    console.log('📋 1. 現在使用中のABI:');
    const currentAbiPath = path.join(__dirname, '../../abi/HyperSwapV2Router.json');
    const currentAbi = JSON.parse(fs.readFileSync(currentAbiPath, 'utf8'));
    
    const currentSwapFunction = currentAbi.find(item => 
      item.type === 'function' && item.name === 'swapExactTokensForTokens'
    );
    
    if (currentSwapFunction) {
      console.log('   ✅ swapExactTokensForTokens 関数発見');
      console.log('   詳細:');
      console.log(`     名前: ${currentSwapFunction.name}`);
      console.log(`     状態: ${currentSwapFunction.stateMutability}`);
      console.log('     引数:');
      currentSwapFunction.inputs.forEach((input, index) => {
        console.log(`       ${index + 1}. ${input.name}: ${input.type}`);
      });
      console.log('     戻り値:');
      currentSwapFunction.outputs.forEach((output, index) => {
        console.log(`       ${index + 1}. ${output.name || '(無名)'}: ${output.type}`);
      });
    } else {
      console.log('   ❌ swapExactTokensForTokens 関数が見つかりません');
      return;
    }
    
    console.log('');

    // 2. 公式GitHub仕様（WebFetchから取得した情報）
    console.log('📋 2. 公式GitHub ABI仕様:');
    const officialSpec = {
      name: 'swapExactTokensForTokens',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'amountIn', type: 'uint256' },
        { name: 'amountOutMin', type: 'uint256' },
        { name: 'path', type: 'address[]' },
        { name: 'to', type: 'address' },
        { name: 'deadline', type: 'uint256' }
      ],
      outputs: [
        { name: 'amounts', type: 'uint256[]' }
      ]
    };
    
    console.log('   公式GitHub仕様:');
    console.log(`     名前: ${officialSpec.name}`);
    console.log(`     状態: ${officialSpec.stateMutability}`);
    console.log('     引数:');
    officialSpec.inputs.forEach((input, index) => {
      console.log(`       ${index + 1}. ${input.name}: ${input.type}`);
    });
    console.log('     戻り値:');
    officialSpec.outputs.forEach((output, index) => {
      console.log(`       ${index + 1}. ${output.name}: ${output.type}`);
    });
    
    console.log('');

    // 3. 詳細比較
    console.log('🔍 3. 詳細比較結果:');
    
    console.log('   関数名:');
    console.log(`     現在: ${currentSwapFunction.name}`);
    console.log(`     公式: ${officialSpec.name}`);
    console.log(`     一致: ${currentSwapFunction.name === officialSpec.name ? '✅' : '❌'}`);
    
    console.log('\\n   状態修飾子:');
    console.log(`     現在: ${currentSwapFunction.stateMutability}`);
    console.log(`     公式: ${officialSpec.stateMutability}`);
    console.log(`     一致: ${currentSwapFunction.stateMutability === officialSpec.stateMutability ? '✅' : '❌'}`);
    
    console.log('\\n   引数比較:');
    const inputsMatch = currentSwapFunction.inputs.length === officialSpec.inputs.length &&
      currentSwapFunction.inputs.every((input, index) => {
        const officialInput = officialSpec.inputs[index];
        const nameMatch = input.name === officialInput.name;
        const typeMatch = input.type === officialInput.type;
        
        console.log(`     ${index + 1}. ${input.name}: ${input.type} vs ${officialInput.name}: ${officialInput.type} ${nameMatch && typeMatch ? '✅' : '❌'}`);
        
        return nameMatch && typeMatch;
      });
    
    console.log(`\\n   引数全体一致: ${inputsMatch ? '✅' : '❌'}`);
    
    console.log('\\n   戻り値比較:');
    const outputsMatch = currentSwapFunction.outputs.length === officialSpec.outputs.length &&
      currentSwapFunction.outputs.every((output, index) => {
        const officialOutput = officialSpec.outputs[index];
        const nameMatch = (output.name || 'amounts') === officialOutput.name;
        const typeMatch = output.type === officialOutput.type;
        
        console.log(`     ${index + 1}. ${output.name || '(無名)'}: ${output.type} vs ${officialOutput.name}: ${officialOutput.type} ${nameMatch && typeMatch ? '✅' : '❌'}`);
        
        return nameMatch && typeMatch;
      });
    
    console.log(`\\n   戻り値全体一致: ${outputsMatch ? '✅' : '❌'}`);

    // 4. 関数セレクタ確認
    console.log('\\n🔑 4. 関数セレクタ確認:');
    
    // 現在のABIから関数セレクタ生成
    const currentInterface = new ethers.Interface([currentSwapFunction]);
    const currentSelector = currentInterface.getFunction('swapExactTokensForTokens').selector;
    
    // 公式仕様から関数セレクタ生成
    const officialInterface = new ethers.Interface([{
      name: officialSpec.name,
      type: 'function',
      stateMutability: officialSpec.stateMutability,
      inputs: officialSpec.inputs,
      outputs: officialSpec.outputs
    }]);
    const officialSelector = officialInterface.getFunction('swapExactTokensForTokens').selector;
    
    console.log(`   現在ABI: ${currentSelector}`);
    console.log(`   公式ABI: ${officialSelector}`);
    console.log(`   セレクタ一致: ${currentSelector === officialSelector ? '✅' : '❌'}`);

    // 5. 標準Uniswap V2との比較
    console.log('\\n📚 5. 標準Uniswap V2との比較:');
    const standardUniV2 = '0x38ed1739'; // 標準的なUniswap V2の関数セレクタ
    
    console.log(`   標準Uniswap V2: ${standardUniV2}`);
    console.log(`   HyperSwap現在: ${currentSelector}`);
    console.log(`   HyperSwap公式: ${officialSelector}`);
    console.log(`   標準準拠: ${currentSelector === standardUniV2 ? '✅' : '❌'}`);

    console.log('\\n🎯 最終結論:');
    
    const allMatch = inputsMatch && outputsMatch && (currentSelector === officialSelector);
    
    if (allMatch) {
      console.log('   ✅ 現在使用中のABIは公式GitHubと完全一致');
      console.log('   ✅ swapExactTokensForTokensのABIに問題なし');
      console.log('   💡 エラーの原因はABI以外（テストネット制約等）');
    } else {
      console.log('   ❌ ABI定義に相違あり');
      console.log('   🔧 修正が必要');
    }

  } catch (error) {
    console.error('❌ 比較中にエラーが発生しました:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  compareOfficialABI()
    .then(() => {
      console.log('\\n🔍 公式ABI比較完了!');
    })
    .catch((error) => {
      console.error('❌ 致命的エラー:', error);
      process.exit(1);
    });
}

module.exports = { compareOfficialABI };