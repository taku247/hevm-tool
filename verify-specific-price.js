const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

/**
 * 特定ペアの価格詳細検証
 */

async function verifySpecificPrice(tokenA, tokenB, fee, expectedPrice) {
  console.log(`🔍 ${tokenA}/${tokenB} ${fee}bps 価格詳細検証\n`);
  
  const contracts = {
    quoterV1: '0xF865716B90f09268fF12B6B620e14bEC390B8139',
    quoterV2: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
  };
  
  const tokens = {
    WHYPE: '0x5555555555555555555555555555555555555555',
    UBTC: '0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463',
    UETH: '0xBe6727B535545C67d5cAa73dEa54865B92CF7907'
  };
  
  // 複数の金額でテスト
  const amounts = [
    ethers.utils.parseEther('1'),
    ethers.utils.parseEther('0.1'), 
    ethers.utils.parseEther('10')
  ];
  
  for (const amount of amounts) {
    console.log(`💰 投入量: ${ethers.utils.formatEther(amount)} ${tokenA}`);
    
    // V1テスト
    // V2テスト
    // 価格計算と比較
  }
}

// 使用例
if (require.main === module) {
  // 疑問のあるペアを指定して実行
  // verifySpecificPrice('WHYPE', 'UBTC', 3000, '期待値').catch(console.error);
}

module.exports = { verifySpecificPrice };