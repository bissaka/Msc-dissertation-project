// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IWormholeRelayer.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Issuer is Ownable {
    uint16 public constant SOURCE_CHAIN_ID = 2; // Wormhole ID for Sepolia
    IWormholeRelayer public immutable wormholeRelayer;
    uint16 public immutable targetChainId;
    address public targetMirrorContract;

    event LogCredentialIssued(address indexed issuer, string cid, bytes32 indexed cidHash);

    constructor(address _relayer, uint16 _targetChainId, address initialOwner) Ownable(initialOwner) {
        wormholeRelayer = IWormholeRelayer(_relayer);
        targetChainId = _targetChainId;
    }

    function setMirrorContract(address _targetMirror) external onlyOwner {
        targetMirrorContract = _targetMirror;
    }

    function issueCredentialWithRelay(string calldata _cid) external payable {
        require(targetMirrorContract != address(0), "Mirror contract not set");
        bytes32 cidHash = keccak256(abi.encodePacked(_cid));
        bytes memory payload = abi.encode(msg.sender, cidHash);
        uint256 gasLimit = 200000;

        wormholeRelayer.sendPayloadToEvm{value: msg.value}(
            targetChainId,
            targetMirrorContract,
            payload,
            gasLimit,
            SOURCE_CHAIN_ID // Refund address is this chain
        );
        emit LogCredentialIssued(msg.sender, _cid, cidHash);
    }
}