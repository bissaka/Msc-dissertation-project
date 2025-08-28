// script/DeployMirror.s.sol
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import "../src/Mirror.sol";

contract DeployMirror is Script {
    function run() external {
        // Use the official Amoy Core Contract address
        address wormholeCoreBridge = 0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35; // [cite: 3]
        address issuerContractOnSepolia = vm.envAddress("ISSUER_ADDRESS");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY_AMOY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        Mirror mirror = new Mirror(wormholeCoreBridge, issuerContractOnSepolia, deployerAddress);
        vm.stopBroadcast();
        console.log(" Manual Mirror contract deployed to:", address(mirror));
    }
}