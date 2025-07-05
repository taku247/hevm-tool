# Hyperevm Chain Tools - 設計ドキュメント

このディレクトリには、Hyperevm Chain Toolsプロジェクトの設計ドキュメントが含まれています。

## 📋 ドキュメント一覧

### 1. [アーキテクチャ設計書](./architecture.md)
- システム概要と全体アーキテクチャ
- コンポーネント設計
- 技術スタック
- セキュリティ設計
- 拡張性と運用設計

### 2. [API仕様書](./api-specification.md)
- REST APIエンドポイント
- WebSocket API
- スクリプト仕様
- エラーハンドリング
- 使用例

### 3. [データフロー設計書](./data-flow.md)
- 全体データフロー
- コンポーネント間データフロー
- エラーハンドリングフロー
- 状態管理
- パフォーマンス最適化

### 4. [デプロイメント設計書](./deployment.md)
- デプロイメント環境
- インフラストラクチャ設計
- CI/CDパイプライン
- 監視とログ
- セキュリティ設定

## 🎯 プロジェクト概要

Hyperevm Chain Toolsは、Hyperevm（HyperLiquid EVM）ブロックチェーンとの相互作用を簡素化するための包括的なツールセットです。以下の主要機能を提供します：

### 主要機能
- **残高確認**: 指定されたアドレスの残高をチェック
- **トランザクション送信**: ETH送金とスマートコントラクトデプロイ
- **コントラクト相互作用**: スマートコントラクトの読み取り・書き込み操作
- **Webダッシュボード**: リアルタイムでの操作と結果確認

### 技術スタック
- **Backend**: Node.js, Express.js, WebSocket
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Blockchain**: ethers.js, Hyperevm Network
- **Deployment**: Docker, PM2, Nginx

## 🚀 クイックスタート

### 前提条件
- Node.js 18.0.0以上
- yarn または npm

### インストール
```bash
# 依存関係のインストール
yarn install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してRPC URLと秘密鍵を設定
```

### 起動
```bash
# ダッシュボードを起動
yarn start

# ブラウザで http://localhost:3000 にアクセス
```

## 📁 プロジェクト構造

```
hevm-tool/
├── docs/                    # 設計ドキュメント
│   ├── README.md           # このファイル
│   ├── architecture.md     # アーキテクチャ設計
│   ├── api-specification.md # API仕様
│   ├── data-flow.md        # データフロー設計
│   └── deployment.md       # デプロイメント設計
├── scripts/                # コア機能スクリプト
│   ├── balance_check.js    # 残高チェック
│   ├── transaction_sender.js # トランザクション送信
│   └── contract_interaction.js # コントラクト相互作用
├── dashboard/              # Web UI
│   ├── server.js          # Express サーバー
│   └── public/
│       └── index.html     # フロントエンド
├── package.json           # Node.js依存関係
├── .env                   # 環境変数
└── README.md             # プロジェクト概要
```

## 🔧 開発ガイド

### 新機能の追加
1. `scripts/` ディレクトリに新しいスクリプトを追加
2. `dashboard/server.js` の `allowedScripts` に追加
3. API仕様書を更新
4. テストを追加

### コーディング規約
- JavaScript ES6+を使用
- 非同期処理にはasync/awaitを使用
- エラーハンドリングは必須
- コメントは日本語で記述

## 🛡️ セキュリティ

### 重要な注意事項
- 秘密鍵は絶対に公開しない
- 本番環境では適切なセキュリティ対策を実装
- テストネットでの動作確認を推奨

### セキュリティ機能
- 秘密鍵の検証
- スクリプト実行の制限
- 入力値の検証
- エラー情報の適切な処理

## 📊 監視とログ

### ログファイル
- `logs/error.log` - エラーログ
- `logs/combined.log` - 全ログ
- `logs/access.log` - アクセスログ

### 監視項目
- アプリケーション起動状態
- メモリ使用量
- CPU使用率
- ネットワーク接続状態

## 🤝 貢献

### 開発の流れ
1. 課題を特定
2. 機能を設計
3. コードを実装
4. テストを作成
5. ドキュメントを更新
6. レビューを受ける

### コードレビュー
- 設計原則の遵守
- セキュリティの確認
- パフォーマンスの評価
- ドキュメントの更新

## 📞 サポート

### 問題報告
- GitHub Issuesを使用
- 詳細な再現手順を記載
- 環境情報を含める

### 質問・相談
- 設計についての質問
- 実装についての相談
- 運用についての問い合わせ

## 📄 ライセンス

MIT License

## 🗂️ 関連リンク

- [Hyperevm公式ドキュメント](https://docs.hyperliquid.xyz/)
- [ethers.js ドキュメント](https://docs.ethers.io/)
- [Express.js ドキュメント](https://expressjs.com/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

## 📝 変更履歴

### Version 1.0.0 (2024-01-01)
- 初期リリース
- 基本機能の実装
- 設計ドキュメントの作成

### Version 1.1.0 (予定)
- 認証機能の追加
- バッチ処理機能
- パフォーマンス改善

---

*このドキュメントは継続的に更新されます。最新版を参照してください。*