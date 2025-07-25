# HyperEVM Tools ドキュメント

## 📚 ドキュメント一覧

### 🚀 はじめに
- **[クイックスタート](./QUICKSTART.md)** - 5分で始める
- **[プロジェクト構造](./PROJECT_STRUCTURE.md)** - ディレクトリ構成と使い分け

### 📖 詳細ガイド
- **[スクリプトガイド](./SCRIPTS_GUIDE.md)** - 各スクリプトの使用方法
- **[開発者ガイド](./DEVELOPER_GUIDE.md)** - 新規開発の手順
- **[APIリファレンス](./API_REFERENCE.md)** - クラス・関数の詳細
- **[トレーディングペアガイド](./TRADING_PAIRS_GUIDE.md)** 🆕 - 全70ペアの完全ガイド
- **[KittenSwap統合ガイド](./KITTENSWAP_INTEGRATION.md)** - KittenSwap特有の実装方法

### 📋 インデックス
- **[カスタムスクリプト一覧](./CUSTOM_SCRIPTS_INDEX.md)** - custom/配下の全スクリプト解説

### 🔧 既存ドキュメント
- **[アーキテクチャ設計書](./architecture.md)** - システム全体アーキテクチャ
- **[API仕様書](./api-specification.md)** - REST/WebSocket API仕様
- **[データフロー設計書](./data-flow.md)** - データフロー設計
- **[デプロイメント設計書](./deployment.md)** - デプロイメント設計

## 🎯 目的別ガイド

### トークンスワップを行いたい
1. **[トレーディングペアガイド](./TRADING_PAIRS_GUIDE.md)** で利用可能ペアを確認 🆕
2. [クイックスタート](./QUICKSTART.md) のケース1を参照
3. [カスタムスクリプト一覧](./CUSTOM_SCRIPTS_INDEX.md) の hyperevm-swap セクション

### アービトラージbotを作りたい
1. **[トレーディングペアガイド](./TRADING_PAIRS_GUIDE.md)** でアービトラージ機会を分析 🆕
2. [MultiSwap アービトラージ](../custom/deploy/multiswap-arbitrage-memo.md) を読む
3. [開発者ガイド](./DEVELOPER_GUIDE.md) のパターン3を参照

### 新しいDEXを統合したい
1. [DEX統合ガイド](../src/dex/README.md) を読む
2. [開発者ガイド](./DEVELOPER_GUIDE.md) のDEX統合開発セクション
3. **KittenSwap統合の場合**: [KittenSwap統合ガイド](./KITTENSWAP_INTEGRATION.md) 🆕

### ガス最適化したい
1. [APIリファレンス](./API_REFERENCE.md) のガス価格ユーティリティ
2. [スクリプトガイド](./SCRIPTS_GUIDE.md) の gas-analyzer.ts

## 📊 機能マトリックス

| 機能 | ドキュメント | サンプルコード |
|------|-------------|---------------|
| **ペア情報確認** | [トレーディングペアガイド](./TRADING_PAIRS_GUIDE.md) 🆕 | `/config/trading-pairs-mainnet-corrected.json` |
| **DEXペア情報統合** | [カスタムスクリプト一覧](./CUSTOM_SCRIPTS_INDEX.md#dexペア情報統合システム) 🆕 | `custom/investigate/update-trading-pairs-master.js` |
| 残高確認 | [スクリプトガイド](./SCRIPTS_GUIDE.md#balance_checkjs) | `scripts/balance_check.js` |
| トークンスワップ | [クイックスタート](./QUICKSTART.md#3-トークンスワップ2分) | `custom/hyperevm-swap/` |
| アービトラージ | [トレーディングペアガイド](./TRADING_PAIRS_GUIDE.md#アービトラージ機会分析) 🆕 | `custom/monitoring/arbitrage-simulation-*.js` |
| コントラクトデプロイ | [開発者ガイド](./DEVELOPER_GUIDE.md#deploycontract) | `templates/contract-deploy.ts` |
| ガス分析 | [APIリファレンス](./API_REFERENCE.md#ガス価格ユーティリティ) | `templates/gas-analyzer.ts` |
| DEX統合 | [DEX統合ガイド](../src/dex/README.md) | `src/dex/` |
| Webダッシュボード | [API仕様書](./api-specification.md) | `dashboard/` |

## 🚀 クイックスタート

詳細は[クイックスタートガイド](./QUICKSTART.md)を参照してください。

```bash
# 基本的な使い方
git clone https://github.com/taku247/hevm-tool.git
cd hevm-tool
npm install
cp .env.example .env
# .envを編集後
node scripts/balance_check.js
```

## 📁 プロジェクト構造

詳細は[プロジェクト構造ドキュメント](./PROJECT_STRUCTURE.md)を参照してください。

```
hyperevm-tool/
├── scripts/          # 基本的なブロックチェーン操作スクリプト
├── templates/        # 汎用TypeScriptテンプレート（推奨）
├── custom/           # プロジェクト固有のカスタムスクリプト
├── src/              # 共通ユーティリティとコアロジック
├── tests/            # テストスイート
├── docs/             # ドキュメント
├── dashboard/        # Web UI
└── abi/              # 共通ABI定義
```

## 🔧 技術スタック

- **言語**: TypeScript, JavaScript (Node.js)
- **ブロックチェーン**: ethers.js v6, HyperEVM
- **Web**: Express.js, WebSocket
- **テスト**: Mocha, Chai, Hardhat
- **デプロイ**: Docker, PM2

## 🔄 更新履歴

### v2.2.0 (2025-07-12) 🆕
- **DEXペア情報統合マスターシステム構築**
- 段階的データ収集・統合アプローチの実装
- 4つの新規スクリプト追加:
  - `hyperswap-factory-pairs-export.js` - Hyperswap V3収集
  - `kittenswap-factory-pairs-export.js` - KittenSwap V3収集  
  - `merge-dex-pairs-to-config.js` - DEXデータ統合
  - `update-trading-pairs-master.js` - マスター実行スクリプト
- 自動バックアップ・エラーハンドリング強化
- Factory契約からの直接ペア収集システム完成

### v2.1.0 (2025-07-11)
- **トレーディングペア情報の完全整備** 🆕
- HyperEVM メインネット全70ペアの分析完了
- Hyperswap V3: プールなし判明（V1/V2のみ）
- KittenSwap V3: 15ペア対応 (21.4%)
- 包括的なペア設定ファイル `/config/trading-pairs-mainnet-corrected.json` 作成
- Factory コントラクトからの自動ペア収集システム構築

### v2.0.0 (2025-01-08)
- 包括的なドキュメント体系の構築
- MultiSwapアービトラージ実装（ChatGPT推奨）
- 詳細ログ機能の追加
- カスタムスクリプトインデックスの作成
- **KittenSwap統合ガイド作成** 🆕
- KittenSwap Factory分析・ABI最適化完了

### v1.5.0 (2025-01-07)
- DEX統合システムの実装
- TypeScriptテンプレートの拡充
- ガス最適化機能の強化

## 🤝 貢献方法

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📝 ライセンス

MIT License - 詳細は[LICENSE](../LICENSE)を参照

## 🗂️ 関連リンク

- [HyperLiquid公式](https://hyperliquid.xyz/)
- [HyperEVM Docs](https://docs.hyperliquid.xyz/)
- [GitHub Repository](https://github.com/taku247/hevm-tool)

---

**お問い合わせ**: [GitHub Issues](https://github.com/taku247/hevm-tool/issues)