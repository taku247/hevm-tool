// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SimpleStorage
 * @dev Store and retrieve a value
 */
contract SimpleStorage {
    uint256 private storedData;
    
    event ValueStored(uint256 indexed newValue, address indexed setter);
    
    /**
     * @dev Store a value
     * @param data The value to store
     */
    function store(uint256 data) public {
        storedData = data;
        emit ValueStored(data, msg.sender);
    }
    
    /**
     * @dev Retrieve the stored value
     * @return The stored value
     */
    function retrieve() public view returns (uint256) {
        return storedData;
    }
    
    /**
     * @dev Get the contract version
     * @return Version string
     */
    function version() public pure returns (string memory) {
        return "1.0.0";
    }
}