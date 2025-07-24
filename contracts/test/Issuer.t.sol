// SPDX-License-Identifier: MIT
// I'm defining the license for this test contract.
pragma solidity ^0.8.20;
// I'm specifying the Solidity compiler version.

// I'm importing the Foundry Test base contract, which provides useful testing utilities.
import "forge-std/Test.sol";
// I'm importing the updated Issuer contract that I want to test.
import "../src/Issuer.sol";

/**
 * @title IssuerTest
 * @author Oludoyi Olumide Joshua
 * @notice This is my updated test suite for the revised Issuer.sol contract.
 * I'm testing the new CID-centric logic and security features.
 */
contract IssuerTest is Test {
    // I'm declaring a state variable to hold the instance of the Issuer contract.
    Issuer private issuer;

    // I'm declaring an address variable to simulate an institution (issuer).
    address private issuer1 = address(0x1);

    /**
     * @notice This is my setup function, which runs before each test.
     * It deploys a fresh contract instance to ensure my tests are isolated.
     */
    function setUp() public {
        // I'm creating and deploying a brand new instance of the Issuer contract.
        issuer = new Issuer();
    }

    /**
     * @notice I'm testing the core function to ensure it stores the issuer's address against the CID hash.
     * This test also checks that the correct event is emitted.
     */
    function test_issueCredential_storesIssuerAddressAndEmitsEvent() public {
        // I'm defining a sample IPFS CID that I'll use for this test.
        string memory testCID = "QmTestCID1234567890";
        // I'm calculating the hash of the CID, just like the smart contract does.
        bytes32 cidHash = keccak256(abi.encodePacked(testCID));

        // I'm telling the test runner to expect my updated event signature in the next call.
        vm.expectEmit(true, true, true, true);
        // I'm defining the event I expect, which now includes the issuer, CID, and the hash of the CID.
        emit issuer.LogCredentialIssued(issuer1, testCID, cidHash);

        // I'm using vm.prank to simulate the transaction being sent from issuer1's address.
        vm.prank(issuer1);
        // I'm calling the issueCredential function with my test CID.
        issuer.issueCredential(testCID);

        // I'm retrieving the stored issuer address by calling the public 'cidIssuer' mapping with the hash.
        address storedIssuer = issuer.cidIssuer(cidHash);
        // I'm asserting that the address stored in the mapping is the address of issuer1.
        assertEq(storedIssuer, issuer1, "The issuer address should be stored correctly.");
    }

    /**
     * @notice I'm testing the new security feature: the contract must reject duplicate CIDs.
     * This test ensures the same credential cannot be issued twice.
     */
    function test_reverts_whenIssuingDuplicateCID() public {
        // I'm defining a sample IPFS CID.
        string memory testCID = "QmTestCID1234567890";

        // --- First Issuance ---
        // I'm simulating the first issuance from issuer1.
        vm.prank(issuer1);
        // I'm calling the function, which should succeed.
        issuer.issueCredential(testCID);

        // --- Second Issuance Attempt ---
        // I'm telling the test runner to expect the transaction to fail (revert).
        // I'm providing the exact error message I expect from the 'require' statement in my contract.
        vm.expectRevert(bytes("Issuer: This credential CID has already been issued."));
        // I'm simulating another user trying to issue the EXACT same CID, which should be blocked.
        vm.prank(address(0x2));
        // I'm calling the function again with the same CID, which should trigger the revert.
        issuer.issueCredential(testCID);
    }
}