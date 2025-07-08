# Custom Scripts 詳細インデックス

## 📁 custom/deploy/ - デプロイメント・テストスクリプト

### コントラクトデプロイメント

#### 🆕 MultiSwap関連
- **multiswap-deploy-test.js** - MultiSwapの基本デプロイとテスト
- **deploy-arbitrage-simple.js** - ChatGPT推奨アービトラージコントラクトデプロイ
- **multiswap-debug-deploy.js** - デバッグ版MultiSwapデプロイ
- **multiswap-lite-deploy.js** - 軽量版MultiSwapデプロイ
- **multiswap-v3only-deploy.js** - V3専用MultiSwapデプロイ

#### 基本コントラクト
- **simple-deploy-test.js** - シンプルなコントラクトデプロイテスト
- **actual-deploy-test.js** - 実際のデプロイメントテスト
- **hyperevm-deploy-test.js** - HyperEVM特化デプロイテスト
- **organized-deploy-test.js** - 整理されたデプロイフロー

#### TypeScript版
- **deployment-check.ts** - デプロイメント確認ツール
- **erc20-token-test.ts** - ERC20トークンデプロイテスト
- **simple-storage-contract.ts** - SimpleStorageデプロイ

### テスト・検証スクリプト

#### アービトラージテスト
- **test-arbitrage-simple.js** - 基本的なアービトラージテスト
- **test-arbitrage-with-detailed-logs.js** 🔥 - 詳細ログ付きアービトラージテスト
- **test-deployed-arbitrage.js** - デプロイ済みコントラクトのテスト

#### MultiSwapテスト
- **multiswap-usage-test.js** - MultiSwap使用テスト
- **multiswap-fixed-test.js** - 修正版MultiSwapテスト
- **multiswap-v3-debug-test.js** - V3デバッグテスト
- **test-multihop-v3.js** - V3マルチホップテスト
- **test-flexible-multihop.js** - 柔軟なマルチホップテスト
- **test-optimized-multihop.js** - 最適化マルチホップテスト

#### ルーター・スワップテスト
- **direct-v2-swap-test.js** - V2直接スワップテスト
- **test-v2-purr-hfun.js** - V2 PURR-HFUNペアテスト
- **router-connectivity-test.js** - ルーター接続性テスト
- **simple-multiswap-test.js** - シンプルなマルチスワップテスト

### 分析・調査スクリプト

#### ルーター分析
- **investigate-router-pairs.js** - ルーターペア調査
- **analyze-v2-routes.js** - V2ルート分析（JSON出力）
- **check-v3-pools.js** - V3プール確認
- **analysis-fund-flow-patterns.js** - 資金フローパターン分析

#### ABI・アドレス検証
- **abi-comparison-test.js** - ABI比較テスト
- **address-abi-verification.js** - アドレス・ABI検証
- **official-abi-comparison.js** - 公式ABI比較

#### デバッグツール
- **debug-approve-test.js** - Approveデバッグテスト
- **debug-block-contents.js** - ブロック内容デバッグ
- **check-specific-block.js** - 特定ブロック詳細確認

#### ガス見積もり
- **estimate-gas-arbitrage.js** - アービトラージガス見積もり

### 📂 contracts/ - Solidityコントラクト

- **Counter.sol** - カウンターコントラクト（テスト用）
- **SimpleStorage.sol** - シンプルストレージ（テスト用）
- **Token.sol** - ERC20トークン（テスト用）
- **MultiSwap.sol** - マルチスワップ基本実装
- **MultiSwapArbitrageSimple.sol** 🆕 - ChatGPT推奨アービトラージ実装
- **MultiSwapDebug.sol** - デバッグ版
- **MultiSwapFlexible.sol** - 柔軟な実装
- **MultiSwapLite.sol** - 軽量版
- **MultiSwapOptimized.sol** - 最適化版
- **MultiSwapV3Only.sol** - V3専用版

### 📂 abi/ - ABI定義
- **MultiSwap.json** - MultiSwap ABI
- **MultiSwapDebug.json** - デバッグ版ABI

### 📂 test/ - テストファイル
- **MultiSwap.test.js** - MultiSwapユニットテスト
- **Counter.test.js** - Counterテスト
- **SimpleStorage.test.js** - SimpleStorageテスト

---

## 📁 custom/hyperevm-swap/ - HyperSwapスワップ実装

### V3スワップ
- **v3-swap-testnet-router01.js** ⭐ - V3 Router01実装（推奨）
- **v3-swap-testnet-router02.js** - V3 Router02実装
- **v3-swap-testnet-safe.js** - 安全なV3スワップ
- **v3-swap-with-dynamic-gas.js** - 動的ガス価格V3スワップ

### V2スワップ
- **v2-swap-testnet.js** - V2基本実装（制限あり）
- **v2-swap-testnet-dymanic-gas.js** - 動的ガス価格V2

### 流動性・レート確認
- **check-v3-liquidity.js** - V3流動性確認
- **test-v3-rate-calculation.js** - V3レート計算テスト

### ユーティリティ
- **create-weth.js** - WETH作成（ETHラップ）
- **swap-config.js** - スワップ設定
- **test-all-routes.js** - 全ルートテスト

---

## 📁 custom/monitoring/ - 監視・分析ツール

- **dex-rate-monitor.ts** - リアルタイムDEXレート監視
- **flexible-dex-monitor.js** - 設定ベース柔軟監視
- **simple-rate-check.ts** - シンプルレート確認

---

## 📁 custom/investigate/ - 調査ツール

### 一般調査
- **hyperevm-kittenswap-investigate-core.js** - KittenSwapコア調査
- **hyperevm-kittenswap-investigate-periphery.js** - KittenSwap周辺調査
- **hyperevm-simple-balance-check.js** - シンプル残高確認
- **pool-state-analyzer.js** - プール状態分析
- **router-method-test.js** - ルーターメソッドテスト

### KittenSwap専用調査 🆕
- **kittenswap-quoterv2-test.js** - KittenSwap QuoterV2テスト（メインネット）
- **kittenswap-quoterv2-basic-test.js** - QuoterV2基本機能テスト
- **kittenswap-token-discovery.js** - 実際のトークン発見（13種類）
- **kittenswap-factory-analysis.js** - Factory getPair()問題調査
- **kittenswap-bytecode-analysis.js** - バイトコード詳細分析（163バイト）
- **kittenswap-all-factories-analysis.js** - 全Factory契約分析（5種類）
- **kittenswap-abi-validator.js** - ABI検証・最適化ツール

### 🔍 KittenSwap調査結果
- **V2プール**: 70個（アクティブ）
- **V3プール**: 0個（存在しない）
- **実用Factory**: V2_PairFactory のみ（`0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B`）
- **制約**: `getPair()` 関数なし、`allPairs()` 列挙のみ
- **対応ABI**: `abi/KittenSwapV2Factory.json`（最適化済み）

---

## 📁 custom/utils/ - ユーティリティ

- **config-validator.js** - 設定検証
- **token-helper.js** - トークンヘルパー関数

---

## 🔥 重要スクリプト

### アービトラージ実行
```bash
# 詳細ログ付き実行（推奨）
node custom/deploy/test-arbitrage-with-detailed-logs.js

# 基本実行
node custom/deploy/test-deployed-arbitrage.js
```

### スワップ実行
```bash
# V3スワップ（推奨）
node custom/hyperevm-swap/v3-swap-testnet-router01.js \
  --tokenIn=WETH --tokenOut=PURR --amount=0.1

# 動的ガス価格付き
node custom/hyperevm-swap/v3-swap-with-dynamic-gas.js \
  --tokenIn=WETH --tokenOut=PURR --amount=0.1 --gas-strategy=fast
```

### 監視・分析
```bash
# リアルタイム監視
ts-node custom/monitoring/dex-rate-monitor.ts

# V2ルート分析
node custom/deploy/analyze-v2-routes.js > v2-routes.json
```

### デプロイメント
```bash
# アービトラージコントラクト
node custom/deploy/deploy-arbitrage-simple.js

# ガス見積もり
node custom/deploy/estimate-gas-arbitrage.js
```

---

**最終更新**: 2025年1月8日