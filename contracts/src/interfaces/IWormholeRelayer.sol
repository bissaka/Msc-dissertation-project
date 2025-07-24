// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IWormholeRelayer
 * @notice Simplified Wormhole Relayer interface for automatic cross-chain message delivery.
 */
interface IWormholeRelayer {
    /**
     * @notice Sends a payload to an EVM chain using the Wormhole Relayer.
     * @param targetChain The target chain ID.
     * @param targetAddress The target contract address.
     * @param payload The message payload.
     * @param gasLimit The gas limit for the target transaction.
     * @param refundChain The chain to refund excess gas to.
     * @return sequence The sequence number of the sent message.
     */
    function sendPayloadToEvm(
        uint16 targetChain,
        address targetAddress,
        bytes memory payload,
        uint256 gasLimit,
        uint16 refundChain
    ) external payable returns (uint64 sequence);
    
    /**
     * @notice Delivers a payload to a target contract.
     * @param targetAddress The target contract address.
     * @param payload The message payload.
     * @param sourceChain The source chain ID.
     * @param sourceAddress The source contract address.
     * @param deliveryHash The delivery hash.
     */
    function deliver(
        address targetAddress,
        bytes memory payload,
        uint16 sourceChain,
        bytes32 sourceAddress,
        bytes32 deliveryHash
    ) external;
    
    /**
     * @notice Gets the delivery hash for a message.
     * @param sourceChain The source chain ID.
     * @param sourceAddress The source contract address.
     * @param sequence The message sequence number.
     * @return The delivery hash.
     */
    function getDeliveryHash(uint16 sourceChain, bytes32 sourceAddress, uint64 sequence) external view returns (bytes32);
} 