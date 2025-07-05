export interface BalanceResult {
  success: boolean;
  address: string;
  balance?: string;
  balanceWei?: string;
  timestamp: string;
  error?: string;
}

export interface TransactionResult {
  success: boolean;
  transactionHash?: string;
  from: string;
  to: string;
  value: string;
  gasUsed?: string;
  timestamp: string;
  error?: string;
}

export interface ContractDeployResult {
  success: boolean;
  contractAddress?: string;
  transactionHash?: string;
  deployer: string;
  timestamp: string;
  error?: string;
}

export interface ContractCallResult {
  success: boolean;
  contractAddress: string;
  method: string;
  parameters: any[];
  result?: any;
  transactionHash?: string | null;
  timestamp: string;
  error?: string;
}

export interface ContractEventResult {
  success: boolean;
  contractAddress: string;
  eventName: string;
  events?: ContractEvent[];
  timestamp: string;
  error?: string;
}

export interface ContractEvent {
  blockNumber: number;
  transactionHash: string;
  args: any;
  timestamp: string;
}

export interface ScriptExecutionResult {
  scriptName: string;
  args: string[];
  exitCode: number;
  output: string;
  error: string;
  timestamp: string;
}

export interface ScriptDefinition {
  name: string;
  description: string;
  parameters: string[];
}

export interface WebSocketMessage {
  type: 'script_execution';
  data: ScriptExecutionResult;
}

export interface EnvironmentConfig {
  HYPEREVM_RPC_URL: string;
  PRIVATE_KEY: string;
  PORT: string;
  NODE_ENV?: string;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
}