require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // ローカル開発用
    hardhat: {
      chainId: 31337,
      blockGasLimit: 30000000,
    },
    // HyperEVM テストネット
    hyperevm_testnet: {
      url: process.env.HYPERLIQUID_TESTNET_RPC || "https://rpc.hyperliquid-testnet.xyz/evm",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 998,
      gasPrice: 1600000000, // 1.6 Gwei
      gas: 2000000, // Small Block制限
    },
    // HyperEVM メインネット
    hyperevm: {
      url: process.env.HYPERLIQUID_RPC || "https://rpc.hyperliquid.xyz/evm",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 383,
      gasPrice: 1000000000, // 1 Gwei
      gas: 2000000, // Small Block制限
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    gasPrice: 1.6, // HyperEVM相当のガス価格
  },
  etherscan: {
    // HyperEVM用のエクスプローラー設定（将来的に）
    apiKey: {
      hyperevm_testnet: "dummy", // プレースホルダー
    },
    customChains: [
      {
        network: "hyperevm_testnet",
        chainId: 998,
        urls: {
          apiURL: "https://api.hyperliquid-testnet.xyz",
          browserURL: "https://explorer.hyperliquid-testnet.xyz"
        }
      }
    ]
  },
};