// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IWormhole.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Issuer is Ownable, ReentrancyGuard {
    IWormhole public immutable wormhole;
    address public targetMirrorContract;
    mapping(bytes32 => address) public cidIssuer;
    mapping(bytes32 => bool) public isRevoked;
    mapping(bytes32 => bool) public contentHashIssued;

    event LogCredentialIssued(address indexed issuer, string cid, bytes32 indexed cidHash);
    event CrossChainMessageEmitted(uint64 sequence);
    event CredentialRevoked(bytes32 indexed cidHash);

    constructor(address _wormholeCoreBridge, address initialOwner) Ownable(initialOwner) {
        wormhole = IWormhole(_wormholeCoreBridge);
    }

    function setMirrorContract(address _targetMirror) external onlyOwner nonReentrant {
        require(_targetMirror != address(0), "Cannot set mirror to the zero address");
        targetMirrorContract = _targetMirror;
    }

    function issueCredential(string calldata _cid, bytes32 _contentHash) external payable nonReentrant {
        // Get the fee and pass it into the internal function
        uint256 messageFee = wormhole.messageFee();
        require(msg.value >= messageFee, "Insufficient value for message fee");
        _issueSingleCredential(_cid, _contentHash, messageFee);
    }

    function batchIssueCredentials(string[] calldata _cids, bytes32[] calldata _contentHashes) external payable nonReentrant {
        require(_cids.length > 0, "Empty CIDs array");
        require(_cids.length <= 50, "Too many CIDs in batch");
        require(_cids.length == _contentHashes.length, "CIDs and content hashes arrays must have same length");
        
        uint256 messageFee = wormhole.messageFee();
        uint256 totalCost = messageFee * _cids.length;
        require(msg.value >= totalCost, "Insufficient value for batch message fees");

        for (uint256 i = 0; i < _cids.length; i++) {
            // Pass the fee into the internal function for each iteration
            _issueSingleCredential(_cids[i], _contentHashes[i], messageFee);
        }
    }

    function revokeCredential(string calldata _cid) external onlyOwner nonReentrant {
        bytes32 cidHash = keccak256(abi.encodePacked(_cid));
        require(cidIssuer[cidHash] != address(0), "Credential does not exist");
        require(!isRevoked[cidHash], "Credential already revoked");
        isRevoked[cidHash] = true;
        emit CredentialRevoked(cidHash);
    }

    function _issueSingleCredential(string calldata _cid, bytes32 _contentHash, uint256 _messageFee) internal {
        require(!contentHashIssued[_contentHash], "Credential for this content already issued");
        bytes32 cidHash = keccak256(abi.encodePacked(_cid));
        require(cidIssuer[cidHash] == address(0), "Credential already issued for this CID");
        contentHashIssued[_contentHash] = true;
        cidIssuer[cidHash] = msg.sender;
        
        bytes memory payload = abi.encode(msg.sender, cidHash);
        
        uint64 sequence = wormhole.publishMessage{value: _messageFee}(0, payload, 1);
        
        emit LogCredentialIssued(msg.sender, _cid, cidHash);
        emit CrossChainMessageEmitted(sequence);
    }
}