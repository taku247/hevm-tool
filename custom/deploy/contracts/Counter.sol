// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Counter
 * @dev Increment and decrement a counter
 */
contract Counter {
    uint256 private count;
    address public owner;
    
    event Incremented(uint256 indexed newCount, address indexed caller);
    event Decremented(uint256 indexed newCount, address indexed caller);
    event Reset(address indexed caller);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        count = 0;
    }
    
    /**
     * @dev Increment the counter
     */
    function increment() public {
        count++;
        emit Incremented(count, msg.sender);
    }
    
    /**
     * @dev Decrement the counter
     */
    function decrement() public {
        require(count > 0, "Cannot decrement below zero");
        count--;
        emit Decremented(count, msg.sender);
    }
    
    /**
     * @dev Get current count
     * @return Current counter value
     */
    function getCount() public view returns (uint256) {
        return count;
    }
    
    /**
     * @dev Reset counter to zero (owner only)
     */
    function reset() public onlyOwner {
        count = 0;
        emit Reset(msg.sender);
    }
    
    /**
     * @dev Transfer ownership
     * @param newOwner Address of new owner
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}