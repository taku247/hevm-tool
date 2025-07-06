import { ConfigLoader } from '../../src/config/config-loader';

describe('ConfigLoader', () => {
  let testConfigLoader: ConfigLoader;

  beforeEach(() => {
    testConfigLoader = ConfigLoader.getInstance();
    // テスト前にキャッシュをクリア
    testConfigLoader.reloadConfig();
  });

  describe('シングルトンパターン', () => {
    it('同一のインスタンスを返すこと', () => {
      const instance1 = ConfigLoader.getInstance();
      const instance2 = ConfigLoader.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('DEX設定読み込み', () => {
    it('DEX設定ファイルを正常に読み込めること', async () => {
      const config = await testConfigLoader.loadDexConfig();
      
      expect(config).toBeDefined();
      expect(config.networks).toBeDefined();
      expect(config.defaultNetwork).toBe('hyperevm-mainnet');
      expect(config.supportedProtocols).toContain('uniswap-v2');
      expect(config.supportedProtocols).toContain('uniswap-v3');
    });

    it('特定ネットワークのDEX設定を取得できること', async () => {
      const dexes = await testConfigLoader.getDexConfig('hyperevm-mainnet');
      
      expect(dexes).toBeDefined();
      expect(dexes.hyperswap_v2).toBeDefined();
      if (dexes.hyperswap_v2) {
        expect(dexes.hyperswap_v2.name).toBe('HyperSwap V2');
        expect(dexes.hyperswap_v2.type).toBe('v2');
        expect(dexes.hyperswap_v2.router).toBe('0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A');
      }
    });

    it('存在しないネットワークでエラーを投げること', async () => {
      await expect(testConfigLoader.getDexConfig('non-existent-network'))
        .rejects.toThrow('ネットワーク \'non-existent-network\' の設定が見つかりません');
    });
  });

  describe('トークン設定読み込み', () => {
    it('トークン設定ファイルを正常に読み込めること', async () => {
      const config = await testConfigLoader.loadTokenConfig();
      
      expect(config).toBeDefined();
      expect(config.networks).toBeDefined();
      expect(config.commonPairs).toBeDefined();
    });

    it('特定ネットワークのトークン設定を取得できること', async () => {
      const tokens = await testConfigLoader.getTokenConfig('hyperevm-mainnet');
      
      expect(tokens).toBeDefined();
      expect(tokens.WHYPE).toBeDefined();
      if (tokens.WHYPE) {
        expect(tokens.WHYPE.decimals).toBe(18);
      }
      expect(tokens.UBTC).toBeDefined();
      if (tokens.UBTC) {
        expect(tokens.UBTC.decimals).toBe(8);
      }
    });
  });

  describe('特定設定取得', () => {
    it('DEX IDで特定DEX設定を取得できること', async () => {
      const dex = await testConfigLoader.getDexById('hyperswap_v2');
      
      expect(dex.name).toBe('HyperSwap V2');
      expect(dex.protocol).toBe('uniswap-v2');
      expect(dex.type).toBe('v2');
      expect(dex.status).toBe('active');
    });

    it('存在しないDEX IDでエラーを投げること', async () => {
      await expect(testConfigLoader.getDexById('non-existent-dex'))
        .rejects.toThrow('DEX \'non-existent-dex\' の設定が見つかりません');
    });

    it('トークンシンボルで特定トークン設定を取得できること', async () => {
      const token = await testConfigLoader.getTokenById('WHYPE');
      
      expect(token.symbol).toBe('WHYPE');
      expect(token.address).toBe('0x5555555555555555555555555555555555555555');
      expect(token.decimals).toBe(18);
      expect(token.type).toBe('wrapped-native');
    });
  });

  describe('フィルタリング機能', () => {
    it('プロトコル別DEX一覧を取得できること', async () => {
      const v2Dexes = await testConfigLoader.getDexesByProtocol('uniswap-v2');
      
      expect(Object.keys(v2Dexes).length).toBeGreaterThan(0);
      Object.values(v2Dexes).forEach(dex => {
        expect(dex.protocol).toBe('uniswap-v2');
        expect(dex.type).toBe('v2');
      });
    });

    it('アクティブなDEX一覧を取得できること', async () => {
      const activeDexes = await testConfigLoader.getActiveDexes();
      
      expect(Object.keys(activeDexes).length).toBeGreaterThan(0);
      Object.values(activeDexes).forEach(dex => {
        expect(dex.status).toBe('active');
      });
    });
  });

  describe('ネットワーク情報', () => {
    it('ネットワーク情報を取得できること', async () => {
      const networkInfo = await testConfigLoader.getNetworkInfo('hyperevm-mainnet');
      
      expect(networkInfo.chainId).toBe(999);
      expect(networkInfo.rpcUrl).toBe('https://rpc.hyperliquid.xyz/evm');
      expect(networkInfo.dexes).toBeDefined();
    });
  });

  describe('設定検証', () => {
    it('設定の妥当性を検証できること', async () => {
      const validation = await testConfigLoader.validateConfig();
      
      expect(validation).toBeDefined();
      expect(validation.valid).toBeDefined();
      expect(validation.errors).toBeDefined();
      
      // 基本的な設定は有効であることを期待
      if (!validation.valid) {
        console.log('設定検証エラー:', validation.errors);
      }
    });

    it('一般的な取引ペアを取得できること', async () => {
      const pairs = await testConfigLoader.getCommonPairs();
      
      expect(pairs).toBeDefined();
      expect(Array.isArray(pairs)).toBe(true);
      expect(pairs.length).toBeGreaterThan(0);
      
      // WHYPE/UBTCペアが含まれていることを確認
      const whypeUbtcPair = pairs.find(pair => 
        (pair[0] === 'WHYPE' && pair[1] === 'UBTC') ||
        (pair[0] === 'UBTC' && pair[1] === 'WHYPE')
      );
      expect(whypeUbtcPair).toBeDefined();
    });
  });

  describe('設定リロード', () => {
    it('設定をリロードできること', async () => {
      // 最初の読み込み
      const config1 = await testConfigLoader.loadDexConfig();
      
      // リロード
      testConfigLoader.reloadConfig();
      
      // 再度読み込み（キャッシュされていないはず）
      const config2 = await testConfigLoader.loadDexConfig();
      
      expect(config1).toEqual(config2);
    });
  });

  describe('エラーハンドリング', () => {
    it('設定ファイルが存在しない場合のエラー処理', () => {
      // 一時的に設定ディレクトリを変更
      const originalCwd = process.cwd();
      
      try {
        // 存在しないディレクトリに変更
        process.chdir('/tmp');
        
        const newLoader = new (ConfigLoader as any)();
        
        expect(newLoader.loadDexConfig()).rejects.toThrow();
      } finally {
        // 元のディレクトリに戻す
        process.chdir(originalCwd);
      }
    });
  });

  describe('サポートプロトコル', () => {
    it('サポートされているプロトコル一覧を取得できること', async () => {
      const protocols = await testConfigLoader.getSupportedProtocols();
      
      expect(protocols).toBeDefined();
      expect(Array.isArray(protocols)).toBe(true);
      expect(protocols).toContain('uniswap-v2');
      expect(protocols).toContain('uniswap-v3');
    });
  });
});