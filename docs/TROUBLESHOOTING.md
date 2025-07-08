# HyperEVM Tools トラブルシューティングガイド

## 🚨 よくあるエラーと解決方法

### 1. "missing revert data" エラー

**症状**:
```
Error: missing revert data (action="estimateGas", data=null, reason=null, transaction={...})
```

**原因**: 
- V2ルーターのテストネット制限
- 不適切なルーター選択

**解決方法**:
```javascript
// ❌ 悪い例: V2ルーターを使用
const result = await swapV2(tokenIn, tokenOut, amount);

// ✅ 良い例: V3ルーターを使用
const result = await swapV3(tokenIn, tokenOut, amount, fee);
```

---

### 2. "SPL" (Slippage Protection Limit) エラー

**症状**:
```
Error: execution reverted: SPL
```

**原因**:
- スリッページが大きすぎる
- 不適切なfee tier設定（V3）

**解決方法**:
```javascript
// 正しいfee tierを使用
// WETH/PURR: 500 (0.05%)
// PURR/HFUN: 10000 (1%)

const result = await swapV3(PURR, HFUN, amount, 10000); // 1%のfee
```

---

### 3. ガス制限超過エラー

**症状**:
```
Error: transaction may fail or may require manual gas limit
```

**原因**:
- HyperEVMの2M gas制限を超過
- Big Blockキューに入る

**解決方法**:
```javascript
// ガス制限を2M未満に設定
const tx = await contract.method({
  gasLimit: 1900000 // 安全マージン付き
});
```

---

### 4. "insufficient funds" エラー

**症状**:
```
Error: insufficient funds for intrinsic transaction cost
```

**原因**:
- ETH残高不足
- ガス代を考慮していない

**解決方法**:
```bash
# 残高確認
node scripts/balance_check.js

# 必要に応じてテストネットfaucetから取得
```

---

### 5. "INVALID_ARGUMENT" エラー

**症状**:
```
Error: invalid argument "address" - invalid address
```

**原因**:
- アドレスフォーマットが不正
- 環境変数が設定されていない

**解決方法**:
```javascript
// アドレスの検証
if (!ethers.isAddress(address)) {
  throw new Error(`Invalid address: ${address}`);
}

// 環境変数の確認
if (!process.env.PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY not set in .env');
}
```

---

### 6. "CALL_EXCEPTION" エラー

**症状**:
```
Error: call exception (method="balanceOf", errorArgs=null, errorName=null)
```

**原因**:
- 間違ったABI
- 存在しないコントラクトアドレス

**解決方法**:
```javascript
// ABIとアドレスの確認
const correctABI = require('./abi/ERC20.json');
const verifiedAddress = '0x...'; // etherscanで確認

const contract = new ethers.Contract(verifiedAddress, correctABI, provider);
```

---

### 7. ネットワーク接続エラー

**症状**:
```
Error: could not detect network
Error: timeout
```

**原因**:
- RPC URLが間違っている
- ネットワーク接続の問題

**解決方法**:
```javascript
// 正しいRPC URL
const TESTNET_RPC = 'https://rpc.hyperliquid-testnet.xyz/evm';
const MAINNET_RPC = 'https://rpc.hyperliquid.xyz/evm';

// タイムアウト設定
const provider = new ethers.JsonRpcProvider(RPC_URL, {
  timeout: 30000 // 30秒
});
```

---

### 8. Approve関連のエラー

**症状**:
```
Error: execution reverted: ERC20: insufficient allowance
```

**原因**:
- トークンのapproveが不足
- approve後すぐにスワップを実行

**解決方法**:
```javascript
// 十分なapprove
await token.approve(router, ethers.MaxUint256);

// approve確認後にスワップ
const allowance = await token.allowance(wallet.address, router);
if (allowance < amount) {
  await token.approve(router, amount);
}
```

---

### 9. Nonce関連のエラー

**症状**:
```
Error: nonce has already been used
```

**原因**:
- 同じnonceで複数のトランザクション
- 前のトランザクションがpending

**解決方法**:
```javascript
// 最新のnonceを取得
const nonce = await wallet.getNonce('latest');

// または前のトランザクションを待つ
await previousTx.wait();
```

---

### 10. TypeScriptコンパイルエラー

**症状**:
```
TSError: ⨯ Unable to compile TypeScript
```

**原因**:
- 型定義の不一致
- 依存関係の問題

**解決方法**:
```bash
# 依存関係の再インストール
rm -rf node_modules package-lock.json
npm install

# TypeScript設定の確認
npx tsc --noEmit
```

---

### 11. KittenSwap特有のエラー

**症状**:
```
Error: execution reverted: getPair function not found
```

**原因**:
- KittenSwapのFactoryは標準的なUniswap V2実装ではない
- getPair()関数が存在しない（163バイトの極小実装）

**解決方法**:
```javascript
// ❌ 悪い例: 標準的なgetPair()使用
const pairAddress = await factory.getPair(tokenA, tokenB);

// ✅ 良い例: allPairs()で全ペアを列挙
const pairCount = await factory.allPairsLength();
for (let i = 0; i < pairCount; i++) {
  const pairAddress = await factory.allPairs(i);
  // ペアの詳細を確認
}
```

**対応方法**:
```javascript
// KittenSwap用の最適化されたABI使用
const KITTENSWAP_FACTORY_ABI = [
  "function allPairs(uint256) external view returns (address)",
  "function allPairsLength() external view returns (uint256)",
  "function owner() external view returns (address)"
];

const factory = new ethers.Contract(
  '0xDa12F450580A4cc485C3b501BAB7b0B3cbc3B31B',
  KITTENSWAP_FACTORY_ABI,
  provider
);
```

---

### 12. KittenSwap QuoterV2エラー

**症状**:
```
Error: contract call failed - no V3 pools found
```

**原因**:
- KittenSwapはV2プールのみ運用（V3プールは存在しない）
- QuoterV2はメインネットのみ利用可能

**解決方法**:
```javascript
// ❌ 悪い例: V3機能を期待
const quote = await quoterV2.quoteExactInputSingle({...});

// ✅ 良い例: V2プールを直接使用
const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
const reserves = await pair.getReserves();
// 手動でレート計算
```

**対応プール**:
```javascript
// KittenSwapで利用可能なV2プール（70個）
const KITTENSWAP_TOKENS = {
  WHYPE: '0x5555555555555555555555555555555555555555',
  PURR: '0x9b498C3c8A0b8CD8BA1D9851d40D186F1872b44E',
  USDXL: '0xca79db4B49f608eF54a5CB813FbEd3a6387bC645',
  // 他13トークン
};
```

---

## 🔍 デバッグテクニック

### 1. 詳細なエラーログ
```javascript
try {
  // 処理
} catch (error) {
  console.error('Error details:', {
    message: error.message,
    code: error.code,
    transaction: error.transaction,
    receipt: error.receipt,
    reason: error.reason
  });
}
```

### 2. callStaticでの事前テスト
```javascript
// 実際の実行前にシミュレーション
try {
  const result = await contract.myMethod.staticCall(args);
  console.log('Simulation success:', result);
} catch (error) {
  console.error('Will fail with:', error.message);
}
```

### 3. ガス見積もりの確認
```javascript
const estimatedGas = await contract.myMethod.estimateGas(args);
console.log('Estimated gas:', estimatedGas.toString());

if (estimatedGas > 2000000n) {
  console.warn('Warning: Will go to Big Block queue!');
}
```

### 4. ブロック内トランザクション分析
```javascript
const block = await provider.getBlock('latest', true);
console.log('Block transactions:', block.transactions.length);
console.log('Gas used:', block.gasUsed.toString());
```

---

## 📞 サポートが必要な場合

### 1. 情報収集
- エラーメッセージの完全なコピー
- 使用したコマンドまたはコード
- 環境情報（OS、Node.jsバージョン）
- `.env`設定（秘密鍵は除く）

### 2. 問い合わせ先
- GitHub Issues: https://github.com/taku247/hevm-tool/issues
- Discord: HyperLiquid公式Discord

### 3. よくある質問の確認
- このトラブルシューティングガイド
- [開発者ガイド](./DEVELOPER_GUIDE.md)
- [APIリファレンス](./API_REFERENCE.md)

---

**最終更新**: 2025年1月8日