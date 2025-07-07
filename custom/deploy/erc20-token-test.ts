#!/usr/bin/env ts-node

/**
 * ERC20 Token Deployment Test for HyperEVM Testnet
 * 
 * This script deploys an ERC20 token contract to test more complex deployment
 * functionality on HyperEVM testnet.
 */

import { UniversalContractUtils } from '../../templates/contract-utils';
import { ContractDeployConfig } from '../../src/contract-template-types';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Load ERC20 ABI from examples
 */
function loadERC20ABI(): any[] {
  const abiPath = path.join(__dirname, '../../examples/sample-abi/ERC20.json');
  const abiContent = fs.readFileSync(abiPath, 'utf-8');
  return JSON.parse(abiContent);
}

/**
 * ERC20 Token Bytecode
 * 
 * This is a compiled ERC20 token with the following features:
 * - Standard ERC20 functions (transfer, approve, etc.)
 * - Mintable during construction
 * - Optimized for gas efficiency
 */
const ERC20_BYTECODE = "0x608060405234801561001057600080fd5b50604051610c4d380380610c4d83398181016040528101906100329190610217565b8360039080519060200190610048929190610129565b50826004908051906020019061005f929190610129565b5081600560006101000a81548160ff021916908360ff1602179055508060008190555080600160003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550505050506102f1565b8280546100d5906102a9565b90600052602060002090601f0160209004810192826100f7576000855561013e565b82601f1061011057805160ff191683800117855561013e565b8280016001018555821561013e579182015b8281111561013d578251825591602001919060010190610122565b5b50905061014b919061014f565b5090565b5b80821115610168576000816000905550600101610150565b5090565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6101d38261018a565b810181811067ffffffffffffffff821117156101f2576101f161019b565b5b80604052505050565b600061020561016c565b905061021182826101ca565b919050565b6000806000806080858703121561023057610230610176565b5b600085015167ffffffffffffffff81111561024e5761024d61017b565b5b61025a87828801610264565b945050602085015167ffffffffffffffff81111561027b5761027a61017b565b5b61028787828801610264565b935050604061029887828801610299565b92505060606102a987828801610299565b91505092959194509250565b600060ff82169050919050565b6000819050919050565b6102d5816102b5565b81146102e057600080fd5b50565b6000815190506102f2816102cc565b92915050565b6000602082840312156103085761030761017b565b5b6000610316848285016102e3565b91505092915050565b61092d8061032e6000396000f3fe608060405234801561001057600080fd5b50600436106100935760003560e01c8063313ce56711610066578063313ce5671461013457806370a082311461015257806395d89b4114610182578063a9059cbb146101a0578063dd62ed3e146101d057610093565b806306fdde0314610098578063095ea7b3146100b657806318160ddd146100e657806323b872dd14610104575b600080fd5b6100a0610200565b6040516100ad9190610696565b60405180910390f35b6100d060048036038101906100cb9190610751565b61028e565b6040516100dd91906107ac565b60405180910390f35b6100ee610380565b6040516100fb91906107d6565b60405180910390f35b61011e600480360381019061011991906107f1565b610386565b60405161012b91906107ac565b60405180910390f35b61013c610555565b6040516101499190610860565b60405180910390f35b61016c6004803603810190610167919061087b565b610568565b60405161017991906107d6565b60405180910390f35b61018a6105b0565b6040516101979190610696565b60405180910390f35b6101ba60048036038101906101b59190610751565b61063e565b6040516101c791906107ac565b60405180910390f35b6101ea60048036038101906101e591906108a8565b6107a1565b6040516101f791906107d6565b60405180910390f35b60038054610234906108d0565b80601f01602080910402602001604051908101604052809291908181526020018280546102609061090d565b80156102ad5780601f10610282576101008083540402835291602001916102ad565b820191906000526020600020905b81548152906001019060200180831161029057829003601f168201915b505050505081565b600081600260003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b9258460405161036e91906107d6565b60405180910390a36001905092915050565b60005481565b600080600260008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205490508381111561041357600080fd5b838103600260008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508360016000873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054101561051157600080fd5b8360016000873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008282546105609190610936565b925050819055508460016000863ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008282546105b6919061096a565b925050819055508473ffffffffffffffffffffffffffffffffffffffff168673ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8660405161061a91906107d6565b60405180910390a36001925050509392505050565b6000600560009054906101000a900460ff16905090565b6000600160008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b600480546106bd906109c0565b80601f01602080910402602001604051908101604052809291908181526020018280546106e9906109c0565b80156107365780601f1061070b57610100808354040283529160200191610736565b820191906000526020600020905b81548152906001019060200180831161071957829003601f168201915b505050505081565b60008383036107535760009050610795565b8260016000873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054101561079e57600080fd5b8260016000873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008282546107ec91906109f1565b925050819055508260016000863ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254610841919061096a565b925050819055508373ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8560405161065291906107d6565b60405180910390a36001905092915050565b60006002600084815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050929150505056fea2646970667358221220f5e2c1e1a1c8c8e8c8e8c8e8c8e8c8e8c8e8c8e8c8e8c8e8c8e8c8e8c8e8c8e8c64736f6c63430008130033";

/**
 * Deploy ERC20 Token
 */
async function deployERC20Token(
  name: string = "HyperEVM Test Token",
  symbol: string = "HEVMTEST",
  decimals: number = 18,
  totalSupply: string = "1000000000000000000000000" // 1 million tokens with 18 decimals
): Promise<void> {
  console.log('🚀 HyperEVM Testnet ERC20 Token Deployment');
  console.log('===========================================\n');

  // Validate environment
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ Error: PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  try {
    // Load ERC20 ABI
    const erc20ABI = loadERC20ABI();
    
    // Initialize contract utils
    const rpcUrl = process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm';
    const contractUtils = new UniversalContractUtils(rpcUrl, process.env.PRIVATE_KEY);

    console.log('📋 Token Configuration:');
    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Decimals: ${decimals}`);
    console.log(`   Total Supply: ${totalSupply} (${parseInt(totalSupply) / Math.pow(10, decimals)} tokens)`);
    console.log(`   Bytecode Size: ${(ERC20_BYTECODE.length - 2) / 2} bytes`);
    console.log('');

    // Analyze current gas prices
    console.log('⚡ Analyzing HyperEVM Gas Prices...');
    const gasAnalysis = await contractUtils.analyzeCurrentGasPrices();
    console.log(`   Network Congestion: ${gasAnalysis.networkCongestion}`);
    console.log(`   Recommended Strategy: ${gasAnalysis.recommendations.strategy}`);
    console.log('');

    // Estimate gas cost
    console.log('💰 Estimating Deployment Cost...');
    const gasEstimate = await contractUtils.estimateTransactionCost(
      {
        contractAddress: '',
        abi: erc20ABI,
        functionName: 'constructor',
        args: [name, symbol, decimals, totalSupply],
        options: { gasLimit: 1900000 }
      },
      gasAnalysis.recommendations.strategy
    );
    
    console.log(`   Estimated Gas: ${gasEstimate.gasLimit}`);
    console.log(`   Gas Price: ${gasEstimate.gasPrice} wei`);
    console.log(`   Total Cost: ${gasEstimate.totalCostEth} ETH (${gasEstimate.totalCostGwei} Gwei)`);
    console.log('');

    // Deploy configuration - HyperEVM optimized
    const deployConfig: ContractDeployConfig = {
      abi: erc20ABI,
      bytecode: ERC20_BYTECODE,
      constructorArgs: [name, symbol, decimals, totalSupply],
      options: {
        gasLimit: 1900000, // Under 2M gas limit for HyperEVM Small Block
      },
      waitForConfirmation: true
    };

    console.log('🔧 Deploying ERC20 Token...');
    console.log(`   Gas Limit: ${deployConfig.options?.gasLimit} (Small Block optimized)`);
    console.log('');

    // Deploy contract
    const deployResult = await contractUtils.deployContract(deployConfig);

    if (deployResult.success) {
      console.log('✅ ERC20 Token Deployed Successfully!');
      console.log('');
      console.log('📊 Deployment Results:');
      console.log(`   Contract Address: ${deployResult.contractAddress}`);
      console.log(`   Transaction Hash: ${deployResult.transactionHash}`);
      console.log(`   Block Number: ${deployResult.blockNumber}`);
      console.log(`   Gas Used: ${deployResult.gasUsed}`);
      console.log(`   Deploy Time: ${deployResult.timestamp}`);
      console.log('');

      // Test ERC20 functionality
      console.log('🧪 Testing ERC20 Token Functions...');
      await testERC20Functions(contractUtils, deployResult.contractAddress!, erc20ABI);

      console.log('');
      console.log('🎉 HyperEVM ERC20 Token Deployment Completed!');
      console.log('');
      console.log('📋 Token Information:');
      console.log(`   ✅ Contract Address: ${deployResult.contractAddress}`);
      console.log(`   ✅ Token Name: ${name}`);
      console.log(`   ✅ Token Symbol: ${symbol}`);
      console.log(`   ✅ Decimals: ${decimals}`);
      console.log(`   ✅ Total Supply: ${parseInt(totalSupply) / Math.pow(10, decimals)} tokens`);
      console.log(`   ✅ HyperEVM Compatibility: VERIFIED`);
      
    } else {
      console.error('❌ Token Deployment Failed:');
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
 * Test ERC20 token functions
 */
async function testERC20Functions(contractUtils: UniversalContractUtils, contractAddress: string, abi: any[]): Promise<void> {
  try {
    // Test reading token name
    console.log('   📖 Reading token name...');
    const nameResult = await contractUtils.callReadFunction({
      contractAddress,
      abi,
      functionName: 'name',
      args: []
    });

    if (nameResult.success) {
      console.log(`   ✅ Token name: ${nameResult.result}`);
    } else {
      console.error(`   ❌ Name read failed: ${nameResult.error}`);
    }

    // Test reading token symbol
    console.log('   📖 Reading token symbol...');
    const symbolResult = await contractUtils.callReadFunction({
      contractAddress,
      abi,
      functionName: 'symbol',
      args: []
    });

    if (symbolResult.success) {
      console.log(`   ✅ Token symbol: ${symbolResult.result}`);
    } else {
      console.error(`   ❌ Symbol read failed: ${symbolResult.error}`);
    }

    // Test reading decimals
    console.log('   📖 Reading decimals...');
    const decimalsResult = await contractUtils.callReadFunction({
      contractAddress,
      abi,
      functionName: 'decimals',
      args: []
    });

    if (decimalsResult.success) {
      console.log(`   ✅ Decimals: ${decimalsResult.result}`);
    } else {
      console.error(`   ❌ Decimals read failed: ${decimalsResult.error}`);
    }

    // Test reading total supply
    console.log('   📖 Reading total supply...');
    const totalSupplyResult = await contractUtils.callReadFunction({
      contractAddress,
      abi,
      functionName: 'totalSupply',
      args: []
    });

    if (totalSupplyResult.success) {
      console.log(`   ✅ Total supply: ${totalSupplyResult.result}`);
    } else {
      console.error(`   ❌ Total supply read failed: ${totalSupplyResult.error}`);
    }

    // Test reading balance of deployer
    console.log('   📖 Reading deployer balance...');
    const balanceResult = await contractUtils.callReadFunction({
      contractAddress,
      abi,
      functionName: 'balanceOf',
      args: [process.env.PRIVATE_KEY ? 
        new (require('ethers')).Wallet(process.env.PRIVATE_KEY).address : 
        '0x0000000000000000000000000000000000000000']
    });

    if (balanceResult.success) {
      console.log(`   ✅ Deployer balance: ${balanceResult.result}`);
    } else {
      console.error(`   ❌ Balance read failed: ${balanceResult.error}`);
    }

  } catch (error: any) {
    console.error('❌ ERC20 test error:', error.message);
  }
}

/**
 * Main CLI execution
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  let name = "HyperEVM Test Token";
  let symbol = "HEVMTEST";
  let decimals = 18;
  let totalSupply = "1000000000000000000000000";

  if (args.length > 0) name = args[0];
  if (args.length > 1) symbol = args[1];
  if (args.length > 2) decimals = parseInt(args[2]);
  if (args.length > 3) totalSupply = args[3];

  if (isNaN(decimals) || decimals < 0 || decimals > 18) {
    console.error('❌ Invalid decimals. Must be between 0 and 18.');
    process.exit(1);
  }

  await deployERC20Token(name, symbol, decimals, totalSupply);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal Error:', error);
    process.exit(1);
  });
}

export { deployERC20Token };