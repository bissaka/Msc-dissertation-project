// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Mirror.sol";
import "../src/interfaces/IWormhole.sol";

contract MirrorTest is Test {
    Mirror public mirror;
    address public wormholeCoreBridge;
    address public sourceContract; // The Issuer contract on Sepolia
    address public owner;
    address public user;
    address public originalIssuer;

    // Test data
    string public constant TEST_CID = "QmExampleCID123456789";
    bytes32 public constant TEST_CID_HASH = keccak256(abi.encodePacked("QmExampleCID123456789"));

    // Mock VAA data
    bytes public mockVAA;
    bytes32 public mockVAAHash;

    event CredentialReceived(address indexed originalIssuer, bytes32 indexed cidHash);
    event CredentialRevoked(bytes32 indexed cidHash);

    function setUp() public {
        // Setup addresses
        owner = address(this);
        user = makeAddr("user");
        originalIssuer = makeAddr("originalIssuer");
        
        // Mock addresses
        wormholeCoreBridge = makeAddr("wormholeCoreBridge");
        sourceContract = makeAddr("sourceContract");
        
        // Deploy the Mirror contract
        mirror = new Mirror(wormholeCoreBridge, sourceContract, owner);
        
        // Create mock VAA payload
        bytes memory payload = abi.encode(originalIssuer, TEST_CID_HASH);
        
        // Create mock VAA (simplified structure for testing)
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
        
        // Calculate VAA hash for replay protection testing
        mockVAAHash = keccak256(mockVAA);
        
        // Give some ETH to the user for testing
        vm.deal(user, 100 ether);
    }

    function test_receiveAndVerifyVAA() public {
        // Create a mock VM struct that will be returned by parseAndVerifyVM
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

        // Mock the parseAndVerifyVM call to return valid VM and true
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.parseAndVerifyVM.selector, mockVAA),
            abi.encode(mockVM, true, "") // valid = true, reason = ""
        );

        // Expect the CredentialReceived event
        vm.expectEmit(true, false, false, true);
        emit CredentialReceived(originalIssuer, TEST_CID_HASH);

        // Call receiveAndVerifyVAA
        mirror.receiveAndVerifyVAA(mockVAA);

        // Verify the credential was recorded correctly
        assertEq(mirror.cidIssuer(TEST_CID_HASH), originalIssuer, "CID issuer should be set to original issuer");
        assertFalse(mirror.isRevoked(TEST_CID_HASH), "Credential should not be revoked initially");
    }

    function test_fail_receiveDuplicateVAA() public {
        // Create a mock VM struct
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

        // Mock the parseAndVerifyVM call
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.parseAndVerifyVM.selector, mockVAA),
            abi.encode(mockVM, true, "")
        );

        // First call should succeed
        mirror.receiveAndVerifyVAA(mockVAA);

        // Second call with the same VAA should revert
        vm.expectRevert("VAA already processed");
        mirror.receiveAndVerifyVAA(mockVAA);
    }

    function test_fail_receiveVAAFromUntrustedSource() public {
        // Create a mock VM struct with untrusted source
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

        // Mock the parseAndVerifyVM call
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.parseAndVerifyVM.selector, mockVAA),
            abi.encode(mockVM, true, "")
        );

        // Call should revert due to untrusted source
        vm.expectRevert("Untrusted source contract");
        mirror.receiveAndVerifyVAA(mockVAA);
    }

    function test_fail_receiveVAAFromWrongChain() public {
        // Create a mock VM struct with wrong chain ID
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

        // Mock the parseAndVerifyVM call
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.parseAndVerifyVM.selector, mockVAA),
            abi.encode(mockVM, true, "")
        );

        // Call should revert due to wrong chain
        vm.expectRevert("Invalid source chain");
        mirror.receiveAndVerifyVAA(mockVAA);
    }

    function test_fail_receiveInvalidVAA() public {
        // Mock the parseAndVerifyVM call to return invalid VAA
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

        // Call should revert due to invalid VAA
        vm.expectRevert("Invalid VAA");
        mirror.receiveAndVerifyVAA(mockVAA);
    }

    function test_revokeCredential() public {
        // First, receive a VAA to create a credential
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

        // Verify the credential exists and is not revoked
        assertEq(mirror.cidIssuer(TEST_CID_HASH), originalIssuer, "Credential should exist");
        assertFalse(mirror.isRevoked(TEST_CID_HASH), "Credential should not be revoked initially");

        // Now revoke the credential as the owner
        vm.startPrank(owner);
        
        // Expect the CredentialRevoked event
        vm.expectEmit(true, false, false, false);
        emit CredentialRevoked(TEST_CID_HASH);
        
        mirror.revokeCredential(TEST_CID);
        vm.stopPrank();

        // Verify the credential is now revoked
        assertTrue(mirror.isRevoked(TEST_CID_HASH), "Credential should be revoked");
    }

    function test_fail_revokeNonExistentCredential() public {
        // Try to revoke a credential that doesn't exist
        vm.startPrank(owner);
        vm.expectRevert("Credential does not exist");
        mirror.revokeCredential(TEST_CID);
        vm.stopPrank();
    }

    function test_fail_onlyOwnerCanRevoke() public {
        // First, receive a VAA to create a credential
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

        // Try to revoke as non-owner - should revert
        vm.startPrank(user);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user));
        mirror.revokeCredential(TEST_CID);
        vm.stopPrank();
    }

    function test_fail_revokeAlreadyRevokedCredential() public {
        // First, receive a VAA to create a credential
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

        // Revoke the credential as owner
        vm.startPrank(owner);
        mirror.revokeCredential(TEST_CID);

        // Try to revoke the same credential again - should revert
        vm.expectRevert("Credential already revoked");
        mirror.revokeCredential(TEST_CID);
        vm.stopPrank();
    }

    function test_contractState() public {
        // Test contract state variables
        assertEq(mirror.SOURCE_CHAIN_ID(), 10002, "Source chain ID should be Sepolia");
        assertEq(mirror.trustedSourceContract(), bytes32(uint256(uint160(sourceContract))), "Trusted source should be set");
        assertEq(mirror.owner(), owner, "Owner should be set correctly");
    }

    function test_multipleVAAs() public {
        // Test processing multiple VAAs with different CIDs
        string memory testCid2 = "QmExampleCID987654321";
        bytes32 testCidHash2 = keccak256(abi.encodePacked(testCid2));
        address originalIssuer2 = makeAddr("originalIssuer2");

        // Create second VAA
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

        // Mock first VAA
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

        // Mock second VAA
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

        // Process both VAAs
        mirror.receiveAndVerifyVAA(mockVAA);
        mirror.receiveAndVerifyVAA(mockVAA2);

        // Verify both credentials were recorded
        assertEq(mirror.cidIssuer(TEST_CID_HASH), originalIssuer, "First credential should be recorded");
        assertEq(mirror.cidIssuer(testCidHash2), originalIssuer2, "Second credential should be recorded");
    }
} 