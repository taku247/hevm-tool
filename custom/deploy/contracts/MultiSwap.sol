// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Router interfaces
interface IV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
}

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
 * @title MultiSwap
 * @dev Execute multiple HyperSwap operations in a single transaction
 * Supports both V2 and V3 swaps with conditional revert logic
 */
contract MultiSwap {
    
    // HyperSwap Router addresses (testnet)
    address public constant HYPERSWAP_V2_ROUTER = 0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853;
    address public constant HYPERSWAP_V3_ROUTER01 = 0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990;
    address public constant HYPERSWAP_V3_ROUTER02 = 0x51c5958FFb3e326F8d7AA945948159f1FF27e14A;
    
    // Token addresses (testnet)
    address public constant WETH = 0xADcb2f358Eae6492F61A5F87eb8893d09391d160;
    address public constant PURR = 0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82;
    address public constant HFUN = 0x37adB2550b965851593832a6444763eeB3e1d1Ec;
    
    // Events
    event MultiSwapExecuted(
        address indexed user,
        address[] tokens,
        uint256[] amounts,
        uint256 finalOutput
    );
    
    event SwapStepCompleted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        string routerType
    );
    
    event ConditionalRevert(
        string reason,
        uint256 actualOutput,
        uint256 expectedOutput
    );
    
    // Custom errors
    error InsufficientOutput(uint256 actual, uint256 minimum);
    error InvalidTokenPath();
    error SwapFailed(string reason);
    error UnauthorizedAccess();
    
    
    /**
     * @dev Execute multiple swaps: WETH → PURR → HFUN
     * @param wethAmount Initial WETH amount to swap
     * @param minPurrOutput Minimum PURR output from first swap
     * @param minHfunOutput Minimum HFUN output from second swap  
     * @param slippageBps Slippage tolerance in basis points (100 = 1%)
     * @param useV3ForFirst Whether to use V3 for WETH→PURR swap
     */
    function executeWethToPurrToHfun(
        uint256 wethAmount,
        uint256 minPurrOutput,
        uint256 minHfunOutput,
        uint256 slippageBps,
        bool useV3ForFirst
    ) external returns (uint256 finalHfunAmount) {
        
        // Transfer WETH from user
        require(
            IERC20(WETH).transferFrom(msg.sender, address(this), wethAmount),
            "WETH transfer failed"
        );
        
        // Step 1: WETH → PURR
        uint256 purrAmount;
        if (useV3ForFirst) {
            purrAmount = _swapV3(WETH, PURR, wethAmount, minPurrOutput, 500); // 0.05% fee
            emit SwapStepCompleted(WETH, PURR, wethAmount, purrAmount, "V3");
        } else {
            purrAmount = _swapV2(WETH, PURR, wethAmount, minPurrOutput);
            emit SwapStepCompleted(WETH, PURR, wethAmount, purrAmount, "V2");
        }
        
        // Conditional check after first swap
        if (purrAmount < minPurrOutput) {
            emit ConditionalRevert("Insufficient PURR output", purrAmount, minPurrOutput);
            revert InsufficientOutput(purrAmount, minPurrOutput);
        }
        
        // Step 2: PURR → HFUN (use V3 with correct 1% fee)
        finalHfunAmount = _swapV3(PURR, HFUN, purrAmount, minHfunOutput, 10000); // 1% fee
        emit SwapStepCompleted(PURR, HFUN, purrAmount, finalHfunAmount, "V3");
        
        // Final conditional check
        if (finalHfunAmount < minHfunOutput) {
            emit ConditionalRevert("Insufficient HFUN output", finalHfunAmount, minHfunOutput);
            revert InsufficientOutput(finalHfunAmount, minHfunOutput);
        }
        
        // Transfer final tokens to user
        require(
            IERC20(HFUN).transfer(msg.sender, finalHfunAmount),
            "HFUN transfer failed"
        );
        
        // Emit final event
        address[] memory tokens = new address[](3);
        tokens[0] = WETH;
        tokens[1] = PURR; 
        tokens[2] = HFUN;
        
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = wethAmount;
        amounts[1] = purrAmount;
        amounts[2] = finalHfunAmount;
        
        emit MultiSwapExecuted(msg.sender, tokens, amounts, finalHfunAmount);
        
        return finalHfunAmount;
    }
    
    /**
     * @dev Execute custom multi-swap path
     * @param tokenPath Array of token addresses [tokenA, tokenB, tokenC, ...]
     * @param amountIn Initial input amount
     * @param minFinalOutput Minimum final output amount
     * @param routerTypes Array of router types ("V2" or "V3") for each swap
     */
    function executeCustomMultiSwap(
        address[] calldata tokenPath,
        uint256 amountIn,
        uint256 minFinalOutput,
        string[] calldata routerTypes
    ) external returns (uint256 finalOutput) {
        
        require(tokenPath.length >= 2, "Invalid token path");
        require(tokenPath.length - 1 == routerTypes.length, "Router types mismatch");
        
        // Transfer initial token
        require(
            IERC20(tokenPath[0]).transferFrom(msg.sender, address(this), amountIn),
            "Initial token transfer failed"
        );
        
        uint256 currentAmount = amountIn;
        
        // Execute swaps sequentially
        for (uint i = 0; i < tokenPath.length - 1; i++) {
            address tokenIn = tokenPath[i];
            address tokenOut = tokenPath[i + 1];
            
            uint256 outputAmount;
            if (keccak256(bytes(routerTypes[i])) == keccak256(bytes("V3"))) {
                outputAmount = _swapV3(tokenIn, tokenOut, currentAmount, 0, 500);
                emit SwapStepCompleted(tokenIn, tokenOut, currentAmount, outputAmount, "V3");
            } else {
                outputAmount = _swapV2(tokenIn, tokenOut, currentAmount, 0);
                emit SwapStepCompleted(tokenIn, tokenOut, currentAmount, outputAmount, "V2");
            }
            
            currentAmount = outputAmount;
        }
        
        finalOutput = currentAmount;
        
        // Final condition check
        if (finalOutput < minFinalOutput) {
            emit ConditionalRevert("Multi-swap insufficient output", finalOutput, minFinalOutput);
            revert InsufficientOutput(finalOutput, minFinalOutput);
        }
        
        // Transfer final tokens to user
        address finalToken = tokenPath[tokenPath.length - 1];
        require(
            IERC20(finalToken).transfer(msg.sender, finalOutput),
            "Final token transfer failed"
        );
        
        emit MultiSwapExecuted(msg.sender, tokenPath, new uint256[](0), finalOutput);
        
        return finalOutput;
    }
    
    /**
     * @dev Internal V2 swap function
     */
    function _swapV2(
        address tokenIn,
        address tokenOut, 
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        
        IV2Router router = IV2Router(HYPERSWAP_V2_ROUTER);
        
        // Approve router
        IERC20(tokenIn).approve(HYPERSWAP_V2_ROUTER, amountIn);
        
        // Prepare path
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        // Execute swap
        uint256[] memory amounts = router.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            block.timestamp + 300 // 5 minutes deadline
        );
        
        return amounts[1];
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
        
        // Prepare params
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
        return router.exactInputSingle(params);
    }
    
    /**
     * @dev Get estimated output for WETH → PURR → HFUN path
     */
    function getEstimatedOutput(
        uint256 wethAmount,
        bool useV3ForFirst
    ) external view returns (uint256 estimatedHfunOutput, uint256 estimatedPurrOutput) {
        
        // This would need to call the quoter contracts in real implementation
        // For now, return mock values
        estimatedPurrOutput = wethAmount * 1000; // Mock: 1 WETH = 1000 PURR
        estimatedHfunOutput = estimatedPurrOutput * 2; // Mock: 1 PURR = 2 HFUN
        
        return (estimatedHfunOutput, estimatedPurrOutput);
    }
    
    /**
     * @dev Emergency function to recover stuck tokens
     */
    function recoverToken(address token, uint256 amount) external {
        require(msg.sender == tx.origin, "Only EOA"); // Simple access control
        IERC20(token).transfer(msg.sender, amount);
    }
}