// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

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
 * @title MultiSwapOptimized
 * @dev Optimized multi-hop swaps with correct fee tiers for HyperSwap testnet
 */
contract MultiSwapOptimized {
    
    // HyperSwap V3 Router (testnet)
    address public constant HYPERSWAP_V3_ROUTER01 = 0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990;
    
    // Token addresses (testnet)
    address public constant WETH = 0xADcb2f358Eae6492F61A5F87eb8893d09391d160;
    address public constant PURR = 0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82;
    address public constant HFUN = 0x37adB2550b965851593832a6444763eeB3e1d1Ec;
    
    // Events
    event MultiSwapExecuted(uint256 wethIn, uint256 purrMid, uint256 hfunOut);
    event SwapStep(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint256 amountOut);
    
    /**
     * @dev Optimized WETH → PURR → HFUN with correct fees
     * WETH→PURR: 500bps (0.05%)
     * PURR→HFUN: 10000bps (1%)
     */
    function executeWethToPurrToHfun(
        uint256 wethAmount,
        uint256 minHfunOutput
    ) external returns (uint256 hfunAmount) {
        
        // Transfer WETH from user
        require(IERC20(WETH).transferFrom(msg.sender, address(this), wethAmount), "WETH transfer failed");
        
        // Step 1: WETH → PURR (500 bps)
        uint256 purrAmount = _swapV3(WETH, PURR, wethAmount, 0, 500);
        emit SwapStep(WETH, PURR, 500, wethAmount, purrAmount);
        
        // Step 2: PURR → HFUN (10000 bps)
        hfunAmount = _swapV3(PURR, HFUN, purrAmount, minHfunOutput, 10000);
        emit SwapStep(PURR, HFUN, 10000, purrAmount, hfunAmount);
        
        // Check minimum output
        require(hfunAmount >= minHfunOutput, "Insufficient HFUN output");
        
        // Transfer HFUN to user
        require(IERC20(HFUN).transfer(msg.sender, hfunAmount), "HFUN transfer failed");
        
        emit MultiSwapExecuted(wethAmount, purrAmount, hfunAmount);
        return hfunAmount;
    }
    
    /**
     * @dev Execute flexible path with custom fees
     */
    function executeCustomPath(
        address[] calldata tokenPath,
        uint24[] calldata feeTiers,
        uint256 amountIn,
        uint256 minFinalOutput
    ) external returns (uint256 finalOutput) {
        
        require(tokenPath.length >= 2, "Invalid path");
        require(tokenPath.length - 1 == feeTiers.length, "Fee mismatch");
        
        // Transfer initial token
        require(IERC20(tokenPath[0]).transferFrom(msg.sender, address(this), amountIn), "Initial transfer failed");
        
        uint256 currentAmount = amountIn;
        
        // Execute swaps
        for (uint i = 0; i < tokenPath.length - 1; i++) {
            currentAmount = _swapV3(tokenPath[i], tokenPath[i + 1], currentAmount, 0, feeTiers[i]);
            emit SwapStep(tokenPath[i], tokenPath[i + 1], feeTiers[i], amountIn, currentAmount);
        }
        
        finalOutput = currentAmount;
        require(finalOutput >= minFinalOutput, "Insufficient output");
        
        // Transfer final token
        require(IERC20(tokenPath[tokenPath.length - 1]).transfer(msg.sender, finalOutput), "Final transfer failed");
        
        return finalOutput;
    }
    
    /**
     * @dev Internal V3 swap
     */
    function _swapV3(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee
    ) internal returns (uint256 amountOut) {
        
        IV3Router router = IV3Router(HYPERSWAP_V3_ROUTER01);
        IERC20(tokenIn).approve(HYPERSWAP_V3_ROUTER01, amountIn);
        
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
        
        return router.exactInputSingle(params);
    }
    
    /**
     * @dev Emergency recovery
     */
    function recoverToken(address token, uint256 amount) external {
        require(msg.sender == tx.origin, "Only EOA");
        IERC20(token).transfer(msg.sender, amount);
    }
}