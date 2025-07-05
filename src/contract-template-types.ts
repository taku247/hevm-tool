// 汎用コントラクトテンプレート用の型定義

export interface ContractCallOptions {
  gasLimit?: string | number;
  gasPrice?: string | number;
  maxFeePerGas?: string | number;
  maxPriorityFeePerGas?: string | number;
  value?: string | number;
}

export interface ReadCallConfig {
  abiPath?: string;
  abi?: any[];
  contractAddress: string;
  functionName: string;
  args: any[];
  blockTag?: string | number;
}

export interface WriteCallConfig {
  abiPath?: string;
  abi?: any[];
  contractAddress: string;
  functionName: string;
  args: any[];
  options?: ContractCallOptions;
  waitForConfirmation?: boolean;
  confirmations?: number;
}

export interface ContractReadResult {
  success: boolean;
  contractAddress: string;
  functionName: string;
  args: any[];
  result?: any;
  blockNumber?: number;
  timestamp: string;
  error?: string;
}

export interface ContractWriteResult {
  success: boolean;
  contractAddress: string;
  functionName: string;
  args: any[];
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  effectiveGasPrice?: string;
  timestamp: string;
  error?: string;
}

export interface BatchCallConfig {
  calls: (ReadCallConfig | WriteCallConfig)[];
  stopOnError?: boolean;
}

export interface BatchCallResult {
  success: boolean;
  results: (ContractReadResult | ContractWriteResult)[];
  totalExecuted: number;
  totalFailed: number;
  timestamp: string;
  error?: string;
}

export interface ContractDeployConfig {
  abiPath?: string;
  abi?: any[];
  bytecode: string;
  constructorArgs?: any[];
  options?: ContractCallOptions;
  waitForConfirmation?: boolean;
}

export interface ContractEventFilter {
  contractAddress: string;
  abiPath?: string;
  abi?: any[];
  eventName: string;
  fromBlock?: number | string;
  toBlock?: number | string;
  topics?: string[];
}

export interface EventLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  removed: boolean;
  args?: any;
  event?: string;
}

export interface ContractEventResult {
  success: boolean;
  contractAddress: string;
  eventName: string;
  events: EventLog[];
  fromBlock: number | string;
  toBlock: number | string;
  timestamp: string;
  error?: string;
}