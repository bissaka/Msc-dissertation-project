// SPDX-License-Identifier: UNLICENSED
// constants.js - Shared constants for the credential verification system

// --- Contract Addresses ---
export const ISSUER_ADDRESS = "YOUR_ISSUER_CONTRACT_ADDRESS"; // Ethereum Sepolia
export const MIRROR_ADDRESS = "YOUR_MIRROR_CONTRACT_ADDRESS"; // Polygon Amoy

// --- Network Chain IDs ---
export const SEPOLIA_CHAIN_ID = 11155111;
export const AMOY_CHAIN_ID = 80002;

// --- Wormhole Core Bridge Addresses ---
export const CORE_BRIDGE_ADDRESS_SEPOLIA =
  "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78";

// --- Contract ABIs ---
export const ISSUER_ABI = [
  {
    type: "constructor",
    inputs: [
      { name: "_wormholeCoreBridge", type: "address", internalType: "address" },
      { name: "initialOwner", type: "address", internalType: "address" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "batchIssueCredentials",
    inputs: [
      { name: "_cids", type: "string[]", internalType: "string[]" },
      { name: "_contentHashes", type: "bytes32[]", internalType: "bytes32[]" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "cidIssuer",
    inputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "contentHashIssued",
    inputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isRevoked",
    inputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "issueCredential",
    inputs: [
      { name: "_cid", type: "string", internalType: "string" },
      { name: "_contentHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeCredential",
    inputs: [{ name: "_cid", type: "string", internalType: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setMirrorContract",
    inputs: [
      { name: "_targetMirror", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "targetMirrorContract",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "wormhole",
    inputs: [],
    outputs: [
      { name: "", type: "address", internalType: "contract IWormhole" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "CredentialRevoked",
    inputs: [
      {
        name: "cidHash",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "CrossChainMessageEmitted",
    inputs: [
      {
        name: "sequence",
        type: "uint64",
        indexed: false,
        internalType: "uint64",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "LogCredentialIssued",
    inputs: [
      {
        name: "issuer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      { name: "cid", type: "string", indexed: false, internalType: "string" },
      {
        name: "cidHash",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      {
        name: "previousOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "OwnableInvalidOwner",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
  },
  { type: "error", name: "ReentrancyGuardReentrantCall", inputs: [] },
];

// Mirror contract uses the same ABI as Issuer for verification
export const MIRROR_ABI = ISSUER_ABI;

// ABI for the core bridge to get the message fee
export const CORE_BRIDGE_ABI = ["function messageFee() view returns (uint256)"];
