const { ethers } = require('ethers');

/**
 * V2直接プールスワップの複雑さ詳細解説
 */
class V2DirectComplexity {
  constructor() {
    // V2 Pair ABI（完全版）
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
      },
      {
        "name": "sync",
        "type": "function",
        "stateMutability": "nonpayable"
      }
    ];
  }

  /**
   * 🔴 問題1: 手動reserves取得とAMM計算
   */
  async demonstrateReservesComplexity(provider, pairAddress) {
    console.log('🔴 問題1: 手動reserves取得とAMM計算の複雑さ\n');
    
    const pair = new ethers.Contract(pairAddress, this.pairABI, provider);
    
    try {
      // 1. プール情報取得（複数の非同期呼び出し）
      console.log('📡 1. プール情報取得（Router不要の処理）:');
      const [token0, token1, reserves] = await Promise.all([
        pair.token0(),
        pair.token1(),
        pair.getReserves()
      ]);
      
      console.log(`   Token0: ${token0}`);
      console.log(`   Token1: ${token1}`);
      console.log(`   Reserve0: ${ethers.utils.formatEther(reserves.reserve0)}`);
      console.log(`   Reserve1: ${ethers.utils.formatEther(reserves.reserve1)}`);
      console.log(`   LastUpdate: ${new Date(reserves.blockTimestampLast * 1000).toLocaleString()}`);
      
      // 2. AMM計算の手動実装
      console.log('\n🧮 2. AMM計算の手動実装:');
      const amountIn = ethers.utils.parseEther('10'); // 10 tokens
      
      // Uniswap V2の計算式実装
      const amountOut = this.calculateAmountOutManual(
        amountIn,
        reserves.reserve0,
        reserves.reserve1
      );
      
      console.log(`   入力: ${ethers.utils.formatEther(amountIn)}`);
      console.log(`   計算出力: ${ethers.utils.formatEther(amountOut)}`);
      
      // 3. Router比較
      console.log('\n📊 3. Router使用との比較:');
      console.log('   Router使用: router.getAmountsOut(amountIn, [token0, token1])');
      console.log('   直接計算: 上記の手動実装が必要');
      
    } catch (error) {
      console.log(`❌ エラー: ${error.message}`);
    }
  }

  /**
   * Uniswap V2 AMM計算式の手動実装
   * ⚠️ この計算をRouterが自動でやってくれる
   */
  calculateAmountOutManual(amountIn, reserveIn, reserveOut) {
    console.log('   🔢 手動AMM計算:');
    console.log('      式: (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)');
    
    // 手数料考慮（0.3% = 997/1000）
    const amountInWithFee = amountIn.mul(997);
    console.log(`      手数料後入力: ${ethers.utils.formatEther(amountInWithFee)} * 997/1000`);
    
    // 分子計算
    const numerator = amountInWithFee.mul(reserveOut);
    console.log(`      分子: ${ethers.utils.formatEther(numerator)}`);
    
    // 分母計算
    const denominator = reserveIn.mul(1000).add(amountInWithFee);
    console.log(`      分母: ${ethers.utils.formatEther(denominator)}`);
    
    // 最終結果
    const result = numerator.div(denominator);
    console.log(`      結果: ${ethers.utils.formatEther(result)}`);
    
    return result;
  }

  /**
   * 🔴 問題2: Token順序判定の複雑さ
   */
  async demonstrateTokenOrderComplexity(provider, pairAddress, tokenIn) {
    console.log('\n🔴 問題2: Token順序判定の複雑さ\n');
    
    const pair = new ethers.Contract(pairAddress, this.pairABI, provider);
    
    try {
      const [token0, token1] = await Promise.all([
        pair.token0(),
        pair.token1()
      ]);
      
      console.log('📋 Token順序の問題:');
      console.log(`   Pair Token0: ${token0}`);
      console.log(`   Pair Token1: ${token1}`);
      console.log(`   Input Token: ${tokenIn}`);
      
      // 順序判定ロジック
      const isToken0 = tokenIn.toLowerCase() === token0.toLowerCase();
      console.log(`   Is Token0?: ${isToken0}`);
      
      console.log('\n🔄 スワップパラメータ設定:');
      if (isToken0) {
        console.log('   Token0 → Token1 スワップ');
        console.log('   amount0Out = 0');
        console.log('   amount1Out = 計算結果');
      } else {
        console.log('   Token1 → Token0 スワップ');
        console.log('   amount0Out = 計算結果');
        console.log('   amount1Out = 0');
      }
      
      console.log('\n⚠️ 順序間違いのリスク:');
      console.log('   - 間違った順序 → スワップ失敗');
      console.log('   - Reserve取得ミス → 計算エラー');
      console.log('   - Token確認不足 → 予期しない結果');
      
    } catch (error) {
      console.log(`❌ エラー: ${error.message}`);
    }
  }

  /**
   * 🔴 問題3: 状態同期の複雑さ
   */
  demonstrateStateSyncComplexity() {
    console.log('\n🔴 問題3: 状態同期とタイミングの複雑さ\n');
    
    console.log('⏰ タイミング問題:');
    console.log('   1. Reserves取得');
    console.log('   2. 計算実行');  
    console.log('   3. スワップ送信');
    console.log('   4. ⚠️ この間にreservesが変わる可能性');
    
    console.log('\n🔄 状態変更のリスク:');
    console.log('   - 他のトランザクションでプール状態変更');
    console.log('   - 計算時とスワップ時の価格乖離');
    console.log('   - MEVボットによる先行取引');
    
    console.log('\n🛡️ Router保護機能:');
    console.log('   - 最新状態での計算');
    console.log('   - アトミックな実行');
    console.log('   - スリッページ保護');
    console.log('   - デッドライン設定');
  }

  /**
   * 完全な直接スワップ実装例（危険）
   */
  showCompleteDirectImplementation() {
    console.log('\n💀 完全な直接スワップ実装の複雑さ\n');
    
    const code = `
// ⚠️ 危険: 実際の直接プールスワップ実装
async function dangerousDirectSwap(provider, wallet, pairAddress, tokenIn, amountIn) {
  const pair = new ethers.Contract(pairAddress, pairABI, wallet);
  
  // 1. プール情報取得
  const [token0, token1, reserves] = await Promise.all([
    pair.token0(), pair.token1(), pair.getReserves()
  ]);
  
  // 2. Token順序判定
  const isToken0 = tokenIn.toLowerCase() === token0.toLowerCase();
  const [reserveIn, reserveOut] = isToken0 
    ? [reserves.reserve0, reserves.reserve1]
    : [reserves.reserve1, reserves.reserve0];
  
  // 3. AMM計算
  const amountInWithFee = amountIn.mul(997);
  const numerator = amountInWithFee.mul(reserveOut);
  const denominator = reserveIn.mul(1000).add(amountInWithFee);
  const amountOut = numerator.div(denominator);
  
  // 4. スリッページチェック（手動実装）
  const minAmountOut = amountOut.mul(995).div(1000); // 0.5%
  if (amountOut.lt(minAmountOut)) {
    throw new Error('Slippage too high');
  }
  
  // 5. スワップパラメータ設定
  const [amount0Out, amount1Out] = isToken0 
    ? [0, amountOut] : [amountOut, 0];
  
  // 6. 危険なスワップ実行
  const tx = await pair.swap(
    amount0Out,
    amount1Out, 
    wallet.address,
    '0x' // callback data
  );
  
  // 7. 失敗リスク
  // - MEV攻撃
  // - フロントランニング
  // - リエントランシー
  // - 計算ミス
  // - 状態変更
}`;

    console.log('📝 実装の複雑さ:');
    console.log(code);
    
    console.log('\n❌ 実装上の問題点:');
    console.log('   1. 70行以上のコード vs Router 1行');
    console.log('   2. エラー処理が不完全');
    console.log('   3. セキュリティホールが多数');
    console.log('   4. テストが困難');
    console.log('   5. 保守コストが高い');
    
    console.log('\n✅ Router使用の利点:');
    console.log('   1. 1行でスワップ完了');
    console.log('   2. 包括的なエラー処理');
    console.log('   3. セキュリティが検証済み');
    console.log('   4. 十分にテスト済み');
    console.log('   5. 保守コストが低い');
  }
}

// 実行
async function main() {
  const complexity = new V2DirectComplexity();
  
  console.log('🎯 V2直接プールスワップの複雑さ詳細解説\n');
  
  // 問題の詳細説明
  complexity.demonstrateStateSyncComplexity();
  complexity.showCompleteDirectImplementation();
  
  console.log('\n📋 結論:');
  console.log('V2でもRouterを使うべき理由が明確になりました');
  console.log('直接プールは技術的興味としては面白いが、実用性は低い');
}

if (require.main === module) {
  main();
}

module.exports = { V2DirectComplexity };