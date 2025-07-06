# Custom Utils

HyperEVM/HyperSwap開発で使用する汎用ユーティリティツール集

## 🔧 利用可能なツール

### 💰 check-token-balances.js
指定したウォレットアドレスのトークン残高を確認するツール

#### 主要機能
- **全トークン残高表示**: config/token-config.jsonから読み込んだ全トークンの残高
- **HYPE残高表示**: ネイティブHYPEの残高
- **特定トークン確認**: 指定したトークンのみの残高確認
- **ネットワーク切り替え**: テストネット・メインネット両対応
- **残高フィルタ**: 残高があるトークンのみ表示可能

#### 使用方法

```bash
# 基本的な使用方法（全トークン表示）
node custom/utils/check-token-balances.js --address YOUR_WALLET_ADDRESS

# 特定トークンのみ確認
node custom/utils/check-token-balances.js --address YOUR_WALLET_ADDRESS --tokens HSPX,WETH,PURR

# 残高があるトークンのみ表示
node custom/utils/check-token-balances.js --address YOUR_WALLET_ADDRESS --only-balance

# メインネットでの確認
node custom/utils/check-token-balances.js --address YOUR_WALLET_ADDRESS --network mainnet
```

#### オプション

| オプション | 説明 | 例 |
|-----------|------|-----|
| `--address` | ウォレットアドレス（必須） | `YOUR_WALLET_ADDRESS` |
| `--tokens` | 特定トークンのみ確認（カンマ区切り） | `HSPX,WETH,PURR` |
| `--network` | ネットワーク選択 | `testnet` または `mainnet` |
| `--only-balance` | 残高があるトークンのみ表示 | - |
| `--help` | ヘルプ表示 | - |

#### 出力例

```
🔍 ウォレット残高確認: YOUR_WALLET_ADDRESS
🌐 ネットワーク: testnet (hyperevm-testnet)
📡 RPC: https://rpc.hyperliquid-testnet.xyz/evm

💰 HYPE残高:
   HYPE: 0.0

💎 トークン残高:
   0 WHYPE
   1000.0 HSPX
   0 xHSPX
   5.5 WETH
   100.25 PURR
   0 JEFF
   0 CATBAL
   0 HFUN
   0 POINTS

📊 サマリー:
   残高あり: 3/10 トークン

💰 残高があるトークン:
   HSPX: 1000.0
   WETH: 5.5
   PURR: 100.25
```

#### 技術仕様

- **設定読み込み**: `config/token-config.json`から自動読み込み
- **ネットワーク対応**: テストネット・メインネット自動切り替え
- **並列処理**: 複数トークンの残高を並列取得で高速化
- **エラーハンドリング**: 個別トークンエラーでも他のトークンは正常表示
- **アドレス検証**: ethers.jsによる厳密なアドレス形式チェック

#### プログラマティック使用

```javascript
const { TokenBalanceChecker } = require('./custom/utils/check-token-balances');

async function example() {
  const checker = new TokenBalanceChecker('testnet');
  
  // 全トークン残高取得
  const result = await checker.getAllTokenBalances('YOUR_WALLET_ADDRESS');
  
  // 特定トークンのみ
  const tokens = await checker.checkSpecificTokens('YOUR_WALLET_ADDRESS', ['HSPX', 'WETH']);
}
```

## 🚀 今後の追加予定

- **価格計算ツール**: トークン残高の USD/JPY 換算
- **履歴追跡ツール**: トランザクション履歴の分析
- **ガス計算ツール**: 各種操作のガス見積もり
- **アービトラージ計算**: DEX間の価格差分析

## 📝 使用上の注意

- すべてのツールは**読み取り専用**です
- 秘密鍵や署名は一切必要ありません
- RPC接続エラー時は適切なエラーメッセージを表示
- 大量のアドレス確認時はRPCレート制限にご注意ください