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
 * @title MultiSwapV3Only
 * @dev V3のみ使用版MultiSwap - V2問題を迂回
 */
contract MultiSwapV3Only {
    
    // HyperSwap V3 Router (testnet)
    address public constant HYPERSWAP_V3_ROUTER01 = 0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990;
    
    // Token addresses (testnet)
    address public constant WETH = 0xADcb2f358Eae6492F61A5F87eb8893d09391d160;
    address public constant PURR = 0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82;
    address public constant HFUN = 0x37adB2550b965851593832a6444763eeB3e1d1Ec;
    
    // イベント
    event MultiSwapExecuted(uint256 wethIn, uint256 purrOut, uint256 hfunOut);
    event SwapCompleted(string stage, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    
    /**
     * @dev V3のみ使用 WETH→PURR→HFUN スワップ
     */
    function executeWethToPurrToHfunV3Only(
        uint256 wethAmount,
        uint256 minPurrOutput,
        uint256 minHfunOutput,
        uint24 firstFee,   // WETH/PURR プールのfee (通常500)
        uint24 secondFee   // PURR/HFUN プールのfee (通常3000)
    ) external returns (uint256 finalHfunAmount) {
        
        // WETH転送
        require(IERC20(WETH).transferFrom(msg.sender, address(this), wethAmount), "WETH transfer failed");
        
        // 第1スワップ (WETH → PURR) V3
        uint256 purrAmount = _swapV3(WETH, PURR, wethAmount, minPurrOutput, firstFee);
        require(purrAmount >= minPurrOutput, "Insufficient PURR output");
        emit SwapCompleted("First", WETH, PURR, wethAmount, purrAmount);
        
        // 第2スワップ (PURR → HFUN) V3
        finalHfunAmount = _swapV3(PURR, HFUN, purrAmount, minHfunOutput, secondFee);
        require(finalHfunAmount >= minHfunOutput, "Insufficient HFUN output");
        emit SwapCompleted("Second", PURR, HFUN, purrAmount, finalHfunAmount);
        
        // HFUN転送
        require(IERC20(HFUN).transfer(msg.sender, finalHfunAmount), "HFUN transfer failed");
        
        emit MultiSwapExecuted(wethAmount, purrAmount, finalHfunAmount);
        return finalHfunAmount;
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