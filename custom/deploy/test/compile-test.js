const { expect } = require("chai");
const hre = require("hardhat");

describe("Contract Compilation Test", function () {
  it("Should compile contracts successfully", async function () {
    // コンパイル実行
    await hre.run("compile");
    
    // アーティファクトディレクトリ確認
    const fs = require("fs");
    const path = require("path");
    
    const artifactsPath = path.join(__dirname, "../artifacts/contracts");
    expect(fs.existsSync(artifactsPath)).to.be.true;
    
    // 各コントラクトのアーティファクト確認
    const contracts = ["SimpleStorage.sol", "Counter.sol", "Token.sol"];
    
    for (const contract of contracts) {
      const contractPath = path.join(artifactsPath, contract);
      expect(fs.existsSync(contractPath)).to.be.true;
    }
  });
  
  it("Should verify bytecode generation", async function () {
    const fs = require("fs");
    const path = require("path");
    
    // SimpleStorageのアーティファクト確認
    const simpleStoragePath = path.join(__dirname, "../artifacts/contracts/SimpleStorage.sol/SimpleStorage.json");
    
    if (fs.existsSync(simpleStoragePath)) {
      const artifact = JSON.parse(fs.readFileSync(simpleStoragePath, "utf8"));
      
      expect(artifact.contractName).to.equal("SimpleStorage");
      expect(artifact.bytecode).to.be.a("string");
      expect(artifact.bytecode.length).to.be.greaterThan(10);
      expect(artifact.abi).to.be.an("array");
      expect(artifact.abi.length).to.be.greaterThan(0);
    }
  });
  
  it("Should have valid ABI structures", async function () {
    const fs = require("fs");
    const path = require("path");
    
    // Counterのアーティファクト確認
    const counterPath = path.join(__dirname, "../artifacts/contracts/Counter.sol/Counter.json");
    
    if (fs.existsSync(counterPath)) {
      const artifact = JSON.parse(fs.readFileSync(counterPath, "utf8"));
      
      // 関数とイベントの存在確認
      const functionNames = artifact.abi
        .filter(item => item.type === "function")
        .map(item => item.name);
      
      expect(functionNames).to.include("increment");
      expect(functionNames).to.include("decrement");
      expect(functionNames).to.include("getCount");
      expect(functionNames).to.include("reset");
      
      const eventNames = artifact.abi
        .filter(item => item.type === "event")
        .map(item => item.name);
      
      expect(eventNames).to.include("Incremented");
      expect(eventNames).to.include("Decremented");
      expect(eventNames).to.include("Reset");
    }
  });
});