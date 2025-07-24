const { ethers } = require("ethers");

const provider = new ethers.providers.JsonRpcProvider("wss://polygon-amoy.g.alchemy.com/v2/3VuH4lq2msmIjuQcup3Xl");
const wormholeAddress = "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78";
const wormholeAbi = [
  "function messageFee() view returns (uint256)"
];

async function main() {
  const contract = new ethers.Contract(wormholeAddress, wormholeAbi, provider);
  const fee = await contract.messageFee();
  console.log("Wormhole message fee:", ethers.utils.formatEther(fee), "ETH");
}

main();