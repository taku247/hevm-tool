const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

/**
 * 実際のアービトラージ実行ブロック (26364538) の詳細確認
 */

async function checkSpecificBlock() {
  console.log('🔍 Block 26364538 詳細確認');
  console.log('========================\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const targetBlockNumber = 26364538;
    const targetTxHash = '0x2f493bb1fedd20d7f527e7c2802acbc79a03b1f251247589c482e1f8c94ce36f';

    // 複数の方法でブロック情報を取得
    console.log('1️⃣ getBlock(number, true) での取得:');
    const blockWithTx = await provider.getBlock(targetBlockNumber, true);
    
    console.log(`   ブロック番号: ${blockWithTx.number}`);
    console.log(`   トランザクション数: ${blockWithTx.transactions.length}`);
    console.log(`   トランザクションの型: ${typeof blockWithTx.transactions[0]}`);
    console.log(`   トランザクション内容: ${JSON.stringify(blockWithTx.transactions[0])}`);

    console.log('\n2️⃣ getBlock(number, false) での取得:');
    const blockWithoutTx = await provider.getBlock(targetBlockNumber, false);
    console.log(`   トランザクションの型: ${typeof blockWithoutTx.transactions[0]}`);
    console.log(`   トランザクション内容: ${blockWithoutTx.transactions[0]}`);

    console.log('\n3️⃣ getTransaction で個別取得:');
    const tx = await provider.getTransaction(targetTxHash);
    if (tx) {
      console.log(`   hash: ${tx.hash}`);
      console.log(`   from: ${tx.from}`);
      console.log(`   to: ${tx.to}`);
      console.log(`   gasPrice: ${tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') + ' Gwei' : 'null'}`);
      console.log(`   gasLimit: ${tx.gasLimit}`);
      console.log(`   blockNumber: ${tx.blockNumber}`);
      console.log(`   index: ${tx.index}`);
    }

    console.log('\n4️⃣ ブロック内でのトランザクション順位確認:');
    // 実際のログでの処理を再現
    if (typeof blockWithTx.transactions[0] === 'string') {
      console.log('   ⚠️  transactions配列はハッシュ文字列の配列です');
      
      // ハッシュでのfindIndex
      const txIndex = blockWithTx.transactions.findIndex(txHash => txHash === targetTxHash);
      console.log(`   findIndexの結果: ${txIndex}`);
      console.log(`   順位: ${txIndex >= 0 ? (txIndex + 1) + '/' + blockWithTx.transactions.length : '見つからない'}`);
      
      // 代替案: getTransactionでindex取得
      if (tx && tx.index !== undefined) {
        console.log(`   getTransactionからのindex: ${tx.index}`);
        console.log(`   実際の順位: ${tx.index + 1}/${blockWithTx.transactions.length}`);
      }
    }

    console.log('\n5️⃣ 詳細ログスクリプトの動作分析:');
    console.log('   問題: getBlock(number, true)でもトランザクションがハッシュ文字列として返される');
    console.log('   原因: HyperEVM testnetのRPC実装の仕様');
    console.log('   影響: tx.gasPrice, tx.from等のプロパティにアクセスできない');
    console.log('   解決: 各トランザクションをgetTransactionで個別取得する必要がある');

    console.log('\n6️⃣ 正しい実装方法の提案:');
    console.log('```javascript');
    console.log('// ブロック内の全トランザクション詳細を取得');
    console.log('const txDetails = [];');
    console.log('for (const txHash of blockWithTx.transactions) {');
    console.log('  const txDetail = await provider.getTransaction(txHash);');
    console.log('  txDetails.push(txDetail);');
    console.log('}');
    console.log('// その後、txDetailsで分析処理');
    console.log('```');

  } catch (error) {
    console.error('❌ エラー:', error.message);
  }
}

checkSpecificBlock()
  .then(() => console.log('\n✅ 確認完了'))
  .catch(console.error);