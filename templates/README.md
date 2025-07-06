# 汎用コントラクトテンプレート

このディレクトリには、どんなスマートコントラクトにも使える汎用テンプレートが含まれています。

## 🎯 概要

ChatGPTの提案を基に、ABI、コントラクトアドレス、関数名、引数を指定するだけで、任意のREAD/WRITE関数を実行できる汎用テンプレートを作成しました。

## 📁 ファイル構成

```
templates/
├── contract-utils.ts           # 汎用コントラクト操作クラス
├── call-read.ts               # READ関数実行スクリプト
├── call-write.ts              # WRITE関数実行スクリプト
├── contract-deploy.ts         # コントラクトデプロイスクリプト
├── batch-execute.ts           # バッチ実行スクリプト
└── README.md                  # このファイル
```

## 🚀 使用方法

### 1. READ関数の実行

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

### 2. WRITE関数の実行

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

# ガス見積もりのみ
ts-node templates/call-write.ts \
  --abi=./examples/sample-abi/ERC20.json \
  --address=0x1234567890123456789012345678901234567890 \
  --function=transfer \
  --args=0xabcdef1234567890123456789012345678901234,1000000000000000000 \
  --estimate
```

### 3. コントラクトデプロイ

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
```

### 4. バッチ実行

```bash
# 設定ファイルに基づいてバッチ実行
ts-node templates/batch-execute.ts --config=./examples/batch-config-sample.json

# エラー時停止オプション付き
ts-node templates/batch-execute.ts --config=./examples/batch-config-sample.json --stop-on-error
```

## 🛠️ 高度な機能

### 1. ガスオプション

- `--gas-limit`: ガス制限の指定
- `--gas-price`: ガス価格の指定（Legacy）
- `--max-fee-per-gas`: 最大ガス料金（EIP-1559）
- `--max-priority-fee-per-gas`: 優先ガス料金（EIP-1559）
- `--value`: 送金額（payable関数用）

### 2. 実行オプション

- `--no-wait`: トランザクション確認を待機しない
- `--confirmations`: 必要な確認数
- `--block`: 特定ブロックでの実行（READ専用）
- `--estimate`: ガス見積もりのみ実行（WRITE専用）

### 3. 引数の指定方法

#### シンプルな引数
```bash
--args=value1,value2,value3
```

#### JSON配列形式
```bash
--args='["value1","value2",123,true]'
```

#### 複雑な構造
```bash
--args='[["0xA","0xB"],"1000000000000000000"]'
```

## 🔧 設定

### 環境変数

```bash
# .env ファイル
HYPEREVM_RPC_URL=https://rpc.hyperliquid.xyz/evm
PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
```

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
        "gasLimit": "100000"
      },
      "description": "トークン転送"
    }
  ]
}
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

## 🔍 デバッグとトラブルシューティング

### 1. ガス見積もりエラー
```bash
# まずガス見積もりを実行
ts-node templates/call-write.ts \
  --abi=./abi/Contract.json \
  --address=0x1234... \
  --function=myFunction \
  --args=param1,param2 \
  --estimate
```

### 2. ABI確認
```bash
# READ関数でコントラクト情報を確認
ts-node templates/call-read.ts \
  --abi=./abi/Contract.json \
  --address=0x1234... \
  --function=name

ts-node templates/call-read.ts \
  --abi=./abi/Contract.json \
  --address=0x1234... \
  --function=version
```

### 3. イベントログ確認
JavaScriptコードで直接確認：
```javascript
const { UniversalContractUtils } = require('./contract-utils');
const utils = new UniversalContractUtils(rpcUrl, privateKey);

const events = await utils.getContractEvents({
  contractAddress: '0x1234...',
  abiPath: './abi/Contract.json',
  eventName: 'Transfer',
  fromBlock: 18000000,
  toBlock: 'latest'
});
console.log(events);
```

## 📈 今後の拡張

このテンプレートを基に、以下のような専用スクリプトを作成できます：

1. **価格監視スクリプト**: DeFiプロトコルの価格を定期的に取得
2. **流動性管理**: Uniswap等のLP管理
3. **ガバナンス**: DAOの提案投票
4. **アービトラージ**: 価格差を利用した自動取引
5. **NFT管理**: 大量NFTの一括操作

すべてこのテンプレートの拡張として実現可能です！