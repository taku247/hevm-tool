import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import {
  ReadCallConfig,
  WriteCallConfig,
  ContractReadResult,
  ContractWriteResult,
  ContractCallOptions,
  ContractDeployConfig,
  ContractEventFilter,
  ContractEventResult,
  BatchCallConfig,
  BatchCallResult
} from '../src/contract-template-types';
import { GasPriceCalculator, GasStrategy } from '../src/gas-price-utils';

/**
 * 汎用コントラクト操作ユーティリティクラス
 * どんなコントラクトにも使える汎用テンプレート
 */
export class UniversalContractUtils {
  private provider: ethers.providers.Provider;
  private signer?: ethers.Signer;
  private gasPriceCalculator: GasPriceCalculator;

  constructor(rpcUrl: string, privateKey?: string) {
    // Hyperevm用のネットワーク設定
    const network = ethers.providers.getNetwork(999);
    network.name = 'hyperevm';
    
    this.provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl, network);
    this.gasPriceCalculator = new GasPriceCalculator(this.provider);
    
    if (privateKey && privateKey !== '0x' + '0'.repeat(64)) {
      this.signer = new ethers.Wallet(privateKey, this.provider);
    }
  }

  /**
   * ABIファイルを読み込む
   */
  private loadABI(abiPath: string): any[] {
    try {
      const fullPath = path.resolve(abiPath);
      const abiContent = fs.readFileSync(fullPath, 'utf-8');
      return JSON.parse(abiContent);
    } catch (error: any) {
      throw new Error(`Failed to load ABI from ${abiPath}: ${error.message}`);
    }
  }

  /**
   * READ関数を実行（view/pure関数用）
   */
  async callReadFunction(config: ReadCallConfig): Promise<ContractReadResult> {
    try {
      const abi = config.abi || this.loadABI(config.abiPath!);
      const contract = new ethers.Contract(config.contractAddress, abi, this.provider);

      // ブロック指定での呼び出し
      const overrides = config.blockTag ? { blockTag: config.blockTag } : {};
      
      const result = await contract[config.functionName](...config.args, overrides);
      
      // ブロック番号を取得
      const blockNumber = await this.provider.getBlockNumber();

      return {
        success: true,
        contractAddress: config.contractAddress,
        functionName: config.functionName,
        args: config.args,
        result: this.serializeResult(result),
        blockNumber,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        contractAddress: config.contractAddress,
        functionName: config.functionName,
        args: config.args,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * WRITE関数を実行（state変更関数用）
   */
  async callWriteFunction(config: WriteCallConfig): Promise<ContractWriteResult> {
    try {
      if (!this.signer) {
        throw new Error('Private key required for write operations');
      }

      const abi = config.abi || this.loadABI(config.abiPath!);
      const contract = new ethers.Contract(config.contractAddress, abi, this.signer);

      // ガスオプションの設定
      const txOptions = this.buildTransactionOptions(config.options);

      const tx = await contract[config.functionName](...config.args, txOptions);
      
      let receipt;
      if (config.waitForConfirmation !== false) {
        receipt = await tx.wait(config.confirmations || 1);
      }

      return {
        success: true,
        contractAddress: config.contractAddress,
        functionName: config.functionName,
        args: config.args,
        transactionHash: tx.hash,
        blockNumber: receipt?.blockNumber,
        gasUsed: receipt?.gasUsed?.toString(),
        effectiveGasPrice: receipt?.effectiveGasPrice?.toString(),
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        contractAddress: config.contractAddress,
        functionName: config.functionName,
        args: config.args,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * コントラクトをデプロイ
   */
  async deployContract(config: ContractDeployConfig): Promise<ContractWriteResult> {
    try {
      if (!this.signer) {
        throw new Error('Private key required for contract deployment');
      }

      const abi = config.abi || this.loadABI(config.abiPath!);
      const factory = new ethers.ContractFactory(abi, config.bytecode, this.signer);

      const txOptions = this.buildTransactionOptions(config.options);
      const contract = await factory.deploy(...(config.constructorArgs || []), txOptions);
      
      let receipt;
      if (config.waitForConfirmation !== false) {
        receipt = await contract.deployed();
      }

      return {
        success: true,
        contractAddress: contract.address,
        functionName: 'constructor',
        args: config.constructorArgs || [],
        transactionHash: contract.deployTransaction.hash,
        blockNumber: receipt?.deployTransaction?.blockNumber,
        gasUsed: receipt?.deployTransaction?.gasUsed?.toString(),
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        contractAddress: '',
        functionName: 'constructor',
        args: config.constructorArgs || [],
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * イベントログを取得
   */
  async getContractEvents(filter: ContractEventFilter): Promise<ContractEventResult> {
    try {
      const abi = filter.abi || this.loadABI(filter.abiPath!);
      const contract = new ethers.Contract(filter.contractAddress, abi, this.provider);

      const eventFilter = contract.filters[filter.eventName]();
      const events = await contract.queryFilter(
        eventFilter,
        filter.fromBlock || 0,
        filter.toBlock || 'latest'
      );

      return {
        success: true,
        contractAddress: filter.contractAddress,
        eventName: filter.eventName,
        events: events.map(event => ({
          address: event.address,
          topics: event.topics,
          data: event.data,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          transactionIndex: event.transactionIndex,
          logIndex: event.logIndex,
          removed: event.removed,
          args: event.args,
          event: event.event
        })),
        fromBlock: filter.fromBlock || 0,
        toBlock: filter.toBlock || 'latest',
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        contractAddress: filter.contractAddress,
        eventName: filter.eventName,
        events: [],
        fromBlock: filter.fromBlock || 0,
        toBlock: filter.toBlock || 'latest',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * バッチ実行（複数の関数を順次実行）
   */
  async executeBatch(config: BatchCallConfig): Promise<BatchCallResult> {
    const results: (ContractReadResult | ContractWriteResult)[] = [];
    let totalExecuted = 0;
    let totalFailed = 0;

    try {
      for (const call of config.calls) {
        try {
          let result;
          
          if ('waitForConfirmation' in call || call.functionName.includes('write') || call.functionName.includes('set')) {
            // Write operation
            result = await this.callWriteFunction(call as WriteCallConfig);
          } else {
            // Read operation
            result = await this.callReadFunction(call as ReadCallConfig);
          }

          results.push(result);
          totalExecuted++;

          if (!result.success) {
            totalFailed++;
            if (config.stopOnError) {
              break;
            }
          }
        } catch (error: any) {
          totalFailed++;
          results.push({
            success: false,
            contractAddress: call.contractAddress,
            functionName: call.functionName,
            args: call.args,
            error: error.message,
            timestamp: new Date().toISOString()
          } as ContractReadResult);

          if (config.stopOnError) {
            break;
          }
        }
      }

      return {
        success: totalFailed === 0,
        results,
        totalExecuted,
        totalFailed,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        results,
        totalExecuted,
        totalFailed,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * コントラクトの基本情報を取得
   */
  async getContractInfo(contractAddress: string): Promise<any> {
    try {
      const code = await this.provider.getCode(contractAddress);
      const balance = await this.provider.getBalance(contractAddress);
      
      return {
        address: contractAddress,
        hasCode: code !== '0x',
        codeSize: (code.length - 2) / 2, // Remove 0x and divide by 2
        balance: ethers.utils.formatEther(balance),
        balanceWei: balance.toString()
      };
    } catch (error: any) {
      throw new Error(`Failed to get contract info: ${error.message}`);
    }
  }

  /**
   * ガス見積もりを取得
   */
  async estimateGas(config: WriteCallConfig): Promise<string> {
    try {
      if (!this.signer) {
        throw new Error('Private key required for gas estimation');
      }

      const abi = config.abi || this.loadABI(config.abiPath!);
      const contract = new ethers.Contract(config.contractAddress, abi, this.signer);

      const gasEstimate = await contract.estimateGas[config.functionName](...config.args);
      return gasEstimate.toString();
    } catch (error: any) {
      throw new Error(`Gas estimation failed: ${error.message}`);
    }
  }

  /**
   * 現在のネットワークガス価格を分析
   */
  async analyzeCurrentGasPrices() {
    return await this.gasPriceCalculator.analyzeNetworkGasPrices();
  }

  /**
   * 指定された戦略に基づいてガス価格を取得
   */
  async getOptimalGasPrice(strategy: GasStrategy = 'standard') {
    return await this.gasPriceCalculator.getOptimalGasSettings(strategy);
  }

  /**
   * 動的ガス価格を使用してWRITE関数を実行
   */
  async callWriteFunctionWithDynamicGas(
    config: WriteCallConfig,
    gasStrategy: GasStrategy = 'standard'
  ): Promise<ContractWriteResult> {
    try {
      if (!this.signer) {
        throw new Error('Private key required for write operations');
      }

      // 動的ガス価格を取得
      const optimalGas = await this.getOptimalGasPrice(gasStrategy);
      
      // 既存のガスオプションと動的ガス価格をマージ
      const dynamicGasOptions: ContractCallOptions = {
        ...config.options,
        ...(optimalGas.recommended === 'eip1559' 
          ? {
              maxFeePerGas: optimalGas.eip1559.maxFeePerGas,
              maxPriorityFeePerGas: optimalGas.eip1559.maxPriorityFeePerGas
            }
          : {
              gasPrice: optimalGas.legacy.gasPrice
            }
        )
      };

      // 更新された設定でWRITE関数を実行
      const updatedConfig: WriteCallConfig = {
        ...config,
        options: dynamicGasOptions
      };

      return await this.callWriteFunction(updatedConfig);
    } catch (error: any) {
      return {
        success: false,
        contractAddress: config.contractAddress,
        functionName: config.functionName,
        args: config.args,
        error: `Dynamic gas calculation failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * トランザクション手数料を事前計算
   */
  async estimateTransactionCost(
    config: WriteCallConfig,
    gasStrategy: GasStrategy = 'standard'
  ): Promise<{
    gasLimit: string;
    gasPrice: string;
    totalCostWei: string;
    totalCostEth: string;
    totalCostGwei: string;
    strategy: GasStrategy;
    networkStatus: string;
  }> {
    try {
      // ガス使用量を見積もり
      const gasLimit = await this.estimateGas(config);
      
      // 動的ガス価格を取得
      const optimalGas = await this.getOptimalGasPrice(gasStrategy);
      const analysis = await this.analyzeCurrentGasPrices();
      
      const gasPrice = optimalGas.recommended === 'eip1559' 
        ? optimalGas.eip1559.maxFeePerGas 
        : optimalGas.legacy.gasPrice;

      // コストを計算
      const cost = this.gasPriceCalculator.estimateTransactionCost(
        parseInt(gasLimit),
        gasPrice
      );

      return {
        gasLimit,
        gasPrice,
        totalCostWei: cost.costWei,
        totalCostEth: cost.costEth,
        totalCostGwei: cost.costGwei,
        strategy: gasStrategy,
        networkStatus: analysis.networkCongestion
      };
    } catch (error: any) {
      throw new Error(`Transaction cost estimation failed: ${error.message}`);
    }
  }

  /**
   * プライベートメソッド: トランザクションオプションを構築
   */
  private buildTransactionOptions(options?: ContractCallOptions): any {
    if (!options) return {};

    const txOptions: any = {};

    if (options.gasLimit) {
      txOptions.gasLimit = ethers.BigNumber.from(options.gasLimit);
    }
    if (options.gasPrice) {
      txOptions.gasPrice = ethers.BigNumber.from(options.gasPrice);
    }
    if (options.maxFeePerGas) {
      txOptions.maxFeePerGas = ethers.BigNumber.from(options.maxFeePerGas);
    }
    if (options.maxPriorityFeePerGas) {
      txOptions.maxPriorityFeePerGas = ethers.BigNumber.from(options.maxPriorityFeePerGas);
    }
    if (options.value) {
      txOptions.value = ethers.utils.parseEther(options.value.toString());
    }

    return txOptions;
  }

  /**
   * プライベートメソッド: 結果をシリアライズ
   */
  private serializeResult(result: any): any {
    if (ethers.BigNumber.isBigNumber(result)) {
      return result.toString();
    }
    if (Array.isArray(result)) {
      return result.map(item => this.serializeResult(item));
    }
    if (typeof result === 'object' && result !== null) {
      const serialized: any = {};
      for (const [key, value] of Object.entries(result)) {
        serialized[key] = this.serializeResult(value);
      }
      return serialized;
    }
    return result;
  }
}