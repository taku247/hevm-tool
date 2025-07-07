# HyperEVM Contract Deployment Testing

This directory contains comprehensive test scripts to verify contract deployment capabilities on the HyperEVM testnet.

## Overview

HyperEVM has specific characteristics that affect contract deployment:

### Network Characteristics
- **Small Block**: 1 second interval, 2M gas limit
- **Big Block**: 1 minute interval, 30M gas limit
- **Critical**: Transactions exceeding 2M gas go to Big Block queue and will likely fail due to competition

### Gas Optimization Strategy
- Keep gas limit **under 2M** for Small Block processing
- Use dynamic gas pricing based on network congestion
- Optimize for fast confirmation times (15-30 seconds)

## Test Scripts

### 1. Simple Storage Contract (`simple-storage-contract.ts`)

**Purpose**: Test basic contract deployment functionality

**Features**:
- Minimal storage contract (stores/retrieves uint256)
- ~500 bytes bytecode
- Constructor with initial value parameter
- Gas optimized for Small Block

**Usage**:
```bash
# Deploy with default initial value (42)
ts-node custom/deploy/simple-storage-contract.ts

# Deploy with custom initial value
ts-node custom/deploy/simple-storage-contract.ts 123
```

**What it tests**:
- Basic contract deployment
- Constructor parameters
- Contract function calls (read/write)
- Gas estimation accuracy
- HyperEVM compatibility

### 2. ERC20 Token Test (`erc20-token-test.ts`)

**Purpose**: Test more complex contract deployment

**Features**:
- Full ERC20 token implementation
- ~2KB bytecode
- Multiple constructor parameters
- Standard token functions
- Gas cost analysis

**Usage**:
```bash
# Deploy with default parameters
ts-node custom/deploy/erc20-token-test.ts

# Deploy with custom parameters
ts-node custom/deploy/erc20-token-test.ts "My Token" "MTK" 18 "1000000000000000000000000"
```

**What it tests**:
- Complex contract deployment
- Multiple constructor arguments
- ERC20 standard compliance
- Token functionality verification
- Gas optimization for larger contracts

## Environment Setup

### Required Environment Variables

Create a `.env` file in the project root:

```env
# HyperEVM RPC URL (default: https://rpc.hyperliquid.xyz/evm)
HYPEREVM_RPC_URL=https://rpc.hyperliquid.xyz/evm

# Private key for deployment (required)
PRIVATE_KEY=your_private_key_here
```

### Prerequisites

1. **Node.js and TypeScript**: Ensure you have Node.js 16+ and TypeScript installed
2. **Dependencies**: Run `npm install` to install all dependencies
3. **Testnet ETH**: Ensure your wallet has sufficient testnet ETH for gas fees
4. **Network Access**: Verify you can connect to the HyperEVM testnet

## Gas Settings for HyperEVM

### Recommended Gas Limits

| Contract Type | Gas Limit | Block Target | Confirmation Time |
|---------------|-----------|--------------|-------------------|
| Simple Storage | 200,000 | Small Block | 15-30 seconds |
| ERC20 Token | 1,900,000 | Small Block | 15-30 seconds |
| Complex DeFi | 1,800,000 | Small Block | 15-30 seconds |

### Gas Strategies

The scripts use dynamic gas pricing with these strategies:

- **safe**: Lower cost, 1-2 minute confirmation
- **standard**: Balanced cost/speed, 30-60 seconds
- **fast**: Higher cost, 15-30 seconds
- **instant**: Highest cost, 5-15 seconds

## Testing Procedure

### 1. Pre-deployment Checks

```bash
# Check network connectivity
ts-node templates/gas-analyzer.ts --monitor

# Verify account balance
ts-node scripts/balance_check.ts
```

### 2. Run Simple Storage Test

```bash
# Basic deployment test
ts-node custom/deploy/simple-storage-contract.ts

# Expected output:
# ✅ Contract deployment: SUCCESS
# ✅ Gas optimization: Small Block (< 2M gas)
# ✅ Contract interaction: SUCCESS
# ✅ HyperEVM compatibility: VERIFIED
```

### 3. Run ERC20 Token Test

```bash
# ERC20 deployment test
ts-node custom/deploy/erc20-token-test.ts

# Expected output:
# ✅ Contract Address: 0x...
# ✅ Token Name: HyperEVM Test Token
# ✅ Token Symbol: HEVMTEST
# ✅ Decimals: 18
# ✅ Total Supply: 1000000 tokens
# ✅ HyperEVM Compatibility: VERIFIED
```

### 4. Advanced Testing

```bash
# Test with custom gas settings
ts-node templates/contract-deploy.ts \
  --abi=./examples/sample-abi/ERC20.json \
  --bytecode=./path/to/bytecode.bin \
  --args="Custom Token,CTK,18,1000000000000000000000000" \
  --gas-limit=1900000
```

## Troubleshooting

### Common Issues

1. **Gas Limit Too High**
   - Error: Transaction sent to Big Block queue
   - Solution: Reduce gas limit to under 2M

2. **Insufficient Gas**
   - Error: Out of gas
   - Solution: Increase gas limit (but stay under 2M)

3. **Network Congestion**
   - Error: Transaction timeout
   - Solution: Use higher gas strategy (fast/instant)

4. **RPC Connection Issues**
   - Error: Connection timeout
   - Solution: Verify RPC URL and network connectivity

### Gas Optimization Tips

1. **Use Small Block Strategy**
   - Keep gas limit under 2M
   - Use instant/fast gas pricing during high congestion

2. **Monitor Network Status**
   - Check network congestion before deployment
   - Adjust gas strategy based on current conditions

3. **Optimize Contract Size**
   - Minimize constructor parameters
   - Use efficient Solidity patterns
   - Consider proxy patterns for large contracts

## Expected Results

### Successful Deployment

When deployment succeeds, you should see:

1. **Contract Address**: Valid deployed contract address
2. **Transaction Hash**: Successful transaction hash
3. **Block Number**: Confirmation block number
4. **Gas Used**: Actual gas consumption
5. **Function Tests**: All contract functions working correctly

### Gas Usage Analysis

| Test | Expected Gas | Actual Gas | Efficiency |
|------|-------------|------------|------------|
| Simple Storage | ~150,000 | Check output | 95%+ |
| ERC20 Token | ~1,500,000 | Check output | 90%+ |

## Next Steps

After successful deployment testing:

1. **Production Deployment**: Use the same patterns for mainnet deployment
2. **Integration Testing**: Test with other HyperEVM contracts
3. **Performance Optimization**: Fine-tune gas settings based on results
4. **Monitoring Setup**: Implement contract monitoring for production

## Contract Verification

The deployment scripts include automatic verification steps:

1. **Bytecode Verification**: Confirms contract is deployed correctly
2. **Function Testing**: Verifies all contract functions work
3. **Gas Efficiency**: Confirms gas usage is optimized
4. **Network Compatibility**: Validates HyperEVM-specific features

## Resources

- [HyperEVM Documentation](https://docs.hyperliquid.xyz/)
- [Gas Optimization Guide](../../templates/README.md)
- [Contract Utils Reference](../../templates/contract-utils.ts)
- [Gas Price Calculator](../../src/gas-price-utils.ts)

---

**Note**: Always test on testnet before mainnet deployment. The HyperEVM testnet provides an accurate testing environment for gas optimization and contract functionality.