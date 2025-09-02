// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IWormhole {
    
    struct VM {
        uint8 version;
        uint32 timestamp;
        uint32 nonce;
        uint16 emitterChainId;
        bytes32 emitterAddress;
        uint64 sequence;
        uint8 consistencyLevel;
        bytes payload;
    }

    
    function messageFee() external view returns (uint256 fee);

    
    function publishMessage(
        uint32 nonce,
        bytes memory payload,
        uint8 consistencyLevel
    ) external payable returns (uint64 sequence);

    
    function parseAndVerifyVM(
        bytes memory encodedVM
    ) external view returns (VM memory vm, bool valid, string memory reason);
}
