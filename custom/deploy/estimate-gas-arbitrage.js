const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function estimateGas() {
  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const privateKey = process.env.PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    const artifact = JSON.parse(fs.readFileSync(
      path.join(__dirname, 'artifacts/contracts/MultiSwapArbitrageSimple.sol/MultiSwapArbitrageSimple.json'), 
      'utf8'
    ));
    
    console.log('📊 Contract bytecode size:', artifact.bytecode.length / 2, 'bytes');
    
    const contractFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    
    try {
      const estimatedGas = await contractFactory.getDeployTransaction().estimateGas(wallet);
      console.log('⛽ Estimated gas for deployment:', estimatedGas.toString());
    } catch (error) {
      console.log('❌ Gas estimation failed:', error.message);
      
      // Try with static call
      const deployTx = await contractFactory.getDeployTransaction();
      console.log('📝 Deploy transaction data length:', deployTx.data.length);
      
      // Try smaller deployment
      console.log('🔧 Attempting minimal deployment test...');
      try {
        const gasEstimate = await provider.estimateGas({
          data: artifact.bytecode
        });
        console.log('⛽ Basic gas estimate:', gasEstimate.toString());
      } catch (e2) {
        console.log('❌ Basic estimation failed:', e2.message);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

estimateGas();