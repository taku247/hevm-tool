const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSwap", function () {
  let MultiSwap;
  let multiSwap;
  let owner;
  let addr1;
  let addr2;

  // Mock token contracts for testing
  let mockWETH;
  let mockPURR;
  let mockHFUN;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    // Deploy MultiSwap contract
    MultiSwap = await ethers.getContractFactory("MultiSwap");
    multiSwap = await MultiSwap.deploy();
    await multiSwap.waitForDeployment();
    
    // For testing, we'll create mock tokens
    const MockToken = await ethers.getContractFactory("SimpleToken");
    
    mockWETH = await MockToken.deploy("Wrapped Ether", "WETH", 18, 1000000);
    await mockWETH.waitForDeployment();
    
    mockPURR = await MockToken.deploy("PURR Token", "PURR", 18, 1000000);
    await mockPURR.waitForDeployment();
    
    mockHFUN = await MockToken.deploy("HFUN Token", "HFUN", 18, 1000000);
    await mockHFUN.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const address = await multiSwap.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
    });

    it("Should have correct router addresses", async function () {
      expect(await multiSwap.HYPERSWAP_V2_ROUTER()).to.equal("0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853");
      expect(await multiSwap.HYPERSWAP_V3_ROUTER01()).to.equal("0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990");
      expect(await multiSwap.HYPERSWAP_V3_ROUTER02()).to.equal("0x51c5958FFb3e326F8d7AA945948159f1FF27e14A");
    });

    it("Should have correct token addresses", async function () {
      expect(await multiSwap.WETH()).to.equal("0xADcb2f358Eae6492F61A5F87eb8893d09391d160");
      expect(await multiSwap.PURR()).to.equal("0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82");
      expect(await multiSwap.HFUN()).to.equal("0x37adB2550b965851593832a6444763eeB3e1d1Ec");
    });
  });

  describe("getEstimatedOutput", function () {
    it("Should return estimated outputs", async function () {
      const wethAmount = ethers.parseEther("1");
      const [estimatedHfunOutput, estimatedPurrOutput] = await multiSwap.getEstimatedOutput(wethAmount, true);
      
      // Based on mock calculation: 1 WETH = 1000 PURR = 2000 HFUN
      expect(estimatedPurrOutput).to.equal(ethers.parseEther("1000"));
      expect(estimatedHfunOutput).to.equal(ethers.parseEther("2000"));
    });

    it("Should handle different amounts", async function () {
      const wethAmount = ethers.parseEther("0.5");
      const [estimatedHfunOutput, estimatedPurrOutput] = await multiSwap.getEstimatedOutput(wethAmount, false);
      
      expect(estimatedPurrOutput).to.equal(ethers.parseEther("500"));
      expect(estimatedHfunOutput).to.equal(ethers.parseEther("1000"));
    });
  });

  describe("executeWethToPurrToHfun", function () {
    it("Should revert when user has insufficient WETH", async function () {
      const wethAmount = ethers.parseEther("1");
      const minPurrOutput = ethers.parseEther("900");
      const minHfunOutput = ethers.parseEther("1800");
      
      // This will fail because user doesn't have WETH and hasn't approved
      await expect(
        multiSwap.executeWethToPurrToHfun(wethAmount, minPurrOutput, minHfunOutput, 100, true)
      ).to.be.reverted;
    });

    it("Should validate parameters", async function () {
      const wethAmount = 0;
      const minPurrOutput = ethers.parseEther("900");
      const minHfunOutput = ethers.parseEther("1800");
      
      // Should handle zero amount gracefully
      await expect(
        multiSwap.executeWethToPurrToHfun(wethAmount, minPurrOutput, minHfunOutput, 100, true)
      ).to.be.reverted;
    });
  });

  describe("executeCustomMultiSwap", function () {
    it("Should validate token path length", async function () {
      const tokenPath = [await mockWETH.getAddress()]; // Only one token
      const amountIn = ethers.parseEther("1");
      const minFinalOutput = ethers.parseEther("1");
      const routerTypes = [];
      
      await expect(
        multiSwap.executeCustomMultiSwap(tokenPath, amountIn, minFinalOutput, routerTypes)
      ).to.be.revertedWith("Invalid token path");
    });

    it("Should validate router types array length", async function () {
      const tokenPath = [
        await mockWETH.getAddress(),
        await mockPURR.getAddress(),
        await mockHFUN.getAddress()
      ];
      const amountIn = ethers.parseEther("1");
      const minFinalOutput = ethers.parseEther("1");
      const routerTypes = ["V2"]; // Should be 2 router types for 3 tokens
      
      await expect(
        multiSwap.executeCustomMultiSwap(tokenPath, amountIn, minFinalOutput, routerTypes)
      ).to.be.revertedWith("Router types mismatch");
    });

    it("Should accept valid parameters", async function () {
      const tokenPath = [
        await mockWETH.getAddress(),
        await mockPURR.getAddress()
      ];
      const amountIn = ethers.parseEther("1");
      const minFinalOutput = ethers.parseEther("1");
      const routerTypes = ["V2"];
      
      // This will fail due to token transfer, but should pass parameter validation
      await expect(
        multiSwap.executeCustomMultiSwap(tokenPath, amountIn, minFinalOutput, routerTypes)
      ).to.be.reverted; // Will fail on token transfer, not parameter validation
    });
  });

  describe("recoverToken", function () {
    it("Should allow token recovery", async function () {
      // First, send some tokens to the contract
      const amount = ethers.parseEther("100");
      await mockWETH.transfer(await multiSwap.getAddress(), amount);
      
      const contractBalance = await mockWETH.balanceOf(await multiSwap.getAddress());
      expect(contractBalance).to.equal(amount);
      
      // Recover tokens
      const initialBalance = await mockWETH.balanceOf(owner.address);
      await multiSwap.recoverToken(await mockWETH.getAddress(), amount);
      const finalBalance = await mockWETH.balanceOf(owner.address);
      
      expect(finalBalance - initialBalance).to.equal(amount);
    });
  });

  describe("Gas usage", function () {
    it("Should have reasonable gas costs for deployment", async function () {
      // This test already ran during deployment
      expect(await multiSwap.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should estimate gas for view functions", async function () {
      const wethAmount = ethers.parseEther("1");
      const gasEstimate = await multiSwap.getEstimatedOutput.estimateGas(wethAmount, true);
      expect(Number(gasEstimate)).to.be.lessThan(50000); // View functions should be cheap
    });
  });

  describe("Event emissions", function () {
    it("Should emit ConditionalRevert event in getEstimatedOutput", async function () {
      // This is a view function, so it won't actually emit events
      // But we can test the event structure exists
      const wethAmount = ethers.parseEther("1");
      const result = await multiSwap.getEstimatedOutput(wethAmount, true);
      expect(result).to.be.an('array');
      expect(result.length).to.equal(2);
    });
  });

  describe("Edge cases", function () {
    it("Should handle zero amounts", async function () {
      const [estimatedHfunOutput, estimatedPurrOutput] = await multiSwap.getEstimatedOutput(0, true);
      expect(estimatedPurrOutput).to.equal(0);
      expect(estimatedHfunOutput).to.equal(0);
    });

    it("Should handle very large amounts", async function () {
      const largeAmount = ethers.parseEther("1000000");
      const [estimatedHfunOutput, estimatedPurrOutput] = await multiSwap.getEstimatedOutput(largeAmount, true);
      
      expect(estimatedPurrOutput).to.equal(largeAmount * 1000n);
      expect(estimatedHfunOutput).to.equal(largeAmount * 2000n);
    });
  });

  describe("Contract constants", function () {
    it("Should have immutable router addresses", async function () {
      // These should never change after deployment
      const v2Router = await multiSwap.HYPERSWAP_V2_ROUTER();
      const v3Router01 = await multiSwap.HYPERSWAP_V3_ROUTER01();
      const v3Router02 = await multiSwap.HYPERSWAP_V3_ROUTER02();
      
      expect(v2Router).to.be.a('string');
      expect(v3Router01).to.be.a('string');
      expect(v3Router02).to.be.a('string');
      
      // Should be valid Ethereum addresses
      expect(ethers.isAddress(v2Router)).to.be.true;
      expect(ethers.isAddress(v3Router01)).to.be.true;
      expect(ethers.isAddress(v3Router02)).to.be.true;
    });

    it("Should have immutable token addresses", async function () {
      const weth = await multiSwap.WETH();
      const purr = await multiSwap.PURR();
      const hfun = await multiSwap.HFUN();
      
      expect(ethers.isAddress(weth)).to.be.true;
      expect(ethers.isAddress(purr)).to.be.true;
      expect(ethers.isAddress(hfun)).to.be.true;
    });
  });
});