const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

/**
 * ブロック内容の詳細デバッグ
 * provider.getBlock(blockNumber, true) の返り値を完全に調査
 */

async function debugBlockContents() {
  console.log('🔍 ブロック内容詳細デバッグ');
  console.log('============================\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // 最新ブロックを取得
    const latestBlockNumber = await provider.getBlockNumber();
    console.log(`📊 最新ブロック番号: ${latestBlockNumber}`);
    
    // 最近のブロックから、トランザクションが含まれているものを探す
    let targetBlock = null;
    let blockNumber = latestBlockNumber;
    
    console.log('\n🔎 トランザクションを含むブロックを検索中...');
    
    for (let i = 0; i < 100; i++) {
      const block = await provider.getBlock(blockNumber - i, true);
      if (block && block.transactions && block.transactions.length > 0) {
        targetBlock = block;
        console.log(`✅ Block ${block.number} にトランザクション発見: ${block.transactions.length}件`);
        break;
      }
    }

    if (!targetBlock) {
      console.log('❌ 最近100ブロックにトランザクションが見つかりません');
      return;
    }

    // ブロックオブジェクトの完全な内容を表示
    console.log('\n📋 === ブロックオブジェクトの完全な内容 ===');
    console.log('\n1️⃣ ブロック基本情報:');
    console.log(`   number: ${targetBlock.number}`);
    console.log(`   hash: ${targetBlock.hash}`);
    console.log(`   parentHash: ${targetBlock.parentHash}`);
    console.log(`   timestamp: ${targetBlock.timestamp} (${new Date(targetBlock.timestamp * 1000).toISOString()})`);
    console.log(`   miner: ${targetBlock.miner}`);
    console.log(`   difficulty: ${targetBlock.difficulty}`);
    console.log(`   gasLimit: ${targetBlock.gasLimit}`);
    console.log(`   gasUsed: ${targetBlock.gasUsed}`);
    console.log(`   baseFeePerGas: ${targetBlock.baseFeePerGas || 'null'}`);
    console.log(`   extraData: ${targetBlock.extraData}`);
    console.log(`   nonce: ${targetBlock.nonce}`);

    console.log('\n2️⃣ トランザクション配列の詳細:');
    console.log(`   transactions.length: ${targetBlock.transactions.length}`);
    console.log(`   transactions配列の型: ${Array.isArray(targetBlock.transactions) ? 'Array' : typeof targetBlock.transactions}`);
    
    if (targetBlock.transactions.length > 0) {
      console.log('\n3️⃣ 各トランザクションの詳細:');
      
      targetBlock.transactions.forEach((tx, index) => {
        console.log(`\n   === Transaction ${index + 1}/${targetBlock.transactions.length} ===`);
        console.log(`   構造: ${typeof tx}`);
        
        if (typeof tx === 'string') {
          console.log(`   値: ${tx} (ハッシュのみ)`);
        } else if (typeof tx === 'object' && tx !== null) {
          // トランザクションオブジェクトの全プロパティ
          console.log(`   hash: ${tx.hash}`);
          console.log(`   type: ${tx.type}`);
          console.log(`   from: ${tx.from}`);
          console.log(`   to: ${tx.to || 'null (コントラクト作成)'}`);
          console.log(`   value: ${tx.value} (${ethers.formatEther(tx.value || 0)} ETH)`);
          console.log(`   nonce: ${tx.nonce}`);
          console.log(`   gasLimit: ${tx.gasLimit}`);
          console.log(`   gasPrice: ${tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') + ' Gwei' : 'null'}`);
          console.log(`   maxFeePerGas: ${tx.maxFeePerGas || 'null'}`);
          console.log(`   maxPriorityFeePerGas: ${tx.maxPriorityFeePerGas || 'null'}`);
          console.log(`   data: ${tx.data ? tx.data.substring(0, 66) + '...' : '0x'}`);
          console.log(`   v: ${tx.v}`);
          console.log(`   r: ${tx.r}`);
          console.log(`   s: ${tx.s}`);
          console.log(`   blockNumber: ${tx.blockNumber}`);
          console.log(`   blockHash: ${tx.blockHash}`);
          console.log(`   index: ${tx.index}`);
          
          // 追加のプロパティがあれば表示
          const knownProps = ['hash', 'type', 'from', 'to', 'value', 'nonce', 'gasLimit', 
                            'gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas', 'data', 
                            'v', 'r', 's', 'blockNumber', 'blockHash', 'index'];
          const additionalProps = Object.keys(tx).filter(key => !knownProps.includes(key));
          
          if (additionalProps.length > 0) {
            console.log('   --- 追加プロパティ ---');
            additionalProps.forEach(prop => {
              console.log(`   ${prop}: ${JSON.stringify(tx[prop])}`);
            });
          }
        }
      });
    }

    console.log('\n4️⃣ ブロックオブジェクトの全プロパティ:');
    const allKeys = Object.keys(targetBlock);
    console.log(`   プロパティ数: ${allKeys.length}`);
    console.log(`   プロパティ一覧: ${allKeys.join(', ')}`);

    // getBlock(number, true) vs getBlock(number, false) の違いを確認
    console.log('\n5️⃣ getBlock()の第2引数による違い:');
    const blockWithoutTx = await provider.getBlock(targetBlock.number, false);
    const blockWithTx = await provider.getBlock(targetBlock.number, true);
    
    console.log('   getBlock(number, false):');
    console.log(`     - transactions型: ${typeof blockWithoutTx.transactions[0]}`);
    console.log(`     - 例: ${blockWithoutTx.transactions[0]}`);
    
    console.log('   getBlock(number, true):');
    console.log(`     - transactions型: ${typeof blockWithTx.transactions[0]}`);
    console.log(`     - hasプロパティ: ${blockWithTx.transactions[0] ? Object.keys(blockWithTx.transactions[0]).length + '個' : 'N/A'}`);

    // findIndex の動作確認
    if (targetBlock.transactions.length > 0 && typeof targetBlock.transactions[0] === 'object') {
      console.log('\n6️⃣ findIndex動作確認:');
      const testHash = targetBlock.transactions[0].hash;
      const foundIndex = targetBlock.transactions.findIndex(tx => tx.hash === testHash);
      console.log(`   テストハッシュ: ${testHash}`);
      console.log(`   findIndex結果: ${foundIndex}`);
      console.log(`   動作確認: ${foundIndex === 0 ? '✅ 正常' : '❌ 異常'}`);
    }

  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error('詳細:', error);
  }
}

// 実行
debugBlockContents()
  .then(() => console.log('\n✅ デバッグ完了'))
  .catch(console.error);