const { ethers } = require('ethers');

class HyperevmTransactionSender {
    constructor(rpcUrl, privateKey) {
        const network = ethers.providers.getNetwork(999);
        network.name = 'hyperevm';
        this.provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl, network);
        if (!privateKey || privateKey === '0x' + '0'.repeat(64)) {
            throw new Error('Valid private key is required for transaction sending');
        }
        this.wallet = new ethers.Wallet(privateKey, this.provider);
    }

    async sendTransaction(to, value, gasLimit = 21000) {
        try {
            const tx = {
                to: to,
                value: ethers.utils.parseEther(value.toString()),
                gasLimit: gasLimit,
                gasPrice: await this.provider.getGasPrice()
            };

            const transaction = await this.wallet.sendTransaction(tx);
            await transaction.wait();

            return {
                success: true,
                transactionHash: transaction.hash,
                from: this.wallet.address,
                to: to,
                value: value,
                gasUsed: transaction.gasLimit?.toString(),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                from: this.wallet.address,
                to: to,
                value: value,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async deployContract(bytecode, abi, constructorArgs = []) {
        try {
            const factory = new ethers.ContractFactory(abi, bytecode, this.wallet);
            const contract = await factory.deploy(...constructorArgs);
            await contract.deployed();

            return {
                success: true,
                contractAddress: contract.address,
                transactionHash: contract.deployTransaction.hash,
                deployer: this.wallet.address,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                deployer: this.wallet.address,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = HyperevmTransactionSender;

if (require.main === module) {
    try {
        const sender = new HyperevmTransactionSender(
            process.env.HYPEREVM_RPC_URL || 'http://localhost:8545',
            process.env.PRIVATE_KEY
        );
        
        const [to, value] = process.argv.slice(2);
        if (!to || !value) {
            console.log('Usage: node transaction_sender.js <to_address> <value_in_ether>');
            process.exit(1);
        }
        
        sender.sendTransaction(to, value)
            .then(result => {
                console.log(JSON.stringify(result, null, 2));
            })
            .catch(console.error);
    } catch (error) {
        console.error(JSON.stringify({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, null, 2));
    }
}