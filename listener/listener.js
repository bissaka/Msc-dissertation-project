// SPDX-License-Identifier: UNLICENSED
// listener.js - Final Polling Version with State Management

require("dotenv").config();
const { ethers } = require("ethers");
const fetch = require("node-fetch");

// --- Configuration ---
const WORMHOLE_CHAIN_ID_SEPOLIA = 10002;
const ISSUER_ADDRESS = "YOUR_ISSUER_CONTRACT_ADDRESS";
const MIRROR_ADDRESS = "YOUR_MIRROR_CONTRACT_ADDRESS";

// --- ABIs ---
const ISSUER_ABI = [
  {
    type: "event",
    name: "CrossChainMessageEmitted",
    inputs: [{ name: "sequence", type: "uint64", indexed: false }],
    anonymous: false,
  },
];
const MIRROR_ABI = [
  {
    type: "function",
    name: "receiveAndVerifyVAA",
    inputs: [{ name: "_vaa", type: "bytes" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

// --- Helper Functions ---

function getEmitterAddressEth(address) {
  return "0x" + address.slice(2).padStart(64, "0");
}

async function fetchVAAWithRetry(chainId, emitterAddress, sequence) {
  const vaaUrl = `https://api.testnet.wormholescan.io/api/v1/vaas/${chainId}/${emitterAddress.slice(
    2
  )}/${sequence}`;
  const maxAttempts = 60; // 30 minutes total timeout
  const delayMs = 30000; // 30 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(
      `\n📡 Fetching VAA for sequence ${sequence}... (Attempt ${attempt}/${maxAttempts})`
    );
    try {
      const response = await fetch(vaaUrl);
      if (!response.ok) throw new Error(`API status: ${response.status}`);
      const data = await response.json();
      if (data && data.data && data.data.vaa) {
        return Buffer.from(data.data.vaa, "base64");
      }
      throw new Error("VAA not yet available in API response.");
    } catch (e) {
      if (attempt === maxAttempts) {
        throw new Error(
          `Failed to fetch VAA after ${maxAttempts} attempts: ${e.message}`
        );
      }
      console.log(`   Retrying in ${delayMs / 1000}s...`);
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

async function relayVAA(vaaBytes, mirrorContract, sequence) {
  const vaaHex = "0x" + vaaBytes.toString("hex");
  console.log(
    `\n✅ VAA fetched for sequence ${sequence}! Submitting to Mirror contract...`
  );

  try {
    const tx = await mirrorContract.receiveAndVerifyVAA(vaaHex);
    console.log(
      `⏳ Waiting for transaction confirmation for sequence ${sequence} on Amoy...`
    );

    const receipt = await tx.wait();
    console.log(
      `\n✅🎉 Successfully mirrored credential for sequence ${sequence} to Amoy!`
    );
    console.log(`[END] Polygon Tx Confirmed: ${new Date().toISOString()}`);
    console.log(`   - Amoy Tx Hash: ${receipt.hash}`);
    return true; // Indicate success
  } catch (error) {
    // This is not a real error, it just means another instance of the listener succeeded first.
    if (
      error.message.includes("already known") ||
      error.message.includes("VAA already processed")
    ) {
      console.log(
        `\n✅ Sequence ${sequence} was already relayed by another process.`
      );
      return true; // Indicate success
    }
    // This is a real error
    console.error(
      `\n❌ An error occurred during the relay for sequence ${sequence}:`
    );
    console.error(error.message);
    return false; // Indicate failure
  }
}

// --- Main Application ---

async function main() {
  console.log("🚀 Starting VAA listener for manual relay...");

  const sepoliaProvider = new ethers.JsonRpcProvider(
    process.env.SEPOLIA_RPC_URL
  );
  const amoyProvider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL);
  const amoyWallet = new ethers.Wallet(
    process.env.PRIVATE_KEY_AMOY,
    amoyProvider
  );

  const issuerContract = new ethers.Contract(
    ISSUER_ADDRESS,
    ISSUER_ABI,
    sepoliaProvider
  );
  const mirrorContract = new ethers.Contract(
    MIRROR_ADDRESS,
    MIRROR_ABI,
    amoyWallet
  );

  console.log(`📡 Polling for events on Issuer contract: ${ISSUER_ADDRESS}`);
  console.log(`🪞 Mirror contract on Amoy: ${MIRROR_ADDRESS}`);

  let lastCheckedBlock = await sepoliaProvider.getBlockNumber();
  const currentlyProcessing = new Set(); // This will prevent duplicate processing

  console.log(
    `✅ Listener active. Starting scan from block ${lastCheckedBlock}.`
  );

  const pollAndReschedule = async () => {
    try {
      const latestBlock = await sepoliaProvider.getBlockNumber();
      const fromBlock = lastCheckedBlock + 1;

      if (latestBlock >= fromBlock) {
        const events = await issuerContract.queryFilter(
          "CrossChainMessageEmitted",
          fromBlock,
          latestBlock
        );

        if (events.length > 0) {
          console.log(`\nFound ${events.length} new event(s)...`);
          for (const event of events) {
            const { sequence } = event.args;
            const sequenceId = sequence.toString();

            if (!currentlyProcessing.has(sequenceId)) {
              currentlyProcessing.add(sequenceId);
              try {
                console.log("\n✅ Processing New Cross-Chain Message!");
                console.log(`   • Sequence:   ${sequenceId}`);
                console.log(`   • Sepolia tx: ${event.transactionHash}`);

                const vaaBytes = await fetchVAAWithRetry(
                  WORMHOLE_CHAIN_ID_SEPOLIA,
                  getEmitterAddressEth(issuerContract.target),
                  sequenceId
                );
                await relayVAA(vaaBytes, mirrorContract, sequenceId);
              } catch (error) {
                console.error(
                  `A critical error occurred processing sequence ${sequenceId}:`,
                  error.message
                );
              } finally {
                currentlyProcessing.delete(sequenceId);
              }
            }
          }
        }
        lastCheckedBlock = latestBlock;
      }
    } catch (error) {
      console.error(
        "An error occurred during the polling cycle:",
        error.message
      );
    } finally {
      // Always reschedule the next poll, even if an error occurred.
      setTimeout(pollAndReschedule, 30000);
      console.log(
        `\n...waiting for next poll in 30s. Last checked block: ${lastCheckedBlock}`
      );
    }
  };

  // Start the first poll
  pollAndReschedule();
}

main().catch((error) => {
  console.error("A critical error occurred in the main process:", error);
  process.exit(1);
});
