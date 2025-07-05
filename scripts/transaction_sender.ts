import { ethers } from 'ethers';
import { TransactionResult, ContractDeployResult } from '../src/types';

export class HyperevmTransactionSender {
    private provider: ethers.providers.StaticJsonRpcProvider;
    private wallet: ethers.Wallet;

    constructor(rpcUrl: string, privateKey: string) {
        const network = ethers.providers.getNetwork(999);
        network.name = 'hyperevm';
        this.provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl, network);
        if (!privateKey || privateKey === '0x' + '0'.repeat(64)) {
            throw new Error('Valid private key is required for transaction sending');
        }
        this.wallet = new ethers.Wallet(privateKey, this.provider);
    }

    async sendTransaction(to: string, value: string | number, gasLimit: number = 21000): Promise<TransactionResult> {
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
                value: value.toString(),
                gasUsed: transaction.gasLimit?.toString(),
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            return {
                success: false,
                from: this.wallet.address,
                to: to,
                value: value.toString(),
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async deployContract(bytecode: string, abi: any[], constructorArgs: any[] = []): Promise<ContractDeployResult> {
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
        } catch (error: any) {
            return {
                success: false,
                deployer: this.wallet.address,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// CLI実行用の関数
async function main(): Promise<void> {
    try {
        const sender = new HyperevmTransactionSender(
            process.env.HYPEREVM_RPC_URL || 'http://localhost:8545',
            process.env.PRIVATE_KEY!
        );
        
        const [to, value] = process.argv.slice(2);
        if (!to || !value) {
            console.log('Usage: ts-node transaction_sender.ts <to_address> <value_in_ether>');
            process.exit(1);
        }
        
        const result = await sender.sendTransaction(to, value);
        console.log(JSON.stringify(result, null, 2));
    } catch (error: any) {
        console.error(JSON.stringify({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, null, 2));
        process.exit(1);
    }
}

// CLI実行判定
if (require.main === module) {
    main();
}