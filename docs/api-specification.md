# Hyperevm Chain Tools API仕様書

## 1. API概要

Hyperevm Chain Tools APIは、Hyperevmブロックチェーンとの相互作用を提供するRESTful APIです。

### 1.1 基本情報
- **Base URL**: `http://localhost:3000`
- **WebSocket URL**: `ws://localhost:8080`
- **Content-Type**: `application/json`
- **Character Encoding**: UTF-8

### 1.2 認証
現在のバージョンでは認証は不要です。

## 2. REST API エンドポイント

### 2.1 スクリプト一覧取得

#### GET /api/scripts

利用可能なスクリプトの一覧を取得します。

**リクエスト**
```
GET /api/scripts
```

**レスポンス**
```json
{
  "scripts": [
    {
      "name": "balance_check.js",
      "description": "アドレスの残高を確認する",
      "parameters": ["address1", "address2..."]
    },
    {
      "name": "transaction_sender.js",
      "description": "トランザクションを送信する",
      "parameters": ["to_address", "value_in_ether"]
    },
    {
      "name": "contract_interaction.js",
      "description": "スマートコントラクトと相互作用する",
      "parameters": ["contract_address", "method", "params..."]
    }
  ]
}
```

**ステータスコード**
- `200 OK`: 正常に取得
- `500 Internal Server Error`: サーバーエラー

### 2.2 スクリプト実行

#### POST /api/execute-script

指定されたスクリプトを実行します。

**リクエスト**
```json
{
  "scriptName": "balance_check.js",
  "args": ["0x1234567890123456789012345678901234567890"]
}
```

**パラメータ**
- `scriptName` (string, required): 実行するスクリプト名
- `args` (array, optional): スクリプトに渡す引数の配列

**レスポンス**
```json
{
  "scriptName": "balance_check.js",
  "args": ["0x1234567890123456789012345678901234567890"],
  "exitCode": 0,
  "output": "{\n  \"success\": true,\n  \"address\": \"0x1234567890123456789012345678901234567890\",\n  \"balance\": \"1.234567890123456789\",\n  \"balanceWei\": \"1234567890123456789\",\n  \"timestamp\": \"2023-12-01T12:00:00.000Z\"\n}",
  "error": "",
  "timestamp": "2023-12-01T12:00:00.000Z"
}
```

**ステータスコード**
- `200 OK`: 実行完了（成功・失敗問わず）
- `400 Bad Request`: 無効なスクリプト名
- `500 Internal Server Error`: サーバーエラー

## 3. WebSocket API

### 3.1 接続

WebSocketサーバーに接続します。

**接続URL**
```
ws://localhost:8080
```

**接続イベント**
- `connection`: クライアント接続時
- `close`: クライアント切断時
- `error`: エラー発生時

### 3.2 メッセージ形式

#### 3.2.1 スクリプト実行結果

スクリプトの実行が完了すると、以下の形式でメッセージが送信されます。

```json
{
  "type": "script_execution",
  "data": {
    "scriptName": "balance_check.js",
    "args": ["0x1234567890123456789012345678901234567890"],
    "exitCode": 0,
    "output": "{\n  \"success\": true,\n  \"address\": \"0x1234567890123456789012345678901234567890\",\n  \"balance\": \"1.234567890123456789\",\n  \"balanceWei\": \"1234567890123456789\",\n  \"timestamp\": \"2023-12-01T12:00:00.000Z\"\n}",
    "error": "",
    "timestamp": "2023-12-01T12:00:00.000Z"
  }
}
```

## 4. スクリプト仕様

### 4.1 balance_check.js

#### 4.1.1 用途
指定されたアドレスの残高を確認します。

#### 4.1.2 パラメータ
- `address1, address2, ...` (string): 確認するアドレス（複数指定可能）

#### 4.1.3 出力形式
```json
[
  {
    "success": true,
    "address": "0x1234567890123456789012345678901234567890",
    "balance": "1.234567890123456789",
    "balanceWei": "1234567890123456789",
    "timestamp": "2023-12-01T12:00:00.000Z"
  }
]
```

#### 4.1.4 エラー形式
```json
[
  {
    "success": false,
    "address": "0x1234567890123456789012345678901234567890",
    "error": "invalid address",
    "timestamp": "2023-12-01T12:00:00.000Z"
  }
]
```

### 4.2 transaction_sender.js

#### 4.2.1 用途
ETHトランザクションを送信します。

#### 4.2.2 パラメータ
- `to_address` (string): 送信先アドレス
- `value_in_ether` (string): 送信金額（Ether単位）

#### 4.2.3 出力形式（成功）
```json
{
  "success": true,
  "transactionHash": "0xabcdef...",
  "from": "0x1234567890123456789012345678901234567890",
  "to": "0x0987654321098765432109876543210987654321",
  "value": "0.1",
  "gasUsed": "21000",
  "timestamp": "2023-12-01T12:00:00.000Z"
}
```

#### 4.2.4 出力形式（失敗）
```json
{
  "success": false,
  "from": "0x1234567890123456789012345678901234567890",
  "to": "0x0987654321098765432109876543210987654321",
  "value": "0.1",
  "error": "insufficient funds",
  "timestamp": "2023-12-01T12:00:00.000Z"
}
```

### 4.3 contract_interaction.js

#### 4.3.1 用途
スマートコントラクトとの相互作用を行います。

#### 4.3.2 パラメータ
このスクリプトは現在CLIインターフェースを持たず、モジュールとして使用されます。

#### 4.3.3 メソッド呼び出し結果
```json
{
  "success": true,
  "contractAddress": "0x1234567890123456789012345678901234567890",
  "method": "balanceOf",
  "parameters": ["0x0987654321098765432109876543210987654321"],
  "result": "1000000000000000000",
  "transactionHash": null,
  "timestamp": "2023-12-01T12:00:00.000Z"
}
```

#### 4.3.4 イベントログ取得結果
```json
{
  "success": true,
  "contractAddress": "0x1234567890123456789012345678901234567890",
  "eventName": "Transfer",
  "events": [
    {
      "blockNumber": 12345,
      "transactionHash": "0xabcdef...",
      "args": ["0x...", "0x...", "1000000000000000000"],
      "timestamp": "2023-12-01T12:00:00.000Z"
    }
  ],
  "timestamp": "2023-12-01T12:00:00.000Z"
}
```

## 5. エラーハンドリング

### 5.1 HTTPエラー

#### 5.1.1 400 Bad Request
```json
{
  "error": "Invalid script name"
}
```

#### 5.1.2 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "詳細なエラーメッセージ"
}
```

### 5.2 スクリプト実行エラー

スクリプトが正常に実行されない場合、`exitCode`が0以外になり、`error`フィールドにエラー情報が含まれます。

```json
{
  "scriptName": "balance_check.js",
  "args": ["invalid_address"],
  "exitCode": 1,
  "output": "",
  "error": "Error: invalid address format",
  "timestamp": "2023-12-01T12:00:00.000Z"
}
```

## 6. レート制限

現在のバージョンではレート制限は実装されていません。

## 7. 使用例

### 7.1 残高確認

```bash
curl -X GET http://localhost:3000/api/scripts
```

```bash
curl -X POST http://localhost:3000/api/execute-script \
  -H "Content-Type: application/json" \
  -d '{
    "scriptName": "balance_check.js",
    "args": ["0x1234567890123456789012345678901234567890"]
  }'
```

### 7.2 WebSocket接続

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = function() {
  console.log('WebSocket connected');
};

ws.onmessage = function(event) {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

ws.onclose = function() {
  console.log('WebSocket disconnected');
};
```

## 8. 変更履歴

### Version 1.0.0
- 初期リリース
- 基本的なREST API実装
- WebSocketリアルタイム通信
- 3つのコアスクリプト対応