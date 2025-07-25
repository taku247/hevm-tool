# HyperEVM Tools

HyperEVM チェーンとの相互作用を行うためのスクリプトとツールです。設定ベースの DEX 統合システムと TypeScript 対応の汎用コントラクトテンプレートを含みます。

## テストネット Hyperswap

https://testnet.hyperswap.exchange/#/swap

## 🚀 主要機能

### 1. 🆕 V2/V3統合アービトラージシステム

-   **1,447ペア対応**: HyperSwap V2/V3 + KittenSwap V2/V3 完全統合
-   **131倍拡張**: 従来11ペア→1,447ペア（アービトラージ機会大幅拡大）
-   **4段階検証**: 偽陽性V3プール100%排除で正確性確保
-   **異常値フィルター**: 極小値・9兆%スプレッド問題完全解決
-   **リアルタイム監視**: HTMLダッシュボード・CSV/JSON出力対応
-   **エンタープライズ品質**: 自動化・品質保証・エラーハンドリング完備

### 2. 🆕 改善されたアービトラージ分析ツール

-   **bidirectional-liquidity-checker.js**: 実際のトークンdecimals使用で精度向上
-   **極小値・無限ループ対策**: retryable: false設定で安定性確保
-   **HTMLダッシュボード**: インタラクティブな分析・可視化機能
-   **Fee tier認識**: 正規表現→文字列解析で確実な抽出
-   **エラーUI改善**: 適切なエラーメッセージ・close機能搭載

### 3. 🆕 HyperEVM スワップ機能

-   **V3 Router01/Router02**: ChatGPT修正完全適用版
-   **V2スワップ**: レート取得・流動性制限版
-   **ABI統一**: abiディレクトリからの正しいインポート
-   **Safe Swap**: callStatic事前検証・ガス保護機能

### 4. 汎用コントラクトテンプレート

-   **call-read.ts**: 任意コントラクトの READ 関数実行
-   **call-write.ts**: 任意コントラクトの WRITE 関数実行（ガス制御付き）
-   **contract-deploy.ts**: コントラクトデプロイ
-   **batch-execute.ts**: 複数操作の一括実行

### 5. 動的ガス価格制御機能

-   **gas-analyzer.ts**: ネットワークガス価格分析・監視
-   **動的ガス戦略**: safe/standard/fast/instant の 4 段階
-   **自動最適化**: ネットワーク混雑度に応じた価格調整
-   **手数料分析**: 事前コスト計算機能

### 6. 包括的なテストスイート

-   **設定システムテスト**: ConfigLoader 完全テスト
-   **DEX 統合テスト**: 実ネットワーク接続テスト
-   **監視システムテスト**: パフォーマンス・メモリテスト
-   ユニットテスト・統合テスト・E2E テスト
-   70%以上のカバレッジ

## 🔍 最新DEX統合状況

**HyperEVM DEX 状況 (2025年7月時点):**

### 📊 統合システム統計
- **総ペア数**: 1,447ペア（131倍拡張達成）
- **HyperSwap V2**: 1,929ペア（Factory: `0x724412C00059bf7d6ee7d4a1d0D5cd4de3ea1C48`）
- **KittenSwap V2**: 68ペア（Factory: `0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B`）
- **KittenSwap V3**: 13ペア（4段階検証後の正確な数値）
- **クロスDEX**: 37ペア（両DEX利用可能）

### 🎯 アービトラージ機会
- **固定入力量**: 1トークン統一テスト（bidirectional-liquidity-checker）
- **マルチ入力量**: 1, 2, 5, 10トークン段階的分析（swap-rate-monitor-multi-amount）
- **異常値フィルター**: 極小値・9兆%スプレッド問題完全解決
- **4段階検証**: 偽陽性V3プール100%排除
- **リアルタイム監視**: HTMLダッシュボード・CSV/JSON出力

### 利用可能トークン

```json
{
    "WHYPE": "0x5555555555555555555555555555555555555555",
    "UBTC": "0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463",
    "UETH": "0xBe6727B535545C67d5cAa73dEa54865B92CF7907"
}
```

### 🎯 重要な技術的発見

1. **decimals処理改善**: hardcoded 18桁→実際のトークンdecimals使用で精度向上
2. **偽陽性V3プール排除**: 4段階検証でgetQuote()失敗プール100%検出
3. **無限ループ対策**: retryable: false設定でUI安定性確保
4. **Fee tier認識**: 正規表現→文字列解析("HYPERSWAP V3 (10000)")で確実抽出
5. **エンタープライズ品質**: 自動化・品質保証・エラーハンドリング完備

## 🔄 アービトラージ分析の使用方法

### 基本的な使用方法

#### 1. 包括的アービトラージスキャン 🏆
```bash
# 全1,447ペアの包括的分析
node custom/monitoring/bidirectional-liquidity-checker.js --full-scan

# クイックスキャン（100ペア）
node custom/monitoring/bidirectional-liquidity-checker.js --quick

# 単体テスト（1ペア）
node custom/monitoring/bidirectional-liquidity-checker.js --test
```

#### 2. HTMLダッシュボード生成 📊
```bash
# インタラクティブダッシュボード生成
node custom/monitoring/bidirectional-liquidity-checker.js --dashboard
```

#### 3. リアルタイム監視 📈
```bash
# マルチ入力量分析（推奨）
node custom/monitoring/swap-rate-monitor-multi-amount.js

# 包括的監視
node custom/monitoring/swap-rate-monitor-complete.js
```

## 🔄 MultiSwap コントラクト機能

### 📊 マルチホップスワップ対応

**アトミックマルチスワップ**: 複数のトークンスワップを単一トランザクションで実行

#### 1. 最適化版 MultiSwap ✅
```solidity
// WETH → PURR → HFUN (最適なfee設定)
MultiSwapOptimized: 0x6bdab42E95b7707FbBbA97863B25FDc875C0cc2C
```

**実行例**:
```bash
# 最適化されたマルチホップテスト
node custom/deploy/test-optimized-multihop.js
```

**成功実績**:
- WETH → PURR (500bps/0.05%) → HFUN (10000bps/1%)
- 0.0001 WETH → 0.1345 PURR → 0.0000955 HFUN ✅
- TX: `0xdfb5c1b54f8356aec64cda3a5b803a96f02f12d2b201342dbf17a1a6d6e001f7`

#### 2. 柔軟な MultiSwap ✅
```solidity  
// カスタムパス・fee設定対応
MultiSwapFlexible: 0x28199bbC5E49431522Ae91495f66630025103223
```

**機能**:
- 任意の数のホップ対応
- 各ホップで異なるfee tier指定可能
- V3のみ使用でテストネット制約回避

#### 3. アービトラージ最適化版 🆕✅
```solidity
// ChatGPT推奨: Fund pooling + Owner-only access control
MultiSwapArbitrageSimple: 0x4B90A95915a4a0C2690f1F36F3B4C347c27B41d2
```

**ChatGPT推奨事項実装**:
- ✅ Owner-only access control
- ✅ Fund pooling (ガス最適化) 
- ✅ Pre-approved router (コンストラクタで設定)
- ✅ Reentrancy protection
- ✅ Emergency pause functionality
- ✅ transferFrom不要でガス節約

**実行例**:
```bash
# デプロイ
node custom/deploy/deploy-arbitrage-simple.js

# 機能テスト
node custom/deploy/test-deployed-arbitrage.js
```

**成功実績**:
- 0.0001 WETH → 0.0000955 HFUN ✅
- 緊急停止機能動作確認 ✅
- Fund pooling方式でガス最適化 ✅

#### 4. V2/V3制約の完全解明 🔍

**テストネットV2制約**:
- レート取得: ✅ 成功 (36ペア中21ペア)
- 実際のスワップ: ❌ 全ペアで"missing revert data"
- **結論**: V2は実質使用不可、V3必須

**V3プール手数料設定**:
- WETH/PURR: 500bps (0.05%)
- PURR/HFUN: 10000bps (1%) ← **重要**: 他のfeeでは"SPL"エラー
- WETH/HFUN: 500bps (0.05%)

#### 4. 作成したデバッグツール

**包括的な分析ツール**:
```bash
# V2/V3ペア調査
node custom/deploy/investigate-router-pairs.js

# 全testnetトークン(36ペア)分析
node custom/deploy/analyze-v2-routes.js

# 出力: v2-route-analysis.json (token-config.json形式)
```

**解決した問題**:
1. **元のMultiSwap失敗原因**: 2段目でV2強制使用 + 手数料設定ミス
2. **ChatGPT分析との相違**: ガス不足ではなく根本的なV2制約
3. **"SPL"エラーの原因**: Slippage Protection Limit (手数料設定ミス)

#### 5. 最終推奨事項

**開発指針**:
- ✅ **V3のみ使用**: テストネットではV2実行不可
- ✅ **事前fee調査**: 各ペアの正確なfee tier確認必須  
- ✅ **動的ルーティング**: quote-onlyでの事前検証推奨

**実用的なコントラクト**:
- `MultiSwapOptimized.sol`: 最適化された固定ルート
- `MultiSwapFlexible.sol`: 柔軟なカスタムルート構築

#### V2 スワップ（レート取得推奨）
```bash
# レート取得のみ
node custom/hyperevm-swap/v2-swap-testnet.js --tokenIn WETH --tokenOut PURR --amount 0.001 --quote-only
```

### ChatGPT修正完全適用済み

1. **未来deadline設定**: 期限切れエラー解消
2. **callStatic事前テスト**: 実行前検証でリスク回避  
3. **アドレス小文字化**: checksum validation問題解消
4. **ガス保護機能**: 最低HYPE残高確認
5. **エラーハンドリング強化**: 詳細なエラー情報提供
6. **ABI統一**: abiディレクトリから正しいファイル読み込み

### 実行実績

- **V3 Router01**: ✅ 101,038 gas成功（0.001 WETH → 1.344896967199230134 PURR）
- **V3 Router02**: ✅ 101,341 gas成功（0.001 WETH → 1.344896033923951587 PURR）
- **V2レート取得**: ✅ 正常動作（1 WETH = 1256.263109 PURR）

### 対応トークン

HSPX, xHSPX, WETH, PURR, JEFF, CATBAL, HFUN, POINTS

## 📦 セットアップ

### 1. 依存関係をインストール

```bash
yarn install
```

### 2. 環境変数を設定

```bash
# .envファイルを作成
cp .env.example .env

# 以下の環境変数を設定
HYPEREVM_RPC_URL=https://rpc.hyperliquid.xyz/evm
PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
PORT=3000
```

### 3. アプリケーション起動

```bash
# 開発モード（ts-node使用）
yarn dev

# 本番モード（TypeScriptビルド後実行）
yarn build && yarn start

# ダッシュボードのみ起動
yarn dashboard
```

## 🎯 汎用コントラクトテンプレートの使用方法

ChatGPT の提案に基づいて作成された、どんなスマートコントラクトにも使える汎用テンプレートです。

### READ 関数の実行

```bash
# ERC20トークンの残高確認
ts-node templates/call-read.ts \
  --abi=./examples/sample-abi/ERC20.json \
  --address=0x1234567890123456789012345678901234567890 \
  --function=balanceOf \
  --args=0xabcdef1234567890123456789012345678901234

# 総供給量確認
ts-node templates/call-read.ts \
  --abi=./examples/sample-abi/ERC20.json \
  --address=0x1234567890123456789012345678901234567890 \
  --function=totalSupply

# 特定ブロックでの残高確認
ts-node templates/call-read.ts \
  --abi=./examples/sample-abi/ERC20.json \
  --address=0x1234567890123456789012345678901234567890 \
  --function=balanceOf \
  --args=0xabcdef1234567890123456789012345678901234 \
  --block=18500000
```

### WRITE 関数の実行（ガス制御付き）

```bash
# ERC20トークンの転送
ts-node templates/call-write.ts \
  --abi=./examples/sample-abi/ERC20.json \
  --address=0x1234567890123456789012345678901234567890 \
  --function=transfer \
  --args=0xabcdef1234567890123456789012345678901234,1000000000000000000

# 承認設定（ガス制限付き）
ts-node templates/call-write.ts \
  --abi=./examples/sample-abi/ERC20.json \
  --address=0x1234567890123456789012345678901234567890 \
  --function=approve \
  --args=0xabcdef1234567890123456789012345678901234,1000000000000000000 \
  --gas-limit=100000 \
  --gas-price=30000000000

# EIP-1559ガス設定
ts-node templates/call-write.ts \
  --abi=./examples/sample-abi/ERC20.json \
  --address=0x1234567890123456789012345678901234567890 \
  --function=transfer \
  --args=0xabcdef1234567890123456789012345678901234,1000000000000000000 \
  --max-fee-per-gas=30000000000 \
  --max-priority-fee-per-gas=2000000000

# ガス見積もりのみ実行
ts-node templates/call-write.ts \
  --abi=./examples/sample-abi/ERC20.json \
  --address=0x1234567890123456789012345678901234567890 \
  --function=transfer \
  --args=0xabcdef1234567890123456789012345678901234,1000000000000000000 \
  --estimate
```

### コントラクトデプロイ

```bash
# シンプルなコントラクトのデプロイ
ts-node templates/contract-deploy.ts \
  --abi=./examples/sample-abi/ERC20.json \
  --bytecode=./bytecode/ERC20.bin

# ERC20トークンのデプロイ（コンストラクタ引数付き）
ts-node templates/contract-deploy.ts \
  --abi=./examples/sample-abi/ERC20.json \
  --bytecode=./bytecode/ERC20.bin \
  --args="MyToken,MTK,18,1000000000000000000000"

# ガス設定付きデプロイ
ts-node templates/contract-deploy.ts \
  --abi=./examples/sample-abi/ERC20.json \
  --bytecode=./bytecode/ERC20.bin \
  --args='["MyToken","MTK",18,"1000000000000000000000"]' \
  --gas-limit=3000000 \
  --gas-price=30000000000
```

### バッチ実行

```bash
# 設定ファイルに基づいてバッチ実行
ts-node templates/batch-execute.ts --config=./examples/batch-config-sample.json

# エラー時停止オプション付き
ts-node templates/batch-execute.ts --config=./examples/batch-config-sample.json --stop-on-error
```

## 🎯 設定ベース DEX 統合システムの使用方法

### 柔軟な DEX 監視ツール

```bash
# 設定情報確認
ts-node custom/monitoring/flexible-dex-monitor.ts --config

# 基本的なレート取得
ts-node custom/monitoring/flexible-dex-monitor.ts --tokens=WHYPE,UBTC --amount=1

# V2プロトコルのみでレート比較
ts-node custom/monitoring/flexible-dex-monitor.ts --protocol=uniswap-v2 --tokens=WHYPE,UBTC

# 特定DEXのみで監視
ts-node custom/monitoring/flexible-dex-monitor.ts --dex=hyperswap_v2 --tokens=WHYPE,UBTC --monitor

# アービトラージ機会検索
ts-node custom/monitoring/flexible-dex-monitor.ts --tokens=WHYPE,UBTC --arbitrage --min-spread=0.02

# 継続監視（30秒間隔）
ts-node custom/monitoring/flexible-dex-monitor.ts --tokens=WHYPE,UBTC --monitor --interval=30
```

### 設定ファイルの構造

#### DEX 設定 (`config/dex-config.json`)

-   **ネットワーク別設定**: メインネット・テストネット対応
-   **プロトコル対応**: Uniswap V2/V3、Balancer、Curve 等
-   **機能別設定**: クォート・スワップ関数の定義
-   **動的追加**: 新しい DEX を設定ファイルで簡単追加

#### トークン設定 (`config/token-config.json`)

-   **トークン情報**: シンボル、アドレス、decimals 等
-   **カテゴリ分類**: native、stablecoin、bridged 等
-   **価格フィード**: 外部オラクル統合設定

### カスタム DEX の追加

```json
{
    "networks": {
        "hyperevm-mainnet": {
            "dexes": {
                "new_dex_v2": {
                    "name": "New DEX V2",
                    "protocol": "uniswap-v2",
                    "router": "0x新しいルーターアドレス",
                    "abi": "./abi/UniV2Router.json",
                    "quoteFunctions": {
                        "getAmountsOut": {
                            "inputs": ["uint256", "address[]"],
                            "outputs": ["uint256[]"]
                        }
                    },
                    "type": "v2",
                    "status": "active"
                }
            }
        }
    }
}
```

## 🚀 動的ガス価格制御機能

### `--dynamic-gas` オプション詳細

現在のネットワーク状況を分析し、最適なガス価格を自動設定します。

#### 利用可能な戦略

| 戦略       | 説明                                                        | 確認時間   | 用途                     |
| ---------- | ----------------------------------------------------------- | ---------- | ------------------------ |
| `safe`     | 最も安いガス価格<br>ベースフィー × 1.5 + 下位 25%の優先料金 | 1-2 分     | 急がない取引・コスト重視 |
| `standard` | 標準的なガス価格<br>ベースフィー × 2 + 中央値の優先料金     | 30 秒-1 分 | 通常の取引               |
| `fast`     | 高速処理用<br>ベースフィー × 2.5 + 上位 25%の優先料金       | 15-30 秒   | 急ぎの取引               |
| `instant`  | 最高優先度<br>ベースフィー × 3 + 最高値の優先料金           | 5-15 秒    | 緊急取引・MEV 対策       |

#### 使用例

```bash
# DeFiでの迅速なポジション決済
ts-node templates/call-write.ts \
  --abi=./abi/UniswapV2Router.json \
  --address=0xRouter... \
  --function=swapExactTokensForTokens \
  --args='["1000000000000000000","900000000000000000",["0xTokenA","0xTokenB"],"0xYourAddress",1700000000]' \
  --dynamic-gas=instant

# コストを抑えたエアドロップ配布
ts-node templates/call-write.ts \
  --abi=./abi/AirdropContract.json \
  --address=0xAirdrop... \
  --function=distributeTokens \
  --args='[["0xAddr1","0xAddr2","0xAddr3"],["1000","1000","1000"]]' \
  --dynamic-gas=safe
```

### `--analyze-cost` オプション詳細

トランザクションを実行せずに、詳細な手数料分析を提供します。

#### 分析内容

-   推定ガス使用量
-   現在のネットワーク状況（low/medium/high/very_high）
-   推奨ガス価格（選択した戦略に基づく）
-   予想手数料（Wei/Gwei/ETH）

#### 使用例と出力

```bash
# 手数料分析の実行
ts-node templates/call-write.ts \
  --abi=./abi/ERC20.json \
  --address=0x1234... \
  --function=transfer \
  --args=0xRecipient,1000000 \
  --analyze-cost \
  --dynamic-gas=fast
```

出力例：

```
💰 トランザクション手数料を分析中...
✅ 手数料分析完了!

📊 詳細分析結果:
   推定ガス使用量: 65000
   推奨ガス価格: 25.50 Gwei
   ネットワーク状況: 🟡 medium
   使用戦略: fast

💸 予想手数料:
   Wei: 1657500000000000
   Gwei: 1657500
   ETH: 0.0016575
```

### ガス価格分析ツール（gas-analyzer.ts）

ネットワークのガス価格をリアルタイムで分析・監視します。

```bash
# 現在のネットワーク分析
ts-node templates/gas-analyzer.ts --analyze

# 特定戦略のガス価格取得
ts-node templates/gas-analyzer.ts --strategy=fast

# リアルタイム監視（30秒間隔）
ts-node templates/gas-analyzer.ts --monitor --interval=30
```

分析結果の例：

```
📊 ネットワークガス価格分析
================================
🔷 現在のベースフィー: 15.25 Gwei
🌐 ネットワーク混雑度: 🟡 medium

💰 推奨ガス価格戦略:
┌──────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ 戦略     │ ガス価格    │ MaxFee      │ Priority    │ 確認時間    │
├──────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ safe     │ 20.5 Gwei   │ 22.8 Gwei   │ 1.5 Gwei    │ 1-2分       │
│ standard │ 25.3 Gwei   │ 30.5 Gwei   │ 2.4 Gwei    │ 30秒-1分    │
│ fast     │ 32.1 Gwei   │ 38.1 Gwei   │ 3.6 Gwei    │ 15-30秒     │
│ instant  │ 45.8 Gwei   │ 50.3 Gwei   │ 5.0 Gwei    │ 5-15秒      │
└──────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

### 🔍 リアルタイム監視機能

#### **基本的な使い方**

```bash
# 30秒間隔でガス価格を監視（デフォルト）
ts-node templates/gas-analyzer.ts --monitor

# 10秒間隔でより頻繁に監視
ts-node templates/gas-analyzer.ts --monitor --interval=10

# 1分間隔でゆっくり監視
ts-node templates/gas-analyzer.ts --monitor --interval=60
```

#### **HyperEVM 特有の監視ポイント**

HyperEVM は**1 秒ごとの small block（2M gas）**と**1 分ごとの big block（30M gas）**の二本立てです。

**⚠️ 重要な制約**

-   `gasLimit`を**2,000,000 gas**を超える値にすると、自動で big block キューに入り確実に負けます
-   早押しでは**small block**に入ることが絶対条件です

```bash
# ❌ 危険：2M gas超過でbig blockキューに入る
--gas-limit=3000000  # 確実に負ける

# ✅ 推奨：2M gas以下でsmall blockに入る
--gas-limit=1900000  # 1秒ブロックで確実に処理
```

#### **実戦での活用例**

```bash
# ターミナル1: ガス価格監視
ts-node templates/gas-analyzer.ts --monitor --interval=5

# ターミナル2: 早押し用スクリプト準備
ts-node templates/call-write.ts \
  --abi=./abi/HyperswapRouter.json \
  --address=0xRouter... \
  --function=swap \
  --args='...' \
  --dynamic-gas=instant \
  --gas-limit=1900000 \
  --estimate  # まずは見積もり

# 監視画面で混雑度をチェック後、実行
# 混雑度が low/medium なら即実行
# 混雑度が high なら戦略変更を検討
```

#### **戦略切り替えの判断**

監視画面のネットワーク混雑度に応じて戦略を切り替え：

| 混雑度       | 推奨戦略   | 用途       | Small Block 確率 |
| ------------ | ---------- | ---------- | ---------------- |
| 🟢 low       | `safe`     | コスト重視 | 高い             |
| 🟡 medium    | `standard` | バランス   | 中程度           |
| 🟠 high      | `fast`     | 速度重視   | 低い             |
| 🔴 very_high | `instant`  | 最優先     | 非常に低い       |

#### **複数ターミナルでの並行監視**

```bash
# ターミナル1: 高頻度監視
ts-node templates/gas-analyzer.ts --monitor --interval=3

# ターミナル2: 特定戦略価格監視
watch -n 5 "ts-node templates/gas-analyzer.ts --strategy=instant"

# ターミナル3: 実行準備
# 監視結果を見て最適タイミングで実行
```

#### **監視データの読み方**

```
📈 最近のブロック情報:
   Block 1234567: 65.3% 使用, ベースフィー 15.25 Gwei  ← 中程度の混雑
   Block 1234568: 72.1% 使用, ベースフィー 15.78 Gwei  ← やや混雑
   Block 1234569: 58.9% 使用, ベースフィー 14.92 Gwei  ← 空いている
```

**判断基準**：

-   **< 30%**: Small block 狙い絶好機
-   **30-60%**: 通常の取引に適している
-   **60-90%**: 高速戦略推奨
-   **> 90%**: Big block 待ち推奨

#### **ガス価格最適化のコツ**

1. **事前準備**

```bash
# 一度だけ非同期でestimateGas
ts-node templates/call-write.ts --estimate --gas-limit=1900000
```

2. **勝負の瞬間**

```bash
# キャッシュ値で即送信
ts-node templates/call-write.ts \
  --dynamic-gas=instant \
  --gas-limit=1900000  # 事前計算値使用
```

3. **複数戦略**

```bash
# 同じnoncで異なるガス価格のTxを並行送信
# 片方がsmall blockを掴めば、片方は自動でreplace-by-fee
```

## 🔧 高度な機能

### 引数の指定方法

#### シンプルな引数

```bash
--args=value1,value2,value3
```

#### JSON 配列形式

```bash
--args='["value1","value2",123,true]'
```

#### 複雑な構造（Uniswap 等）

```bash
--args='[["0xTokenA","0xTokenB"],"1000000000000000000"]'
```

### ガスオプション

| オプション                   | 説明              | 用途         |
| ---------------------------- | ----------------- | ------------ |
| `--gas-limit`                | ガス制限          | 全般         |
| `--gas-price`                | ガス価格 (Legacy) | 旧形式       |
| `--max-fee-per-gas`          | 最大ガス料金      | EIP-1559     |
| `--max-priority-fee-per-gas` | 優先ガス料金      | EIP-1559     |
| `--value`                    | 送金額 (ETH 単位) | payable 関数 |

### バッチ設定ファイル例

```json
{
    "stopOnError": false,
    "calls": [
        {
            "type": "read",
            "abi": "./examples/sample-abi/ERC20.json",
            "contractAddress": "0x1234...",
            "functionName": "totalSupply",
            "args": [],
            "description": "総供給量を取得"
        },
        {
            "type": "write",
            "abi": "./examples/sample-abi/ERC20.json",
            "contractAddress": "0x1234...",
            "functionName": "transfer",
            "args": ["0xabcd...", "1000000000000000000"],
            "options": {
                "gasLimit": "100000",
                "gasPrice": "30000000000"
            },
            "description": "トークン転送"
        }
    ]
}
```

## 🏗️ 従来スクリプトの個別実行

### 残高確認

```bash
ts-node scripts/balance_check.ts 0x1234567890123456789012345678901234567890
```

### トランザクション送信

```bash
ts-node scripts/transaction_sender.ts 0x1234567890123456789012345678901234567890 0.1
```

## 🧪 テスト実行

```bash
# 全テスト実行
yarn test

# 監視モード
yarn test:watch

# カバレッジ付き実行
yarn test:coverage

# CI用実行
yarn test:ci

# 型チェック
yarn typecheck
```

## 🎯 活用例

### DeFi プロトコルとの相互作用

```bash
# Uniswap価格取得
ts-node templates/call-read.ts \
  --abi=./abi/UniswapV2Router.json \
  --address=0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D \
  --function=getAmountsOut \
  --args='["1000000000000000000",["0xA0b86a33E6441E7D375cAF440d6c7e1F2B9E2CD9","0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"]]'

# スワップ実行
ts-node templates/call-write.ts \
  --abi=./abi/UniswapV2Router.json \
  --address=0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D \
  --function=swapExactTokensForTokens \
  --args='["1000000000000000000","900000000000000000",["0xA","0xB"],"0xYourAddress",1700000000]' \
  --gas-limit=300000
```

### NFT コントラクトとの相互作用

```bash
# NFT残高確認
ts-node templates/call-read.ts \
  --abi=./abi/ERC721.json \
  --address=0xNFTContractAddress \
  --function=balanceOf \
  --args=0xOwnerAddress

# NFT転送
ts-node templates/call-write.ts \
  --abi=./abi/ERC721.json \
  --address=0xNFTContractAddress \
  --function=transferFrom \
  --args=0xFromAddress,0xToAddress,123
```

## 📁 プロジェクト構造

```
hevm-tool/
├── scripts/                    # 従来スクリプト（TypeScript化済み）
│   ├── balance_check.ts
│   ├── transaction_sender.ts
│   └── contract_interaction.ts
├── templates/                  # 汎用コントラクトテンプレート 🆕
│   ├── contract-utils.ts      # 汎用ユーティリティクラス
│   ├── call-read.ts          # READ関数実行
│   ├── call-write.ts         # WRITE関数実行
│   ├── contract-deploy.ts    # コントラクトデプロイ
│   ├── batch-execute.ts      # バッチ実行
│   ├── gas-analyzer.ts       # ガス価格分析・監視 🆕
│   └── README.md             # テンプレート詳細ガイド
├── custom/                     # カスタムスクリプト 🆕
│   ├── README.md             # カスタム開発ガイド
│   ├── hyperswap/            # Hyperswap関連
│   ├── kittenswap/           # Kittenswap関連
│   ├── arbitrage/            # アービトラージ関連
│   ├── monitoring/           # 監視・アラート関連
│   └── utils/                # 共通ユーティリティ
├── dashboard/                  # Webダッシュボード
│   ├── server.ts             # Express サーバー（TypeScript）
│   └── public/
│       └── index.html        # フロントエンド
├── src/                       # 型定義とユーティリティ
│   ├── types.ts              # 基本型定義
│   ├── contract-template-types.ts # テンプレート用型定義 🆕
│   └── gas-price-utils.ts    # ガス価格計算ユーティリティ 🆕
├── tests/                     # 包括的なテストスイート 🆕
│   ├── scripts/              # 従来スクリプトのテスト
│   ├── templates/            # テンプレートのテスト
│   ├── dashboard/            # APIテスト
│   ├── integration/          # 統合・E2Eテスト
│   └── utils/                # テストヘルパー
├── examples/                  # サンプルファイル 🆕
│   ├── sample-abi/           # サンプルABI
│   └── batch-config-sample.json
├── docs/                      # 設計ドキュメント 🆕
│   ├── architecture.md
│   ├── api-specification.md
│   ├── data-flow.md
│   └── deployment.md
├── .github/workflows/         # CI/CD設定 🆕
├── package.json              # TypeScript依存関係
├── tsconfig.json             # TypeScript設定
├── jest.config.js            # テスト設定
└── .env                      # 環境変数
```

## 🔮 今後の拡張可能性

このテンプレートを基に、以下のような専用スクリプトを簡単に作成できます：

1. **DeFi 自動化**: Uniswap スワップ、流動性管理、イールドファーミング
2. **NFT 管理**: 大量 NFT の一括操作、メタデータ管理
3. **ガバナンス自動化**: DAO の提案作成・投票
4. **アービトラージ bot**: 価格差を利用した自動取引
5. **価格監視システム**: リアルタイム価格追跡・アラート
6. **バックアップ・復元**: ウォレット状態のスナップショット

### 📁 カスタムスクリプトの配置

プロジェクト固有のカスタムスクリプトは`custom/`フォルダに配置します：

```bash
# カスタムスクリプトの実行例
ts-node custom/hyperswap/swap-tool.ts
ts-node custom/arbitrage/price-monitor.ts
ts-node custom/monitoring/alert-system.ts
```

**開発方針:**

-   `templates/contract-utils.ts`をライブラリとして活用
-   HyperEVM 特有の制約（2M gas 制限）を考慮した実装
-   動的ガス価格機能の統合
-   適切なエラーハンドリングとドキュメントの記載

詳細は`custom/README.md`を参照してください。

## 📊 技術スタック

-   **言語**: TypeScript 5.3+
-   **ランタイム**: Node.js 18+
-   **フレームワーク**: Express.js
-   **ブロックチェーン**: ethers.js v5.7.2
-   **テスト**: Jest + Supertest
-   **CI/CD**: GitHub Actions
-   **品質**: ESLint + TypeScript strict mode

## ⚙️ 環境変数

| 変数名             | 説明                           | デフォルト値                      |
| ------------------ | ------------------------------ | --------------------------------- |
| `HYPEREVM_RPC_URL` | Hyperevm チェーンの RPC URL    | `https://rpc.hyperliquid.xyz/evm` |
| `PRIVATE_KEY`      | トランザクション送信用の秘密鍵 | -                                 |
| `PORT`             | ダッシュボードのポート番号     | `3000`                            |
| `NODE_ENV`         | 実行環境                       | `development`                     |

## 🛡️ セキュリティ注意事項

-   **秘密鍵管理**: 秘密鍵は絶対に公開しない
-   **テストネット推奨**: 本番運用前にテストネットで十分に検証
-   **ガス制限**: 適切なガス制限を設定して DoS 攻撃を防ぐ
-   **入力検証**: 外部入力は必ず検証する
-   **権限管理**: 適切なアクセス制御を実装

## 📝 TODO（今後の改善予定）

### ガス価格計算ロジックの改善

現在のガス価格計算ロジックは基本的な実装となっており、以下の改善が必要です：

1. **履歴データの活用**

    - 時間帯別のガス価格傾向分析
    - 曜日別パターンの学習
    - 過去のトランザクション成功率の反映

2. **より精緻な予測モデル**

    - 機械学習モデルの導入検討
    - 複数のデータソース（他の RPC ノード、ガスステーション API）の統合
    - MEV ブースト対応の価格戦略

3. **チェーン固有の最適化**

    - Hyperevm 特有のガス価格パターンの分析
    - ブロック生成時間を考慮した調整
    - ネットワーク固有の混雑パターンの学習

4. **ユーザー体験の向上**

    - 推定確認時間の精度向上
    - 失敗リスクの可視化
    - 代替戦略の自動提案

5. **パフォーマンス最適化**
    - キャッシュ戦略の改善
    - 並列処理によるデータ取得の高速化
    - WebSocket によるリアルタイム価格更新

これらの改善により、より正確で信頼性の高いガス価格予測が可能になります。

## 🔍 HyperSwap テストネット調査完了報告 (2025年1月)

### 📋 詳細調査結果

**調査期間**: 2025年1月6-7日  
**調査対象**: HyperSwap V2/V3 テストネット環境  
**目的**: スワップ機能の動作確認とABI最適化

### 🎯 主要発見事項

#### **1. ABI設定の最適化 ✅**

**修正前の問題:**
- HyperSwap V2で汎用`UniV2Router.json`を使用
- HyperSwap V3で単一ABIファイルを使用
- 機能制限と情報不足

**修正後の改善:**
```json
{
  "hyperswap_v2": {
    "abi": "./abi/HyperSwapV2Router.json",  // ✅ 専用ABI
    "swapFunctions": {
      "swapExactTokensForTokens": "...",      // ✅ 追加
      "swapTokensForExactTokens": "..."       // ✅ 追加
    }
  },
  "hyperswap_v3": {
    "quoterAbi": "./abi/HyperSwapQuoterV2.json",     // ✅ 分離
    "swapRouterAbi": "./abi/HyperSwapV3SwapRouter02.json", // ✅ 分離
    "quoteFunctions": {
      "outputs": ["uint256", "uint160", "uint32", "uint256"] // ✅ 詳細情報
    }
  }
}
```

#### **2. 公式アドレスの確認 ✅**

**V2テストネット (公式ドキュメント確認済み):**
- Router: `0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853` ✅
- Factory: `0xA028411927E2015A363014881a4404C636218fb1`

**V3テストネット (公式ドキュメント確認済み):**
- Quoter: `0x7FEd8993828A61A5985F384Cee8bDD42177Aa263`
- SwapRouter: `0x51c5958FFb3e326F8d7AA945948159f1FF27e14A`
- Factory: `0x22B0768972bB7f1F5ea7a8740BB8f94b32483826`

#### **3. 機能動作確認結果**

| 機能 | V2テストネット | V3テストネット | 詳細 |
|------|---------------|---------------|------|
| **Quote関数** | ⚠️ 部分動作 | ✅ 完全動作 | V2は`getAmountsOut`のみ、V3は詳細情報付き |
| **スワップ関数** | ❌ 制限 | ❌ 制限 | 両方とも`callStatic`/`estimateGas`で失敗 |
| **流動性確認** | ✅ 豊富 | ✅ 豊富 | WETH/PURR等のペアに十分な流動性 |
| **承認状態** | ✅ 完了 | ✅ 完了 | Router承認は正常 |

### 🔧 技術的詳細

#### **V3 Quote機能の大幅改善:**
修正されたABIにより以下の詳細情報が取得可能になりました：

```javascript
// V3 Quote結果例
Fee 0.01%: 1.347897416162325043 PURR
詳細: sqrtPrice=2908833733471207947008428208493, ticks=0, gas=81020

Fee 0.05%: 1.344896967199230134 PURR  
詳細: sqrtPrice=2906247631437699490295408289143, ticks=0, gas=74680
```

#### **根本原因の特定:**
```javascript
// バイトコード解析結果
✅ 確認済み関数:
   0xd06ca61f: getAmountsOut(uint256,address[])    // 動作
   0xc45a0155: factory()                           // 動作
   0xad5c4648: WETH()                             // 動作

❌ 不在の関数:
   0x38ed1739: swapExactTokensForTokens(...)      // スワップ関数が存在しない
```

### 📊 比較検証結果

**HyperSwap vs KittenSwap テストネット:**
- **HyperSwap**: Quote機能のみ利用可能（テストネット制限）
- **KittenSwap**: 全機能アクセス不可（テストネット未対応？）

### 🎯 最終結論

**テストネット環境の制限:**
- HyperSwapテストネットは**quote専用環境**として運用
- 実際のスワップ機能は意図的に制限されている
- メインネットでは全機能が正常動作すると予想

**dex-config.json の完成:**
```json
{
  "status": "quote-only",
  "note": "スワップ機能が制限されている可能性"
}
```

### 🚀 成果物

1. **✅ 最適化されたABI設定**: HyperSwap専用ABIで機能最大化
2. **✅ 公式アドレス確認**: 全て公式ドキュメントで検証済み
3. **✅ 詳細機能分析**: Quote機能の大幅な情報量向上
4. **✅ 制限事項の明確化**: テストネットの仕様として文書化

### 💡 開発者への推奨事項

1. **メインネットでの本格テスト**: 実際のスワップ機能確認
2. **Quote機能の活用**: テストネットでのレート取得・分析
3. **代替DEXの検討**: KittenSwap等の併用でリスク分散

---

## 🛡️ Safe Swap System（最新追加）

ChatGPTのアドバイスに基づき、スワップエラーを自動防止する包括的なシステムを構築しました。

### 解決された問題
- **期限切れDeadline**: 2023年タイムスタンプ → 自動未来時刻生成
- **無効アドレス**: 非Hex文字 → アドレス検証・正規化
- **ERC20承認不足**: approve忘れ → 自動承認チェック・実行
- **ゼロ・負の金額**: 不正値 → 金額バリデーション
- **存在しないプール**: 無効fee tier → プール存在確認
- **ガス見積もり失敗**: ネットワーク問題 → callStatic事前テスト

### 使用方法

```bash
# 安全スワップデモ
npm run demo:safe-swap

# テスト実行
npm run test:safe-swap
npm run test:integration
```

```javascript
// 基本的な使用例
const { SafeSwapHelper } = require('./utils/safe-swap-helper');
const safeSwapper = new SafeSwapHelper(provider, privateKey);

const result = await safeSwapper.safeV3Swap({
    tokenIn: "0xADcb2f358Eae6492F61A5f87eb8893d09391d160",
    tokenOut: "0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82",
    amountIn: "0.001" // 全ての安全チェックは自動実行
});
```

### HyperSwap Router正しい使い分け（ChatGPT検証済み）

| Router | パラメータ構造 | 実績 |
|--------|---------------|------|
| **SwapRouter01** | deadline含む（8個） | ✅ 104,966 gas成功 |
| **SwapRouter02** | deadline無し（7個） | ✅ 106,609 gas成功 |

```javascript
// Router01（deadline必須）
await router01.exactInputSingle({
    tokenIn, tokenOut, fee, recipient,
    deadline: Math.floor(Date.now() / 1000) + 1800, // 必須
    amountIn, amountOutMinimum, sqrtPriceLimitX96
});

// Router02（deadline無し）
await router02.exactInputSingle({
    tokenIn, tokenOut, fee, recipient,
    // deadline無し - ChatGPT指摘通り
    amountIn, amountOutMinimum, sqrtPriceLimitX96
});
```

**🎉 これで、どんなスマートコントラクトにも対応できる汎用ツールセットが完成しました！**
