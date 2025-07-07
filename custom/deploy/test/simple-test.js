const { expect } = require("chai");

describe("Basic Test", function () {
  it("Should run a simple test", async function () {
    expect(1 + 1).to.equal(2);
  });
  
  it("Should test string equality", async function () {
    expect("hello").to.equal("hello");
  });
});