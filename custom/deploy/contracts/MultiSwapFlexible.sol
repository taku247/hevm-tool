// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Router interfaces
interface IV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    
    function exactInputSingle(ExactInputSingleParams calldata params)
        external payable returns (uint256 amountOut);
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/**
 * @title MultiSwapFlexible
 * @dev Flexible multi-hop swaps with custom fee tiers for each hop
 */
contract MultiSwapFlexible {
    
    // HyperSwap V3 Router (testnet)
    address public constant HYPERSWAP_V3_ROUTER01 = 0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990;
    
    // Token addresses (testnet)
    address public constant WETH = 0xADcb2f358Eae6492F61A5F87eb8893d09391d160;
    address public constant PURR = 0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82;
    address public constant HFUN = 0x37adB2550b965851593832a6444763eeB3e1d1Ec;
    
    // Events
    event MultiHopExecuted(
        address indexed user,
        address[] tokenPath,
        uint24[] feeTiers,
        uint256[] amounts,
        uint256 finalAmount
    );
    
    event SwapStepCompleted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOut
    );
    
    // Custom errors
    error InsufficientOutput(uint256 actual, uint256 minimum);
    error InvalidPathLength();
    error InvalidFeeLength();
    
    /**
     * @dev Execute flexible multi-hop swap with custom fees
     * @param tokenPath Array of token addresses for the route
     * @param feeTiers Array of fee tiers for each hop (500, 3000, 10000)
     * @param amountIn Initial input amount
     * @param minFinalOutput Minimum acceptable final output
     */
    function executeFlexibleMultiHop(
        address[] calldata tokenPath,
        uint24[] calldata feeTiers,
        uint256 amountIn,
        uint256 minFinalOutput
    ) external returns (uint256 finalOutput) {
        
        // Validate inputs
        if (tokenPath.length < 2) revert InvalidPathLength();
        if (tokenPath.length - 1 != feeTiers.length) revert InvalidFeeLength();
        
        // Transfer initial token
        require(
            IERC20(tokenPath[0]).transferFrom(msg.sender, address(this), amountIn),
            "Initial token transfer failed"
        );
        
        uint256 currentAmount = amountIn;
        uint256[] memory amounts = new uint256[](tokenPath.length);
        amounts[0] = amountIn;
        
        // Execute swaps sequentially
        for (uint i = 0; i < tokenPath.length - 1; i++) {
            address tokenIn = tokenPath[i];
            address tokenOut = tokenPath[i + 1];
            uint24 fee = feeTiers[i];
            
            // Perform V3 swap with specified fee
            uint256 outputAmount = _swapV3(tokenIn, tokenOut, currentAmount, 0, fee);
            
            emit SwapStepCompleted(tokenIn, tokenOut, fee, currentAmount, outputAmount);
            
            currentAmount = outputAmount;
            amounts[i + 1] = outputAmount;
        }
        
        finalOutput = currentAmount;
        
        // Check minimum output
        if (finalOutput < minFinalOutput) {
            revert InsufficientOutput(finalOutput, minFinalOutput);
        }
        
        // Transfer final tokens to user
        address finalToken = tokenPath[tokenPath.length - 1];
        require(
            IERC20(finalToken).transfer(msg.sender, finalOutput),
            "Final token transfer failed"
        );
        
        emit MultiHopExecuted(msg.sender, tokenPath, feeTiers, amounts, finalOutput);
        
        return finalOutput;
    }
    
    /**
     * @dev Optimized WETH → PURR → HFUN with correct fees
     */
    function executeWethToPurrToHfunOptimized(
        uint256 wethAmount,
        uint256 minHfunOutput
    ) external returns (uint256 hfunAmount) {
        
        address[] memory path = new address[](3);
        path[0] = WETH;
        path[1] = PURR;
        path[2] = HFUN;
        
        uint24[] memory fees = new uint24[](2);
        fees[0] = 500;   // WETH→PURR: 0.05%
        fees[1] = 10000; // PURR→HFUN: 1%
        
        return this.executeFlexibleMultiHop(path, fees, wethAmount, minHfunOutput);
    }
    
    /**
     * @dev Internal V3 swap function
     */
    function _swapV3(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee
    ) internal returns (uint256 amountOut) {
        
        IV3Router router = IV3Router(HYPERSWAP_V3_ROUTER01);
        
        // Approve router
        IERC20(tokenIn).approve(HYPERSWAP_V3_ROUTER01, amountIn);
        
        // Prepare swap parameters
        IV3Router.ExactInputSingleParams memory params = IV3Router.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: amountIn,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });
        
        // Execute swap
        amountOut = router.exactInputSingle(params);
        
        return amountOut;
    }
    
    /**
     * @dev Emergency token recovery
     */
    function recoverToken(address token, uint256 amount) external {
        require(msg.sender == tx.origin, "Only EOA");
        IERC20(token).transfer(msg.sender, amount);
    }
}