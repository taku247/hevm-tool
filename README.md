# Hyperevm Chain Tools

Hyperevmチェーンとの相互作用を行うためのスクリプトとダッシュボードツールです。TypeScript対応の汎用コントラクトテンプレートも含まれています。

## 🚀 主要機能

### 1. 従来のスクリプト（TypeScript化済み）
- **balance_check.ts**: アドレスの残高確認
- **transaction_sender.ts**: トランザクション送信  
- **contract_interaction.ts**: スマートコントラクト相互作用

### 2. 🆕 汎用コントラクトテンプレート
- **call-read.ts**: どんなコントラクトのREAD関数も実行
- **call-write.ts**: どんなコントラクトのWRITE関数も実行（ガス制御付き）
- **contract-deploy.ts**: コントラクトデプロイ
- **batch-execute.ts**: 複数操作の一括実行

### 3. 🚀 動的ガス価格制御機能
- **gas-analyzer.ts**: ネットワークガス価格分析・監視
- **動的ガス戦略**: safe/standard/fast/instantの4段階
- **自動最適化**: ネットワーク混雑度に応じた価格調整
- **手数料分析**: 事前コスト計算機能

### 4. Webダッシュボード
- TypeScript対応のExpress サーバー
- リアルタイム結果表示（WebSocket）
- 汎用テンプレートも実行可能

### 5. 包括的なテストスイート
- Jest + TypeScript
- ユニットテスト・統合テスト・E2Eテスト
- 70%以上のカバレッジ

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
PRIVATE_KEY=0x1234567890123456789012345678901234567890123456789012345678901234
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

ChatGPTの提案に基づいて作成された、どんなスマートコントラクトにも使える汎用テンプレートです。

### READ関数の実行

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

### WRITE関数の実行（ガス制御付き）

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

## 🚀 動的ガス価格制御機能

### `--dynamic-gas` オプション詳細

現在のネットワーク状況を分析し、最適なガス価格を自動設定します。

#### 利用可能な戦略

| 戦略 | 説明 | 確認時間 | 用途 |
|------|------|----------|------|
| `safe` | 最も安いガス価格<br>ベースフィー × 1.5 + 下位25%の優先料金 | 1-2分 | 急がない取引・コスト重視 |
| `standard` | 標準的なガス価格<br>ベースフィー × 2 + 中央値の優先料金 | 30秒-1分 | 通常の取引 |
| `fast` | 高速処理用<br>ベースフィー × 2.5 + 上位25%の優先料金 | 15-30秒 | 急ぎの取引 |
| `instant` | 最高優先度<br>ベースフィー × 3 + 最高値の優先料金 | 5-15秒 | 緊急取引・MEV対策 |

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
- 推定ガス使用量
- 現在のネットワーク状況（low/medium/high/very_high）
- 推奨ガス価格（選択した戦略に基づく）
- 予想手数料（Wei/Gwei/ETH）

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

#### **HyperEVM特有の監視ポイント**

HyperEVMは**1秒ごとのsmall block（2M gas）**と**1分ごとのbig block（30M gas）**の二本立てです。

**⚠️ 重要な制約**
- `gasLimit`を**2,000,000 gas**を超える値にすると、自動でbig blockキューに入り確実に負けます
- 早押しでは**small block**に入ることが絶対条件です

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

| 混雑度 | 推奨戦略 | 用途 | Small Block確率 |
|--------|----------|------|----------------|
| 🟢 low | `safe` | コスト重視 | 高い |
| 🟡 medium | `standard` | バランス | 中程度 |
| 🟠 high | `fast` | 速度重視 | 低い |
| 🔴 very_high | `instant` | 最優先 | 非常に低い |

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
- **< 30%**: Small block狙い絶好機
- **30-60%**: 通常の取引に適している
- **60-90%**: 高速戦略推奨
- **> 90%**: Big block待ち推奨

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

#### JSON配列形式
```bash
--args='["value1","value2",123,true]'
```

#### 複雑な構造（Uniswap等）
```bash
--args='[["0xTokenA","0xTokenB"],"1000000000000000000"]'
```

### ガスオプション

| オプション | 説明 | 用途 |
|------------|------|------|
| `--gas-limit` | ガス制限 | 全般 |
| `--gas-price` | ガス価格 (Legacy) | 旧形式 |
| `--max-fee-per-gas` | 最大ガス料金 | EIP-1559 |
| `--max-priority-fee-per-gas` | 優先ガス料金 | EIP-1559 |
| `--value` | 送金額 (ETH単位) | payable関数 |

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

### DeFiプロトコルとの相互作用

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

### NFTコントラクトとの相互作用

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

1. **DeFi自動化**: Uniswapスワップ、流動性管理、イールドファーミング
2. **NFT管理**: 大量NFTの一括操作、メタデータ管理
3. **ガバナンス自動化**: DAOの提案作成・投票
4. **アービトラージbot**: 価格差を利用した自動取引
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
- `templates/contract-utils.ts`をライブラリとして活用
- HyperEVM特有の制約（2M gas制限）を考慮した実装
- 動的ガス価格機能の統合
- 適切なエラーハンドリングとドキュメントの記載

詳細は`custom/README.md`を参照してください。

## 📊 技術スタック

- **言語**: TypeScript 5.3+
- **ランタイム**: Node.js 18+
- **フレームワーク**: Express.js
- **ブロックチェーン**: ethers.js v5.7.2
- **テスト**: Jest + Supertest
- **CI/CD**: GitHub Actions
- **品質**: ESLint + TypeScript strict mode

## ⚙️ 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `HYPEREVM_RPC_URL` | HyperevmチェーンのRPC URL | `https://rpc.hyperliquid.xyz/evm` |
| `PRIVATE_KEY` | トランザクション送信用の秘密鍵 | - |
| `PORT` | ダッシュボードのポート番号 | `3000` |
| `NODE_ENV` | 実行環境 | `development` |

## 🛡️ セキュリティ注意事項

- **秘密鍵管理**: 秘密鍵は絶対に公開しない
- **テストネット推奨**: 本番運用前にテストネットで十分に検証
- **ガス制限**: 適切なガス制限を設定してDoS攻撃を防ぐ
- **入力検証**: 外部入力は必ず検証する
- **権限管理**: 適切なアクセス制御を実装

## 📝 TODO（今後の改善予定）

### ガス価格計算ロジックの改善

現在のガス価格計算ロジックは基本的な実装となっており、以下の改善が必要です：

1. **履歴データの活用**
   - 時間帯別のガス価格傾向分析
   - 曜日別パターンの学習
   - 過去のトランザクション成功率の反映

2. **より精緻な予測モデル**
   - 機械学習モデルの導入検討
   - 複数のデータソース（他のRPCノード、ガスステーション API）の統合
   - MEVブースト対応の価格戦略

3. **チェーン固有の最適化**
   - Hyperevm特有のガス価格パターンの分析
   - ブロック生成時間を考慮した調整
   - ネットワーク固有の混雑パターンの学習

4. **ユーザー体験の向上**
   - 推定確認時間の精度向上
   - 失敗リスクの可視化
   - 代替戦略の自動提案

5. **パフォーマンス最適化**
   - キャッシュ戦略の改善
   - 並列処理によるデータ取得の高速化
   - WebSocketによるリアルタイム価格更新

これらの改善により、より正確で信頼性の高いガス価格予測が可能になります。

**🎉 これで、どんなスマートコントラクトにも対応できる汎用ツールセットが完成しました！**