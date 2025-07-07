const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Counter", function () {
  let Counter;
  let counter;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    Counter = await ethers.getContractFactory("Counter");
    counter = await Counter.deploy();
    await counter.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(await counter.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should set the deployer as owner", async function () {
      expect(await counter.owner()).to.equal(owner.address);
    });

    it("Should initialize count to zero", async function () {
      expect(await counter.getCount()).to.equal(0);
    });
  });

  describe("Increment functionality", function () {
    it("Should increment count by 1", async function () {
      await counter.increment();
      expect(await counter.getCount()).to.equal(1);
      
      await counter.increment();
      expect(await counter.getCount()).to.equal(2);
    });

    it("Should emit Incremented event", async function () {
      await expect(counter.increment())
        .to.emit(counter, "Incremented")
        .withArgs(1, owner.address);
      
      await expect(counter.increment())
        .to.emit(counter, "Incremented")
        .withArgs(2, owner.address);
    });

    it("Should allow any address to increment", async function () {
      await counter.connect(addr1).increment();
      expect(await counter.getCount()).to.equal(1);
      
      await counter.connect(addr2).increment();
      expect(await counter.getCount()).to.equal(2);
    });

    it("Should handle multiple rapid increments", async function () {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(counter.increment());
      }
      
      await Promise.all(promises);
      expect(await counter.getCount()).to.equal(5);
    });
  });

  describe("Decrement functionality", function () {
    it("Should decrement count by 1", async function () {
      // First increment to have something to decrement
      await counter.increment();
      await counter.increment();
      await counter.increment();
      expect(await counter.getCount()).to.equal(3);
      
      await counter.decrement();
      expect(await counter.getCount()).to.equal(2);
      
      await counter.decrement();
      expect(await counter.getCount()).to.equal(1);
    });

    it("Should emit Decremented event", async function () {
      await counter.increment();
      
      await expect(counter.decrement())
        .to.emit(counter, "Decremented")
        .withArgs(0, owner.address);
    });

    it("Should revert when trying to decrement below zero", async function () {
      await expect(counter.decrement())
        .to.be.revertedWith("Cannot decrement below zero");
    });

    it("Should allow any address to decrement", async function () {
      await counter.increment();
      await counter.increment();
      
      await counter.connect(addr1).decrement();
      expect(await counter.getCount()).to.equal(1);
    });
  });

  describe("Reset functionality", function () {
    it("Should reset count to zero (owner only)", async function () {
      // Increment a few times
      await counter.increment();
      await counter.increment();
      await counter.increment();
      expect(await counter.getCount()).to.equal(3);
      
      // Reset as owner
      await counter.reset();
      expect(await counter.getCount()).to.equal(0);
    });

    it("Should emit Reset event", async function () {
      await counter.increment();
      
      await expect(counter.reset())
        .to.emit(counter, "Reset")
        .withArgs(owner.address);
    });

    it("Should revert when non-owner tries to reset", async function () {
      await expect(counter.connect(addr1).reset())
        .to.be.revertedWith("Not the owner");
    });
  });

  describe("Ownership functionality", function () {
    it("Should transfer ownership", async function () {
      await counter.transferOwnership(addr1.address);
      expect(await counter.owner()).to.equal(addr1.address);
    });

    it("Should only allow owner to transfer ownership", async function () {
      await expect(counter.connect(addr1).transferOwnership(addr2.address))
        .to.be.revertedWith("Not the owner");
    });

    it("Should reject zero address for ownership transfer", async function () {
      await expect(counter.transferOwnership(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid address");
    });

    it("Should allow new owner to use owner functions", async function () {
      // Transfer ownership
      await counter.transferOwnership(addr1.address);
      
      // Increment counter
      await counter.increment();
      await counter.increment();
      expect(await counter.getCount()).to.equal(2);
      
      // New owner should be able to reset
      await counter.connect(addr1).reset();
      expect(await counter.getCount()).to.equal(0);
      
      // Old owner should not be able to reset
      await expect(counter.connect(owner).reset())
        .to.be.revertedWith("Not the owner");
    });
  });

  describe("Gas usage", function () {
    it("Should have reasonable gas costs for increment", async function () {
      const gasEstimate = await counter.increment.estimateGas();
      expect(Number(gasEstimate)).to.be.lessThan(100000);
    });

    it("Should have reasonable gas costs for decrement", async function () {
      await counter.increment();
      const gasEstimate = await counter.decrement.estimateGas();
      expect(Number(gasEstimate)).to.be.lessThan(100000);
    });

    it("Should have minimal gas for getCount", async function () {
      const gasEstimate = await counter.getCount.estimateGas();
      expect(Number(gasEstimate)).to.be.lessThan(30000);
    });
  });

  describe("Integration scenarios", function () {
    it("Should handle mixed increment/decrement operations", async function () {
      await counter.increment(); // count = 1
      await counter.increment(); // count = 2
      await counter.decrement(); // count = 1
      await counter.increment(); // count = 2
      await counter.increment(); // count = 3
      await counter.decrement(); // count = 2
      
      expect(await counter.getCount()).to.equal(2);
    });

    it("Should work with ownership transfer and operations", async function () {
      // Original owner increments
      await counter.increment();
      await counter.increment();
      expect(await counter.getCount()).to.equal(2);
      
      // Transfer ownership
      await counter.transferOwnership(addr1.address);
      
      // New owner can still increment/decrement
      await counter.connect(addr1).increment();
      expect(await counter.getCount()).to.equal(3);
      
      // New owner can reset
      await counter.connect(addr1).reset();
      expect(await counter.getCount()).to.equal(0);
    });

    it("Should handle edge case: reset when count is already zero", async function () {
      expect(await counter.getCount()).to.equal(0);
      
      await expect(counter.reset())
        .to.emit(counter, "Reset")
        .withArgs(owner.address);
      
      expect(await counter.getCount()).to.equal(0);
    });
  });
});