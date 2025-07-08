const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function deployArbitrageSimple() {
  console.log('🚀 MultiSwapArbitrageSimple 単独デプロイ');
  console.log('=====================================\n');

  try {
    const rpcUrl = process.env.HYPERLIQUID_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';
    const privateKey = process.env.PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('📋 設定:');
    console.log(`   Deployer: ${wallet.address}`);
    console.log(`   Balance: ${ethers.formatEther(await provider.getBalance(wallet.address))} ETH`);
    console.log('');

    const artifact = JSON.parse(fs.readFileSync(
      path.join(__dirname, 'artifacts/contracts/MultiSwapArbitrageSimple.sol/MultiSwapArbitrageSimple.json'), 
      'utf8'
    ));
    
    console.log(`📊 Contract size: ${artifact.bytecode.length / 2} bytes`);
    console.log('');

    const contractFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    
    console.log('⛽ ガス見積もり中...');
    const gasEstimate = await provider.estimateGas({
      data: artifact.bytecode
    });
    
    const gasLimit = Math.floor(Number(gasEstimate) * 1.2); // 20% buffer
    console.log(`   見積もり: ${gasEstimate.toString()}`);
    console.log(`   制限値: ${gasLimit}`);
    console.log('');

    if (gasLimit > 2000000) {
      console.log('❌ ガス制限が2M超過 - HyperEVM Small Blockに適さない');
      return;
    }

    console.log('🚀 デプロイ実行中...');
    const arbitrageContract = await contractFactory.deploy({ 
      gasLimit: gasLimit,
      gasPrice: ethers.parseUnits('0.1', 'gwei') 
    });
    
    console.log(`   TX Hash: ${arbitrageContract.deploymentTransaction().hash}`);
    
    await arbitrageContract.waitForDeployment();
    const arbitrageAddress = await arbitrageContract.getAddress();
    
    console.log(`✅ デプロイ成功: ${arbitrageAddress}`);
    console.log('');

    // コントラクト情報確認
    console.log('📊 コントラクト情報:');
    const contractInfo = await arbitrageContract.getContractInfo();
    console.log(`   Owner: ${contractInfo.contractOwner}`);
    console.log(`   Paused: ${contractInfo.isPaused}`);
    console.log(`   Pre-approved: Router approval set in constructor`);
    console.log('');

    console.log('🎉 ChatGPT推奨機能 デプロイ完了!');
    console.log('=============================');
    console.log(`   アドレス: ${arbitrageAddress}`);
    console.log('   ✅ Owner-only access control');
    console.log('   ✅ Fund pooling capability');
    console.log('   ✅ Pre-approved router (gas optimized)');
    console.log('   ✅ Reentrancy protection');
    console.log('   ✅ Emergency pause functionality');

    return arbitrageAddress;
    
  } catch (error) {
    console.error('❌ デプロイエラー:', error.message);
    if (error.transaction) {
      console.log('Transaction:', error.transaction);
    }
    if (error.receipt) {
      console.log('Receipt:', error.receipt);
    }
  }
}

if (require.main === module) {
  deployArbitrageSimple()
    .then((address) => {
      if (address) {
        console.log(`\n🤖 デプロイ完了 - アドレス: ${address}`);
      }
    })
    .catch(console.error);
}

module.exports = { deployArbitrageSimple };