// SPDX-License-Identifier: MIT
// I'm defining the license for this test contract.
pragma solidity ^0.8.20;
// I'm specifying the Solidity compiler version.

// I'm importing the Foundry Test base contract for its testing utilities.
import "forge-std/Test.sol";
// I'm importing the updated Mirror contract that I want to test.
import "../src/Mirror.sol";

/**
 * @title MirrorTest
 * @author Oludoyi Olumide Joshua
 * @notice This is my updated test suite for the revised Mirror.sol contract.
 * I'm testing its ability to securely receive mirrored credential data.
 */
contract MirrorTest is Test {
    // I'm declaring a state variable to hold the instance of the Mirror contract.
    Mirror private mirror;

    // I'm defining the official Wormhole Relayer address for Polygon Amoy.
    address private constant WORMHOLE_RELAYER = 0x80624d6657314502777f155762F53835265b6878;
    // I'm defining a fake address to represent an unauthorized caller.
    address private constant NOT_RELAYER = address(0x1234);
    // I'm defining a fake address to represent the original issuer from Ethereum.
    address private constant ORIGINAL_ISSUER = address(0xABCD);

    // I'm declaring a test CID that I'll hash in my tests.
    string private constant TEST_CID = "QmTestCIDPolygon123456";

    /**
     * @notice This is my setup function, which runs before each test.
     * It ensures each test starts with a fresh contract instance.
     */
    function setUp() public {
        // I'm deploying a new instance of the Mirror contract.
        mirror = new Mirror();
    }

    /**
     * @notice I'm testing that receiveMessage correctly stores the issuer's address when called by the official relayer.
     */
    function test_receiveMessage_byRelayer_storesIssuerAddress() public {
        // I'm calculating the keccak256 hash of my test CID string.
        bytes32 cidHash = keccak256(abi.encodePacked(TEST_CID));
        
        // I'm using vm.prank to simulate the transaction coming from the authorized Wormhole Relayer address.
        vm.prank(WORMHOLE_RELAYER);
        // I'm calling receiveMessage with the original issuer's address and the CID hash.
        mirror.receiveMessage(ORIGINAL_ISSUER, cidHash);

        // I'm retrieving the stored issuer address from the public 'cidIssuer' mapping.
        address storedIssuer = mirror.cidIssuer(cidHash);
        // I'm asserting that the stored address matches the original issuer's address I sent.
        assertEq(storedIssuer, ORIGINAL_ISSUER, "Mirror: Issuer address should be stored for the given CID hash.");
    }

    /**
     * @notice I'm testing the security of my contract by ensuring receiveMessage reverts if called by an unauthorized address.
     */
    function test_receiveMessage_byNonRelayer_reverts() public {
        // I'm calculating the hash of the CID for the test.
        bytes32 cidHash = keccak256(abi.encodePacked(TEST_CID));

        // I'm using vm.prank to simulate the call coming from an unauthorized address.
        vm.prank(NOT_RELAYER);
        // I'm telling the test runner to expect the next call to revert with my specific error message.
        vm.expectRevert(bytes("Mirror: Caller is not the Wormhole Relayer"));
        // I'm calling receiveMessage with test data; this call should fail as expected.
        mirror.receiveMessage(ORIGINAL_ISSUER, cidHash);
    }
}