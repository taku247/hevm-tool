const { ethers } = require('ethers');

class HyperevmContractInteraction {
    constructor(rpcUrl, privateKey) {
        const network = ethers.providers.getNetwork(999);
        network.name = 'hyperevm';
        this.provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl, network);
        this.wallet = privateKey && privateKey !== '0x' + '0'.repeat(64) ? 
            new ethers.Wallet(privateKey, this.provider) : null;
    }

    async callContractMethod(contractAddress, abi, methodName, params = [], options = {}) {
        try {
            const signer = options.readOnly ? this.provider : this.wallet;
            if (!options.readOnly && !this.wallet) {
                throw new Error('Private key required for write operations');
            }
            const contract = new ethers.Contract(contractAddress, abi, signer);
            
            let result;
            if (options.readOnly) {
                result = await contract[methodName](...params);
            } else {
                const tx = await contract[methodName](...params, options);
                await tx.wait();
                result = tx;
            }

            return {
                success: true,
                contractAddress: contractAddress,
                method: methodName,
                parameters: params,
                result: result.toString ? result.toString() : result,
                transactionHash: result.hash || null,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                contractAddress: contractAddress,
                method: methodName,
                parameters: params,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async getContractEvents(contractAddress, abi, eventName, fromBlock = 0, toBlock = 'latest') {
        try {
            const contract = new ethers.Contract(contractAddress, abi, this.provider);
            const filter = contract.filters[eventName]();
            const events = await contract.queryFilter(filter, fromBlock, toBlock);

            return {
                success: true,
                contractAddress: contractAddress,
                eventName: eventName,
                events: events.map(event => ({
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash,
                    args: event.args,
                    timestamp: new Date().toISOString()
                })),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                contractAddress: contractAddress,
                eventName: eventName,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = HyperevmContractInteraction;

if (require.main === module) {
    console.log('Contract interaction utility loaded. Use as module or implement CLI interface.');
}