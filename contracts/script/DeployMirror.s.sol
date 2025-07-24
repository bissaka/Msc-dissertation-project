// script/DeployMirror.s.sol
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import "../src/Mirror.sol";

contract DeployMirror is Script {
    function run() external {
        // CORRECTED: The Amoy RELAYER address you provided.
        address wormholeRelayer = 0x362fca37E45fe1096b42021b543f462D49a5C8df;
        
        // The source chain is Sepolia
        uint16 sourceChainId = 2; 

        address issuerContractOnSepolia = vm.envAddress("ISSUER_ADDRESS");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY_AMOY");
        vm.startBroadcast(deployerPrivateKey);
        
        // Pass all three arguments to the constructor
        Mirror mirror = new Mirror(wormholeRelayer, sourceChainId, issuerContractOnSepolia);
        
        vm.stopBroadcast();
        console.log(" Mirror contract deployed to:", address(mirror));
    }
}