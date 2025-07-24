// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IWormholeRelayer.sol";

contract Mirror {
    IWormholeRelayer public immutable wormholeRelayer;
    uint16 public immutable sourceChainId;
    bytes32 public immutable trustedSourceContract;

    mapping(bytes32 => address) public cidIssuer;
    event CredentialReceived(address indexed originalIssuer, bytes32 indexed cidHash);

    constructor(address _relayer, uint16 _sourceChainId, address _sourceContract) {
        wormholeRelayer = IWormholeRelayer(_relayer);
        sourceChainId = _sourceChainId;
        trustedSourceContract = bytes32(uint256(uint160(_sourceContract)));
    }

    function receiveWormholeMessages(
        bytes memory payload,
        bytes[] memory,
        bytes32 sourceAddress,
        uint16 _sourceChainId,
        bytes32
    ) public payable {
        require(msg.sender == address(wormholeRelayer), "Only relayer can call");
        require(_sourceChainId == sourceChainId, "Invalid source chain");
        require(sourceAddress == trustedSourceContract, "Untrusted source contract");

        (address originalIssuer, bytes32 cidHash) = abi.decode(payload, (address, bytes32));
        cidIssuer[cidHash] = originalIssuer;
        emit CredentialReceived(originalIssuer, cidHash);
    }
}