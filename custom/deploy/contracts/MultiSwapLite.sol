// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
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
    function allowance(address owner, address spender) external view returns (uint256);
}

/**
 * @title MultiSwapLite
 * @dev 軽量版MultiSwap - 重要なステップのみログ出力
 */
contract MultiSwapLite {
    
    // HyperSwap Router addresses (testnet)
    address public constant HYPERSWAP_V2_ROUTER = 0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853;
    address public constant HYPERSWAP_V3_ROUTER01 = 0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990;
    
    // Token addresses (testnet)
    address public constant WETH = 0xADcb2f358Eae6492F61A5F87eb8893d09391d160;
    address public constant PURR = 0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82;
    address public constant HFUN = 0x37adB2550b965851593832a6444763eeB3e1d1Ec;
    
    // 重要ステップのみログ
    event StepLog(string step, uint256 value);
    event SwapResult(string swap_type, uint256 input, uint256 output);
    event ErrorStep(string step, string reason);
    
    /**
     * @dev 軽量版 WETH→PURR→HFUN スワップ
     */
    function executeWethToPurrToHfun(
        uint256 wethAmount,
        uint256 minPurrOutput,
        uint256 minHfunOutput,
        bool useV3ForFirst
    ) external returns (uint256 finalHfunAmount) {
        
        emit StepLog("Start", wethAmount);
        
        // WETH転送
        bool transferSuccess = IERC20(WETH).transferFrom(msg.sender, address(this), wethAmount);
        require(transferSuccess, "WETH transfer failed");
        emit StepLog("WETH received", wethAmount);
        
        // 第1スワップ (WETH → PURR)
        uint256 purrAmount;
        if (useV3ForFirst) {
            purrAmount = _swapV3(WETH, PURR, wethAmount, minPurrOutput, 500);
            emit SwapResult("V3_WETH_PURR", wethAmount, purrAmount);
        } else {
            purrAmount = _swapV2(WETH, PURR, wethAmount, minPurrOutput);
            emit SwapResult("V2_WETH_PURR", wethAmount, purrAmount);
        }
        
        require(purrAmount >= minPurrOutput, "Insufficient PURR output");
        emit StepLog("First swap OK", purrAmount);
        
        // 第2スワップ (PURR → HFUN) - V2固定
        finalHfunAmount = _swapV2(PURR, HFUN, purrAmount, minHfunOutput);
        emit SwapResult("V2_PURR_HFUN", purrAmount, finalHfunAmount);
        
        require(finalHfunAmount >= minHfunOutput, "Insufficient HFUN output");
        emit StepLog("Second swap OK", finalHfunAmount);
        
        // HFUN転送
        bool hfunTransferSuccess = IERC20(HFUN).transfer(msg.sender, finalHfunAmount);
        require(hfunTransferSuccess, "HFUN transfer failed");
        emit StepLog("Complete", finalHfunAmount);
        
        return finalHfunAmount;
    }
    
    /**
     * @dev V2スワップ
     */
    function _swapV2(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        
        IV2Router router = IV2Router(HYPERSWAP_V2_ROUTER);
        IERC20(tokenIn).approve(HYPERSWAP_V2_ROUTER, amountIn);
        
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint256[] memory amounts = router.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            block.timestamp + 300
        );
        
        return amounts[1];
    }
    
    /**
     * @dev V3スワップ
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
     * @dev 緊急時トークン回収
     */
    function recoverToken(address token, uint256 amount) external {
        require(msg.sender == tx.origin, "Only EOA");
        IERC20(token).transfer(msg.sender, amount);
    }
}