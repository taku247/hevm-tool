const { ethers } = require('ethers');

class HyperevmBalanceChecker {
    constructor(rpcUrl, privateKey) {
        const network = ethers.providers.getNetwork(999);
        network.name = 'hyperevm';
        this.provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl, network);
        this.wallet = privateKey && privateKey !== '0x' + '0'.repeat(64) ? 
            new ethers.Wallet(privateKey, this.provider) : null;
    }

    async checkBalance(address) {
        try {
            const balance = await this.provider.getBalance(address);
            return {
                success: true,
                address: address,
                balance: ethers.utils.formatEther(balance),
                balanceWei: balance.toString(),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                address: address,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async checkMultipleBalances(addresses) {
        const results = [];
        for (const address of addresses) {
            const result = await this.checkBalance(address);
            results.push(result);
        }
        return results;
    }
}

module.exports = HyperevmBalanceChecker;

if (require.main === module) {
    const checker = new HyperevmBalanceChecker(
        process.env.HYPEREVM_RPC_URL || 'http://localhost:8545',
        process.env.PRIVATE_KEY
    );
    
    const addresses = process.argv.slice(2);
    if (addresses.length === 0) {
        console.log('Usage: node balance_check.js <address1> [address2] ...');
        process.exit(1);
    }
    
    checker.checkMultipleBalances(addresses)
        .then(results => {
            console.log(JSON.stringify(results, null, 2));
        })
        .catch(console.error);
}