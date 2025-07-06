# 📋 HyperSwap ABI命名ガイド

## 🎯 改善された命名規則

### **修正前の問題:**
- `HyperSwapV3Router.json` ← 混乱を招く汎用名
- 実際の機能が不明

### **修正後の明確な命名:**
| ファイル名 | 対象コントラクト | 主要機能 | 用途 |
|-----------|-----------------|---------|------|
| `HyperSwapV2Router.json` | V2 Router | V2スワップ・流動性管理 | V2 DEX操作 |
| `HyperSwapQuoterV1.json` | V3 QuoterV1 | 個別引数クォート | レガシーQuote |
| `HyperSwapQuoterV2.json` | V3 QuoterV2 | Structクォート + 詳細情報 | 現行Quote |
| `HyperSwapV3SwapRouter01.json` | SwapRouter01 | **V3スワップ機能** | **メインスワップ** |
| `HyperSwapV3SwapRouter02.json` | SwapRouter02 | 拡張機能・Multicall | 高度な操作 |

## 🔧 対応するコントラクトアドレス (テストネット)

| ABI | アドレス | 主要関数 |
|-----|----------|----------|
| `HyperSwapV2Router.json` | `0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853` | `swapExactTokensForTokens` |
| `HyperSwapQuoterV2.json` | `0x7FEd8993828A61A5985F384Cee8bDD42177Aa263` | `quoteExactInputSingle` |
| `HyperSwapV3SwapRouter01.json` | `0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990` | `exactInputSingle` ✅ |
| `HyperSwapV3SwapRouter02.json` | `0x51c5958FFb3e326F8d7AA945948159f1FF27e14A` | `multicall` |

## 💡 使い分けガイド

### **V3スワップを実行したい場合:**
```javascript
// ✅ 正しい選択
const router01ABI = require('./abi/HyperSwapV3SwapRouter01.json');
const router01 = new ethers.Contract('0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990', router01ABI, wallet);
await router01.exactInputSingle(params);
```

### **V3クォートを取得したい場合:**
```javascript
// ✅ 最新のStruct形式
const quoterABI = require('./abi/HyperSwapQuoterV2.json');
const quoter = new ethers.Contract('0x7FEd8993828A61A5985F384Cee8bDD42177Aa263', quoterABI, provider);
const result = await quoter.quoteExactInputSingle({
  tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0
});
```

### **V2スワップを実行したい場合:**
```javascript
// ✅ V2はシンプル
const v2ABI = require('./abi/HyperSwapV2Router.json');
const v2Router = new ethers.Contract('0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853', v2ABI, wallet);
await v2Router.swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline);
```

## 🚨 よくある間違い

### **❌ 間違った組み合わせ:**
```javascript
// SwapRouter02でV3スワップしようとする
const router02 = new ethers.Contract('0x51c...', router02ABI, wallet);
await router02.exactInputSingle(params); // ← この関数は存在しない！
```

### **✅ 正しい組み合わせ:**
```javascript
// SwapRouter01でV3スワップ
const router01 = new ethers.Contract('0xD81...', router01ABI, wallet);
await router01.exactInputSingle(params); // ← 正しい！
```

## 📊 今回の修正内容

1. **ファイルリネーム**: `HyperSwapV3Router.json` → `HyperSwapV3SwapRouter02.json`
2. **設定修正**: dex-config.jsonの全参照を更新
3. **文書更新**: README、分析レポートの全参照を修正
4. **明確化**: 機能別の使い分けガイド作成

この命名規則により、開発者が迷うことなく適切なABIを選択できるようになりました。