// script/DeployIssuer.s.sol
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import "../src/Issuer.sol";

contract DeployIssuer is Script {
    function run() external {
        // Sepolia RELAYER address
        address wormholeRelayer = 0x7B1bD7a6b4E61c2a123AC6BC2cbfC614437D0470;
        
        // CORRECTED: Define the targetChainId
        uint16 targetChainId = 5; // Wormhole Chain ID for Amoy/Polygon

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY_SEPOLIA");
        address deployerAddress = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        
        // CORRECTED: Pass all three arguments to the constructor
        Issuer issuer = new Issuer(wormholeRelayer, targetChainId, deployerAddress);
        
        vm.stopBroadcast();
        console.log(" Issuer contract deployed to:", address(issuer));
    }
}