const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleStorage", function () {
  let SimpleStorage;
  let simpleStorage;
  let owner;
  let addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    
    SimpleStorage = await ethers.getContractFactory("SimpleStorage");
    simpleStorage = await SimpleStorage.deploy();
    await simpleStorage.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const address = await simpleStorage.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
      expect(address).to.not.equal("");
      expect(address).to.not.equal(null);
      expect(address).to.not.equal(undefined);
    });

    it("Should have correct initial state", async function () {
      const initialValue = await simpleStorage.retrieve();
      expect(initialValue).to.equal(0);
    });

    it("Should return correct version", async function () {
      const version = await simpleStorage.version();
      expect(version).to.equal("1.0.0");
    });
  });

  describe("Storage functionality", function () {
    it("Should store a value correctly", async function () {
      const valueToStore = 42;
      
      // Store the value
      const tx = await simpleStorage.store(valueToStore);
      await tx.wait();
      
      // Retrieve and verify
      const storedValue = await simpleStorage.retrieve();
      expect(storedValue).to.equal(valueToStore);
    });

    it("Should emit ValueStored event", async function () {
      const valueToStore = 123;
      
      await expect(simpleStorage.store(valueToStore))
        .to.emit(simpleStorage, "ValueStored")
        .withArgs(valueToStore, owner.address);
    });

    it("Should allow multiple updates", async function () {
      // Store first value
      await simpleStorage.store(10);
      expect(await simpleStorage.retrieve()).to.equal(10);
      
      // Store second value
      await simpleStorage.store(20);
      expect(await simpleStorage.retrieve()).to.equal(20);
      
      // Store third value
      await simpleStorage.store(30);
      expect(await simpleStorage.retrieve()).to.equal(30);
    });

    it("Should work with different callers", async function () {
      const valueFromOwner = 100;
      const valueFromAddr1 = 200;
      
      // Owner stores value
      await simpleStorage.connect(owner).store(valueFromOwner);
      expect(await simpleStorage.retrieve()).to.equal(valueFromOwner);
      
      // addr1 stores value
      await simpleStorage.connect(addr1).store(valueFromAddr1);
      expect(await simpleStorage.retrieve()).to.equal(valueFromAddr1);
    });

    it("Should handle large numbers", async function () {
      const largeNumber = ethers.parseUnits("999999999999999999999999999999", 0);
      
      await simpleStorage.store(largeNumber);
      const retrieved = await simpleStorage.retrieve();
      expect(retrieved).to.equal(largeNumber);
    });

    it("Should handle zero value", async function () {
      // Store non-zero first
      await simpleStorage.store(42);
      expect(await simpleStorage.retrieve()).to.equal(42);
      
      // Then store zero
      await simpleStorage.store(0);
      expect(await simpleStorage.retrieve()).to.equal(0);
    });
  });

  describe("Gas usage", function () {
    it("Should have reasonable gas costs", async function () {
      const valueToStore = 42;
      
      // Estimate gas for store operation
      const gasEstimate = await simpleStorage.store.estimateGas(valueToStore);
      expect(Number(gasEstimate)).to.be.lessThan(100000); // Should be well under 100k gas
      
      // Execute and check actual gas used
      const tx = await simpleStorage.store(valueToStore);
      const receipt = await tx.wait();
      expect(Number(receipt.gasUsed)).to.be.lessThan(100000);
    });

    it("Should have constant gas for retrieve", async function () {
      // Store some value first
      await simpleStorage.store(123);
      
      // Estimate gas for retrieve (view function)
      const gasEstimate = await simpleStorage.retrieve.estimateGas();
      expect(Number(gasEstimate)).to.be.lessThan(30000); // View functions use minimal gas
    });
  });

  describe("Edge cases", function () {
    it("Should handle maximum uint256 value", async function () {
      const maxUint256 = ethers.MaxUint256;
      
      await simpleStorage.store(maxUint256);
      const retrieved = await simpleStorage.retrieve();
      expect(retrieved).to.equal(maxUint256);
    });

    it("Should not fail with rapid consecutive calls", async function () {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(simpleStorage.store(i));
      }
      
      await Promise.all(promises);
      
      // The final value should be one of 0-4 (race condition)
      const finalValue = await simpleStorage.retrieve();
      expect(Number(finalValue)).to.be.at.least(0);
      expect(Number(finalValue)).to.be.at.most(4);
    });
  });
});