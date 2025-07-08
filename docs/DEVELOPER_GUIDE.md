# HyperEVM Tools 開発者ガイド

## 🚀 新規開発の手順

### 1. 開発前の準備

#### 環境セットアップ
```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集して必要な値を設定
```

#### 必要な環境変数
```env
# HyperEVM RPC
HYPERLIQUID_TESTNET_RPC=https://rpc.hyperliquid-testnet.xyz/evm
HYPERLIQUID_MAINNET_RPC=https://rpc.hyperliquid.xyz/evm

# ウォレット秘密鍵
TESTNET_PRIVATE_KEY=your_testnet_private_key
MAINNET_PRIVATE_KEY=your_mainnet_private_key
```

### 2. 開発パターン

#### パターン1: テンプレートベースの開発（推奨）

```typescript
// 新しいスクリプトを templates/ 配下に作成
import { UniversalContractUtils } from './contract-utils';
import { GasStrategy, calculateDynamicGasPrice } from '../src/gas-price-utils';

async function myCustomFunction() {
  const utils = new UniversalContractUtils(
    process.env.HYPERLIQUID_TESTNET_RPC!,
    process.env.TESTNET_PRIVATE_KEY!
  );

  // ガス価格の動的計算
  const gasPrice = await calculateDynamicGasPrice(
    utils.provider,
    GasStrategy.FAST
  );

  // コントラクト操作
  const result = await utils.callContractWrite(
    contractAddress,
    abi,
    'myFunction',
    [arg1, arg2],
    { gasPrice }
  );
}
```

#### パターン2: カスタムスクリプト開発

```javascript
// custom/my-feature/my-script.js
const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.HYPERLIQUID_TESTNET_RPC);
  const wallet = new ethers.Wallet(process.env.TESTNET_PRIVATE_KEY, provider);

  // カスタムロジックを実装
}

if (require.main === module) {
  main().catch(console.error);
}
```

#### パターン3: DEX統合開発

```typescript
// src/dex/protocols/MyDexProtocol.ts
import { DexProtocol } from '../DexProtocol';
import { SwapParams, SwapResult } from '../../types';

export class MyDexProtocol extends DexProtocol {
  async getQuote(params: SwapParams): Promise<BigInt> {
    // 見積もりロジック
  }

  async executeSwap(params: SwapParams): Promise<SwapResult> {
    // スワップ実行ロジック
  }
}
```

### 3. コーディング規約

#### TypeScript
```typescript
// インターフェース名は I プレフィックス
interface ITokenInfo {
  address: string;
  symbol: string;
  decimals: number;
}

// 型定義は Type サフィックス
type GasStrategyType = 'safe' | 'standard' | 'fast' | 'instant';

// クラスはPascalCase
class ContractManager {
  // プライベートメンバーは _ プレフィックス
  private _provider: ethers.Provider;

  // 公開メソッドは動詞で開始
  async deployContract(): Promise<string> {
    // 実装
  }
}
```

#### JavaScript
```javascript
// モジュールレベルの定数は大文字
const DEFAULT_GAS_LIMIT = 2000000;

// 関数は動詞で開始
async function executeSwap(params) {
  // パラメータ検証
  if (!params.tokenIn || !params.tokenOut) {
    throw new Error('Invalid parameters');
  }

  // 実装
}

// エラーハンドリング
try {
  const result = await riskyOperation();
} catch (error) {
  console.error('Operation failed:', error.message);
  // 適切なエラー処理
}
```

### 4. テスト開発

#### ユニットテスト
```typescript
// tests/unit/my-feature.test.ts
import { expect } from 'chai';
import { MyFeature } from '../../src/my-feature';

describe('MyFeature', () => {
  let feature: MyFeature;

  beforeEach(() => {
    feature = new MyFeature();
  });

  it('should perform expected operation', async () => {
    const result = await feature.doSomething();
    expect(result).to.equal(expectedValue);
  });
});
```

#### 統合テスト
```typescript
// tests/integration/dex-integration.test.ts
describe('DEX Integration', () => {
  it('should execute swap on testnet', async () => {
    // 実際のテストネットでスワップを実行
    const result = await dexManager.executeSwap({
      tokenIn: 'WETH',
      tokenOut: 'PURR',
      amountIn: ethers.parseEther('0.001')
    });

    expect(result.success).to.be.true;
  });
});
```

### 5. HyperEVM特有の考慮事項

#### ガス制限
```typescript
// 常に2M gas未満に設定
const GAS_LIMIT = {
  SAFE: 1_900_000,      // 安全マージン付き
  STANDARD: 1_950_000,  // 標準
  MAX: 1_990_000        // 最大（リスクあり）
};

// Big Blockを避けるためのチェック
if (estimatedGas > 2_000_000) {
  throw new Error('Transaction will go to Big Block queue');
}
```

#### ブロック時間
```typescript
// Small Block: 1秒
// Big Block: 60秒

// 高頻度操作の場合
const BLOCK_TIME = 1000; // 1秒

// タイムアウト設定
const timeout = setTimeout(() => {
  throw new Error('Transaction timeout');
}, 30000); // 30秒
```

### 6. 設定管理

#### JSON設定ファイル
```json
// config/my-feature.json
{
  "networks": {
    "testnet": {
      "contracts": {
        "router": "0x...",
        "factory": "0x..."
      }
    }
  },
  "tokens": {
    "WETH": {
      "address": "0x...",
      "decimals": 18
    }
  }
}
```

#### 設定ローダー使用
```typescript
import { ConfigLoader } from '../src/config/ConfigLoader';

const config = new ConfigLoader<MyConfig>('config/my-feature.json');
const routerAddress = config.get('networks.testnet.contracts.router');
```

### 7. ログとデバッグ

#### 構造化ログ
```typescript
function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

// 使用例
log('Transaction sent', 'INFO');
log('High gas price detected', 'WARN');
log('Transaction failed', 'ERROR');
```

#### デバッグ情報
```typescript
if (process.env.DEBUG) {
  console.log('Debug info:', {
    gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
    gasLimit: gasLimit.toString(),
    nonce: nonce
  });
}
```

### 8. セキュリティベストプラクティス

#### 秘密鍵管理
```typescript
// ❌ 悪い例
const privateKey = "0x1234...";

// ✅ 良い例
const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error('PRIVATE_KEY not set');
}
```

#### 入力検証
```typescript
function validateAddress(address: string): void {
  if (!ethers.isAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
}

function validateAmount(amount: string): void {
  try {
    const value = ethers.parseEther(amount);
    if (value <= 0n) {
      throw new Error('Amount must be positive');
    }
  } catch {
    throw new Error(`Invalid amount: ${amount}`);
  }
}
```

### 9. デプロイメントチェックリスト

- [ ] 環境変数が正しく設定されている
- [ ] テストネットで動作確認済み
- [ ] ガス制限が2M未満
- [ ] エラーハンドリングが適切
- [ ] ログ出力が十分
- [ ] セキュリティチェック完了
- [ ] ドキュメント更新済み
- [ ] .gitignoreに機密ファイル追加済み

### 10. DEX特有の実装パターン

#### KittenSwap対応
```typescript
// KittenSwapは標準的なUniswap V2実装ではない
// getPair()関数が存在しないため、allPairs()で列挙する必要がある

const KITTENSWAP_FACTORY = '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B';
const KITTENSWAP_FACTORY_ABI = [
  "function allPairs(uint256) external view returns (address)",
  "function allPairsLength() external view returns (uint256)",
  "function owner() external view returns (address)"
];

// ❌ 悪い例: 標準的なgetPair()使用
const pairAddress = await factory.getPair(tokenA, tokenB);

// ✅ 良い例: allPairs()で全ペアを列挙
async function findKittenSwapPair(tokenA: string, tokenB: string): Promise<string | null> {
  const factory = new ethers.Contract(KITTENSWAP_FACTORY, KITTENSWAP_FACTORY_ABI, provider);
  const pairCount = await factory.allPairsLength();
  
  for (let i = 0; i < pairCount; i++) {
    const pairAddress = await factory.allPairs(i);
    const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
    
    const [token0, token1] = await Promise.all([
      pair.token0(),
      pair.token1()
    ]);
    
    if ((token0 === tokenA && token1 === tokenB) || 
        (token0 === tokenB && token1 === tokenA)) {
      return pairAddress;
    }
  }
  
  return null;
}
```

#### HyperSwap vs KittenSwap
```typescript
// DEXの種類に応じた処理分岐
async function getPoolAddress(dexType: 'hyperswap' | 'kittenswap', tokenA: string, tokenB: string): Promise<string | null> {
  switch (dexType) {
    case 'hyperswap':
      // 標準的なUniswap V2実装
      const hyperFactory = new ethers.Contract(HYPERSWAP_FACTORY, UNISWAP_V2_FACTORY_ABI, provider);
      return await hyperFactory.getPair(tokenA, tokenB);
      
    case 'kittenswap':
      // カスタム実装、列挙が必要
      return await findKittenSwapPair(tokenA, tokenB);
      
    default:
      throw new Error(`Unsupported DEX: ${dexType}`);
  }
}
```

#### V2/V3プール検出
```typescript
// DEXごとのV2/V3対応状況
const DEX_SUPPORT = {
  hyperswap: {
    v2: true,
    v3: true,
    quoterV2: true
  },
  kittenswap: {
    v2: true,
    v3: false,  // V3プールは存在しない
    quoterV2: false  // V3プールがないため実用不可
  }
};

async function getQuote(dex: string, tokenA: string, tokenB: string, amount: bigint): Promise<bigint> {
  const support = DEX_SUPPORT[dex];
  
  if (support.quoterV2) {
    // QuoterV2を使用
    const quoter = new ethers.Contract(QUOTER_V2_ADDRESS, QUOTER_V2_ABI, provider);
    return await quoter.quoteExactInputSingle({
      tokenIn: tokenA,
      tokenOut: tokenB,
      amountIn: amount,
      fee: 500,
      sqrtPriceLimitX96: 0
    });
  } else if (support.v2) {
    // V2プールから手動計算
    const pairAddress = await getPoolAddress(dex, tokenA, tokenB);
    if (!pairAddress) throw new Error('Pair not found');
    
    const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
    const reserves = await pair.getReserves();
    
    // 手動でレート計算
    return calculateV2Quote(reserves, amount);
  } else {
    throw new Error(`No quote method available for ${dex}`);
  }
}
```

### 11. よくある実装パターン

#### リトライ機構
```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

#### トランザクション監視
```typescript
async function waitForTransaction(
  provider: ethers.Provider,
  txHash: string,
  confirmations: number = 1
): Promise<ethers.TransactionReceipt> {
  console.log(`Waiting for ${confirmations} confirmations...`);
  const receipt = await provider.waitForTransaction(txHash, confirmations);
  
  if (receipt.status === 0) {
    throw new Error('Transaction failed');
  }
  
  return receipt;
}
```

---

**最終更新**: 2025年1月8日  
**次**: [API リファレンス](./API_REFERENCE.md)