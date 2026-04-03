// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IIdentityRegistry {
    function getAgentWallet(uint256 agentId) external view returns (address);
}

/**
 * @title RiskRouter
 * @notice Enforces risk limits on agent trade intents signed via EIP-712.
 * Verifies agent identity, signature, position sizes, daily loss, and whitelisted markets.
 */
contract RiskRouter is EIP712, Ownable {
    using ECDSA for bytes32;

    // -----------------------------------------------------------------------
    // EIP-712 domain: name="APEX", version="1", chainId=84532 (Base Sepolia)
    // -----------------------------------------------------------------------
    bytes32 private constant TRADE_INTENT_TYPEHASH = keccak256(
        "TradeIntent(string protocol,string pool,uint256 amount_usd,uint256 deadline,uint256 nonce)"
    );

    // -----------------------------------------------------------------------
    // Risk parameters
    // -----------------------------------------------------------------------
    uint256 public constant MAX_POSITION_PCT = 2000;   // 20.00% (basis points)
    uint256 public constant MAX_LEVERAGE = 5;           // 5x max leverage
    uint256 public constant BASIS_POINTS = 10000;

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    IIdentityRegistry public identityRegistry;

    mapping(address => uint256) public dailyLoss;           // agent wallet => daily loss (USD, 18 decimals)
    mapping(address => uint256) public dailyLossLimit;      // agent wallet => daily loss limit
    mapping(address => uint256) public lastCheckpointDay;   // agent wallet => last day number
    mapping(address => uint256) public usedNonces;          // agent wallet => nonce bitmap (simplified: count)
    mapping(address => bool) public authorizedAgents;       // agent wallet => authorized
    mapping(string => bool) public whitelistedProtocols;    // protocol name => allowed

    uint256 public vaultBalance;                            // total vault balance in USD (18 decimals)

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    event TradeExecuted(
        address indexed agentWallet,
        uint256 indexed agentId,
        string protocol,
        string pool,
        uint256 amountUsd,
        uint256 leverage,
        bytes32 intentHash,
        uint256 timestamp
    );

    event DailyLossLimitHit(
        address indexed agentWallet,
        uint256 indexed agentId,
        uint256 dailyLoss,
        uint256 dailyLossLimit,
        uint256 timestamp
    );

    event PositionSizeExceeded(
        address indexed agentWallet,
        uint256 indexed agentId,
        uint256 requestedAmount,
        uint256 maxAllowed,
        uint256 timestamp
    );

    event Checkpoint(
        address indexed agentWallet,
        uint256 indexed agentId,
        uint256 vaultBalance,
        uint256 dailyLoss,
        uint256 timestamp
    );

    event AgentAuthorized(address indexed agentWallet, bool authorized);
    event DailyLossLimitSet(address indexed agentWallet, uint256 limit);
    event ProtocolWhitelisted(string protocol, bool whitelisted);
    event VaultBalanceUpdated(uint256 newBalance);

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------
    constructor(
        address _identityRegistry,
        uint256 _initialVaultBalance
    ) EIP712("APEX", "1") Ownable(msg.sender) {
        require(_identityRegistry != address(0), "Invalid registry");
        identityRegistry = IIdentityRegistry(_identityRegistry);
        vaultBalance = _initialVaultBalance;

        // Default whitelisted protocols
        whitelistedProtocols["AAVE"] = true;
        whitelistedProtocols["Curve"] = true;
        whitelistedProtocols["Compound"] = true;
        whitelistedProtocols["Uniswap"] = true;
    }

    // -----------------------------------------------------------------------
    // Admin functions
    // -----------------------------------------------------------------------

    /**
     * @notice Authorize or deauthorize an agent wallet.
     */
    function setAgentAuthorized(address agentWallet, bool authorized) external onlyOwner {
        authorizedAgents[agentWallet] = authorized;
        emit AgentAuthorized(agentWallet, authorized);
    }

    /**
     * @notice Set the daily loss limit for an agent wallet.
     */
    function setDailyLossLimit(address agentWallet, uint256 limit) external onlyOwner {
        dailyLossLimit[agentWallet] = limit;
        emit DailyLossLimitSet(agentWallet, limit);
    }

    /**
     * @notice Add or remove a protocol from the whitelist.
     */
    function setProtocolWhitelisted(string calldata protocol, bool whitelisted) external onlyOwner {
        whitelistedProtocols[protocol] = whitelisted;
        emit ProtocolWhitelisted(protocol, whitelisted);
    }

    /**
     * @notice Update the vault balance.
     */
    function setVaultBalance(uint256 newBalance) external onlyOwner {
        vaultBalance = newBalance;
        emit VaultBalanceUpdated(newBalance);
    }

    // -----------------------------------------------------------------------
    // Core: submit and verify a signed trade intent
    // -----------------------------------------------------------------------

    /**
     * @notice Submit a signed trade intent for verification and execution.
     * @param agentId The agent ID from IdentityRegistry.
     * @param protocol The DeFi protocol (must be whitelisted).
     * @param pool The pool identifier.
     * @param amountUsd The trade size in USD (18 decimals).
     * @param deadline Unix timestamp after which the intent expires.
     * @param nonce Unique nonce to prevent replay.
     * @param leverage Leverage multiplier (1..MAX_LEVERAGE).
     * @param signature EIP-712 signature (r,s,v packed, 65 bytes).
     */
    function submitTradeIntent(
        uint256 agentId,
        string calldata protocol,
        string calldata pool,
        uint256 amountUsd,
        uint256 deadline,
        uint256 nonce,
        uint256 leverage,
        bytes calldata signature
    ) external returns (bool approved) {
        // 1. Resolve agent wallet from identity registry
        address agentWallet = identityRegistry.getAgentWallet(agentId);
        require(agentWallet != address(0), "Unknown agent");

        // 2. Check authorization
        require(authorizedAgents[agentWallet], "Agent not authorized");

        // 3. Verify EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                TRADE_INTENT_TYPEHASH,
                keccak256(bytes(protocol)),
                keccak256(bytes(pool)),
                amountUsd,
                deadline,
                nonce
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = digest.recover(signature);
        require(recovered == agentWallet, "Invalid signature");

        // 4. Check deadline
        require(block.timestamp <= deadline, "Intent expired");

        // 5. Check nonce (simple: nonce must be strictly increasing)
        require(nonce > usedNonces[agentWallet], "Nonce already used");
        usedNonces[agentWallet] = nonce;

        // 6. Check whitelisted protocol
        require(whitelistedProtocols[protocol], "Protocol not whitelisted");

        // 7. Check leverage
        require(leverage >= 1 && leverage <= MAX_LEVERAGE, "Invalid leverage");

        // 8. Check position size limit (max 20% of vault)
        uint256 maxPosition = (vaultBalance * MAX_POSITION_PCT) / BASIS_POINTS;
        if (amountUsd > maxPosition) {
            emit PositionSizeExceeded(agentWallet, agentId, amountUsd, maxPosition, block.timestamp);
            return false;
        }

        // 9. Check daily loss limit
        _maybeResetDaily(agentWallet);
        uint256 limit = dailyLossLimit[agentWallet];
        if (limit > 0 && dailyLoss[agentWallet] >= limit) {
            emit DailyLossLimitHit(agentWallet, agentId, dailyLoss[agentWallet], limit, block.timestamp);
            return false;
        }

        // 10. All checks passed — emit trade event
        emit TradeExecuted(agentWallet, agentId, protocol, pool, amountUsd, leverage, digest, block.timestamp);

        // 11. Emit checkpoint
        emit Checkpoint(agentWallet, agentId, vaultBalance, dailyLoss[agentWallet], block.timestamp);

        return true;
    }

    /**
     * @notice Record a loss for an agent (called by the execution layer after a trade settles).
     */
    function recordLoss(address agentWallet, uint256 lossUsd) external onlyOwner {
        _maybeResetDaily(agentWallet);
        dailyLoss[agentWallet] += lossUsd;

        uint256 limit = dailyLossLimit[agentWallet];
        if (limit > 0 && dailyLoss[agentWallet] >= limit) {
            // Resolve agentId for the event
            uint256 agentId = _findAgentId(agentWallet);
            emit DailyLossLimitHit(agentWallet, agentId, dailyLoss[agentWallet], limit, block.timestamp);
        }
    }

    /**
     * @notice Record a profit for an agent (reduces daily loss tracker).
     */
    function recordProfit(address agentWallet, uint256 profitUsd) external onlyOwner {
        _maybeResetDaily(agentWallet);
        if (profitUsd <= dailyLoss[agentWallet]) {
            dailyLoss[agentWallet] -= profitUsd;
        } else {
            dailyLoss[agentWallet] = 0;
        }
    }

    // -----------------------------------------------------------------------
    // View helpers
    // -----------------------------------------------------------------------

    /**
     * @notice Get the current day number (Unix day).
     */
    function currentDay() public view returns (uint256) {
        return block.timestamp / 1 days;
    }

    /**
     * @notice Get remaining daily loss allowance for an agent.
     */
    function remainingDailyLoss(address agentWallet) external view returns (uint256) {
        uint256 limit = dailyLossLimit[agentWallet];
        if (limit == 0) return type(uint256).max;
        return limit > dailyLoss[agentWallet] ? limit - dailyLoss[agentWallet] : 0;
    }

    /**
     * @notice Get the max allowed position size for the current vault.
     */
    function maxPositionSize() external view returns (uint256) {
        return (vaultBalance * MAX_POSITION_PCT) / BASIS_POINTS;
    }

    /**
     * @notice Check if a protocol is whitelisted.
     */
    function isProtocolWhitelisted(string calldata protocol) external view returns (bool) {
        return whitelistedProtocols[protocol];
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    /**
     * @notice Reset daily loss counter if a new day has started.
     */
    function _maybeResetDaily(address agentWallet) internal {
        uint256 today = currentDay();
        if (lastCheckpointDay[agentWallet] != today) {
            dailyLoss[agentWallet] = 0;
            lastCheckpointDay[agentWallet] = today;
        }
    }

    /**
     * @notice Find the agentId for a given wallet (linear scan — acceptable for small registries).
     */
    function _findAgentId(address agentWallet) internal view returns (uint256) {
        // We iterate a reasonable upper bound; in production this could be cached.
        for (uint256 i = 0; i < 10000; i++) {
            if (identityRegistry.getAgentWallet(i) == agentWallet) {
                return i;
            }
        }
        return 0;
    }
}
