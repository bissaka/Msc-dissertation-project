
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import "../src/Issuer.sol";

contract DeployIssuer is Script {
    function run() external {
        // official Sepolia Core Contract address
        address wormholeCoreBridge = 0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78; 
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY_SEPOLIA");
        address deployerAddress = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        Issuer issuer = new Issuer(wormholeCoreBridge, deployerAddress);
        vm.stopBroadcast();
        console.log(" Manual Issuer contract deployed to:", address(issuer));
    }
}
