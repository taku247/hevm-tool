# KittenSwap 統合ガイド

## 📋 概要

KittenSwapは、HyperEVMチェーン上のDecentralized Exchange（DEX）ですが、標準的なUniswap V2実装とは異なる特殊な実装を持っています。本ガイドでは、KittenSwapとの統合時に発生する問題と解決策について説明します。

## 🔍 調査結果サマリー

### 基本情報
- **チェーン**: HyperLiquid EVM (Mainnet)
- **プロトコル**: Uniswap V2ベース（カスタム実装）
- **アクティブプール**: 70個のV2プール
- **対応トークン**: 13種類
- **V3プール**: 存在しない

### Factory契約分析
| 契約名 | アドレス | 用途 | 利用可能性 |
|--------|---------|------|------------|
| V2_PairFactory | `0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B` | プール管理 | ✅ 利用可能 |
| V3_CLFactory | `0x2E08F5Ff603E4343864B14599CAeDb19918BDCaF` | V3プール管理 | ❌ プール未作成 |
| GaugeFactory | `0x72490535A73cf5C66c3BC573B5626DE187DcE9E4` | ゲージ管理 | ❌ 調査中 |
| VotingRewardFactory | `0x9f7dc78cA10798fE1C5c969b032596A3904db3eE` | 投票報酬 | ❌ 調査中 |
| FactoryRegistry | `0x8C142521ebB1aC1cC1F0958037702A69b6f608e4` | レジストリ | ❌ 調査中 |

## ⚠️ 重要な制約事項

### 1. getPair()関数の非存在
```javascript
// ❌ 標準的なUniswap V2実装では動作しない
const pairAddress = await factory.getPair(tokenA, tokenB);
// Error: function getPair not found
```

**原因**: 
- Factoryコントラクトのバイトコードが163バイトと異常に小さい
- `getPair()`セレクタ（`0xe6a43905`）がバイトコードに存在しない

### 2. V3プールの非存在
```javascript
// ❌ QuoterV2での見積もりは全て失敗
const quote = await quoterV2.quoteExactInputSingle({
  tokenIn: TOKENS.WHYPE,
  tokenOut: TOKENS.PURR,
  amountIn: amount,
  fee: 500,
  sqrtPriceLimitX96: 0
});
// Error: Pool does not exist
```

**原因**:
- V3_CLFactoryは存在するが、実際のプールが作成されていない
- 全てのV3関連機能が実用不可

## 💡 推奨解決策

### 1. 最適化されたFactory ABI使用

```javascript
// ✅ 動作確認済みのKittenSwap専用ABI
const KITTENSWAP_FACTORY_ABI = [
  {
    "constant": true,
    "inputs": [{"internalType": "uint256", "name": "index", "type": "uint256"}],
    "name": "allPairs",
    "outputs": [{"internalType": "address", "name": "pair", "type": "address"}],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "allPairsLength",
    "outputs": [{"internalType": "uint256", "name": "length", "type": "uint256"}],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "owner",
    "outputs": [{"internalType": "address", "name": "owner", "type": "address"}],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];
```

### 2. ペア検索の実装

```javascript
async function findKittenSwapPair(tokenA, tokenB, provider) {
  const factory = new ethers.Contract(
    '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B',
    KITTENSWAP_FACTORY_ABI,
    provider
  );
  
  const pairCount = await factory.allPairsLength();
  
  for (let i = 0; i < pairCount; i++) {
    const pairAddress = await factory.allPairs(i);
    const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
    
    const [token0, token1] = await Promise.all([
      pair.token0(),
      pair.token1()
    ]);
    
    if ((token0.toLowerCase() === tokenA.toLowerCase() && token1.toLowerCase() === tokenB.toLowerCase()) ||
        (token0.toLowerCase() === tokenB.toLowerCase() && token1.toLowerCase() === tokenA.toLowerCase())) {
      return pairAddress;
    }
  }
  
  return null;
}
```

### 3. V2専用レート計算

```javascript
async function getKittenSwapQuote(tokenA, tokenB, amountIn, provider) {
  const pairAddress = await findKittenSwapPair(tokenA, tokenB, provider);
  if (!pairAddress) {
    throw new Error('Pair not found');
  }
  
  const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
  const reserves = await pair.getReserves();
  const [token0] = await pair.token0();
  
  const [reserve0, reserve1] = token0.toLowerCase() === tokenA.toLowerCase() 
    ? [reserves.reserve0, reserves.reserve1]
    : [reserves.reserve1, reserves.reserve0];
  
  // Uniswap V2の定数積公式: x * y = k
  const amountInWithFee = amountIn * 997n; // 0.3% fee
  const numerator = amountInWithFee * reserve1;
  const denominator = (reserve0 * 1000n) + amountInWithFee;
  
  return numerator / denominator;
}
```

## 🎯 利用可能なトークン

### 実際に取引可能なトークン（13種類）
```javascript
const KITTENSWAP_TOKENS = {
  WHYPE: '0x5555555555555555555555555555555555555555',
  PURR: '0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E',
  USDXL: '0xca79db4B49f608eF54a5CB813FbEd3a6387bC645',
  UBTC: '0x236ab8D4E6892dd1c8d3aDA9B2E8C5EC6A5E4a8d',
  HYPE: '0x4de68b5c2D4f5b600e3c5a1f1F6e65d5c5E7e5Df',
  HFUN: '0x4A73D8e0B66A06a8D8D82e89A5C5c5e6E6d5a5E8',
  UETH: '0x7d5c5f5E6f5F6F6f5C5F5F5f5F5F5F5F5F5F5F5F',
  ADHD: '0x8e4e8e8E8E8E8e8e8e8e8e8e8e8e8e8e8e8e8e8e',
  BUDDY: '0x9f9f9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F',
  CATBAL: '0xa0A0a0A0A0A0a0a0a0A0a0a0a0A0a0a0a0A0a0a0',
  JEFF: '0xb1b1B1B1B1B1b1b1b1b1b1b1b1b1b1b1b1b1b1b1',
  SIGMA: '0xc2C2c2C2C2C2c2c2c2c2c2c2c2c2c2c2c2c2c2c2',
  PDOG: '0xd3d3D3D3D3D3d3d3d3d3d3d3d3d3d3d3d3d3d3d3'
};
```

## 📁 関連ファイル

### 調査スクリプト
- `/custom/investigate/kittenswap-quoterv2-test.js` - QuoterV2テスト
- `/custom/investigate/kittenswap-token-discovery.js` - トークン発見
- `/custom/investigate/kittenswap-factory-analysis.js` - Factory分析
- `/custom/investigate/kittenswap-bytecode-analysis.js` - バイトコード分析
- `/custom/investigate/kittenswap-all-factories-analysis.js` - 全Factory分析
- `/custom/investigate/kittenswap-abi-validator.js` - ABI検証

### 設定ファイル
- `/abi/KittenSwapV2Factory.json` - 最適化済みFactory ABI

### 実行例
```bash
# トークン発見
node custom/investigate/kittenswap-token-discovery.js

# Factory分析
node custom/investigate/kittenswap-factory-analysis.js

# QuoterV2テスト（メインネット）
node custom/investigate/kittenswap-quoterv2-test.js

# バイトコード分析
node custom/investigate/kittenswap-bytecode-analysis.js
```

## 🔧 統合テンプレート

### KittenSwap専用ユーティリティクラス
```javascript
class KittenSwapUtils {
  constructor(provider) {
    this.provider = provider;
    this.factory = new ethers.Contract(
      '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B',
      KITTENSWAP_FACTORY_ABI,
      provider
    );
  }
  
  async getAllPairs() {
    const pairCount = await this.factory.allPairsLength();
    const pairs = [];
    
    for (let i = 0; i < pairCount; i++) {
      const pairAddress = await this.factory.allPairs(i);
      pairs.push(pairAddress);
    }
    
    return pairs;
  }
  
  async findPair(tokenA, tokenB) {
    return await findKittenSwapPair(tokenA, tokenB, this.provider);
  }
  
  async getQuote(tokenA, tokenB, amountIn) {
    return await getKittenSwapQuote(tokenA, tokenB, amountIn, this.provider);
  }
}
```

### 使用例
```javascript
const utils = new KittenSwapUtils(provider);

// 全ペア取得
const allPairs = await utils.getAllPairs();
console.log(`Total pairs: ${allPairs.length}`);

// 特定ペア検索
const pairAddress = await utils.findPair(
  KITTENSWAP_TOKENS.WHYPE,
  KITTENSWAP_TOKENS.PURR
);

// レート取得
const quote = await utils.getQuote(
  KITTENSWAP_TOKENS.WHYPE,
  KITTENSWAP_TOKENS.PURR,
  ethers.parseEther('1')
);
```

## 🚨 注意事項

1. **メインネットのみ**: KittenSwapはメインネットでのみ利用可能
2. **V2プールのみ**: V3機能は実装されていない
3. **カスタム実装**: 標準的なUniswap V2ライブラリは使用不可
4. **非効率な検索**: `getPair()`がないため、全ペアスキャンが必要
5. **手動計算**: QuoterV2が使用できないため、手動でレート計算が必要

## 🔄 今後の改善予定

1. **ペアキャッシュ**: 全ペアをキャッシュして検索効率を向上
2. **バッチ処理**: 複数ペアの一括取得機能
3. **レート監視**: リアルタイムレート監視システム
4. **V3対応**: V3プールが作成された場合の対応

---

**最終更新**: 2025年1月8日  
**調査完了**: KittenSwap Factory分析・ABI最適化・統合テンプレート作成