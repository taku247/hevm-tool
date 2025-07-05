import { ethers } from 'ethers';
import { BalanceResult } from '../src/types';

export class HyperevmBalanceChecker {
    private provider: ethers.providers.StaticJsonRpcProvider;

    constructor(rpcUrl: string, _privateKey?: string) {
        const network = ethers.providers.getNetwork(999);
        network.name = 'hyperevm';
        this.provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl, network);
    }

    async checkBalance(address: string): Promise<BalanceResult> {
        try {
            const balance = await this.provider.getBalance(address);
            return {
                success: true,
                address: address,
                balance: ethers.utils.formatEther(balance),
                balanceWei: balance.toString(),
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            return {
                success: false,
                address: address,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async checkMultipleBalances(addresses: string[]): Promise<BalanceResult[]> {
        const results: BalanceResult[] = [];
        for (const address of addresses) {
            const result = await this.checkBalance(address);
            results.push(result);
        }
        return results;
    }
}

// CLI実行用の関数
async function main(): Promise<void> {
    const checker = new HyperevmBalanceChecker(
        process.env.HYPEREVM_RPC_URL || 'http://localhost:8545',
        process.env.PRIVATE_KEY
    );
    
    const addresses = process.argv.slice(2);
    if (addresses.length === 0) {
        console.log('Usage: ts-node balance_check.ts <address1> [address2] ...');
        process.exit(1);
    }
    
    try {
        const results = await checker.checkMultipleBalances(addresses);
        console.log(JSON.stringify(results, null, 2));
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

// CLI実行判定
if (require.main === module) {
    main();
}