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
    function allowance(address owner, address spender) external view returns (uint256);
}

/**
 * @title MultiSwapDebug
 * @dev デバッグ版MultiSwap - 詳細ログと検証機能付き
 */
contract MultiSwapDebug {
    
    // HyperSwap Router addresses (testnet)
    address public constant HYPERSWAP_V2_ROUTER = 0x85aA63EB2ab9BaAA74eAd7e7f82A571d74901853;
    address public constant HYPERSWAP_V3_ROUTER01 = 0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990;
    address public constant HYPERSWAP_V3_ROUTER02 = 0x51c5958FFb3e326F8d7AA945948159f1FF27e14A;
    
    // Token addresses (testnet)
    address public constant WETH = 0xADcb2f358Eae6492F61A5F87eb8893d09391d160;
    address public constant PURR = 0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82;
    address public constant HFUN = 0x37adB2550b965851593832a6444763eeB3e1d1Ec;
    
    // デバッグイベント
    event DebugLog(string message, uint256 value1, uint256 value2);
    event DebugAddress(string message, address addr);
    event DebugBool(string message, bool value);
    event StepCompleted(string step, bool success, uint256 amount);
    event ValidationResult(string check, bool passed, string details);
    
    // エラーイベント
    event ErrorOccurred(string function_name, string error_reason, uint256 step);
    
    /**
     * @dev デバッグ版 WETH→PURR→HFUN スワップ
     */
    function executeWethToPurrToHfunDebug(
        uint256 wethAmount,
        uint256 minPurrOutput,
        uint256 minHfunOutput,
        uint256 slippageBps,
        bool useV3ForFirst
    ) external returns (uint256 finalHfunAmount) {
        
        emit DebugLog("=== MultiSwap Debug Start ===", wethAmount, slippageBps);
        emit DebugBool("Use V3 for first swap", useV3ForFirst);
        
        // Step 0: 事前バリデーション
        emit DebugLog("Step 0: Pre-validation", 0, 0);
        
        _validateInputs(wethAmount, minPurrOutput, minHfunOutput);
        emit StepCompleted("Input validation", true, 0);
        
        // Step 1: WETH残高・Allowance確認
        emit DebugLog("Step 1: Balance and allowance check", 0, 0);
        
        _validateWethBalance(msg.sender, wethAmount);
        emit StepCompleted("WETH validation", true, wethAmount);
        
        // Step 2: WETH転送
        emit DebugLog("Step 2: WETH transfer", wethAmount, 0);
        
        bool transferSuccess = IERC20(WETH).transferFrom(msg.sender, address(this), wethAmount);
        emit DebugBool("WETH transfer success", transferSuccess);
        require(transferSuccess, "WETH transfer failed");
        emit StepCompleted("WETH transfer", true, wethAmount);
        
        // Step 3: 第1スワップ (WETH → PURR)
        emit DebugLog("Step 3: First swap WETH->PURR", wethAmount, minPurrOutput);
        emit DebugBool("Using V3 for first swap", useV3ForFirst);
        
        uint256 purrAmount;
        if (useV3ForFirst) {
            purrAmount = _swapV3Debug(WETH, PURR, wethAmount, minPurrOutput, 500);
            emit StepCompleted("V3 swap WETH->PURR", true, purrAmount);
        } else {
            purrAmount = _swapV2Debug(WETH, PURR, wethAmount, minPurrOutput);
            emit StepCompleted("V2 swap WETH->PURR", true, purrAmount);
        }
        
        // Step 4: 第1スワップ結果確認
        emit DebugLog("Step 4: First swap validation", purrAmount, minPurrOutput);
        
        if (purrAmount < minPurrOutput) {
            emit ValidationResult("First swap output", false, "Insufficient PURR output");
            revert("Insufficient PURR output");
        }
        emit ValidationResult("First swap output", true, "PURR output sufficient");
        
        // Step 5: 第2スワップ (PURR → HFUN) - 固定でV2使用
        emit DebugLog("Step 5: Second swap PURR->HFUN", purrAmount, minHfunOutput);
        emit DebugBool("Using V2 for second swap", true);
        
        finalHfunAmount = _swapV2Debug(PURR, HFUN, purrAmount, minHfunOutput);
        emit StepCompleted("V2 swap PURR->HFUN", true, finalHfunAmount);
        
        // Step 6: 最終結果確認
        emit DebugLog("Step 6: Final validation", finalHfunAmount, minHfunOutput);
        
        if (finalHfunAmount < minHfunOutput) {
            emit ValidationResult("Final output", false, "Insufficient HFUN output");
            revert("Insufficient HFUN output");
        }
        emit ValidationResult("Final output", true, "HFUN output sufficient");
        
        // Step 7: HFUN転送
        emit DebugLog("Step 7: HFUN transfer", finalHfunAmount, 0);
        
        bool hfunTransferSuccess = IERC20(HFUN).transfer(msg.sender, finalHfunAmount);
        emit DebugBool("HFUN transfer success", hfunTransferSuccess);
        require(hfunTransferSuccess, "HFUN transfer failed");
        emit StepCompleted("HFUN transfer", true, finalHfunAmount);
        
        emit DebugLog("=== MultiSwap Debug Complete ===", finalHfunAmount, 0);
        return finalHfunAmount;
    }
    
    /**
     * @dev バリデーション: 入力値チェック
     */
    function _validateInputs(uint256 wethAmount, uint256 minPurrOutput, uint256 minHfunOutput) internal {
        require(wethAmount > 0, "WETH amount must be > 0");
        require(minPurrOutput > 0, "Min PURR output must be > 0");
        require(minHfunOutput > 0, "Min HFUN output must be > 0");
        emit ValidationResult("Input parameters", true, "All inputs valid");
    }
    
    /**
     * @dev バリデーション: WETH残高・Allowance
     */
    function _validateWethBalance(address user, uint256 amount) internal {
        IERC20 weth = IERC20(WETH);
        
        uint256 balance = weth.balanceOf(user);
        emit DebugLog("User WETH balance", balance, amount);
        require(balance >= amount, "Insufficient WETH balance");
        
        uint256 allowance = weth.allowance(user, address(this));
        emit DebugLog("WETH allowance", allowance, amount);
        require(allowance >= amount, "Insufficient WETH allowance");
        
        emit ValidationResult("WETH balance and allowance", true, "Sufficient WETH");
    }
    
    /**
     * @dev デバッグ版V2スワップ
     */
    function _swapV2Debug(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256 amountOut) {
        
        emit DebugAddress("V2 swap tokenIn", tokenIn);
        emit DebugAddress("V2 swap tokenOut", tokenOut);
        emit DebugLog("V2 swap amounts", amountIn, minAmountOut);
        
        IV2Router router = IV2Router(HYPERSWAP_V2_ROUTER);
        IERC20 token = IERC20(tokenIn);
        
        // 現在の残高確認
        uint256 balanceBefore = token.balanceOf(address(this));
        emit DebugLog("Contract balance before V2 approve", balanceBefore, 0);
        
        // Approve
        emit DebugLog("V2 approving router", amountIn, 0);
        bool approveSuccess = token.approve(HYPERSWAP_V2_ROUTER, amountIn);
        emit DebugBool("V2 approve success", approveSuccess);
        require(approveSuccess, "V2 approve failed");
        
        // Path準備
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        emit DebugAddress("V2 path[0]", path[0]);
        emit DebugAddress("V2 path[1]", path[1]);
        
        // スワップ実行
        uint256 deadline = block.timestamp + 300;
        emit DebugLog("V2 swap deadline", deadline, block.timestamp);
        
        uint256[] memory amounts = router.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            deadline
        );
        
        amountOut = amounts[1];
        emit DebugLog("V2 swap completed", amounts[0], amounts[1]);
        emit StepCompleted("V2 router call", true, amountOut);
        
        return amountOut;
    }
    
    /**
     * @dev デバッグ版V3スワップ
     */
    function _swapV3Debug(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee
    ) internal returns (uint256 amountOut) {
        
        emit DebugAddress("V3 swap tokenIn", tokenIn);
        emit DebugAddress("V3 swap tokenOut", tokenOut);
        emit DebugLog("V3 swap amounts", amountIn, minAmountOut);
        emit DebugLog("V3 swap fee", fee, 0);
        
        IV3Router router = IV3Router(HYPERSWAP_V3_ROUTER01);
        IERC20 token = IERC20(tokenIn);
        
        // 現在の残高確認
        uint256 balanceBefore = token.balanceOf(address(this));
        emit DebugLog("Contract balance before V3 approve", balanceBefore, 0);
        
        // Approve
        emit DebugLog("V3 approving router", amountIn, 0);
        bool v3ApproveSuccess = token.approve(HYPERSWAP_V3_ROUTER01, amountIn);
        emit DebugBool("V3 approve success", v3ApproveSuccess);
        require(v3ApproveSuccess, "V3 approve failed");
        
        // パラメータ準備
        uint256 deadline = block.timestamp + 300;
        emit DebugLog("V3 swap deadline", deadline, block.timestamp);
        
        IV3Router.ExactInputSingleParams memory params = IV3Router.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: address(this),
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });
        
        emit DebugAddress("V3 params recipient", params.recipient);
        
        // スワップ実行
        amountOut = router.exactInputSingle(params);
        emit DebugLog("V3 swap completed", amountIn, amountOut);
        emit StepCompleted("V3 router call", true, amountOut);
        
        return amountOut;
    }
    
    /**
     * @dev 残高確認用デバッグ関数
     */
    function debugBalances(address user) external view returns (
        uint256 userWeth,
        uint256 userPurr,
        uint256 userHfun,
        uint256 contractWeth,
        uint256 contractPurr,
        uint256 contractHfun,
        uint256 wethAllowance
    ) {
        userWeth = IERC20(WETH).balanceOf(user);
        userPurr = IERC20(PURR).balanceOf(user);
        userHfun = IERC20(HFUN).balanceOf(user);
        
        contractWeth = IERC20(WETH).balanceOf(address(this));
        contractPurr = IERC20(PURR).balanceOf(address(this));
        contractHfun = IERC20(HFUN).balanceOf(address(this));
        
        wethAllowance = IERC20(WETH).allowance(user, address(this));
    }
    
    /**
     * @dev 緊急時トークン回収
     */
    function recoverToken(address token, uint256 amount) external {
        require(msg.sender == tx.origin, "Only EOA");
        IERC20(token).transfer(msg.sender, amount);
    }
}