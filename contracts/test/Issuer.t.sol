// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Issuer.sol";
import "../src/interfaces/IWormhole.sol";

contract IssuerTest is Test {
    Issuer public issuer;
    address public wormholeCoreBridge;
    address public owner;
    address public user;
    address public nonOwner;

    // Test data
    string public constant TEST_CID = "QmExampleCID123456789";
    string public constant TEST_CID_2 = "QmExampleCID987654321";
    string public constant TEST_CID_3 = "QmExampleCID555666777";

    // Test content hashes
    bytes32 public constant TEST_CONTENT_HASH = keccak256("file1_content");
    bytes32 public constant TEST_CONTENT_HASH_2 = keccak256("file2_content");
    bytes32 public constant TEST_CONTENT_HASH_3 = keccak256("file3_content");

    event LogCredentialIssued(address indexed issuer, string cid, bytes32 indexed cidHash);
    event CrossChainMessageEmitted(uint64 sequence);
    event CredentialRevoked(bytes32 indexed cidHash);

    function setUp() public {
        
        owner = address(this);
        user = makeAddr("user");
        nonOwner = makeAddr("nonOwner");
        
        
        wormholeCoreBridge = makeAddr("wormholeCoreBridge");
        
        
        issuer = new Issuer(wormholeCoreBridge, owner);
        
        
        vm.deal(user, 100 ether);
        vm.deal(nonOwner, 100 ether);
    }

    
    function mockWormholeMessageFee() internal pure returns (uint256) {
        return 0.001 ether; // Mock fee of 0.001 ETH
    }

    function test_issueSingleCredential() public {
        
        vm.startPrank(user);
        
        
        bytes32 expectedCidHash = keccak256(abi.encodePacked(TEST_CID));
        
        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.messageFee.selector),
            abi.encode(mockWormholeMessageFee())
        );
        
        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.publishMessage.selector),
            abi.encode(uint64(1)) // Mock sequence number
        );
        
        
        issuer.issueCredential{value: mockWormholeMessageFee()}(TEST_CID, TEST_CONTENT_HASH);
        
        
        assertEq(issuer.cidIssuer(expectedCidHash), user, "CID issuer should be set to user");
        assertFalse(issuer.isRevoked(expectedCidHash), "Credential should not be revoked");
        assertTrue(issuer.contentHashIssued(TEST_CONTENT_HASH), "Content hash should be marked as issued");
        
        vm.stopPrank();
    }

    function test_batchIssueCredentials() public {
        
        vm.startPrank(user);
        
        // Prepare test CIDs
        string[] memory cids = new string[](3);
        cids[0] = TEST_CID;
        cids[1] = TEST_CID_2;
        cids[2] = TEST_CID_3;

        bytes32[] memory contentHashes = new bytes32[](3);
        contentHashes[0] = TEST_CONTENT_HASH;
        contentHashes[1] = TEST_CONTENT_HASH_2;
        contentHashes[2] = TEST_CONTENT_HASH_3;
        
        // Calculate expected CID hashes
        bytes32[] memory expectedCidHashes = new bytes32[](3);
        expectedCidHashes[0] = keccak256(abi.encodePacked(TEST_CID));
        expectedCidHashes[1] = keccak256(abi.encodePacked(TEST_CID_2));
        expectedCidHashes[2] = keccak256(abi.encodePacked(TEST_CID_3));
        
        
        uint256 messageFee = mockWormholeMessageFee();
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.messageFee.selector),
            abi.encode(messageFee)
        );
        
        
        for (uint256 i = 0; i < 3; i++) {
            vm.mockCall(
                wormholeCoreBridge,
                abi.encodeWithSelector(IWormhole.publishMessage.selector),
                abi.encode(uint64(i + 1)) // Mock sequence numbers
            );
        }
        
        
        issuer.batchIssueCredentials{value: messageFee * 3}(cids, contentHashes);
        
        
        for (uint256 i = 0; i < 3; i++) {
            assertEq(
                issuer.cidIssuer(expectedCidHashes[i]), 
                user, 
                "CID issuer should be set to user"
            );
            assertFalse(
                issuer.isRevoked(expectedCidHashes[i]), 
                "Credential should not be revoked"
            );
            assertTrue(issuer.contentHashIssued(contentHashes[i]));
        }
        
        vm.stopPrank();
    }

    function test_fail_issueDuplicateCredential() public {
        
        vm.startPrank(user);
        
        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.messageFee.selector),
            abi.encode(mockWormholeMessageFee())
        );
        
        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.publishMessage.selector),
            abi.encode(uint64(1))
        );
        
        
        issuer.issueCredential{value: mockWormholeMessageFee()}(TEST_CID, TEST_CONTENT_HASH);
        
        
        vm.expectRevert("Credential already issued for this CID");
        issuer.issueCredential{value: mockWormholeMessageFee()}(TEST_CID, TEST_CONTENT_HASH_2); // This line is changed
        
        vm.stopPrank();
    }

    
    function test_fail_issueDuplicateContentHash() public {
        vm.startPrank(user);
        
        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.messageFee.selector),
            abi.encode(mockWormholeMessageFee())
        );
        
        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.publishMessage.selector),
            abi.encode(uint64(1))
        );

        
        issuer.issueCredential{value: mockWormholeMessageFee()}(TEST_CID, TEST_CONTENT_HASH);

        
        vm.expectRevert("Credential for this content already issued");
        issuer.issueCredential{value: mockWormholeMessageFee()}(TEST_CID_2, TEST_CONTENT_HASH);
        vm.stopPrank();
    }

    function test_revokeCredential() public {
        
        vm.startPrank(user);
        
        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.messageFee.selector),
            abi.encode(mockWormholeMessageFee())
        );
        
        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.publishMessage.selector),
            abi.encode(uint64(1))
        );
        
        
        issuer.issueCredential{value: mockWormholeMessageFee()}(TEST_CID, TEST_CONTENT_HASH);
        vm.stopPrank();
        
        
        bytes32 cidHash = keccak256(abi.encodePacked(TEST_CID));
        
        
        assertEq(issuer.cidIssuer(cidHash), user, "Credential should exist");
        assertFalse(issuer.isRevoked(cidHash), "Credential should not be revoked initially");
        
        
        vm.startPrank(owner);
        issuer.revokeCredential(TEST_CID);
        vm.stopPrank();
        
        
        assertTrue(issuer.isRevoked(cidHash), "Credential should be revoked");
    }

    function test_fail_revokeNonExistentCredential() public {
        
        vm.startPrank(owner);
        vm.expectRevert("Credential does not exist");
        issuer.revokeCredential(TEST_CID);
        vm.stopPrank();
    }

    function test_fail_onlyOwnerCanRevoke() public {
        
        vm.startPrank(user);
        
        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.messageFee.selector),
            abi.encode(mockWormholeMessageFee())
        );
        
        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.publishMessage.selector),
            abi.encode(uint64(1))
        );
        
        
        issuer.issueCredential{value: mockWormholeMessageFee()}(TEST_CID, TEST_CONTENT_HASH);
        vm.stopPrank();
        
        
        vm.startPrank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        issuer.revokeCredential(TEST_CID);
        vm.stopPrank();
    }

    function test_fail_revokeAlreadyRevokedCredential() public {
        
        vm.startPrank(user);
        
        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.messageFee.selector),
            abi.encode(mockWormholeMessageFee())
        );
        
        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.publishMessage.selector),
            abi.encode(uint64(1))
        );
        
        
        issuer.issueCredential{value: mockWormholeMessageFee()}(TEST_CID, TEST_CONTENT_HASH);
        vm.stopPrank();
        
        
        vm.startPrank(owner);
        issuer.revokeCredential(TEST_CID);
        
        
        vm.expectRevert("Credential already revoked");
        issuer.revokeCredential(TEST_CID);
        vm.stopPrank();
    }

    function test_setMirrorContract() public {
        address newMirrorContract = makeAddr("newMirrorContract");
        
        
        vm.startPrank(owner);
        issuer.setMirrorContract(newMirrorContract);
        vm.stopPrank();
        
        
        assertEq(issuer.targetMirrorContract(), newMirrorContract, "Mirror contract should be set");
    }

    function test_fail_setMirrorContractZeroAddress() public {
        
        vm.startPrank(owner);
        vm.expectRevert("Cannot set mirror to the zero address");
        issuer.setMirrorContract(address(0));
        vm.stopPrank();
    }

    function test_fail_onlyOwnerCanSetMirrorContract() public {
        address newMirrorContract = makeAddr("newMirrorContract");
        
        
        vm.startPrank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        issuer.setMirrorContract(newMirrorContract);
        vm.stopPrank();
    }

    function test_events() public {
        
        vm.startPrank(user);
        
        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.messageFee.selector),
            abi.encode(mockWormholeMessageFee())
        );
        
        
        vm.mockCall(
            wormholeCoreBridge,
            abi.encodeWithSelector(IWormhole.publishMessage.selector),
            abi.encode(uint64(1))
        );
        
        
        vm.expectEmit(true, false, false, true);
        emit LogCredentialIssued(user, TEST_CID, keccak256(abi.encodePacked(TEST_CID)));
        
        vm.expectEmit(false, false, false, true);
        emit CrossChainMessageEmitted(1);
        
        
        issuer.issueCredential{value: mockWormholeMessageFee()}(TEST_CID, TEST_CONTENT_HASH);
        
        vm.stopPrank();
        
        
        vm.startPrank(owner);
        vm.expectEmit(true, false, false, false);
        emit CredentialRevoked(keccak256(abi.encodePacked(TEST_CID)));
        
        
        issuer.revokeCredential(TEST_CID);
        vm.stopPrank();
    }
} 
