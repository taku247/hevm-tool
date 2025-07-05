import { ethers } from 'ethers';
import { ContractCallResult, ContractEventResult } from '../src/types';

interface CallOptions {
    readOnly?: boolean;
    gasLimit?: number;
    gasPrice?: ethers.BigNumber;
    value?: ethers.BigNumber;
}

export class HyperevmContractInteraction {
    private provider: ethers.providers.StaticJsonRpcProvider;
    private wallet: ethers.Wallet | null;

    constructor(rpcUrl: string, privateKey?: string) {
        const network = ethers.providers.getNetwork(999);
        network.name = 'hyperevm';
        this.provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl, network);
        this.wallet = privateKey && privateKey !== '0x' + '0'.repeat(64) ? 
            new ethers.Wallet(privateKey, this.provider) : null;
    }

    async callContractMethod(
        contractAddress: string,
        abi: any[],
        methodName: string,
        params: any[] = [],
        options: CallOptions = {}
    ): Promise<ContractCallResult> {
        try {
            if (!options.readOnly && !this.wallet) {
                throw new Error('Private key required for write operations');
            }
            const signer = options.readOnly ? this.provider : this.wallet!;
            const contract = new ethers.Contract(contractAddress, abi, signer);
            
            let result: any;
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
        } catch (error: any) {
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

    async getContractEvents(
        contractAddress: string,
        abi: any[],
        eventName: string,
        fromBlock: number | string = 0,
        toBlock: number | string = 'latest'
    ): Promise<ContractEventResult> {
        try {
            const contract = new ethers.Contract(contractAddress, abi, this.provider);
            const filterFunction = contract.filters[eventName];
            if (!filterFunction) {
                throw new Error(`Event ${eventName} not found in contract ABI`);
            }
            const filter = filterFunction();
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
        } catch (error: any) {
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

// CLI実行用の関数
async function main(): Promise<void> {
    console.log('Contract interaction utility loaded. Use as module or implement CLI interface.');
    console.log('Usage example:');
    console.log('const { HyperevmContractInteraction } = require("./contract_interaction");');
    console.log('const interaction = new HyperevmContractInteraction(rpcUrl, privateKey);');
    console.log('const result = await interaction.callContractMethod(address, abi, method, params);');
}

// CLI実行判定
if (require.main === module) {
    main();
}