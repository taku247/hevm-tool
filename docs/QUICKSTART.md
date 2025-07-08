# HyperEVM Tools クイックスタートガイド

## 🚀 5分で始める

### 1. セットアップ（1分）

```bash
# リポジトリのクローン
git clone https://github.com/taku247/hevm-tool.git
cd hevm-tool

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
```

**.env ファイルを編集**:
```env
# 最低限必要な設定
HYPERLIQUID_TESTNET_RPC=https://rpc.hyperliquid-testnet.xyz/evm
TESTNET_PRIVATE_KEY=your_testnet_private_key_here
```

### 2. 残高確認（30秒）

```bash
# 自分のウォレット残高を確認
node scripts/balance_check.js
```

### 3. トークンスワップ（2分）

```bash
# WETH → PURR スワップ
node custom/hyperevm-swap/v3-swap-testnet-router01.js \
  --tokenIn=WETH \
  --tokenOut=PURR \
  --amount=0.001
```

### 4. レート監視（1分）

```bash
# 現在のレートを確認
ts-node custom/monitoring/simple-rate-check.ts
```

---

## 📋 よくある使用ケース

### ケース1: トークンの承認とスワップ

```bash
# Step 1: トークンの承認
ts-node templates/call-write.ts \
  --contract=0xADcb2f358Eae6492F61A5F87eb8893d09391d160 \
  --abi=./abi/ERC20.json \
  --function=approve \
  --args='["0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990", "1000000000000000000"]'

# Step 2: スワップ実行
node custom/hyperevm-swap/v3-swap-testnet-router01.js \
  --tokenIn=WETH \
  --tokenOut=PURR \
  --amount=0.1
```

### ケース2: ガス最適化スワップ

```bash
# ガス価格を分析
ts-node templates/gas-analyzer.ts

# 動的ガス価格でスワップ
node custom/hyperevm-swap/v3-swap-with-dynamic-gas.js \
  --tokenIn=WETH \
  --tokenOut=PURR \
  --amount=0.1 \
  --gas-strategy=fast
```

### ケース3: アービトラージ監視

```bash
# リアルタイム価格監視
ts-node custom/monitoring/dex-rate-monitor.ts \
  --interval=5000 \
  --alert-threshold=0.01
```

### ケース4: コントラクトデプロイ

```bash
# SimpleStorageコントラクトをデプロイ
ts-node custom/deploy/simple-storage-contract.ts

# カスタムコントラクトをデプロイ
ts-node templates/contract-deploy.ts \
  --abi=./contracts/MyContract.abi \
  --bytecode=./contracts/MyContract.bin \
  --gas-limit=1900000
```

---

## ⚡ 高度な使用例

### マルチホップスワップ（WETH → PURR → HFUN）

```bash
# アービトラージコントラクトを使用
node custom/deploy/test-deployed-arbitrage.js
```

### バッチトランザクション

```typescript
// batch-example.ts
import { UniversalContractUtils } from './templates/contract-utils';

async function batchOperations() {
  const utils = new UniversalContractUtils(
    process.env.HYPERLIQUID_TESTNET_RPC!,
    process.env.TESTNET_PRIVATE_KEY!
  );

  await utils.executeBatch([
    {
      contract: WETH_ADDRESS,
      method: 'approve',
      args: [ROUTER_ADDRESS, ethers.MaxUint256]
    },
    {
      contract: ROUTER_ADDRESS,
      method: 'swapExactTokensForTokens',
      args: [amountIn, minAmountOut, [WETH, PURR], recipient, deadline]
    }
  ]);
}
```

---

## 🛠️ トラブルシューティング

### エラー: "missing revert data"
**原因**: V2ルーターの制限  
**解決**: V3ルーターを使用してください

```bash
# ❌ V2 (エラーになる可能性)
node custom/hyperevm-swap/v2-swap-testnet.js

# ✅ V3 (推奨)
node custom/hyperevm-swap/v3-swap-testnet-router01.js
```

### エラー: "insufficient funds"
**原因**: ガス代不足  
**解決**: テストネットETHを取得

```bash
# 残高確認
node scripts/balance_check.js

# Faucetから取得
# https://faucet.hyperliquid-testnet.xyz/
```

### エラー: "gas limit exceeded"
**原因**: 2M gasを超過  
**解決**: ガス制限を下げる

```bash
# ガス制限を指定
--gas-limit=1900000
```

---

## 📚 次のステップ

1. **詳細なドキュメント**
   - [プロジェクト構造](./PROJECT_STRUCTURE.md)
   - [スクリプトガイド](./SCRIPTS_GUIDE.md)
   - [開発者ガイド](./DEVELOPER_GUIDE.md)

2. **サンプルコード**
   - [templates/](../templates/) - TypeScriptテンプレート
   - [custom/deploy/](../custom/deploy/) - デプロイメント例

3. **テスト**
   ```bash
   npm test
   ```

---

## 💬 サポート

- **GitHub Issues**: https://github.com/taku247/hevm-tool/issues
- **Discord**: [HyperLiquid Discord](https://discord.gg/hyperliquid)

---

**Happy Trading! 🚀**