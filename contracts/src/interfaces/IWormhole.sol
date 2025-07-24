// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IWormhole {
    // VM is a struct that contains the data of a Wormhole message.
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

    // Returns the fee for publishing a message.
    function messageFee() external view returns (uint256 fee);

    // Publishes a message to the Wormhole network.
    function publishMessage(
        uint32 nonce,
        bytes memory payload,
        uint8 consistencyLevel
    ) external payable returns (uint64 sequence);

    // Parses and verifies a VAA. Reverts if the VAA is invalid.
    function parseAndVerifyVM(
        bytes memory encodedVM
    ) external view returns (VM memory vm, bool valid, string memory reason);
}