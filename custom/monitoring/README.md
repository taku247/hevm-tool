# DEX Rate Monitoring Scripts

HyperSwap と KittenSwap のレート監視ツール群です。

## 📊 dex-rate-monitor.ts

### 概要
HyperSwap V2、KittenSwap V2、KittenSwap CL (V3) のレートをリアルタイムで監視・比較するツールです。

### 主な機能
- **複数DEX対応**: HyperSwap V2、KittenSwap V2、KittenSwap CL (V3)
- **リアルタイム監視**: 指定間隔での自動更新
- **価格差アラート**: 閾値を超えた価格差を検出
- **多様な出力形式**: Table、JSON、CSV対応
- **V3手数料ティア対応**: 1bps、5bps、25bps、100bps

### 使用方法

#### 基本的なレート取得
```bash
# 1 HYPE → USDC のレート取得
ts-node custom/monitoring/dex-rate-monitor.ts --tokens=HYPE,USDC --amount=1

# 1000 USDC → HYPE のレート取得
ts-node custom/monitoring/dex-rate-monitor.ts --tokens=USDC,HYPE --amount=1000
```

#### リアルタイム監視
```bash
# 30秒間隔でレート監視
ts-node custom/monitoring/dex-rate-monitor.ts \
  --tokens=HYPE,USDC \
  --amount=1 \
  --monitor \
  --interval=30

# 特定DEXのみ監視
ts-node custom/monitoring/dex-rate-monitor.ts \
  --tokens=HYPE,USDC \
  --dex=hyperswap \
  --monitor
```

#### アラート機能
```bash
# 5%以上の価格差でアラート
ts-node custom/monitoring/dex-rate-monitor.ts \
  --tokens=HYPE,USDC \
  --monitor \
  --alert-threshold=0.05
```

#### 出力形式の指定
```bash
# JSON形式で出力
ts-node custom/monitoring/dex-rate-monitor.ts \
  --tokens=HYPE,USDC \
  --output=json

# CSV形式で出力
ts-node custom/monitoring/dex-rate-monitor.ts \
  --tokens=HYPE,USDC \
  --output=csv
```

### オプション一覧

| オプション | 説明 | 例 |
|------------|------|-----|
| `--tokens` | 取引ペア（必須） | `HYPE,USDC` |
| `--amount` | 取引量 | `1` |
| `--monitor` | 継続監視モード | - |
| `--interval` | 監視間隔（秒） | `30` |
| `--alert-threshold` | アラート閾値 | `0.05` (5%) |
| `--dex` | 特定DEX指定 | `hyperswap` |
| `--output` | 出力形式 | `table\|json\|csv` |
| `--help` | ヘルプ表示 | - |

### 対応DEX（2024年7月更新）

| DEX | 種類 | コントラクト | 状態 |
|-----|------|-------------|------|
| HyperSwap V2 | Uniswap V2互換 | `0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A` | ✅ 確認済み |
| HyperSwap V3 | Uniswap V3互換 | `0x03A918028f22D9E1473B7959C927AD7425A45C7C` | ✅ 確認済み |
| KittenSwap V2 | Uniswap V2互換 | `0xd6eeffbdaf6503ad6539cf8f337d79bebbd40802` | ✅ 確認済み |
| KittenSwap CL | Uniswap V3互換 | `0xd9949cB0655E8D5167373005Bd85f814c8E0C9BF` | ✅ 確認済み |

## 🎯 重要：複数プールとレート差異について

### HyperSwap UIとスクリプトのレート差異

HyperSwap UIとこのスクリプトで取得するレートに差異がある場合があります：

**例**: 1 UBTC → WHYPE の場合
- **HyperSwap UI**: 2796 WHYPE
- **スクリプト**: 2688 WHYPE（約3.9%の差）

### 差異の原因

#### 1. **複数プールの存在**
HyperSwap Explorerで確認すると、同じトークンペアで複数のプールが存在することがあります（例：HYPE/UBTCで5つのプール）。これらは以下の組み合わせです：
- 異なる手数料ティア（V3）: 1bps, 5bps, 30bps, 100bps
- 異なるDEX: HyperSwap vs KittenSwap
- 異なるバージョン: V2 vs V3
- 異なるトークン形式: Native HYPE vs Wrapped HYPE (WHYPE)

#### 2. **価格影響（Price Impact）**
取引量によってレートが大きく変動します：
- **小額取引（0.001 UBTC）**: 2805 WHYPE/UBTC → UIレートに近い
- **大額取引（1 UBTC）**: 2688 WHYPE/UBTC → 価格影響で悪化

#### 3. **ルーティングの違い**
- **HyperSwap UI**: 
  - 全プールから最適レートを自動選択
  - 必要に応じて複数プールに分割（スプリットルーティング）
  - スマートルーティングで最良価格を実現
  
- **このスクリプト**:
  - 単一プール（主にV2ルーター経由）を使用
  - シンプルな実装のため価格影響を受けやすい

### 推奨事項

1. **小額取引の場合**: UIとほぼ同じレートを得られます（0.01 UBTC以下推奨）
2. **大額取引の場合**: 複数の小額取引に分割して実行することを検討
3. **正確なレート**: 実際の取引前にHyperSwap UIで最終確認を推奨

### 実際のトークンアドレス（確認済み）

| トークン | アドレス | 備考 |
|----------|----------|------|
| WHYPE | `0x5555555555555555555555555555555555555555` | Wrapped HYPE（DEX取引用） |
| UBTC | `0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463` | Wrapped Bitcoin |
| Native HYPE | `0x0000000000000000000000000000000000000000` | ネイティブトークン（DEXでは直接取引不可） |

**注意**: DEXでは通常、ネイティブトークン（Native HYPE）は直接取引できず、Wrapped版（WHYPE）を使用します。

## DEXアーキテクチャの理解

### 🏗️ Router vs Quoter vs CL の違い

#### **Router（ルーター）**
- **役割**: 実際の取引実行
- **操作**: WRITE（状態変更あり）
- **ガス**: 消費あり、秘密鍵必要
- **機能**: `swapExactTokensForTokens()`, `getAmountsOut()`

#### **Quoter（クォーター）**
- **役割**: 見積もり専用（V3/CLで導入）
- **操作**: READ（状態変更なし）
- **ガス**: 消費なし、秘密鍵不要
- **機能**: `quoteExactInputSingle()`, `quoteExactInput()`

#### **CL（Concentrated Liquidity）**
- **概念**: V3の集中流動性方式
- **特徴**: 指定価格範囲での効率的な流動性提供
- **手数料**: 複数ティア（1bps, 5bps, 25bps, 100bps）

### 📊 HyperSwap vs KittenSwap の特徴

#### **HyperSwap**
- **性質**: HyperLiquid公式/コアチーム開発
- **特徴**: エコシステム統合、AI最適化ルーティング
- **命名**: V2 → V3（標準的な進化）
- **対象**: メジャーペア中心

#### **KittenSwap**
- **性質**: サードパーティ/コミュニティ開発
- **特徴**: 独立プロトコル、ミーム要素
- **命名**: V2 → CL（独自アプローチ）
- **対象**: ニッチトークン、多様なペア

### 🔍 V2 vs CL の技術的違い

#### **V2 アーキテクチャ（従来のAMM）**
```
流動性分散: [価格 0 ～ ∞] 全範囲に均等
手数料: 固定率（通常0.25%）
計算: シンプルな x*y=k 公式
資本効率: 低い
ガス効率: 高い
```

#### **CL アーキテクチャ（集中流動性）**
```
流動性分散: [指定範囲] に集中
手数料: 選択可能（1bps～100bps）
計算: 複雑な√price ベース
資本効率: 高い
ガス効率: 低い
```

### 💡 実際の価格差例

同じトークンペアでも異なる価格を提示：

```
1 HYPE → USDC の場合:
┌─────────────────────────┬─────────────┬──────────────┐
│ DEX                     │ レート      │ 特徴         │
├─────────────────────────┼─────────────┼──────────────┤
│ HyperSwap V2            │ 0.001230    │ 標準AMM      │
│ HyperSwap V3            │ 0.001245    │ 高効率CL     │
│ KittenSwap V2           │ 0.001225    │ シンプル     │
│ KittenSwap CL (1bps)    │ 0.001250    │ 最高効率     │
│ KittenSwap CL (5bps)    │ 0.001240    │ バランス     │
│ KittenSwap CL (25bps)   │ 0.001235    │ 一般的       │
│ KittenSwap CL (100bps)  │ 0.001220    │ 高手数料     │
└─────────────────────────┴─────────────┴──────────────┘
```

### 🎯 最適な使い分け

#### **大口取引**
```bash
# 最高効率を求める
ts-node custom/monitoring/dex-rate-monitor.ts --tokens=HYPE,USDC
# → CL の 1bps ティアが有利な可能性
```

#### **小額取引**
```bash
# ガス効率重視
ts-node custom/monitoring/dex-rate-monitor.ts --dex=hyperswap_v2
# → V2 が有利な可能性
```

#### **アービトラージ発見**
```bash
# 全DEX監視でチャンス発見
ts-node custom/monitoring/dex-rate-monitor.ts --monitor --alert-threshold=0.01
# → 異なるアーキテクチャ間の価格差を活用
```

### ⚡ アービトラージ機会

#### **同プロジェクト内アービトラージ**
- KittenSwap V2 vs KittenSwap CL 間の価格差
- HyperSwap V2 vs HyperSwap V3 間の価格差

#### **プロジェクト間アービトラージ**
- HyperSwap vs KittenSwap 間の実装差による価格差
- 公式 vs コミュニティプロジェクト間の流動性差

#### **手数料ティア間アービトラージ**
- CL内の異なる手数料ティア間での価格差

### 対応トークン

| シンボル | アドレス | 備考 |
|----------|----------|------|
| HYPE | `0x0000...0000` | ネイティブトークン |
| USDC | `0x8ae93f5...` | USD Coin |
| WETH | `0x420000...` | Wrapped Ether |

### 出力例

```
💱 DEX レート比較結果
========================

┌─────────────────────────┬─────────────────┬──────────────┬─────────────┐
│ DEX                     │ レート          │ 出力量       │ ガス予想    │
├─────────────────────────┼─────────────────┼──────────────┼─────────────┤
│ 🏆 KittenSwap CL (25bps) │        0.001234 │     0.1234   │     ~200k   │
│    HyperSwap V2         │        0.001230 │     0.1230   │     ~150k   │
│    KittenSwap V2        │        0.001225 │     0.1225   │     ~150k   │
└─────────────────────────┴─────────────────┴──────────────┴─────────────┘

🏆 最良レート: KittenSwap CL (25bps) (0.001234)
📊 価格差: 0.73%
⏰ 更新時刻: 2024-01-15 14:30:45
```

### アラート例

```
🚨 アラート: 5.23% の価格差を検出!
   最良: KittenSwap CL (25bps) (0.001234)
   最悪: KittenSwap V2 (0.001171)
   アービトラージ機会あり!
```

## 活用例

### 1. アービトラージ機会の発見
```bash
# 高頻度監視でアービトラージ機会を監視
ts-node custom/monitoring/dex-rate-monitor.ts \
  --tokens=HYPE,USDC \
  --monitor \
  --interval=10 \
  --alert-threshold=0.02
```

### 2. 最適な取引タイミングの判断
```bash
# 大口取引前のレート確認
ts-node custom/monitoring/dex-rate-monitor.ts \
  --tokens=USDC,HYPE \
  --amount=10000
```

### 3. 流動性の監視
```bash
# V3の全手数料ティアを確認
ts-node custom/monitoring/dex-rate-monitor.ts \
  --tokens=HYPE,USDC \
  --dex=kittenswap_cl
```

## 設定ファイル

`config/tokens.json`でトークンアドレスやDEX設定をカスタマイズできます。

## セットアップ手順

### 1. コントラクトアドレスの確認
実際のDEXコントラクトアドレスを確認する必要があります：

```bash
# 接続テスト
ts-node custom/monitoring/rate-monitor-template.ts --test

# セットアップガイド表示
ts-node custom/monitoring/rate-monitor-template.ts --setup
```

### 2. アドレス設定の更新
正しいコントラクトアドレスを取得後、以下のファイルを更新：
- `custom/monitoring/dex-rate-monitor.ts`
- `config/tokens.json`

### 3. 動作確認
```bash
# 利用可能なDEX確認
ts-node custom/monitoring/rate-monitor-template.ts --available

# レート取得テスト
ts-node custom/monitoring/dex-rate-monitor.ts --tokens=HYPE,USDC
```

## 注意事項

- **✅ アドレス更新済み**: 2024年7月に正しいコントラクトアドレスに更新済み
- **⚠️ トークンペア要確認**: 実際に流動性があるトークンペアの確認が必要
- HyperEVMにテストネットがないため、小額での動作確認を推奨
- V3では流動性がないプールではエラーが発生する場合があります
- レート取得にはRPC呼び出しが必要なため、高頻度監視時はRPC制限にご注意ください

## トラブルシューティング

### "call revert exception" エラー
- コントラクトアドレスが間違っている
- 指定したペアに流動性がない
- ABIが正しくない

### "bad address checksum" エラー  
- トークンアドレスのチェックサムが正しくない
- ethers.utils.getAddress()で正規化が必要

### V3/CL で "流動性なし" エラー
- 指定した手数料ティアにプールが存在しない
- 異なる手数料ティア（1bps, 5bps, 25bps, 100bps）を試す
- V2では利用可能でもV3/CLでは未対応の場合がある

## 📚 参考資料

### 技術仕様
- **HyperSwap**: [docs.hyperswap.exchange](https://docs.hyperswap.exchange/)
- **Uniswap V2**: 従来のAMM実装リファレンス
- **Uniswap V3**: 集中流動性アーキテクチャリファレンス

### アドレス確認
- **Purrsec**: [purrsec.com](https://purrsec.com/) - HyperEVMコントラクト探索
- **HyperEVM RPC**: `https://rpc.hyperliquid.xyz/evm`