import * as fs from 'fs';
import * as path from 'path';

export interface DexFunction {
  inputs: string[];
  outputs: string[];
  description: string;
}

export interface DexConfig {
  name: string;
  protocol: string;
  router?: string;
  quoter?: string;
  swapRouter?: string;
  factory?: string;
  abi: string;
  quoteFunctions: Record<string, DexFunction>;
  swapFunctions?: Record<string, DexFunction>;
  feeRate?: number;
  feeTiers?: number[];
  type: 'v2' | 'v3' | 'stable' | 'concentrated';
  status: 'active' | 'deprecated' | 'testing';
}

export interface TokenConfig {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  type: 'native' | 'wrapped-native' | 'erc20' | 'stablecoin' | 'bridged';
  wrappedToken?: string;
  originalChain?: string;
  coingeckoId?: string;
  category: string;
  note?: string;
}

export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  dexes: Record<string, DexConfig>;
  tokens?: Record<string, TokenConfig>;
}

export interface ConfigData {
  networks: Record<string, NetworkConfig>;
  defaultNetwork: string;
  supportedProtocols: string[];
  commonPairs?: string[][];
  metadata: {
    version: string;
    lastUpdated: string;
    description: string;
  };
}

export class ConfigLoader {
  private static instance: ConfigLoader;
  private dexConfig: ConfigData | null = null;
  private tokenConfig: ConfigData | null = null;
  private configDir: string;

  private constructor() {
    // プロジェクトルートからの相対パス
    this.configDir = path.join(process.cwd(), 'config');
  }

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * DEX設定を読み込み
   */
  public async loadDexConfig(): Promise<ConfigData> {
    if (!this.dexConfig) {
      const configPath = path.join(this.configDir, 'dex-config.json');
      
      if (!fs.existsSync(configPath)) {
        throw new Error(`DEX設定ファイルが見つかりません: ${configPath}`);
      }

      const configData = fs.readFileSync(configPath, 'utf-8');
      this.dexConfig = JSON.parse(configData);
    }

    if (!this.dexConfig) {
      throw new Error('DEX設定の読み込みに失敗しました');
    }

    return this.dexConfig;
  }

  /**
   * トークン設定を読み込み
   */
  public async loadTokenConfig(): Promise<ConfigData> {
    if (!this.tokenConfig) {
      const configPath = path.join(this.configDir, 'token-config.json');
      
      if (!fs.existsSync(configPath)) {
        throw new Error(`トークン設定ファイルが見つかりません: ${configPath}`);
      }

      const configData = fs.readFileSync(configPath, 'utf-8');
      this.tokenConfig = JSON.parse(configData);
    }

    if (!this.tokenConfig) {
      throw new Error('トークン設定の読み込みに失敗しました');
    }

    return this.tokenConfig;
  }

  /**
   * 指定ネットワークのDEX設定取得
   */
  public async getDexConfig(network?: string): Promise<Record<string, DexConfig>> {
    const config = await this.loadDexConfig();
    const targetNetwork = network || config.defaultNetwork;
    
    if (!config.networks[targetNetwork]) {
      throw new Error(`ネットワーク '${targetNetwork}' の設定が見つかりません`);
    }

    return config.networks[targetNetwork].dexes;
  }

  /**
   * 指定ネットワークのトークン設定取得
   */
  public async getTokenConfig(network?: string): Promise<Record<string, TokenConfig>> {
    const dexConfig = await this.loadDexConfig();
    const tokenConfig = await this.loadTokenConfig();
    const targetNetwork = network || dexConfig.defaultNetwork;
    
    if (!tokenConfig.networks[targetNetwork]?.tokens) {
      throw new Error(`ネットワーク '${targetNetwork}' のトークン設定が見つかりません`);
    }

    return tokenConfig.networks[targetNetwork].tokens;
  }

  /**
   * 特定DEXの設定取得
   */
  public async getDexById(dexId: string, network?: string): Promise<DexConfig> {
    const dexes = await this.getDexConfig(network);
    
    if (!dexes[dexId]) {
      throw new Error(`DEX '${dexId}' の設定が見つかりません`);
    }

    return dexes[dexId];
  }

  /**
   * 特定トークンの設定取得
   */
  public async getTokenById(tokenSymbol: string, network?: string): Promise<TokenConfig> {
    const tokens = await this.getTokenConfig(network);
    
    if (!tokens[tokenSymbol]) {
      throw new Error(`トークン '${tokenSymbol}' の設定が見つかりません`);
    }

    return tokens[tokenSymbol];
  }

  /**
   * プロトコル別DEX一覧取得
   */
  public async getDexesByProtocol(protocol: string, network?: string): Promise<Record<string, DexConfig>> {
    const dexes = await this.getDexConfig(network);
    
    return Object.entries(dexes)
      .filter(([, config]) => config.protocol === protocol)
      .reduce((acc, [key, config]) => {
        acc[key] = config;
        return acc;
      }, {} as Record<string, DexConfig>);
  }

  /**
   * アクティブなDEX一覧取得
   */
  public async getActiveDexes(network?: string): Promise<Record<string, DexConfig>> {
    const dexes = await this.getDexConfig(network);
    
    return Object.entries(dexes)
      .filter(([, config]) => config.status === 'active')
      .reduce((acc, [key, config]) => {
        acc[key] = config;
        return acc;
      }, {} as Record<string, DexConfig>);
  }

  /**
   * ネットワーク情報取得
   */
  public async getNetworkInfo(network?: string): Promise<NetworkConfig> {
    const config = await this.loadDexConfig();
    const targetNetwork = network || config.defaultNetwork;
    
    if (!config.networks[targetNetwork]) {
      throw new Error(`ネットワーク '${targetNetwork}' の設定が見つかりません`);
    }

    return config.networks[targetNetwork];
  }

  /**
   * サポートされているプロトコル一覧
   */
  public async getSupportedProtocols(): Promise<string[]> {
    const config = await this.loadDexConfig();
    return config.supportedProtocols;
  }

  /**
   * 一般的な取引ペア取得
   */
  public async getCommonPairs(): Promise<string[][]> {
    const tokenConfig = await this.loadTokenConfig();
    return tokenConfig.commonPairs || [];
  }

  /**
   * 設定をリロード（キャッシュクリア）
   */
  public reloadConfig(): void {
    this.dexConfig = null;
    this.tokenConfig = null;
  }

  /**
   * 設定の検証
   */
  public async validateConfig(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const dexConfig = await this.loadDexConfig();
      const tokenConfig = await this.loadTokenConfig();

      // 基本構造チェック
      if (!dexConfig.networks || Object.keys(dexConfig.networks).length === 0) {
        errors.push('DEX設定にネットワークが定義されていません');
      }

      if (!tokenConfig.networks || Object.keys(tokenConfig.networks).length === 0) {
        errors.push('トークン設定にネットワークが定義されていません');
      }

      // ネットワーク整合性チェック
      for (const [networkId, network] of Object.entries(dexConfig.networks)) {
        if (!tokenConfig.networks[networkId]) {
          errors.push(`ネットワーク '${networkId}' のトークン設定が不足しています`);
        }

        // DEX設定の妥当性
        for (const [dexId, dex] of Object.entries(network.dexes)) {
          if (!dex.abi || !fs.existsSync(path.join(process.cwd(), dex.abi))) {
            errors.push(`DEX '${dexId}' のABIファイルが見つかりません: ${dex.abi}`);
          }

          if (dex.type === 'v2' && !dex.router) {
            errors.push(`V2 DEX '${dexId}' にrouterアドレスが設定されていません`);
          }

          if (dex.type === 'v3' && !dex.quoter) {
            errors.push(`V3 DEX '${dexId}' にquoterアドレスが設定されていません`);
          }
        }
      }

    } catch (error: any) {
      errors.push(`設定読み込みエラー: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// シングルトンインスタンスをエクスポート
export const configLoader = ConfigLoader.getInstance();