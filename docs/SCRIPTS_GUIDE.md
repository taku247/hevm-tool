# HyperEVM Tools スクリプト詳細ガイド

## 📋 目次

1. [基本スクリプト (scripts/)](#基本スクリプト)
2. [テンプレート (templates/)](#テンプレート)
3. [カスタムスクリプト (custom/)](#カスタムスクリプト)
4. [使用例とベストプラクティス](#使用例とベストプラクティス)

---

## 🔧 基本スクリプト (scripts/)

### balance_check.js
**目的**: ウォレットの残高を確認  
**使用方法**:
```bash
node scripts/balance_check.js [address]
```
**機能**:
- ETH残高の確認
- 複数アドレスの一括確認
- ブロック高での残高照会

### contract_interaction.js
**目的**: 基本的なコントラクト操作  
**使用方法**:
```bash
node scripts/contract_interaction.js --contract=0x... --method=balanceOf --args=0x...
```
**機能**:
- READ関数の呼び出し
- 戻り値のデコード
- イベントログの取得

### transaction_sender.js
**目的**: ETH送金やトランザクション送信  
**使用方法**:
```bash
node scripts/transaction_sender.js --to=0x... --value=0.1 --gas-price=10
```
**機能**:
- ETH送金
- データ付きトランザクション
- ガス見積もり

---

## 🚀 テンプレート (templates/)

### contract-utils.ts ⭐核心モジュール
**目的**: すべてのコントラクト操作の基盤  
**主要クラス**: `UniversalContractUtils`

**主要メソッド**:
```typescript
// コントラクトREAD
callContractRead(contractAddress, abi, functionName, args)

// コントラクトWRITE
callContractWrite(contractAddress, abi, functionName, args, options)

// デプロイ
deployContract(abi, bytecode, constructorArgs, options)

// ガス分析
analyzeCurrentGasPrices()

// バッチ実行
executeBatch(operations)
```

**使用例**:
```typescript
const utils = new UniversalContractUtils(rpcUrl, privateKey);
const result = await utils.callContractRead(
  contractAddress,
  abi,
  'balanceOf',
  [walletAddress]
);
```

### gas-analyzer.ts
**目的**: ネットワークガス価格の分析と監視  
**使用方法**:
```bash
# 現在のガス価格分析
ts-node templates/gas-analyzer.ts

# リアルタイム監視
ts-node templates/gas-analyzer.ts --monitor

# CSV出力
ts-node templates/gas-analyzer.ts --output=gas-report.csv
```

**分析項目**:
- 現在のガス価格（base fee + priority fee）
- ネットワーク混雑度
- 推奨ガス戦略（safe/standard/fast/instant）
- コスト予測

### call-read.ts
**目的**: 任意のコントラクトのREAD関数実行  
**使用方法**:
```bash
ts-node templates/call-read.ts \
  --contract=0x... \
  --abi=./abi/ERC20.json \
  --function=balanceOf \
  --args='["0x..."]'
```

### call-write.ts
**目的**: 任意のコントラクトのWRITE関数実行  
**使用方法**:
```bash
ts-node templates/call-write.ts \
  --contract=0x... \
  --abi=./abi/ERC20.json \
  --function=transfer \
  --args='["0x...", "1000000000000000000"]' \
  --gas-limit=100000 \
  --dynamic-gas=fast
```

### contract-deploy.ts
**目的**: コントラクトのデプロイメント  
**使用方法**:
```bash
ts-node templates/contract-deploy.ts \
  --abi=./contracts/MyContract.abi \
  --bytecode=./contracts/MyContract.bin \
  --args='["arg1", 123, true]' \
  --gas-limit=2000000
```

### batch-execute.ts
**目的**: 複数のトランザクションを効率的に実行  
**使用方法**:
```bash
ts-node templates/batch-execute.ts \
  --operations='[
    {
      "type": "call",
      "contract": "0x...",
      "method": "approve",
      "args": ["0x...", "1000000"]
    },
    {
      "type": "call",
      "contract": "0x...",
      "method": "swap",
      "args": ["0x...", "0x...", 1000000]
    }
  ]'
```

---

## 🎯 カスタムスクリプト (custom/)

### custom/deploy/ - デプロイメント関連

#### multiswap-deploy-test.js
**目的**: MultiSwapコントラクトのデプロイとテスト  
**機能**:
- マルチホップスワップコントラクトのデプロイ
- 初期設定とテスト実行
- ガス使用量分析

#### deploy-arbitrage-simple.js
**目的**: アービトラージコントラクトのデプロイ  
**特徴**:
- ChatGPT推奨のFund pooling実装
- Owner-only access control
- ガス最適化済み

#### test-arbitrage-with-detailed-logs.js 🆕
**目的**: 詳細なトランザクション分析付きアービトラージテスト  
**機能**:
- ブロック内順位分析
- 競合トランザクション詳細
- 自動ログファイル生成
- パフォーマンス評価

### custom/hyperevm-swap/ - HyperSwap統合

#### v3-swap-testnet-router01.js
**目的**: HyperSwap V3でのトークンスワップ  
**使用方法**:
```bash
node custom/hyperevm-swap/v3-swap-testnet-router01.js \
  --tokenIn=WETH \
  --tokenOut=PURR \
  --amount=0.001 \
  --slippage=0.5
```

#### check-v3-liquidity.js
**目的**: V3プールの流動性確認  
**機能**:
- プール存在確認
- 流動性量チェック
- 価格レンジ分析

### custom/monitoring/ - 監視ツール

#### dex-rate-monitor.ts
**目的**: リアルタイムDEXレート監視  
**使用方法**:
```bash
ts-node custom/monitoring/dex-rate-monitor.ts \
  --dex=hyperswap \
  --pair=WETH/PURR \
  --interval=5000
```

#### flexible-dex-monitor.js
**目的**: 設定ベースの柔軟な監視  
**機能**:
- 複数DEX同時監視
- アラート設定
- データロギング

#### simple-rate-check.ts
**目的**: シンプルなレート確認  
**使用方法**:
```bash
ts-node custom/monitoring/simple-rate-check.ts
```

### custom/investigate/ - 調査・分析

#### analyze-v2-routes.js
**目的**: V2ルーター利用可能ペアの分析  
**出力**: JSON形式のペアリスト

#### investigate-router-pairs.js
**目的**: V2/V3ルーターのペア調査  
**機能**:
- ペア存在確認
- 流動性チェック
- 実行可能性テスト

---

## 💡 使用例とベストプラクティス

### 1. トークンスワップの実行
```bash
# 1. まずレートを確認
ts-node custom/monitoring/simple-rate-check.ts

# 2. ガス価格を分析
ts-node templates/gas-analyzer.ts

# 3. スワップ実行
node custom/hyperevm-swap/v3-swap-testnet-router01.js \
  --tokenIn=WETH \
  --tokenOut=PURR \
  --amount=0.1 \
  --dynamic-gas=fast
```

### 2. アービトラージの実行
```bash
# 1. 機会を監視
ts-node custom/monitoring/dex-rate-monitor.ts --interval=1000

# 2. 詳細ログ付きで実行
node custom/deploy/test-arbitrage-with-detailed-logs.js

# 3. ログ分析
cat custom/deploy/arbitrage_detailed_log.txt | grep "競合"
```

### 3. コントラクトデプロイメント
```bash
# 1. ガス見積もり
node custom/deploy/estimate-gas-arbitrage.js

# 2. デプロイ実行
node custom/deploy/deploy-arbitrage-simple.js

# 3. 動作確認
node custom/deploy/test-deployed-arbitrage.js
```

### 4. バッチ操作
```bash
# 承認とスワップを一括実行
ts-node templates/batch-execute.ts --operations='[
  {
    "type": "call",
    "contract": "0xWETH",
    "method": "approve",
    "args": ["0xRouter", "1000000000000000000"]
  },
  {
    "type": "call", 
    "contract": "0xRouter",
    "method": "swap",
    "args": ["0xWETH", "0xPURR", "1000000000000000000"]
  }
]'
```

## 🛠️ トラブルシューティング

### よくあるエラーと対処法

1. **"missing revert data"**
   - 原因: V2ルーターの制限
   - 対処: V3ルーターを使用

2. **"SPL"エラー**
   - 原因: 間違ったfee tier
   - 対処: 正しいfee設定（500/3000/10000）

3. **ガス制限超過**
   - 原因: 2M gas制限超過
   - 対処: ガス制限を1.9M以下に設定

4. **"insufficient funds"**
   - 原因: ガス代不足
   - 対処: ウォレットにETHを追加

---

**最終更新**: 2025年1月8日  
**次**: [開発者ガイド](./DEVELOPER_GUIDE.md)