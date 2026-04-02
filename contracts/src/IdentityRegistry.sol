// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title IdentityRegistry
 * @notice ERC-8004 Identity Registry — ERC-721 with URIStorage for agent registration.
 * Each agent is minted as an NFT with its AgentCard URI.
 */
contract IdentityRegistry is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    // Reserved metadata key for agent wallet
    string public constant AGENT_WALLET_KEY = "agentWallet";

    // Mapping: agentId => agentWallet
    mapping(uint256 => address) public agentWallets;

    // Metadata storage: agentId => key => value
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue);

    constructor() ERC721("ERC8004 Identity Registry", "AGENT8004") Ownable(msg.sender) {}

    /**
     * @notice Register a new agent with URI and optional metadata.
     * @param agentURI The URI resolving to the AgentCard JSON.
     * @param metadataKeys Array of metadata keys.
     * @param metadataValues Array of metadata values (bytes).
     * @return agentId The minted token ID.
     */
    function register(
        string calldata agentURI,
        string[] calldata metadataKeys,
        bytes[] calldata metadataValues
    ) external returns (uint256 agentId) {
        require(metadataKeys.length == metadataValues.length, "Mismatched metadata arrays");

        agentId = _nextTokenId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);

        // Set agentWallet to caller
        agentWallets[agentId] = msg.sender;
        _metadata[agentId][AGENT_WALLET_KEY] = abi.encode(msg.sender);
        emit MetadataSet(agentId, AGENT_WALLET_KEY, AGENT_WALLET_KEY, abi.encode(msg.sender));

        // Set additional metadata
        for (uint256 i = 0; i < metadataKeys.length; i++) {
            require(
                keccak256(bytes(metadataKeys[i])) != keccak256(bytes(AGENT_WALLET_KEY)),
                "agentWallet is reserved"
            );
            _metadata[agentId][metadataKeys[i]] = metadataValues[i];
            emit MetadataSet(agentId, metadataKeys[i], metadataKeys[i], metadataValues[i]);
        }

        emit Registered(agentId, agentURI, msg.sender);
    }

    /**
     * @notice Register a new agent with URI only (no extra metadata).
     */
    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _nextTokenId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);

        agentWallets[agentId] = msg.sender;
        _metadata[agentId][AGENT_WALLET_KEY] = abi.encode(msg.sender);
        emit MetadataSet(agentId, AGENT_WALLET_KEY, AGENT_WALLET_KEY, abi.encode(msg.sender));

        emit Registered(agentId, agentURI, msg.sender);
    }

    /**
     * @notice Update the agent URI.
     */
    function setAgentURI(uint256 agentId, string calldata newURI) external {
        address owner = _requireOwned(agentId);
        _checkAuthorized(owner, msg.sender, agentId);
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    /**
     * @notice Get metadata for an agent.
     */
    function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory) {
        return _metadata[agentId][metadataKey];
    }

    /**
     * @notice Set metadata for an agent.
     */
    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external {
        address owner = _requireOwned(agentId);
        _checkAuthorized(owner, msg.sender, agentId);
        require(
            keccak256(bytes(metadataKey)) != keccak256(bytes(AGENT_WALLET_KEY)),
                "agentWallet is reserved - use setAgentWallet"
        );
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    /**
     * @notice Get the agent wallet address.
     */
    function getAgentWallet(uint256 agentId) external view returns (address) {
        return agentWallets[agentId];
    }

    /**
     * @notice Total number of registered agents.
     */
    function totalAgents() external view returns (uint256) {
        return _nextTokenId;
    }

    /**
     * @dev Override to prevent burning.
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        return super._update(to, tokenId, auth);
    }

    bytes4 internal constant EIP1271_MAGIC_VALUE = 0x1626ba7e;

    /**
     * @notice EIP-1271 signature verification for smart contract wallets.
     * @dev The hash should be constructed as keccak256(abi.encodePacked(agentId, message))
     *      so the caller knows which agentId is being verified.
     * @param hash The hash that was signed.
     * @param signature The signature to verify.
     * @return magicValue EIP1271_MAGIC_VALUE if the signer owns any agentId, 0xffffffff otherwise.
     */
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4 magicValue) {
        address signer = ECDSA.recover(hash, signature);
        uint256 total = _nextTokenId;
        for (uint256 i = 0; i < total; i++) {
            if (_ownerOf(i) == signer) {
                return EIP1271_MAGIC_VALUE;
            }
        }
        return 0xffffffff;
    }
}
