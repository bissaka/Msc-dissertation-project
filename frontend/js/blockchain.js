// SPDX-License-Identifier: UNLICENSED
// blockchain.js - Centralized blockchain interactions

import {
  ISSUER_ADDRESS,
  MIRROR_ADDRESS,
  SEPOLIA_CHAIN_ID,
  AMOY_CHAIN_ID,
  CORE_BRIDGE_ADDRESS_SEPOLIA,
  ISSUER_ABI,
  MIRROR_ABI,
  CORE_BRIDGE_ABI
} from './constants.js';

/**
 * Connect to MetaMask wallet and ensure user is on the correct network
 * @param {number} targetNetworkId - The chain ID to switch to
 * @returns {Promise<Object>} - Returns a signer object
 */
export async function connectToWallet(targetNetworkId) {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);

  const network = await provider.getNetwork();
  if (network.chainId !== targetNetworkId) {
    const networkName = targetNetworkId === SEPOLIA_CHAIN_ID ? "Sepolia" : "Amoy";
    throw new Error(`Please switch to ${networkName} network in MetaMask.`);
  }

  return provider.getSigner();
}

/**
 * Get the Issuer contract instance
 * @param {Object} signer - The signer object
 * @returns {Object} - Returns the Issuer contract instance
 */
export function getIssuerContract(signer) {
  return new ethers.Contract(ISSUER_ADDRESS, ISSUER_ABI, signer);
}

/**
 * Get the Mirror contract instance
 * @param {Object} signer - The signer object
 * @returns {Object} - Returns the Mirror contract instance
 */
export function getMirrorContract(signer) {
  return new ethers.Contract(MIRROR_ADDRESS, MIRROR_ABI, signer);
}

/**
 * Get the Core Bridge contract instance for Sepolia
 * @param {Object} provider - The provider object
 * @returns {Object} - Returns the Core Bridge contract instance
 */
export function getCoreBridgeContract(provider) {
  return new ethers.Contract(CORE_BRIDGE_ADDRESS_SEPOLIA, CORE_BRIDGE_ABI, provider);
}

/**
 * Get the appropriate contract based on network
 * @param {string} network - The network name ("ethereum" or "polygon")
 * @param {Object} provider - The provider object
 * @returns {Object} - Returns the appropriate contract instance
 */
export function getContractForNetwork(network, provider) {
  const contractAddress = network === "ethereum" ? ISSUER_ADDRESS : MIRROR_ADDRESS;
  return new ethers.Contract(contractAddress, ISSUER_ABI, provider);
}

/**
 * Get the target network ID based on network name
 * @param {string} network - The network name ("ethereum" or "polygon")
 * @returns {number} - Returns the chain ID
 */
export function getTargetNetworkId(network) {
  return network === "ethereum" ? SEPOLIA_CHAIN_ID : AMOY_CHAIN_ID;
}

/**
 * Issue multiple credentials in a batch transaction
 * @param {Object} signer - The signer object
 * @param {Array<string>} cids - Array of IPFS CIDs to issue
 * @param {Array<string>} contentHashes - Array of content hashes for the files
 * @returns {Promise<Object>} - Returns the transaction receipt
 */
export async function batchIssueCredentials(signer, cids, contentHashes) {
  const issuerContract = getIssuerContract(signer);
  const coreBridge = getCoreBridgeContract(signer.provider);

  // Get the message fee and calculate total cost
  const messageFee = await coreBridge.messageFee();
  const totalCost = messageFee.mul(cids.length);

  // Call the batch issuance function with content hashes
  const tx = await issuerContract.batchIssueCredentials(cids, contentHashes, { value: totalCost });
  return await tx.wait();
} 