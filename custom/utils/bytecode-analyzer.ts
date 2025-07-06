import { ethers } from "ethers";

/**
 * バイトコードから関数シグネチャとセレクタを抽出するツール
 * 
 * HyperEVMのコントラクトバイトコードを解析して、
 * 実装されている関数を特定します。
 */

interface FunctionSignature {
    selector: string;
    signature?: string | undefined;
    name?: string | undefined;
}

class BytecodeAnalyzer {
    private provider: ethers.providers.JsonRpcProvider;
    private knownSelectors: Map<string, string>;

    constructor(rpcUrl: string) {
        this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        this.knownSelectors = this.loadKnownSelectors();
    }

    /**
     * 既知の関数セレクタのデータベースを読み込み
     */
    private loadKnownSelectors(): Map<string, string> {
        const selectors = new Map<string, string>();
        
        // QuoterV2の既知の関数
        selectors.set("0xcdca1753", "quoteExactInput(bytes,uint256)");
        selectors.set("0xf7729d43", "quoteExactInputSingle(address,address,uint24,uint256,uint160)");
        selectors.set("0x2f80bb1d", "quoteExactOutput(bytes,uint256)");
        selectors.set("0xbd21704a", "quoteExactOutputSingle(address,address,uint24,uint256,uint160)");
        
        // QuoterV1の関数
        selectors.set("0xf7729d43", "quoteExactInputSingle(address,address,uint24,uint256,uint160)");
        selectors.set("0xcdca1753", "quoteExactInput(bytes,uint256)");
        
        // 一般的なERC20関数
        selectors.set("0x70a08231", "balanceOf(address)");
        selectors.set("0x18160ddd", "totalSupply()");
        selectors.set("0xa9059cbb", "transfer(address,uint256)");
        selectors.set("0x23b872dd", "transferFrom(address,address,uint256)");
        selectors.set("0x095ea7b3", "approve(address,uint256)");
        selectors.set("0xdd62ed3e", "allowance(address,address)");
        
        // Uniswap V3共通関数
        selectors.set("0x1f0464d1", "factory()");
        selectors.set("0x4aa4a4fc", "WETH9()");
        selectors.set("0x0902f1ac", "getReserves()");
        
        return selectors;
    }

    /**
     * コントラクトのバイトコードを取得
     */
    async getContractBytecode(address: string): Promise<string> {
        console.log(`📋 コントラクトのバイトコードを取得中: ${address}`);
        const code = await this.provider.getCode(address);
        
        if (code === "0x") {
            throw new Error("コントラクトが存在しません");
        }
        
        console.log(`✅ バイトコードサイズ: ${code.length / 2 - 1} bytes`);
        return code;
    }

    /**
     * バイトコードから関数セレクタを抽出
     */
    extractFunctionSelectors(bytecode: string): FunctionSignature[] {
        const signatures: FunctionSignature[] = [];
        const selectorPattern = /63([0-9a-f]{8})14/gi;
        
        // PUSH4命令パターンで検索
        const matches = new Set<string>();
        
        // Pattern 1: 63 xx xx xx xx 14 (PUSH4 selector DUP5)
        let match;
        while ((match = selectorPattern.exec(bytecode)) !== null) {
            matches.add("0x" + match[1]);
        }
        
        // Pattern 2: 直接的なPUSH4参照を探す
        const push4Pattern = /63([0-9a-f]{8})/gi;
        while ((match = push4Pattern.exec(bytecode)) !== null) {
            const selector = "0x" + match[1];
            // 一般的な関数セレクタの範囲内かチェック
            if (this.isValidSelector(selector)) {
                matches.add(selector);
            }
        }
        
        // セレクタを処理
        matches.forEach(selector => {
            const signature: FunctionSignature = { selector };
            
            if (this.knownSelectors.has(selector)) {
                const sig = this.knownSelectors.get(selector);
                if (sig) {
                    signature.signature = sig;
                    signature.name = sig.split("(")[0];
                }
            }
            
            signatures.push(signature);
        });
        
        return signatures;
    }

    /**
     * 有効な関数セレクタかチェック
     */
    private isValidSelector(selector: string): boolean {
        // 0x00000000 や 0xffffffff などの特殊値を除外
        const num = parseInt(selector, 16);
        return num > 0x00000100 && num < 0xfffffffe;
    }

    /**
     * 関数セレクタを計算
     */
    calculateSelector(signature: string): string {
        const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(signature));
        return hash.slice(0, 10);
    }

    /**
     * QuoterV2の可能性のある関数シグネチャを生成
     */
    generateQuoterV2Possibilities(): string[] {
        const possibilities: string[] = [];
        
        // 標準的なパターン
        possibilities.push("quoteExactInputSingle(address,address,uint24,uint256,uint160)");
        possibilities.push("quoteExactInput(bytes,uint256)");
        possibilities.push("quoteExactOutputSingle(address,address,uint24,uint256,uint160)");
        possibilities.push("quoteExactOutput(bytes,uint256)");
        
        // Struct引数パターン
        possibilities.push("quoteExactInputSingle((address,address,uint256,uint24,uint160))");
        possibilities.push("quoteExactOutputSingle((address,address,uint256,uint24,uint160))");
        
        // 返り値付きパターン
        possibilities.push("quoteExactInputSingle(address,address,uint24,uint256,uint160) returns (uint256,uint160,uint32,uint256)");
        
        return possibilities;
    }

    /**
     * コントラクトを詳細分析
     */
    async analyzeContract(address: string): Promise<void> {
        console.log("🔍 コントラクト解析開始\n");
        
        try {
            // バイトコード取得
            const bytecode = await this.getContractBytecode(address);
            
            // 関数セレクタ抽出
            const signatures = this.extractFunctionSelectors(bytecode);
            
            console.log(`\n📊 検出された関数セレクタ: ${signatures.length}個\n`);
            
            // 既知の関数
            const known = signatures.filter(s => s.signature);
            if (known.length > 0) {
                console.log("✅ 既知の関数:");
                known.forEach(sig => {
                    console.log(`   ${sig.selector}: ${sig.signature}`);
                });
            }
            
            // 未知の関数
            const unknown = signatures.filter(s => !s.signature);
            if (unknown.length > 0) {
                console.log("\n❓ 未知の関数セレクタ:");
                unknown.forEach(sig => {
                    console.log(`   ${sig.selector}`);
                });
                
                // QuoterV2の可能性を試す
                console.log("\n🧪 QuoterV2候補のマッチング試行:");
                const candidates = this.generateQuoterV2Possibilities();
                
                unknown.forEach(unknownSig => {
                    console.log(`\n   セレクタ ${unknownSig.selector} の候補:`);
                    candidates.forEach(candidate => {
                        const calculatedSelector = this.calculateSelector(candidate);
                        if (calculatedSelector === unknownSig.selector) {
                            console.log(`   ✅ マッチ: ${candidate}`);
                        }
                    });
                });
            }
            
            // バイトコード内の特徴的なパターンを検索
            console.log("\n🔎 バイトコードパターン分析:");
            this.analyzePatterns(bytecode);
            
        } catch (error) {
            console.error("❌ エラー:", error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * バイトコード内の特徴的なパターンを分析
     */
    private analyzePatterns(bytecode: string): void {
        // Solidity バージョンマーカー
        const solidityPattern = /736f6c6343([0-9a-f]{6})/g;
        const solidityMatch = solidityPattern.exec(bytecode);
        if (solidityMatch && solidityMatch[1]) {
            const version = solidityMatch[1];
            const major = parseInt(version.substr(0, 2), 16);
            const minor = parseInt(version.substr(2, 2), 16);
            const patch = parseInt(version.substr(4, 2), 16);
            console.log(`   Solidity バージョン: ${major}.${minor}.${patch}`);
        }
        
        // メタデータハッシュ
        const metadataPattern = /a264697066735822([0-9a-f]{64})/g;
        const metadataMatch = metadataPattern.exec(bytecode);
        if (metadataMatch && metadataMatch[1]) {
            console.log(`   メタデータハッシュ: ${metadataMatch[1].substring(0, 16)}...`);
        }
        
        // ライブラリ使用の検出
        if (bytecode.includes("73") && bytecode.length > 10000) {
            console.log("   大規模コントラクト (ライブラリ使用の可能性)");
        }
    }

    /**
     * 複数のコントラクトを比較分析
     */
    async compareContracts(addresses: { [name: string]: string }): Promise<void> {
        console.log("📊 コントラクト比較分析\n");
        
        const results: { [name: string]: FunctionSignature[] } = {};
        
        for (const [name, address] of Object.entries(addresses)) {
            console.log(`\n=== ${name} (${address}) ===`);
            try {
                const bytecode = await this.getContractBytecode(address);
                const signatures = this.extractFunctionSelectors(bytecode);
                results[name] = signatures;
                
                console.log(`検出された関数: ${signatures.length}個`);
                signatures.forEach(sig => {
                    if (sig.signature) {
                        console.log(`   ${sig.selector}: ${sig.signature}`);
                    }
                });
            } catch (error) {
                console.error(`   エラー: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // 差分分析
        console.log("\n\n🔄 差分分析:");
        const names = Object.keys(results);
        for (let i = 0; i < names.length - 1; i++) {
            for (let j = i + 1; j < names.length; j++) {
                const name1 = names[i];
                const name2 = names[j];
                const result1 = results[name1];
                const result2 = results[name2];
                
                if (result1 && result2) {
                    const sigs1 = new Set(result1.map((s: FunctionSignature) => s.selector));
                    const sigs2 = new Set(result2.map((s: FunctionSignature) => s.selector));
                    
                    const unique1 = [...sigs1].filter(s => !sigs2.has(s));
                    const unique2 = [...sigs2].filter(s => !sigs1.has(s));
                
                    if (unique1.length > 0 || unique2.length > 0) {
                        console.log(`\n${name1} vs ${name2}:`);
                        if (unique1.length > 0) {
                            console.log(`   ${name1}のみ: ${unique1.join(", ")}`);
                        }
                        if (unique2.length > 0) {
                            console.log(`   ${name2}のみ: ${unique2.join(", ")}`);
                        }
                    }
                }
            }
        }
    }
}

// CLI実行
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log("使用方法:");
        console.log("  ts-node bytecode-analyzer.ts <address> [--rpc <url>]");
        console.log("  ts-node bytecode-analyzer.ts --compare");
        console.log("\n例:");
        console.log("  ts-node bytecode-analyzer.ts 0x03A918028f22D9E1473B7959C927AD7425A45C7C");
        console.log("  ts-node bytecode-analyzer.ts --compare");
        return;
    }
    
    const rpcUrlIndex = args.indexOf("--rpc");
    const rpcUrl = rpcUrlIndex !== -1 && args[rpcUrlIndex + 1] 
        ? args[rpcUrlIndex + 1] 
        : "https://rpc.hyperliquid.xyz/evm";
    
    const analyzer = new BytecodeAnalyzer(rpcUrl);
    
    if (args[0] === "--compare") {
        // HyperSwap V3のQuoter比較
        const contracts = {
            "QuoterV1": "0xF865716B90f09268fF12B6B620e14bEC390B8139",
            "QuoterV2": "0x03A918028f22D9E1473B7959C927AD7425A45C7C",
        };
        
        await analyzer.compareContracts(contracts);
    } else {
        // 単一コントラクト分析
        const address = args[0];
        if (address) {
            await analyzer.analyzeContract(address);
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
}

export { BytecodeAnalyzer };