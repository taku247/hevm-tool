# HyperEVM Tools API リファレンス

## 📚 コアクラス・関数リファレンス

### UniversalContractUtils

**場所**: `templates/contract-utils.ts`

#### コンストラクタ
```typescript
constructor(rpcUrl: string, privateKey?: string)
```

#### メソッド

##### callContractRead
```typescript
async callContractRead(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[] = [],
  options?: {
    blockTag?: string | number;
  }
): Promise<any>
```

**説明**: コントラクトのREAD関数を呼び出す  
**パラメータ**:
- `contractAddress`: コントラクトアドレス
- `abi`: コントラクトABI
- `functionName`: 関数名
- `args`: 関数引数の配列
- `options.blockTag`: 特定のブロックでの実行

**戻り値**: 関数の戻り値

##### callContractWrite
```typescript
async callContractWrite(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[] = [],
  options?: {
    value?: bigint;
    gasLimit?: number;
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    nonce?: number;
  }
): Promise<ethers.TransactionReceipt>
```

**説明**: コントラクトのWRITE関数を実行  
**パラメータ**:
- `contractAddress`: コントラクトアドレス
- `abi`: コントラクトABI
- `functionName`: 関数名
- `args`: 関数引数の配列
- `options`: トランザクションオプション

**戻り値**: トランザクションレシート

##### deployContract
```typescript
async deployContract(
  abi: any[],
  bytecode: string,
  constructorArgs: any[] = [],
  options?: {
    gasLimit?: number;
    gasPrice?: bigint;
  }
): Promise<{
  address: string;
  receipt: ethers.TransactionReceipt;
  contract: ethers.Contract;
}>
```

**説明**: 新しいコントラクトをデプロイ  
**戻り値**: デプロイ結果オブジェクト

##### analyzeCurrentGasPrices
```typescript
async analyzeCurrentGasPrices(): Promise<{
  baseFee: bigint;
  priorityFees: {
    safe: bigint;
    standard: bigint;
    fast: bigint;
    instant: bigint;
  };
  totalPrices: {
    safe: bigint;
    standard: bigint;
    fast: bigint;
    instant: bigint;
  };
  networkCongestion: 'low' | 'medium' | 'high';
}>
```

**説明**: 現在のガス価格を分析  
**戻り値**: ガス価格分析結果

---

### DexManager

**場所**: `src/dex/DexManager.ts`

#### コンストラクタ
```typescript
constructor(
  provider: ethers.Provider,
  signer?: ethers.Signer,
  config?: DexConfig
)
```

#### メソッド

##### registerProtocol
```typescript
registerProtocol(name: string, protocol: DexProtocol): void
```

**説明**: 新しいDEXプロトコルを登録

##### getQuote
```typescript
async getQuote(
  dexName: string,
  params: SwapParams
): Promise<bigint>
```

**説明**: 指定DEXでの見積もりを取得  
**パラメータ**:
- `dexName`: DEX名（'hyperswap-v2', 'hyperswap-v3', 'kittenswap-v2'）
- `params`: スワップパラメータ

**戻り値**: 予想出力量

##### executeSwap
```typescript
async executeSwap(
  dexName: string,
  params: SwapParams
): Promise<SwapResult>
```

**説明**: スワップを実行  
**戻り値**: スワップ結果

##### findBestRate
```typescript
async findBestRate(
  params: SwapParams
): Promise<{
  dex: string;
  rate: bigint;
  path?: string[];
}>
```

**説明**: 全DEXから最適レートを検索

---

### ガス価格ユーティリティ

**場所**: `src/gas-price-utils.ts`

#### calculateDynamicGasPrice
```typescript
async function calculateDynamicGasPrice(
  provider: ethers.Provider,
  strategy: GasStrategy = GasStrategy.STANDARD
): Promise<bigint>
```

**説明**: 動的ガス価格を計算  
**パラメータ**:
- `provider`: Ethereumプロバイダー
- `strategy`: ガス戦略（SAFE, STANDARD, FAST, INSTANT）

**戻り値**: 推奨ガス価格（Wei単位）

#### analyzeNetworkCongestion
```typescript
async function analyzeNetworkCongestion(
  provider: ethers.Provider
): Promise<'low' | 'medium' | 'high'>
```

**説明**: ネットワーク混雑度を分析

---

### ConfigLoader

**場所**: `src/config/ConfigLoader.ts`

#### コンストラクタ
```typescript
constructor(configPath: string)
```

#### メソッド

##### get
```typescript
get<T = any>(path?: string): T
```

**説明**: 設定値を取得  
**パラメータ**:
- `path`: ドット記法のパス（例: 'networks.testnet.contracts.router'）

**戻り値**: 設定値

##### set
```typescript
set(path: string, value: any): void
```

**説明**: 設定値を更新

##### reload
```typescript
reload(): void
```

**説明**: 設定ファイルを再読み込み

---

## 🔧 型定義

### SwapParams
```typescript
interface SwapParams {
  tokenIn: string;      // 入力トークンアドレス
  tokenOut: string;     // 出力トークンアドレス
  amountIn: bigint;     // 入力量
  recipient?: string;   // 受取アドレス（省略時は送信者）
  slippageBps?: number; // スリッページ（ベーシスポイント）
  deadline?: number;    // デッドライン（秒）
  fee?: number;         // V3手数料ティア（500, 3000, 10000）
}
```

### SwapResult
```typescript
interface SwapResult {
  success: boolean;           // 成功フラグ
  transactionHash?: string;   // トランザクションハッシュ
  amountOut?: bigint;         // 実際の出力量
  error?: string;             // エラーメッセージ
  gasUsed?: bigint;           // 使用ガス量
}
```

### GasStrategy
```typescript
enum GasStrategy {
  SAFE = 'safe',        // 低価格、遅い確認
  STANDARD = 'standard', // 標準
  FAST = 'fast',        // 高速
  INSTANT = 'instant'   // 即時
}
```

### DexConfig
```typescript
interface DexConfig {
  protocols: {
    [key: string]: {
      router: string;
      factory: string;
      initCodeHash?: string;
    };
  };
  tokens: {
    [symbol: string]: {
      address: string;
      decimals: number;
    };
  };
}
```

---

## 📝 使用例

### 基本的なトークンスワップ
```typescript
import { UniversalContractUtils } from './templates/contract-utils';
import { DexManager } from './src/dex/DexManager';

async function swapTokens() {
  const utils = new UniversalContractUtils(rpcUrl, privateKey);
  const dexManager = new DexManager(utils.provider, utils.signer);

  // 見積もり取得
  const quote = await dexManager.getQuote('hyperswap-v3', {
    tokenIn: WETH_ADDRESS,
    tokenOut: PURR_ADDRESS,
    amountIn: ethers.parseEther('0.1'),
    fee: 500
  });

  console.log(`Expected output: ${ethers.formatEther(quote)} PURR`);

  // スワップ実行
  const result = await dexManager.executeSwap('hyperswap-v3', {
    tokenIn: WETH_ADDRESS,
    tokenOut: PURR_ADDRESS,
    amountIn: ethers.parseEther('0.1'),
    fee: 500,
    slippageBps: 50 // 0.5%
  });

  if (result.success) {
    console.log(`Swap successful! TX: ${result.transactionHash}`);
  }
}
```

### ガス最適化付きコントラクト呼び出し
```typescript
async function optimizedContractCall() {
  const utils = new UniversalContractUtils(rpcUrl, privateKey);
  
  // ガス価格分析
  const gasAnalysis = await utils.analyzeCurrentGasPrices();
  
  // ネットワーク状態に応じた戦略選択
  const gasPrice = gasAnalysis.networkCongestion === 'high' 
    ? gasAnalysis.totalPrices.instant 
    : gasAnalysis.totalPrices.fast;

  // 実行
  const receipt = await utils.callContractWrite(
    contractAddress,
    abi,
    'myFunction',
    [arg1, arg2],
    { gasPrice, gasLimit: 1900000 }
  );
}
```

### バッチトランザクション
```typescript
async function executeBatchOperations() {
  const utils = new UniversalContractUtils(rpcUrl, privateKey);
  
  const operations = [
    {
      contract: TOKEN_ADDRESS,
      method: 'approve',
      args: [ROUTER_ADDRESS, ethers.MaxUint256]
    },
    {
      contract: ROUTER_ADDRESS,
      method: 'swapExactTokensForTokens',
      args: [amountIn, minAmountOut, path, recipient, deadline]
    }
  ];

  const results = await utils.executeBatch(operations);
  console.log(`Batch execution complete: ${results.length} operations`);
}
```

---

## 🚨 エラーハンドリング

### カスタムエラータイプ
```typescript
class GasLimitExceededError extends Error {
  constructor(public estimatedGas: bigint, public maxGas: bigint) {
    super(`Gas limit exceeded: ${estimatedGas} > ${maxGas}`);
  }
}

class InsufficientLiquidityError extends Error {
  constructor(public tokenIn: string, public tokenOut: string) {
    super(`Insufficient liquidity for ${tokenIn} -> ${tokenOut}`);
  }
}
```

### エラーハンドリングパターン
```typescript
try {
  const result = await dexManager.executeSwap(dexName, params);
} catch (error) {
  if (error.code === 'CALL_EXCEPTION') {
    // コントラクトrevert
    console.error('Contract reverted:', error.reason);
  } else if (error.code === 'INSUFFICIENT_FUNDS') {
    // 残高不足
    console.error('Insufficient balance');
  } else if (error.message.includes('SPL')) {
    // スリッページエラー
    console.error('Slippage too high');
  } else {
    // その他のエラー
    console.error('Unknown error:', error);
  }
}
```

---

**最終更新**: 2025年1月8日  
**バージョン**: 2.0.0