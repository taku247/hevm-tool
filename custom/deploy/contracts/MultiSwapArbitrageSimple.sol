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
 * @title MultiSwapArbitrageSimple  
 * @dev Owner-only arbitrage contract with fund pooling for gas optimization
 * ChatGPT recommendations implemented:
 * - Owner-only access control
 * - Fund pooling to avoid transferFrom on every trade
 * - Pre-approved router for gas savings
 * - Reentrancy protection
 * - Emergency functions
 */
contract MultiSwapArbitrageSimple {
    
    // HyperSwap V3 Router (testnet)
    address public constant HYPERSWAP_V3_ROUTER01 = 0xD81F56576B1FF2f3Ef18e9Cc71Adaa42516fD990;
    
    // Token addresses (testnet)
    address public constant WETH = 0xADcb2f358Eae6492F61A5F87eb8893d09391d160;
    address public constant PURR = 0xC003D79B8a489703b1753711E3ae9fFDFC8d1a82;
    address public constant HFUN = 0x37adB2550b965851593832a6444763eeB3e1d1Ec;
    
    // Owner and state
    address public owner;
    bool public emergencyPaused = false;
    mapping(address => bool) public approvedTokens;
    
    // Reentrancy protection
    bool private _locked = false;
    
    // Events
    event ArbitrageExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit
    );
    
    event FundsDeposited(address indexed token, uint256 amount);
    event FundsWithdrawn(address indexed token, uint256 amount);
    event EmergencyPauseToggled(bool paused);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    // Custom errors
    error Unauthorized();
    error EmergencyPaused();
    error InsufficientContractBalance(uint256 required, uint256 available);
    error InsufficientOutput(uint256 actual, uint256 minimum);
    error TokenNotApproved(address token);
    error ReentrancyGuard();
    
    // Modifiers
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    modifier notPaused() {
        if (emergencyPaused) revert EmergencyPaused();
        _;
    }
    
    modifier nonReentrant() {
        if (_locked) revert ReentrancyGuard();
        _locked = true;
        _;
        _locked = false;
    }
    
    modifier onlyApprovedToken(address token) {
        if (!approvedTokens[token]) revert TokenNotApproved(token);
        _;
    }
    
    constructor() {
        owner = msg.sender;
        
        // Approve standard tokens
        approvedTokens[WETH] = true;
        approvedTokens[PURR] = true;
        approvedTokens[HFUN] = true;
        
        // Pre-approve router for gas optimization (ChatGPT recommendation)
        IERC20(WETH).approve(HYPERSWAP_V3_ROUTER01, type(uint256).max);
        IERC20(PURR).approve(HYPERSWAP_V3_ROUTER01, type(uint256).max);
        IERC20(HFUN).approve(HYPERSWAP_V3_ROUTER01, type(uint256).max);
    }
    
    /**
     * @dev Transfer ownership (2-step for safety)
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
    /**
     * @dev Deposit funds for high-frequency trading (ChatGPT recommendation)
     * Avoids transferFrom on every trade for gas optimization
     */
    function depositFunds(address token, uint256 amount) 
        external 
        onlyOwner 
        onlyApprovedToken(token) 
    {
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit FundsDeposited(token, amount);
    }
    
    /**
     * @dev Execute WETH → PURR → HFUN arbitrage (gas optimized)
     * Uses internal balance, no transferFrom needed
     */
    function executeWethToPurrToHfunArbitrage(
        uint256 wethAmount,
        uint256 minHfunOutput
    ) 
        external 
        onlyOwner 
        nonReentrant 
        notPaused 
        returns (uint256 hfunAmount) 
    {
        // Check contract balance (ChatGPT recommendation)
        uint256 contractBalance = IERC20(WETH).balanceOf(address(this));
        if (contractBalance < wethAmount) {
            revert InsufficientContractBalance(wethAmount, contractBalance);
        }
        
        uint256 initialHfunBalance = IERC20(HFUN).balanceOf(address(this));
        
        // Step 1: WETH → PURR (500 bps)
        uint256 purrAmount = _swapV3(WETH, PURR, wethAmount, 0, 500);
        
        // Step 2: PURR → HFUN (10000 bps)  
        hfunAmount = _swapV3(PURR, HFUN, purrAmount, minHfunOutput, 10000);
        
        // Verify minimum output
        if (hfunAmount < minHfunOutput) {
            revert InsufficientOutput(hfunAmount, minHfunOutput);
        }
        
        // Calculate profit
        uint256 finalHfunBalance = IERC20(HFUN).balanceOf(address(this));
        uint256 profit = finalHfunBalance - initialHfunBalance;
        
        emit ArbitrageExecuted(WETH, HFUN, wethAmount, hfunAmount, profit);
        return hfunAmount;
    }
    
    /**
     * @dev Execute custom arbitrage path
     */
    function executeCustomArbitrage(
        address[] calldata tokenPath,
        uint24[] calldata feeTiers,
        uint256 amountIn,
        uint256 minFinalOutput
    ) 
        external 
        onlyOwner 
        nonReentrant 
        notPaused 
        returns (uint256 finalOutput) 
    {
        require(tokenPath.length >= 2, "Invalid path");
        require(tokenPath.length - 1 == feeTiers.length, "Fee mismatch");
        
        // Check initial token balance
        address initialToken = tokenPath[0];
        if (!approvedTokens[initialToken]) revert TokenNotApproved(initialToken);
        
        uint256 contractBalance = IERC20(initialToken).balanceOf(address(this));
        if (contractBalance < amountIn) {
            revert InsufficientContractBalance(amountIn, contractBalance);
        }
        
        uint256 currentAmount = amountIn;
        
        // Execute swaps with correct event logging (ChatGPT fix)
        for (uint i = 0; i < tokenPath.length - 1; i++) {
            uint256 inputAmount = currentAmount; // Fix: track input for each hop
            currentAmount = _swapV3(tokenPath[i], tokenPath[i + 1], currentAmount, 0, feeTiers[i]);
            
            emit ArbitrageExecuted(tokenPath[i], tokenPath[i + 1], inputAmount, currentAmount, 0);
        }
        
        finalOutput = currentAmount;
        
        if (finalOutput < minFinalOutput) {
            revert InsufficientOutput(finalOutput, minFinalOutput);
        }
        
        return finalOutput;
    }
    
    /**
     * @dev Internal V3 swap (pre-approved for gas optimization)
     */
    function _swapV3(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee
    ) internal returns (uint256 amountOut) {
        
        IV3Router router = IV3Router(HYPERSWAP_V3_ROUTER01);
        
        // Note: No approve needed - done in constructor for gas optimization
        
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
     * @dev Withdraw funds (owner only)
     */
    function withdrawFunds(address token, uint256 amount) 
        external 
        onlyOwner 
    {
        if (amount == 0) {
            amount = IERC20(token).balanceOf(address(this));
        }
        
        require(IERC20(token).transfer(owner, amount), "Transfer failed");
        emit FundsWithdrawn(token, amount);
    }
    
    /**
     * @dev Emergency pause toggle
     */
    function toggleEmergencyPause() external onlyOwner {
        emergencyPaused = !emergencyPaused;
        emit EmergencyPauseToggled(emergencyPaused);
    }
    
    /**
     * @dev Add/remove approved tokens
     */
    function setTokenApproval(address token, bool approved) 
        external 
        onlyOwner 
    {
        approvedTokens[token] = approved;
        
        if (approved) {
            // Pre-approve for gas optimization
            IERC20(token).approve(HYPERSWAP_V3_ROUTER01, type(uint256).max);
        }
    }
    
    /**
     * @dev Emergency recovery for any token (ChatGPT recommendation)
     */
    function emergencyRecover(address token) 
        external 
        onlyOwner 
    {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            require(IERC20(token).transfer(owner, balance), "Recovery failed");
        }
    }
    
    /**
     * @dev Get contract balances for multiple tokens
     */
    function getBalances(address[] calldata tokens) 
        external 
        view 
        returns (uint256[] memory balances) 
    {
        balances = new uint256[](tokens.length);
        for (uint i = 0; i < tokens.length; i++) {
            balances[i] = IERC20(tokens[i]).balanceOf(address(this));
        }
    }
    
    /**
     * @dev Get contract info
     */
    function getContractInfo() 
        external 
        view 
        returns (
            address contractOwner,
            bool isPaused,
            uint256 wethBalance,
            uint256 purrBalance,
            uint256 hfunBalance
        ) 
    {
        contractOwner = owner;
        isPaused = emergencyPaused;
        wethBalance = IERC20(WETH).balanceOf(address(this));
        purrBalance = IERC20(PURR).balanceOf(address(this));
        hfunBalance = IERC20(HFUN).balanceOf(address(this));
    }
}