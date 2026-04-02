// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ReputationRegistry
 * @notice ERC-8004 Reputation Registry — stores and aggregates feedback signals for agents.
 */
contract ReputationRegistry {
    address public identityRegistry;

    // Feedback structure
    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        bool isRevoked;
    }

    // Per-client feedback list per agent
    // agentId => clientAddress => feedbackIndex => Feedback
    mapping(uint256 => mapping(address => mapping(uint64 => Feedback))) private _feedbacks;

    // Feedback count per client per agent
    mapping(uint256 => mapping(address => uint64)) public feedbackCount;

    // All clients who gave feedback to an agent
    mapping(uint256 => address[]) private _clients;
    mapping(uint256 => mapping(address => bool)) private _clientExists;

    event FeedbackSubmitted(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string indexed indexedTag1,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );

    event FeedbackRevoked(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 indexed feedbackIndex
    );

    modifier onlyValidAgent(uint256 agentId) {
        require(agentId > 0, "Invalid agent ID");
        _;
    }

    constructor(address _identityRegistry) {
        identityRegistry = _identityRegistry;
    }

    /**
     * @notice Submit feedback for an agent.
     * @param agentId The agent being reviewed.
     * @param value The feedback score (fixed-point).
     * @param valueDecimals Number of decimals for the value.
     * @param tag1 Optional tag for categorization.
     * @param tag2 Optional secondary tag.
     * @param endpoint Optional endpoint URI.
     * @param feedbackURI Optional URI to detailed feedback JSON.
     * @param feedbackHash Optional KECCAK-256 hash of feedbackURI content.
     */
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external onlyValidAgent(agentId) {
        require(valueDecimals <= 18, "Decimals must be <= 18");

        uint64 index = feedbackCount[agentId][msg.sender];
        feedbackCount[agentId][msg.sender] = index + 1;

        _feedbacks[agentId][msg.sender][index] = Feedback({
            value: value,
            valueDecimals: valueDecimals,
            tag1: tag1,
            tag2: tag2,
            isRevoked: false
        });

        if (!_clientExists[agentId][msg.sender]) {
            _clientExists[agentId][msg.sender] = true;
            _clients[agentId].push(msg.sender);
        }

        emit FeedbackSubmitted(
            agentId, msg.sender, index, value, valueDecimals,
            tag1, tag1, tag2, endpoint, feedbackURI, feedbackHash
        );
    }

    /**
     * @notice Revoke a previously submitted feedback.
     */
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        Feedback storage f = _feedbacks[agentId][msg.sender][feedbackIndex];
        require(!f.isRevoked, "Already revoked");
        f.isRevoked = true;

        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    /**
     * @notice Read a specific feedback entry.
     */
    function readFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex
    ) external view returns (
        int128 value,
        uint8 valueDecimals,
        string memory tag1,
        string memory tag2,
        bool isRevoked
    ) {
        Feedback storage f = _feedbacks[agentId][clientAddress][feedbackIndex];
        return (f.value, f.valueDecimals, f.tag1, f.tag2, f.isRevoked);
    }

    /**
     * @notice Get summary stats for an agent filtered by tags.
     * @param agentId The agent to query.
     * @param clientAddresses Optional filter by reviewers.
     * @param tag1 Optional tag filter.
     * @param tag2 Optional secondary tag filter.
     * @return count Number of non-revoked feedback entries.
     * @return summaryValue Sum of all non-revoked values.
     * @return summaryValueDecimals The decimals used.
     */
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (
        uint64 count,
        int128 summaryValue,
        uint8 summaryValueDecimals
    ) {
        address[] memory clients;
        if (clientAddresses.length > 0) {
            clients = clientAddresses;
        } else {
            clients = _clients[agentId];
        }

        for (uint256 i = 0; i < clients.length; i++) {
            address client = clients[i];
            uint64 cnt = feedbackCount[agentId][client];
            for (uint64 j = 0; j < cnt; j++) {
                Feedback storage f = _feedbacks[agentId][client][j];
                if (f.isRevoked) continue;
                if (bytes(tag1).length > 0 && keccak256(bytes(f.tag1)) != keccak256(bytes(tag1))) continue;
                if (bytes(tag2).length > 0 && keccak256(bytes(f.tag2)) != keccak256(bytes(tag2))) continue;
                count++;
                summaryValue += f.value;
                if (f.valueDecimals > summaryValueDecimals) {
                    summaryValueDecimals = f.valueDecimals;
                }
            }
        }
    }

    /**
     * @notice Get all clients who have given feedback to an agent.
     */
    function getClients(uint256 agentId) external view returns (address[] memory) {
        return _clients[agentId];
    }

    /**
     * @notice Get the last feedback index for a client-agent pair.
     */
    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64) {
        uint64 cnt = feedbackCount[agentId][clientAddress];
        return cnt > 0 ? cnt - 1 : 0;
    }
}
