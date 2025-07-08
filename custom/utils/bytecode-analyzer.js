#!/usr/bin/env node

/**
 * バイトコード解析ユーティリティ
 * コントラクトのバイトコードから関数セレクタを抽出
 */

const { ethers } = require('ethers');

class BytecodeAnalyzer {
  constructor(rpcUrl) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.knownSelectors = this.loadKnownSelectors();
  }

  loadKnownSelectors() {
    const selectors = new Map();
    
    // Uniswap V2 Router
    selectors.set('0xd06ca61f', 'getAmountsOut(uint256,address[])');
    selectors.set('0x1f00ca74', 'getAmountsIn(uint256,address[])');
    selectors.set('0xad5c4648', 'WETH()');
    selectors.set('0xc45a0155', 'factory()');
    selectors.set('0x38ed1739', 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)');
    selectors.set('0x8803dbee', 'swapTokensForExactTokens(uint256,uint256,address[],address,uint256)');
    selectors.set('0x7ff36ab5', 'swapExactETHForTokens(uint256,address[],address,uint256)');
    selectors.set('0x4a25d94a', 'swapTokensForExactETH(uint256,uint256,address[],address,uint256)');
    selectors.set('0x18cbafe5', 'swapExactTokensForETH(uint256,uint256,address[],address,uint256)');
    selectors.set('0xfb3bdb41', 'swapETHForExactTokens(uint256,address[],address,uint256)');
    
    // Uniswap V3 SwapRouter
    selectors.set('0x414bf389', 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))');
    selectors.set('0xdb3e2198', 'exactOutputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))');
    selectors.set('0xc04b8d59', 'exactInput((bytes,address,uint256,uint256,uint256))');
    selectors.set('0xf28c0498', 'exactOutput((bytes,address,uint256,uint256,uint256))');
    
    // QuoterV2
    selectors.set('0xc6a5026a', 'quoteExactInputSingle((address,address,uint256,uint24,uint160))');
    selectors.set('0xbd21704a', 'quoteExactOutputSingle(address,address,uint24,uint256,uint160)');
    selectors.set('0xcdca1753', 'quoteExactInput(bytes,uint256)');
    selectors.set('0x2f80bb1d', 'quoteExactOutput(bytes,uint256)');
    
    // Factory
    selectors.set('0xe6a43905', 'getPair(address,address)');
    selectors.set('0x1e3dd18b', 'allPairs(uint256)');
    selectors.set('0x574f2ba3', 'allPairsLength()');
    selectors.set('0xc9c65396', 'createPair(address,address)');
    
    // ERC20
    selectors.set('0x70a08231', 'balanceOf(address)');
    selectors.set('0x18160ddd', 'totalSupply()');
    selectors.set('0xa9059cbb', 'transfer(address,uint256)');
    selectors.set('0x23b872dd', 'transferFrom(address,address,uint256)');
    selectors.set('0x095ea7b3', 'approve(address,uint256)');
    selectors.set('0xdd62ed3e', 'allowance(address,address)');
    
    // Common
    selectors.set('0x8da5cb5b', 'owner()');
    selectors.set('0x06fdde03', 'name()');
    selectors.set('0x95d89b41', 'symbol()');
    selectors.set('0x313ce567', 'decimals()');
    
    return selectors;
  }

  async getContractBytecode(address) {
    const code = await this.provider.getCode(address);
    if (code === '0x') {
      throw new Error('Contract not found at address: ' + address);
    }
    return code;
  }

  extractFunctionSelectors(bytecode) {
    const signatures = [];
    const selectorPattern = /63([0-9a-f]{8})/gi;
    const matches = new Set();
    
    let match;
    while ((match = selectorPattern.exec(bytecode)) !== null) {
      const selector = '0x' + match[1];
      if (this.isValidSelector(selector)) {
        matches.add(selector);
      }
    }
    
    // PUSH4パターンも検索（63の代わりに他のパターン）
    const push4Pattern = /60e060405260043610([0-9a-f]{2,})/gi;
    const push4Match = push4Pattern.exec(bytecode);
    if (push4Match) {
      // ディスパッチャーテーブルから抽出
      const dispatcherData = push4Match[1];
      const dispatcherPattern = /([0-9a-f]{8})/g;
      let dispatchMatch;
      while ((dispatchMatch = dispatcherPattern.exec(dispatcherData)) !== null) {
        const selector = '0x' + dispatchMatch[1];
        if (this.isValidSelector(selector)) {
          matches.add(selector);
        }
      }
    }
    
    // 追加パターン: 直接的な関数セレクタ比較
    const directPattern = /7c([0-9a-f]{8})/gi;
    let directMatch;
    while ((directMatch = directPattern.exec(bytecode)) !== null) {
      const selector = '0x' + directMatch[1];
      if (this.isValidSelector(selector)) {
        matches.add(selector);
      }
    }
    
    matches.forEach(selector => {
      const signature = { selector };
      
      if (this.knownSelectors.has(selector)) {
        const sig = this.knownSelectors.get(selector);
        signature.signature = sig;
        signature.name = sig.split('(')[0];
      }
      
      signatures.push(signature);
    });
    
    return signatures;
  }

  isValidSelector(selector) {
    const num = parseInt(selector, 16);
    return num > 0x00000100 && num < 0xfffffffe;
  }

  // メインメソッド：関数シグネチャを抽出
  async extractFunctionSignatures(address) {
    const bytecode = await this.getContractBytecode(address);
    return this.extractFunctionSelectors(bytecode);
  }

  // セレクタから関数シグネチャを計算（逆算）
  calculateSelector(signature) {
    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(signature));
    return hash.slice(0, 10);
  }

  // バイトコードの詳細分析
  async analyzeBytecode(address) {
    const bytecode = await this.getContractBytecode(address);
    const signatures = this.extractFunctionSelectors(bytecode);
    
    const analysis = {
      address: address,
      bytecodeSize: bytecode.length / 2 - 1,
      functionCount: signatures.length,
      knownFunctions: signatures.filter(s => s.signature).length,
      unknownFunctions: signatures.filter(s => !s.signature).length,
      signatures: signatures,
      metadata: this.extractMetadata(bytecode)
    };
    
    return analysis;
  }

  // メタデータ抽出
  extractMetadata(bytecode) {
    const metadata = {};
    
    // Solidityバージョン
    const solidityPattern = /736f6c6343([0-9a-f]{6})/g;
    const solidityMatch = solidityPattern.exec(bytecode);
    if (solidityMatch && solidityMatch[1]) {
      const version = solidityMatch[1];
      const major = parseInt(version.substr(0, 2), 16);
      const minor = parseInt(version.substr(2, 2), 16);
      const patch = parseInt(version.substr(4, 2), 16);
      metadata.solidityVersion = `${major}.${minor}.${patch}`;
    }
    
    // プロキシパターン検出
    const proxyPatterns = [
      { pattern: '363d3d373d3d3d363d73', name: 'Minimal Proxy' },
      { pattern: '5960205180305d600039f3', name: 'Create2 Proxy' },
      { pattern: '36363d', name: 'Delegatecall Pattern' }
    ];
    
    metadata.proxyType = null;
    for (const { pattern, name } of proxyPatterns) {
      if (bytecode.includes(pattern)) {
        metadata.proxyType = name;
        break;
      }
    }
    
    return metadata;
  }
}

module.exports = { BytecodeAnalyzer };