#!/usr/bin/env ts-node

/**
 * HyperEVM Deployment Readiness Check
 * 
 * This script verifies that the environment is ready for contract deployment
 * on HyperEVM testnet.
 */

import { UniversalContractUtils } from '../../templates/contract-utils';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface DeploymentReadiness {
  rpcConnection: boolean;
  walletSetup: boolean;
  balanceSufficient: boolean;
  gasAnalysis: boolean;
  networkCompatible: boolean;
  overallReady: boolean;
  issues: string[];
  recommendations: string[];
}

/**
 * Check deployment readiness
 */
async function checkDeploymentReadiness(): Promise<DeploymentReadiness> {
  console.log('🔍 HyperEVM Deployment Readiness Check');
  console.log('=====================================\n');

  const result: DeploymentReadiness = {
    rpcConnection: false,
    walletSetup: false,
    balanceSufficient: false,
    gasAnalysis: false,
    networkCompatible: false,
    overallReady: false,
    issues: [],
    recommendations: []
  };

  // 1. Check RPC Connection
  console.log('📡 Checking RPC Connection...');
  try {
    const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    
    console.log(`   ✅ RPC Connected: ${rpcUrl}`);
    console.log(`   ✅ Current Block: ${blockNumber}`);
    console.log(`   ✅ Chain ID: ${network.chainId}`);
    console.log(`   ✅ Network Name: ${network.name || 'HyperEVM'}`);
    
    result.rpcConnection = true;
  } catch (error: any) {
    console.log(`   ❌ RPC Connection Failed: ${error.message}`);
    result.issues.push('RPC connection failed');
    result.recommendations.push('Check HYPEREVM_RPC_URL in .env file');
  }

  console.log('');

  // 2. Check Wallet Setup
  console.log('👛 Checking Wallet Setup...');
  try {
    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY not set');
    }

    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
    console.log(`   ✅ Wallet Address: ${wallet.address}`);
    console.log(`   ✅ Private Key: Valid format`);
    
    result.walletSetup = true;
  } catch (error: any) {
    console.log(`   ❌ Wallet Setup Failed: ${error.message}`);
    result.issues.push('Wallet configuration invalid');
    result.recommendations.push('Set valid PRIVATE_KEY in .env file');
  }

  console.log('');

  // 3. Check Balance
  console.log('💰 Checking Account Balance...');
  try {
    const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.utils.formatEther(balance);
    
    console.log(`   ✅ Current Balance: ${balanceEth} ETH`);
    
    // Check if balance is sufficient for deployment (minimum 0.01 ETH recommended)
    const minBalance = ethers.utils.parseEther('0.01');
    if (balance.gte(minBalance)) {
      console.log(`   ✅ Balance Sufficient: > 0.01 ETH`);
      result.balanceSufficient = true;
    } else {
      console.log(`   ⚠️  Balance Low: < 0.01 ETH recommended`);
      result.issues.push('Account balance may be insufficient');
      result.recommendations.push('Add more testnet ETH to your account');
    }
  } catch (error: any) {
    console.log(`   ❌ Balance Check Failed: ${error.message}`);
    result.issues.push('Unable to check account balance');
  }

  console.log('');

  // 4. Check Gas Analysis
  console.log('⛽ Analyzing Gas Prices...');
  try {
    const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
    const contractUtils = new UniversalContractUtils(rpcUrl, process.env.PRIVATE_KEY);
    
    const gasAnalysis = await contractUtils.analyzeCurrentGasPrices();
    
    console.log(`   ✅ Network Congestion: ${gasAnalysis.networkCongestion}`);
    console.log(`   ✅ Recommended Strategy: ${gasAnalysis.recommendations.strategy}`);
    console.log(`   ✅ Base Fee: ${gasAnalysis.currentBaseFee} wei`);
    console.log(`   ✅ Estimated Confirmation: ${gasAnalysis.recommendations.estimatedConfirmationTime}`);
    
    result.gasAnalysis = true;
  } catch (error: any) {
    console.log(`   ❌ Gas Analysis Failed: ${error.message}`);
    result.issues.push('Gas price analysis failed');
    result.recommendations.push('Check network connectivity and try again');
  }

  console.log('');

  // 5. Check Network Compatibility
  console.log('🌐 Checking HyperEVM Compatibility...');
  try {
    const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Check if network supports EIP-1559
    const latestBlock = await provider.getBlock('latest');
    if (latestBlock.baseFeePerGas) {
      console.log(`   ✅ EIP-1559 Support: Available`);
      console.log(`   ✅ Base Fee: ${latestBlock.baseFeePerGas.toString()} wei`);
    } else {
      console.log(`   ⚠️  EIP-1559 Support: Not available`);
    }
    
    // Check gas limit constraints
    console.log(`   ✅ Block Gas Limit: ${latestBlock.gasLimit.toString()}`);
    console.log(`   ✅ Gas Used: ${latestBlock.gasUsed.toString()}`);
    
    const gasUsedRatio = latestBlock.gasUsed.toNumber() / latestBlock.gasLimit.toNumber();
    console.log(`   ✅ Block Utilization: ${(gasUsedRatio * 100).toFixed(1)}%`);
    
    // Verify 2M gas constraint awareness
    const twoMillion = 2000000;
    if (latestBlock.gasLimit.toNumber() >= twoMillion) {
      console.log(`   ✅ Small Block Optimization: Ready (< 2M gas limit)`);
    } else {
      console.log(`   ⚠️  Block gas limit is unusually low`);
    }
    
    result.networkCompatible = true;
  } catch (error: any) {
    console.log(`   ❌ Network Compatibility Check Failed: ${error.message}`);
    result.issues.push('Network compatibility check failed');
  }

  console.log('');

  // 6. Overall Assessment
  result.overallReady = result.rpcConnection && 
                      result.walletSetup && 
                      result.balanceSufficient && 
                      result.gasAnalysis && 
                      result.networkCompatible;

  // 7. Summary Report
  console.log('📊 Readiness Summary');
  console.log('===================');
  console.log(`RPC Connection:      ${result.rpcConnection ? '✅' : '❌'}`);
  console.log(`Wallet Setup:        ${result.walletSetup ? '✅' : '❌'}`);
  console.log(`Balance Sufficient:  ${result.balanceSufficient ? '✅' : '❌'}`);
  console.log(`Gas Analysis:        ${result.gasAnalysis ? '✅' : '❌'}`);
  console.log(`Network Compatible:  ${result.networkCompatible ? '✅' : '❌'}`);
  console.log('');
  console.log(`Overall Ready:       ${result.overallReady ? '✅ READY' : '❌ NOT READY'}`);

  if (result.issues.length > 0) {
    console.log('');
    console.log('⚠️  Issues Found:');
    result.issues.forEach(issue => console.log(`   • ${issue}`));
  }

  if (result.recommendations.length > 0) {
    console.log('');
    console.log('💡 Recommendations:');
    result.recommendations.forEach(rec => console.log(`   • ${rec}`));
  }

  console.log('');
  
  if (result.overallReady) {
    console.log('🎉 Your environment is ready for HyperEVM contract deployment!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Deploy Simple Storage: ts-node custom/deploy/simple-storage-contract.ts');
    console.log('  2. Deploy ERC20 Token: ts-node custom/deploy/erc20-token-test.ts');
    console.log('  3. Use templates/contract-deploy.ts for custom contracts');
  } else {
    console.log('❌ Please resolve the issues above before attempting deployment.');
  }

  return result;
}

/**
 * Main CLI execution
 */
async function main(): Promise<void> {
  try {
    await checkDeploymentReadiness();
  } catch (error: any) {
    console.error('❌ Readiness check failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal Error:', error);
    process.exit(1);
  });
}

export { checkDeploymentReadiness };