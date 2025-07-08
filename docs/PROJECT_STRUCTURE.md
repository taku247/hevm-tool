# HyperEVM Tools プロジェクト構造ドキュメント

## 📁 ディレクトリ構造と使い分け

### 🗂️ プロジェクトルート
```
hyperevm-tool/
├── scripts/          # 基本的なブロックチェーン操作スクリプト（レガシー）
├── templates/        # 汎用TypeScriptテンプレート（推奨）
├── custom/           # プロジェクト固有のカスタムスクリプト 🆕
├── src/              # 共通ユーティリティとコアロジック
├── tests/            # テストスイート
├── docs/             # ドキュメント
├── abi/              # 共通ABI定義
└── config/           # グローバル設定ファイル
```

## 📂 各ディレクトリの詳細説明

### 1. `/scripts` - レガシースクリプト
**目的**: 基本的なブロックチェーン操作のための従来型スクリプト  
**使用場面**: 単純なタスクや下位互換性が必要な場合  
**言語**: JavaScript (CommonJS)

#### 主要ファイル:
- `balance_check.js` - ウォレット残高確認
- `contract_interaction.js` - 基本的なコントラクト操作
- `transaction_sender.js` - トランザクション送信

### 2. `/templates` - 汎用テンプレート ⭐推奨
**目的**: 再利用可能な高機能TypeScriptテンプレート  
**使用場面**: 新規開発のベースとして使用  
**言語**: TypeScript (ES Modules)

#### 核心ファイル:
- `contract-utils.ts` - 🔥 すべての機能の基盤となるユーティリティクラス
- `gas-analyzer.ts` - ガス価格分析・監視ツール
- `call-read.ts` - 任意のコントラクトREAD関数実行
- `call-write.ts` - 任意のコントラクトWRITE関数実行
- `contract-deploy.ts` - コントラクトデプロイメント
- `batch-execute.ts` - 複数操作の一括実行

### 3. `/custom` - カスタムスクリプト配置場所 🆕
**目的**: プロジェクト固有の特殊な要件に対応  
**使用場面**: 特定のDEX、アービトラージ、監視などの専門的なタスク  
**構造**:
```
custom/
├── deploy/           # デプロイメントとテスト
├── hyperevm-swap/    # HyperSwap関連スクリプト
├── hyperswap/        # HyperSwap DEX統合
├── kittenswap/       # KittenSwap DEX統合
├── arbitrage/        # アービトラージbot
├── monitoring/       # 価格監視・アラート
├── investigate/      # 調査・分析ツール
└── utils/            # カスタムユーティリティ
```

### 4. `/src` - コアユーティリティ
**目的**: プロジェクト全体で使用される共通機能  
**使用場面**: 他のスクリプトから呼び出される基盤機能

#### 主要モジュール:
- `config/` - 設定管理システム
  - `ConfigLoader.ts` - JSON設定ファイルローダー
  - `interfaces.ts` - TypeScript型定義
- `dex/` - DEX統合管理
  - `DexManager.ts` - 複数DEXプロトコル統合
  - `DexProtocol.ts` - プロトコル実装基底クラス
- `gas-price-utils.ts` - 動的ガス価格計算
- `types.ts` - 共通型定義

### 5. `/tests` - テストスイート
**目的**: 自動テストとCI/CD統合  
**構造**:
```
tests/
├── unit/           # ユニットテスト
├── integration/    # 統合テスト
├── config/         # テスト設定
├── dex/            # DEXプロトコルテスト
├── monitoring/     # 監視機能テスト
└── system/         # システムテスト
```

## 🔧 開発ガイドライン

### 新規開発時の選択基準

#### 1. `templates/`を使用すべき場合:
- 汎用的な機能を開発する
- 他のプロジェクトでも再利用可能
- TypeScriptの型安全性が必要
- ガス最適化機能を活用したい

#### 2. `custom/`を使用すべき場合:
- 特定のDEXやプロトコル専用の機能
- プロジェクト固有のビジネスロジック
- 実験的な機能や一時的なスクリプト
- 特殊な要件がある場合

#### 3. `scripts/`を使用すべき場合:
- 非常にシンプルなタスク
- 既存スクリプトの修正
- JavaScriptで十分な場合

### ベストプラクティス

1. **新規開発は`templates/contract-utils.ts`を基盤に**
   ```typescript
   import { UniversalContractUtils } from '../templates/contract-utils';
   ```

2. **設定は`src/config/`を活用**
   ```typescript
   import { ConfigLoader } from '../src/config/ConfigLoader';
   ```

3. **DEX統合は`DexManager`を使用**
   ```typescript
   import { DexManager } from '../src/dex/DexManager';
   ```

4. **ガス価格は動的に最適化**
   ```typescript
   import { GasStrategy } from '../src/gas-price-utils';
   ```

## 📊 機能マトリックス

| 機能 | scripts/ | templates/ | custom/ |
|------|----------|------------|---------|
| 言語 | JS | TS | JS/TS |
| 型安全性 | ❌ | ✅ | △ |
| ガス最適化 | ❌ | ✅ | ✅ |
| 再利用性 | 低 | 高 | 中 |
| 複雑度対応 | 低 | 高 | 高 |
| 推奨度 | ★☆☆ | ★★★ | ★★☆ |

## 🚀 クイックスタート

### 基本的な残高確認
```bash
node scripts/balance_check.js
```

### 高度なコントラクト操作
```bash
ts-node templates/call-write.ts --help
```

### カスタムDEXスワップ
```bash
node custom/hyperevm-swap/v3-swap-testnet-router01.js --tokenIn WETH --tokenOut PURR --amount 0.001
```

### アービトラージ実行
```bash
node custom/deploy/test-arbitrage-with-detailed-logs.js
```

## 📝 次のステップ

1. [スクリプト詳細ガイド](./SCRIPTS_GUIDE.md) - 各スクリプトの使用方法
2. [開発者ガイド](./DEVELOPER_GUIDE.md) - 新規開発の手順
3. [API リファレンス](./API_REFERENCE.md) - 関数・クラス詳細

---

**最終更新**: 2025年1月8日  
**バージョン**: 2.0.0