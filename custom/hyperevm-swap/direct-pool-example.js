const { ethers } = require('ethers');

/**
 * 直接プールスワップの実装例（教育目的）
 * ⚠️ 本番利用非推奨 - Routerの使用を強く推奨
 */
class DirectPoolSwap {
  constructor() {
    // V2 Pair ABI（必要最小限）
    this.pairABI = [
      {
        "name": "getReserves",
        "type": "function",
        "stateMutability": "view",
        "outputs": [
          {"name": "reserve0", "type": "uint112"},
          {"name": "reserve1", "type": "uint112"},
          {"name": "blockTimestampLast", "type": "uint32"}
        ]
      },
      {
        "name": "token0",
        "type": "function",
        "stateMutability": "view",
        "outputs": [{"name": "", "type": "address"}]
      },
      {
        "name": "token1", 
        "type": "function",
        "stateMutability": "view",
        "outputs": [{"name": "", "type": "address"}]
      },
      {
        "name": "swap",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
          {"name": "amount0Out", "type": "uint256"},
          {"name": "amount1Out", "type": "uint256"},
          {"name": "to", "type": "address"},
          {"name": "data", "type": "bytes"}
        ]
      }
    ];

    // V3 Pool ABI（必要最小限）
    this.poolABI = [
      {
        "name": "slot0",
        "type": "function", 
        "stateMutability": "view",
        "outputs": [
          {"name": "sqrtPriceX96", "type": "uint160"},
          {"name": "tick", "type": "int24"},
          {"name": "observationIndex", "type": "uint16"},
          {"name": "observationCardinality", "type": "uint16"},
          {"name": "observationCardinalityNext", "type": "uint16"},
          {"name": "feeProtocol", "type": "uint8"},
          {"name": "unlocked", "type": "bool"}
        ]
      },
      {
        "name": "swap",
        "type": "function",
        "stateMutability": "nonpayable", 
        "inputs": [
          {"name": "recipient", "type": "address"},
          {"name": "zeroForOne", "type": "bool"},
          {"name": "amountSpecified", "type": "int256"},
          {"name": "sqrtPriceLimitX96", "type": "uint160"},
          {"name": "data", "type": "bytes"}
        ],
        "outputs": [
          {"name": "amount0", "type": "int256"},
          {"name": "amount1", "type": "int256"}
        ]
      }
    ];
  }

  /**
   * V2直接プールスワップ（理論的実装）
   * ⚠️ 実用には多くの追加実装が必要
   */
  async v2DirectSwap(provider, pairAddress, tokenIn, amountIn, to) {
    console.log('⚠️ V2直接プールスワップ（教育目的のみ）\n');
    
    const pair = new ethers.Contract(pairAddress, this.pairABI, provider);
    
    // 1. プール情報取得
    const [token0, token1, reserves] = await Promise.all([
      pair.token0(),
      pair.token1(), 
      pair.getReserves()
    ]);
    
    console.log('📊 プール情報:');
    console.log(`   Token0: ${token0}`);
    console.log(`   Token1: ${token1}`); 
    console.log(`   Reserve0: ${ethers.utils.formatEther(reserves.reserve0)}`);
    console.log(`   Reserve1: ${ethers.utils.formatEther(reserves.reserve1)}`);
    
    // 2. トークン順序判定
    const isToken0 = tokenIn.toLowerCase() === token0.toLowerCase();
    const [reserveIn, reserveOut] = isToken0 
      ? [reserves.reserve0, reserves.reserve1]
      : [reserves.reserve1, reserves.reserve0];
    
    // 3. AMM計算（x * y = k）
    const amountInWithFee = amountIn.mul(997); // 0.3%手数料
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(1000).add(amountInWithFee);
    const amountOut = numerator.div(denominator);
    
    console.log('\n💰 計算結果:');
    console.log(`   入力量: ${ethers.utils.formatEther(amountIn)}`);
    console.log(`   出力量: ${ethers.utils.formatEther(amountOut)}`);
    
    // 4. スワップパラメータ設定
    const [amount0Out, amount1Out] = isToken0 
      ? [0, amountOut] 
      : [amountOut, 0];
    
    console.log('\n🔄 スワップパラメータ:');
    console.log(`   amount0Out: ${ethers.utils.formatEther(amount0Out)}`);
    console.log(`   amount1Out: ${ethers.utils.formatEther(amount1Out)}`);
    
    // ⚠️ 実際のスワップ実行は省略（危険なため）
    console.log('\n⚠️ 実際のスワップ実行は省略');
    console.log('理由: セキュリティリスク、複雑なエラー処理が必要');
    
    return {
      method: 'v2_direct_pool',
      amountOut,
      gasEstimate: '~120,000', // Router比で約80,000削減
      risks: [
        'MEV攻撃リスク',
        'スリッページ保護なし', 
        'リエントランシー攻撃',
        '複雑なエラー処理'
      ]
    };
  }

  /**
   * V3直接プールスワップ（概念的実装）
   * ⚠️ 実装難易度極めて高い
   */
  async v3DirectSwap(provider, poolAddress, tokenIn, amountIn, to) {
    console.log('⚠️ V3直接プールスワップ（概念のみ）\n');
    
    const pool = new ethers.Contract(poolAddress, this.poolABI, provider);
    
    // 1. プール状態取得
    const slot0 = await pool.slot0();
    
    console.log('📊 V3プール状態:');
    console.log(`   sqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
    console.log(`   currentTick: ${slot0.tick}`);
    console.log(`   unlocked: ${slot0.unlocked}`);
    
    // 2. 価格計算（非常に複雑）
    const sqrtPriceX96 = slot0.sqrtPriceX96;
    const price = sqrtPriceX96.mul(sqrtPriceX96).div(ethers.BigNumber.from(2).pow(192));
    
    console.log('\n💹 価格情報:');
    console.log(`   現在価格: ${ethers.utils.formatUnits(price, 18)}`);
    
    // ⚠️ 実際の計算は極めて複雑
    console.log('\n🧮 V3スワップ計算:');
    console.log('   - tick境界の計算');
    console.log('   - 流動性分布の取得');
    console.log('   - sqrtPriceX96の更新計算');
    console.log('   - 手数料の正確な計算');
    console.log('   → 実装難易度: 極めて高い');
    
    return {
      method: 'v3_direct_pool',
      complexity: 'extremely_high',
      gasEstimate: '~80,000', // Router比で大幅削減可能
      risks: [
        '数学的計算の複雑さ',
        'tick境界の処理',
        '流動性分布の理解',
        'MEV攻撃リスク',
        '実装バグのリスク'
      ]
    };
  }

  /**
   * Router vs 直接プール比較
   */
  showComparison() {
    console.log('\n📊 Router vs 直接プール比較\n');
    
    const comparison = [
      {
        項目: '実装難易度',
        Router: '簡単',
        直接プール: 'V2:難しい V3:極めて困難'
      },
      {
        項目: 'ガス効率',
        Router: '標準',
        直接プール: '最高効率'
      },
      {
        項目: 'セキュリティ',
        Router: '高い',
        直接プール: 'リスクあり'
      },
      {
        項目: 'エラー処理',
        Router: '充実',
        直接プール: '手動実装必要'
      },
      {
        項目: 'MEV保護',
        Router: 'ある程度あり',
        直接プール: 'なし'
      },
      {
        項目: '開発コスト',
        Router: '低い',
        直接プール: '非常に高い'
      }
    ];
    
    console.table(comparison);
    
    console.log('\n🎯 推奨事項:');
    console.log('✅ 一般的な用途: Router使用を強く推奨');
    console.log('⚠️ 特殊な用途: 十分な検証後に直接プール検討');
    console.log('❌ 避けるべき: 理解不足での直接プール使用');
  }
}

// 使用例
async function main() {
  const directSwap = new DirectPoolSwap();
  
  console.log('🏊 直接プールスワップ解説\n');
  
  // 比較表示
  directSwap.showComparison();
  
  console.log('\n📋 結論:');
  console.log('Router使用が最適解である理由が明確になりました');
}

if (require.main === module) {
  main();
}

module.exports = { DirectPoolSwap };