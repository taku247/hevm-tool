const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');

async function checkQuoterAddress() {
  const quoterAddress = '0x03A918028f22D9E1473B7959C927AD7425A45C7C';
  
  try {
    const code = await provider.getCode(quoterAddress);
    console.log('Quoter code length:', code.length);
    console.log('Has code:', code !== '0x');
    
    // Try to call a simple function to see if it's a valid quoter
    const simpleQuoterABI = [
      {
        "name": "factory",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [
          { "name": "", "type": "address" }
        ]
      }
    ];
    
    const quoterContract = new ethers.Contract(quoterAddress, simpleQuoterABI, provider);
    const factoryAddress = await quoterContract.factory();
    console.log('Factory address from quoter:', factoryAddress);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkQuoterAddress();