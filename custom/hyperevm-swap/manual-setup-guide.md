# 🚀 HyperSwap テストネット手動セットアップガイド

APIフォーセットが利用できない場合の手動セットアップ手順です。

## 📝 ステップ1: MetaMaskにテストネット追加

### ネットワーク設定
以下の情報でHyperLiquid Testnetを追加してください：

```
ネットワーク名: HyperLiquid Testnet
RPC URL: https://rpc.hyperliquid-testnet.xyz/evm
チェーンID: 998
通貨シンボル: ETH
ブロックエクスプローラー: https://app.hyperliquid-testnet.xyz/explorer
```

### MetaMaskでの追加方法
1. MetaMaskを開く
2. 「ネットワーク」→「ネットワークを追加」
3. 「カスタムRPC」を選択
4. 上記の情報を入力
5. 「保存」をクリック

## 🔑 ステップ2: テストウォレットのインポート

### 生成済みテストウォレット
```
アドレス: [.envファイルのTESTNET_WALLET_ADDRESSを使用]
秘密鍵: [環境変数TESTNET_PRIVATE_KEYで設定]
```

⚠️ **重要**: この秘密鍵はテストネット専用です。メインネットでは絶対に使用しないでください。

### MetaMaskでのインポート方法
1. MetaMaskで「アカウント」→「アカウントをインポート」
2. 「秘密鍵」を選択
3. 上記の秘密鍵を貼り付け
4. 「インポート」をクリック
5. HyperLiquid Testnetに切り替え

## 💧 ステップ3: 公式フォーセットでETH取得

### フォーセットアクセス
1. https://app.hyperliquid-testnet.xyz/drip にアクセス
2. MetaMaskを接続
3. HyperLiquid Testnetに接続されていることを確認

### ETH取得
1. 「Connect Wallet」をクリック
2. MetaMaskで接続を承認
3. フォーセットボタンをクリック（通常は「Claim」や「Drip」）
4. 取引を承認

### 取得量の確認
```bash
# 残高確認
node custom/hyperevm-swap/faucet-guide.js --balance $TESTNET_WALLET_ADDRESS
```

## 🧪 ステップ4: スワップ機能テスト

### 準備完了の確認
最低0.001 ETH以上あることを確認してください：

```bash
node custom/hyperevm-swap/faucet-guide.js --check
```

### V2スワップテスト（レート確認のみ）
```bash
# レート確認
node custom/hyperevm-swap/v2-swap.js --tokenIn HSPX --tokenOut WETH --amount 10 --quote-only
```

### V3スワップテスト（レート確認のみ）
```bash
# V3レート確認
node custom/hyperevm-swap/v3-swap.js --tokenIn HSPX --tokenOut WETH --amount 10 --quote-only
```

### 実際のスワップ（小額テスト）
⚠️ 十分なETHがある場合のみ実行：

```bash
# V2スワップ（小額）
node custom/hyperevm-swap/v2-swap.js --tokenIn HSPX --tokenOut WETH --amount 1 --slippage 2.0

# V3スワップ（小額）
node custom/hyperevm-swap/v3-swap.js --tokenIn HSPX --tokenOut WETH --amount 1 --slippage 2.0
```

## 🎯 期待される結果

### 成功時の表示例
```
🔄 V2スワップ開始: HSPX → WETH
   ウォレット: [.envファイルのアドレス]
   入力量: 1.0 HSPX
   スリッページ: 2.0%

💰 残高確認:
   HSPX: 1000.0

📊 レート取得:
   期待出力: 0.001234 WETH
   最小出力: 0.001210 WETH
   レート: 0.001234

🔐 Approval:
   ✅ Approval完了: Block 26075420

🚀 スワップ実行:
   ✅ スワップ完了: Block 26075421
   ガス使用量: 123,456

🎉 スワップ成功！
```

## 🔧 トラブルシューティング

### ETHが取得できない場合
1. 公式フォーセットの制限（4時間待機）
2. 別のテストウォレットで試行
3. コミュニティフォーセット利用（注意深く）

### スワップが失敗する場合
1. **流動性不足**: 別のトークンペア試行
2. **ガス不足**: より多くのETH取得
3. **スリッページ**: より高いスリッページ設定

### 一般的なエラー
- `insufficient funds`: ETH不足
- `execution reverted`: 流動性不足またはスリッページ
- `nonce too low`: MetaMaskでリセット

## 📞 サポート

問題が発生した場合：
1. `node custom/hyperevm-swap/faucet-guide.js --check` で状態確認
2. エラーログの確認
3. 小額での再テスト

## 🎉 次のステップ

テストが成功したら：
1. より大きな金額でのテスト
2. 異なるトークンペアでのテスト
3. メインネット実装への準備

---

**注意**: このガイドはテストネット専用です。メインネットでの実行前に十分なテストを行ってください。