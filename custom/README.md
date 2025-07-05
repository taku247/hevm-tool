# Custom Scripts

このフォルダは、templatesをベースにしたカスタムスクリプトの配置場所です。

## 使用方法

### 1. Templates ベース開発
```typescript
// custom/my-script.ts
import { UniversalContractUtils } from '../templates/contract-utils';
import { GasStrategy } from '../src/gas-price-utils';

// カスタムロジック実装
```

### 2. 実行方法
```bash
ts-node custom/my-script.ts [arguments]
```

## ディレクトリ構成

```
custom/
├── README.md              # このファイル
├── hyperswap/             # Hyperswap関連スクリプト
├── kittenswap/            # Kittenswap関連スクリプト
├── arbitrage/             # アービトラージ関連
├── monitoring/            # 監視・アラート関連
└── utils/                 # 共通ユーティリティ
```

## 開発ガイドライン

1. **Templatesを基盤として使用**
   - `templates/contract-utils.ts`をインポート
   - 動的ガス価格機能を活用
   - HyperEVM固有の制約（2M gas制限）を考慮

2. **エラーハンドリング**
   - 適切なtry-catch文
   - ガス価格監視との連携

3. **ドキュメント**
   - 各スクリプトに使用方法をコメントで記載
   - 引数の説明を含める

## Templates活用パターン

### 直接実行型
```typescript
// templatesの機能を直接呼び出し
const utils = new UniversalContractUtils(rpcUrl, privateKey);
const result = await utils.callContractWrite(...);
```

### 監視統合型
```typescript
// ガス価格監視と組み合わせ
const gasAnalysis = await utils.analyzeCurrentGasPrices();
if (gasAnalysis.networkCongestion === 'low') {
  // 実行
}
```

### バッチ処理型
```typescript
// 複数操作の組み合わせ
const operations = [
  { type: 'read', ... },
  { type: 'write', ... }
];
```