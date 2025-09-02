// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Mirror.sol";
import "../src/interfaces/IWormhole.sol";

contract MirrorTest is Test {
    Mirror public mirror;
    address public wormholeCoreBridge;
    address public sourceContract; 
    address public owner;
    address public user;
    address public originalIssuer;

    // Test data
    string public constant TEST_CID = "QmExampleCID123456789";
    bytes32 public constant TEST_CID_HASH = keccak256(abi.encodePacked("QmExampleCID123456789"));

    
    bytes public mockVAA;
    bytes32 public mockVAAHash;

    event CredentialReceived(address indexed originalIssuer, bytes32 indexed cidHash);
    event CredentialRevoked(bytes32 indexed cidHash);

    function setUp() public {
        
        owner = address(this);
        user = makeAddr("user");
        originalIssuer = makeAddr("originalIssuer");
        
        
        wormholeCoreBridge = makeAddr("wormholeCoreBridge");
        sourceContract = makeAddr("sourceContract");
        
        
        mirror = new Mirror(wormholeCoreBridge, sourceContract, owner);
        
        
        bytes memory payload = abi.encode(originalIssuer, TEST_CID_HASH);
        
        
        mockVAA = abi.encode(
            uint8(1),           // version
            uint32(1),          // timestamp
            uint32(1),          // nonce
            uint16(10002),      // emitterChainId (Sepolia)
            bytes32(uint256(uint160(sourceContract))), // emitterAddress
            uint64(1),          // sequence
            uint8(1),           // consistencyLevel
            payload             // payload
        );
        
        
        mockVAAHash = keccak256(mockVAA);
        
        
        vm.deal(user, 100 ether);
    }

    function test_receiveAndVerifyVAA() public {
        
        IWormhole.VM memory mockVM = IWormhole.VM({
            version: 1,
            timestamp: 1,
            nonce: 1,
            emitterChainId: 10002, // Sepolia chain ID
            emitterAddress: bytes32(uint256(uint160(sourceContract))),
            sequence: 1,
            consistencyLevel: 1,
            payload: abi.encode(originalIssuer, TEST_CID_HASH)
        });

        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.parseAndVerifyVM.selector, mockVAA),
            abi.encode(mockVM, true, "") // valid = true, reason = ""
        );

        
        vm.expectEmit(true, false, false, true);
        emit CredentialReceived(originalIssuer, TEST_CID_HASH);

        
        mirror.receiveAndVerifyVAA(mockVAA);

        
        assertEq(mirror.cidIssuer(TEST_CID_HASH), originalIssuer, "CID issuer should be set to original issuer");
        assertFalse(mirror.isRevoked(TEST_CID_HASH), "Credential should not be revoked initially");
    }

    function test_fail_receiveDuplicateVAA() public {
        
        IWormhole.VM memory mockVM = IWormhole.VM({
            version: 1,
            timestamp: 1,
            nonce: 1,
            emitterChainId: 10002,
            emitterAddress: bytes32(uint256(uint160(sourceContract))),
            sequence: 1,
            consistencyLevel: 1,
            payload: abi.encode(originalIssuer, TEST_CID_HASH)
        });

        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.parseAndVerifyVM.selector, mockVAA),
            abi.encode(mockVM, true, "")
        );

        
        mirror.receiveAndVerifyVAA(mockVAA);

        
        vm.expectRevert("VAA already processed");
        mirror.receiveAndVerifyVAA(mockVAA);
    }

    function test_fail_receiveVAAFromUntrustedSource() public {
        
        address untrustedSource = makeAddr("untrustedSource");
        IWormhole.VM memory mockVM = IWormhole.VM({
            version: 1,
            timestamp: 1,
            nonce: 1,
            emitterChainId: 10002,
            emitterAddress: bytes32(uint256(uint160(untrustedSource))), // Different source
            sequence: 1,
            consistencyLevel: 1,
            payload: abi.encode(originalIssuer, TEST_CID_HASH)
        });

        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.parseAndVerifyVM.selector, mockVAA),
            abi.encode(mockVM, true, "")
        );

        
        vm.expectRevert("Untrusted source contract");
        mirror.receiveAndVerifyVAA(mockVAA);
    }

    function test_fail_receiveVAAFromWrongChain() public {
        
        IWormhole.VM memory mockVM = IWormhole.VM({
            version: 1,
            timestamp: 1,
            nonce: 1,
            emitterChainId: 10007, // Wrong chain ID (Amoy instead of Sepolia)
            emitterAddress: bytes32(uint256(uint160(sourceContract))),
            sequence: 1,
            consistencyLevel: 1,
            payload: abi.encode(originalIssuer, TEST_CID_HASH)
        });

        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.parseAndVerifyVM.selector, mockVAA),
            abi.encode(mockVM, true, "")
        );

        
        vm.expectRevert("Invalid source chain");
        mirror.receiveAndVerifyVAA(mockVAA);
    }

    function test_fail_receiveInvalidVAA() public {
        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.parseAndVerifyVM.selector, mockVAA),
            abi.encode(IWormhole.VM({
                version: 1,
                timestamp: 1,
                nonce: 1,
                emitterChainId: 10002,
                emitterAddress: bytes32(uint256(uint160(sourceContract))),
                sequence: 1,
                consistencyLevel: 1,
                payload: abi.encode(originalIssuer, TEST_CID_HASH)
            }), false, "Invalid signature") // valid = false
        );

        
        vm.expectRevert("Invalid VAA");
        mirror.receiveAndVerifyVAA(mockVAA);
    }

    function test_revokeCredential() public {
        
        IWormhole.VM memory mockVM = IWormhole.VM({
            version: 1,
            timestamp: 1,
            nonce: 1,
            emitterChainId: 10002,
            emitterAddress: bytes32(uint256(uint160(sourceContract))),
            sequence: 1,
            consistencyLevel: 1,
            payload: abi.encode(originalIssuer, TEST_CID_HASH)
        });

        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.parseAndVerifyVM.selector, mockVAA),
            abi.encode(mockVM, true, "")
        );

        mirror.receiveAndVerifyVAA(mockVAA);

        
        assertEq(mirror.cidIssuer(TEST_CID_HASH), originalIssuer, "Credential should exist");
        assertFalse(mirror.isRevoked(TEST_CID_HASH), "Credential should not be revoked initially");

        
        vm.startPrank(owner);
        
        
        vm.expectEmit(true, false, false, false);
        emit CredentialRevoked(TEST_CID_HASH);
        
        mirror.revokeCredential(TEST_CID);
        vm.stopPrank();

        
        assertTrue(mirror.isRevoked(TEST_CID_HASH), "Credential should be revoked");
    }

    function test_fail_revokeNonExistentCredential() public {
        
        vm.startPrank(owner);
        vm.expectRevert("Credential does not exist");
        mirror.revokeCredential(TEST_CID);
        vm.stopPrank();
    }

    function test_fail_onlyOwnerCanRevoke() public {
        
        IWormhole.VM memory mockVM = IWormhole.VM({
            version: 1,
            timestamp: 1,
            nonce: 1,
            emitterChainId: 10002,
            emitterAddress: bytes32(uint256(uint160(sourceContract))),
            sequence: 1,
            consistencyLevel: 1,
            payload: abi.encode(originalIssuer, TEST_CID_HASH)
        });

        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.parseAndVerifyVM.selector, mockVAA),
            abi.encode(mockVM, true, "")
        );

        mirror.receiveAndVerifyVAA(mockVAA);

        
        vm.startPrank(user);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user));
        mirror.revokeCredential(TEST_CID);
        vm.stopPrank();
    }

    function test_fail_revokeAlreadyRevokedCredential() public {
        
        IWormhole.VM memory mockVM = IWormhole.VM({
            version: 1,
            timestamp: 1,
            nonce: 1,
            emitterChainId: 10002,
            emitterAddress: bytes32(uint256(uint160(sourceContract))),
            sequence: 1,
            consistencyLevel: 1,
            payload: abi.encode(originalIssuer, TEST_CID_HASH)
        });

        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.parseAndVerifyVM.selector, mockVAA),
            abi.encode(mockVM, true, "")
        );

        mirror.receiveAndVerifyVAA(mockVAA);

        
        vm.startPrank(owner);
        mirror.revokeCredential(TEST_CID);

        
        vm.expectRevert("Credential already revoked");
        mirror.revokeCredential(TEST_CID);
        vm.stopPrank();
    }

    function test_contractState() public {
        
        assertEq(mirror.SOURCE_CHAIN_ID(), 10002, "Source chain ID should be Sepolia");
        assertEq(mirror.trustedSourceContract(), bytes32(uint256(uint160(sourceContract))), "Trusted source should be set");
        assertEq(mirror.owner(), owner, "Owner should be set correctly");
    }

    function test_multipleVAAs() public {
        
        string memory testCid2 = "QmExampleCID987654321";
        bytes32 testCidHash2 = keccak256(abi.encodePacked(testCid2));
        address originalIssuer2 = makeAddr("originalIssuer2");

        
        bytes memory mockVAA2 = abi.encode(
            uint8(1),
            uint32(2),
            uint32(2),
            uint16(10002),
            bytes32(uint256(uint160(sourceContract))),
            uint64(2),
            uint8(1),
            abi.encode(originalIssuer2, testCidHash2)
        );

        
        IWormhole.VM memory mockVM1 = IWormhole.VM({
            version: 1,
            timestamp: 1,
            nonce: 1,
            emitterChainId: 10002,
            emitterAddress: bytes32(uint256(uint160(sourceContract))),
            sequence: 1,
            consistencyLevel: 1,
            payload: abi.encode(originalIssuer, TEST_CID_HASH)
        });

        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.parseAndVerifyVM.selector, mockVAA),
            abi.encode(mockVM1, true, "")
        );

        
        IWormhole.VM memory mockVM2 = IWormhole.VM({
            version: 1,
            timestamp: 2,
            nonce: 2,
            emitterChainId: 10002,
            emitterAddress: bytes32(uint256(uint160(sourceContract))),
            sequence: 2,
            consistencyLevel: 1,
            payload: abi.encode(originalIssuer2, testCidHash2)
        });

        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.parseAndVerifyVM.selector, mockVAA2),
            abi.encode(mockVM2, true, "")
        );

        
        mirror.receiveAndVerifyVAA(mockVAA);
        mirror.receiveAndVerifyVAA(mockVAA2);

        
        assertEq(mirror.cidIssuer(TEST_CID_HASH), originalIssuer, "First credential should be recorded");
        assertEq(mirror.cidIssuer(testCidHash2), originalIssuer2, "Second credential should be recorded");
    }
} 
