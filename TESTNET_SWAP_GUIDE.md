# 🧪 テストネットスワップ実行ガイド

## 📋 事前準備

### 1. 環境設定
```bash
# .envファイルを作成
cp .env.example .env
```

### 2. .envファイルを編集
```bash
# メインネット用秘密鍵 (実際のウォレットの秘密鍵)
PRIVATE_KEY=0x[your_private_key_here]

# テストネット設定 (オプション - PRIVATE_KEYがあれば自動生成)
TESTNET_WALLET_ADDRESS=0x[your_wallet_address_here]
```

### 3. テストネット資金の取得

#### HYPEトークン取得
```bash
# フォーセットサイト
# https://faucet.hyperliquid-testnet.xyz
```

#### ERC20トークン取得
- HSPX, WETH, PURR, JEFF等のテストネットトークンを取得
- DEXでの購入またはフォーセットを利用

## 🔍 残高確認

### 現在の残高をチェック
```bash
# 環境変数から自動取得
node check-testnet-balances.js

# または特定のアドレスを指定
node check-testnet-balances.js 0x[wallet_address]
```

### 必要な最低残高
- **HYPE**: 0.1 HYPE (ガス代用)
- **スワップ元トークン**: 適量 (例: 1 HSPX)

## 🔄 スワップ実行手順

### ステップ1: レート確認 (quote-onlyモード)
```bash
# V2でのレート確認
node custom/hyperevm-swap/v2-swap-testnet.js --tokenIn HSPX --tokenOut WETH --amount 1 --quote-only

# V3でのレート確認 (全fee tier)
node custom/hyperevm-swap/v3-swap-testnet.js --tokenIn HSPX --tokenOut WETH --amount 1 --quote-only

# V3特定fee tier
node custom/hyperevm-swap/v3-swap-testnet.js --tokenIn HSPX --tokenOut WETH --amount 1 --fee 3000 --quote-only
```

### ステップ2: 実際のスワップ実行
```bash
# V2スワップ実行
node custom/hyperevm-swap/v2-swap-testnet.js --tokenIn HSPX --tokenOut WETH --amount 1 --slippage 1.0

# V3スワップ実行
node custom/hyperevm-swap/v3-swap-testnet.js --tokenIn HSPX --tokenOut WETH --amount 1 --fee 3000 --slippage 1.0
```

## 📊 動作確認済みペア (テストネット)

### V2プール (確認済み - 42ペア)
```
✅ HSPX ↔ WETH: 高流動性
✅ HSPX ↔ PURR: 中流動性  
✅ WETH ↔ PURR: 中流動性
✅ HSPX ↔ JEFF: 低流動性
```

### V3プール (推定)
```
⚠️ テストネットでは流動性が限定的
💡 メインネットでは豊富な流動性確認済み
```

## 🛡️ 安全機能

### ガス代保護
- 最低0.1 HYPE残高チェック
- 最大10 Gweiガス価格制限
- スワップ前後の残高確認

### スリッページ保護
- デフォルト: 0.5%
- 調整可能: --slippage 1.0 (1%に設定)

## 🚨 トラブルシューティング

### よくあるエラーと対処法

#### 1. "insufficient HYPE balance"
```bash
# 対処法: フォーセットでHYPE取得
# https://faucet.hyperliquid-testnet.xyz
```

#### 2. "Pool not found"
```bash
# 対処法: 他のペアを試す
# V2の動作確認済みペアを使用
node custom/investigate/test-v2-pools-testnet.js
```

#### 3. "transaction reverted"
```bash
# 対処法1: スリッページを増やす
--slippage 2.0

# 対処法2: 少額でテスト
--amount 0.1
```

#### 4. "Private key not set"
```bash
# 対処法: .envファイルを確認
echo $PRIVATE_KEY
```

## 🎯 推奨テスト順序

### 1. 初回テスト
```bash
# レート確認のみ
node custom/hyperevm-swap/v2-swap-testnet.js --tokenIn HSPX --tokenOut WETH --amount 0.1 --quote-only
```

### 2. 少額スワップ
```bash
# 0.1 HSPXで実際スワップ
node custom/hyperevm-swap/v2-swap-testnet.js --tokenIn HSPX --tokenOut WETH --amount 0.1 --slippage 1.0
```

### 3. 機能比較
```bash
# V2とV3のレート比較
node custom/hyperevm-swap/v2-swap-testnet.js --tokenIn HSPX --tokenOut WETH --amount 1 --quote-only
node custom/hyperevm-swap/v3-swap-testnet.js --tokenIn HSPX --tokenOut WETH --amount 1 --quote-only
```

## 📈 パフォーマンス計測

### 実行時間とガス使用量
- V2: 約200,000 gas
- V3: 約250,000 gas (fee tierにより変動)

### 価格精度
- V2: シンプルなAMM価格
- V3: 複数fee tierから最適選択

## 🔗 参考リンク

- **テストネットエクスプローラー**: https://explorer.hyperliquid-testnet.xyz
- **HyperSwap UI**: https://testnet.hyperswap.exchange
- **フォーセット**: https://faucet.hyperliquid-testnet.xyz

---

**⚠️ 重要**: テストネット専用のウォレットを使用し、本物の資金を入れないでください。