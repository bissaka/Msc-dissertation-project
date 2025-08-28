// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IWormhole.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Mirror is Ownable, ReentrancyGuard {
    IWormhole public immutable wormhole;
    uint16 public constant SOURCE_CHAIN_ID = 10002; // Official Wormhole Chain ID for Sepolia [cite: 11]
    bytes32 public immutable trustedSourceContract;

    mapping(bytes32 => address) public cidIssuer;
    mapping(bytes32 => bool) public processedVaas; // Prevent replay attacks
    mapping(bytes32 => bool) public isRevoked;

    event CredentialReceived(address indexed originalIssuer, bytes32 indexed cidHash);
    event CredentialRevoked(bytes32 indexed cidHash);

    // Constructor uses the Core Bridge address and source contract address
    constructor(address _wormholeCoreBridge, address _sourceContract, address initialOwner) Ownable(initialOwner) {
        wormhole = IWormhole(_wormholeCoreBridge);
        trustedSourceContract = bytes32(uint256(uint160(_sourceContract)));
    }

    // Function to be called by the off-chain listener
    function receiveAndVerifyVAA(bytes calldata _vaa) external nonReentrant {
        // The VAA is parsed and verified using the Core Bridge contract
        (IWormhole.VM memory vm, bool valid, ) = wormhole.parseAndVerifyVM(_vaa);
        require(valid, "Invalid VAA");

        // Security checks
        require(vm.emitterChainId == SOURCE_CHAIN_ID, "Invalid source chain");
        require(vm.emitterAddress == trustedSourceContract, "Untrusted source contract");

        // Replay protection
        bytes32 vaaHash = keccak256(_vaa);
        require(!processedVaas[vaaHash], "VAA already processed");
        processedVaas[vaaHash] = true;

        // Decode payload and store data
        (address originalIssuer, bytes32 cidHash) = abi.decode(vm.payload, (address, bytes32));
        cidIssuer[cidHash] = originalIssuer;
        emit CredentialReceived(originalIssuer, cidHash);
    }

    /**
     * @dev Revokes a credential by the contract owner
     * @param _cid The IPFS CID of the credential to revoke
     */
    function revokeCredential(string calldata _cid) external onlyOwner nonReentrant {
        bytes32 cidHash = keccak256(abi.encodePacked(_cid));
        
        // Ensure the credential exists
        require(cidIssuer[cidHash] != address(0), "Credential does not exist");
        
        // Ensure the credential is not already revoked
        require(!isRevoked[cidHash], "Credential already revoked");
        
        // Mark the credential as revoked
        isRevoked[cidHash] = true;
        
        // Emit the revocation event
        emit CredentialRevoked(cidHash);
    }
}