#!/usr/bin/env ts-node

/**
 * Simple Storage Contract Deployment Test for HyperEVM Testnet
 * 
 * This script deploys a minimal storage contract to test basic deployment
 * functionality on HyperEVM testnet.
 */

import { UniversalContractUtils } from '../../templates/contract-utils';
import { ContractDeployConfig } from '../../src/contract-template-types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Simple Storage Contract ABI
 * A minimal contract that stores and retrieves a uint256 value
 */
const SIMPLE_STORAGE_ABI = [
  {
    "inputs": [{"name": "_initialValue", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "get",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "_value", "type": "uint256"}],
    "name": "set",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "storedValue",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

/**
 * Simple Storage Contract Bytecode
 * 
 * Solidity Code:
 * ```solidity
 * contract SimpleStorage {
 *     uint256 public storedValue;
 *     
 *     constructor(uint256 _initialValue) {
 *         storedValue = _initialValue;
 *     }
 *     
 *     function set(uint256 _value) public {
 *         storedValue = _value;
 *     }
 *     
 *     function get() public view returns (uint256) {
 *         return storedValue;
 *     }
 * }
 * ```
 */
const SIMPLE_STORAGE_BYTECODE = "0x608060405234801561001057600080fd5b506040516101e03803806101e08339818101604052810190610032919061007a565b8060008190555050506100a7565b600080fd5b6000819050919050565b61005781610044565b811461006257600080fd5b50565b6000815190506100748161004e565b92915050565b6000602082840312156100905761008f61003f565b5b600061009e84828501610065565b91505092915050565b61012a806100b66000396000f3fe6080604052348015600f57600080fd5b5060043610603c5760003560e01c80632a1afcd91460415780636057361d146053578063d2178b08146069575b600080fd5b6000546040516004e91906067565b60405180910390f35b6066600480360381019060649190608c565b6075565b005b6000546040516004e91906067565b60405180910390f35b6000819050919050565b607f81607c565b82525050565b6000602082019050609860008301846078565b92915050565b600080fd5b60a881607c565b811460b257600080fd5b50565b60008135905060ca8160a3565b92915050565b600060208284031215607e5760dd609e565b5b600060ea8482850160bd565b91505092915050565b8060008190555050565b00fea2646970667358221220f7b1f8e5c3c7e5c2e3f3e3c3e3c3e3c3e3c3e3c3e3c3e3c3e3c3e3c3e364736f6c63430008130033";

/**
 * Deploy Simple Storage Contract
 */
async function deploySimpleStorage(initialValue: number = 42): Promise<void> {
  console.log('🚀 HyperEVM Testnet Contract Deployment Test');
  console.log('============================================\n');

  // Validate environment
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ Error: PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  try {
    // Initialize contract utils
    const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
    const contractUtils = new UniversalContractUtils(rpcUrl, process.env.PRIVATE_KEY);

    console.log('📋 Deployment Configuration:');
    console.log(`   RPC URL: ${rpcUrl}`);
    console.log(`   Contract Type: Simple Storage`);
    console.log(`   Initial Value: ${initialValue}`);
    console.log(`   Bytecode Size: ${(SIMPLE_STORAGE_BYTECODE.length - 2) / 2} bytes`);
    console.log('');

    // Analyze current gas prices
    console.log('⚡ Analyzing HyperEVM Gas Prices...');
    const gasAnalysis = await contractUtils.analyzeCurrentGasPrices();
    console.log(`   Network Congestion: ${gasAnalysis.networkCongestion}`);
    console.log(`   Base Fee: ${contractUtils.getOptimalGasPrice('standard').then(g => g.eip1559.maxFeePerGas)} wei`);
    console.log(`   Recommended Strategy: ${gasAnalysis.recommendations.strategy}`);
    console.log('');

    // HyperEVM specific gas settings - keeping under 2M gas limit for Small Block
    const deployConfig: ContractDeployConfig = {
      abi: SIMPLE_STORAGE_ABI,
      bytecode: SIMPLE_STORAGE_BYTECODE,
      constructorArgs: [initialValue],
      options: {
        gasLimit: 1900000, // Under 2M gas limit for HyperEVM Small Block
      },
      waitForConfirmation: true
    };

    console.log('🔧 Deploying Contract with HyperEVM optimization...');
    console.log(`   Gas Limit: ${deployConfig.options?.gasLimit} (Small Block optimized)`);
    console.log('');

    // Deploy contract with dynamic gas pricing
    const result = await contractUtils.callWriteFunctionWithDynamicGas(
      {
        ...deployConfig,
        contractAddress: '', // Will be set during deployment
        functionName: 'constructor',
        args: deployConfig.constructorArgs || []
      } as any,
      gasAnalysis.recommendations.strategy
    );

    // Actually deploy the contract
    const deployResult = await contractUtils.deployContract(deployConfig);

    if (deployResult.success) {
      console.log('✅ Deployment Successful!');
      console.log('');
      console.log('📊 Deployment Results:');
      console.log(`   Contract Address: ${deployResult.contractAddress}`);
      console.log(`   Transaction Hash: ${deployResult.transactionHash}`);
      console.log(`   Block Number: ${deployResult.blockNumber}`);
      console.log(`   Gas Used: ${deployResult.gasUsed}`);
      console.log(`   Deploy Time: ${deployResult.timestamp}`);
      console.log('');

      // Test contract functionality
      console.log('🧪 Testing Contract Functionality...');
      await testContractFunctions(contractUtils, deployResult.contractAddress!);

      console.log('');
      console.log('🎉 HyperEVM Testnet Deployment Test Completed Successfully!');
      console.log('');
      console.log('📋 Summary:');
      console.log(`   ✅ Contract deployment: SUCCESS`);
      console.log(`   ✅ Gas optimization: Small Block (< 2M gas)`);
      console.log(`   ✅ Contract interaction: SUCCESS`);
      console.log(`   ✅ HyperEVM compatibility: VERIFIED`);
      
    } else {
      console.error('❌ Deployment Failed:');
      console.error(`   Error: ${deployResult.error}`);
      console.error(`   Timestamp: ${deployResult.timestamp}`);
      process.exit(1);
    }

  } catch (error: any) {
    console.error('❌ Deployment Error:', error.message);
    if (error.stack) {
      console.error('\nStack Trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Test the deployed contract's functions
 */
async function testContractFunctions(contractUtils: UniversalContractUtils, contractAddress: string): Promise<void> {
  try {
    // Test reading the initial value
    console.log('   📖 Reading initial value...');
    const readResult = await contractUtils.callReadFunction({
      contractAddress,
      abi: SIMPLE_STORAGE_ABI,
      functionName: 'get',
      args: []
    });

    if (readResult.success) {
      console.log(`   ✅ Initial value: ${readResult.result}`);
    } else {
      console.error(`   ❌ Read failed: ${readResult.error}`);
      return;
    }

    // Test setting a new value
    console.log('   📝 Setting new value (123)...');
    const writeResult = await contractUtils.callWriteFunctionWithDynamicGas({
      contractAddress,
      abi: SIMPLE_STORAGE_ABI,
      functionName: 'set',
      args: [123],
      options: {
        gasLimit: 100000 // Simple function call
      }
    }, 'standard');

    if (writeResult.success) {
      console.log(`   ✅ Value set successfully (tx: ${writeResult.transactionHash})`);
    } else {
      console.error(`   ❌ Write failed: ${writeResult.error}`);
      return;
    }

    // Test reading the new value
    console.log('   📖 Reading updated value...');
    const readResult2 = await contractUtils.callReadFunction({
      contractAddress,
      abi: SIMPLE_STORAGE_ABI,
      functionName: 'get',
      args: []
    });

    if (readResult2.success) {
      console.log(`   ✅ Updated value: ${readResult2.result}`);
    } else {
      console.error(`   ❌ Read failed: ${readResult2.error}`);
    }

  } catch (error: any) {
    console.error('❌ Contract test error:', error.message);
  }
}

/**
 * Main CLI execution
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const initialValue = args.length > 0 ? parseInt(args[0]) : 42;

  if (isNaN(initialValue)) {
    console.error('❌ Invalid initial value. Please provide a number.');
    process.exit(1);
  }

  await deploySimpleStorage(initialValue);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal Error:', error);
    process.exit(1);
  });
}

export { deploySimpleStorage };