require("dotenv").config();
const { ethers } = require("ethers");
const { getSignedVaa } = require("@wormhole-foundation/sdk");
const fetch = require("node-fetch");

// Set the Wormhole chain ID for Ethereum/Sepolia manually
const CHAIN_ID_ETHEREUM = 2;

// Local helper for emitter address (Ethereum): left-pad 20 bytes to 32 bytes as hex string
function getEmitterAddressEth(address) {
  const addr = address.toLowerCase().replace(/^0x/, "");
  return "0".repeat(24) + addr;
}

// Wormhole Core Bridge address on Sepolia
const WORMHOLE_CORE_SEPOLIA = "0x4a8bc80ed5a4067f1ccf107057b8270e0cc11a78";

/**
 * Extracts the Wormhole message sequence from a transaction receipt.
 * It specifically looks for the 'LogMessagePublished' event from the Core Bridge.
 */
function getSequenceFromReceipt(receipt) {
  // The unique signature (topic) for the LogMessagePublished event.
  const LOG_MESSAGE_PUBLISHED_TOPIC =
    "0x6eb224fb001ed210e379b335e35efe88672a8ce935d981a6896b27ffdf52a3b2";

  // Find the specific log for the LogMessagePublished event.
  const coreLog = receipt.logs.find(
    (l) =>
      l.address.toLowerCase() === WORMHOLE_CORE_SEPOLIA.toLowerCase() &&
      l.topics[0].toLowerCase() === LOG_MESSAGE_PUBLISHED_TOPIC
  );

  if (!coreLog) {
    throw new Error(
      "LogMessagePublished event not found in transaction receipt"
    );
  }

  // The sequence number is the first non-indexed field in the log data.
  // It's a uint64, but it's padded to a full 32-byte word (64 hex characters).
  const sequenceHex = coreLog.data.substring(0, 66); // "0x" + 64 hex chars
  return BigInt(sequenceHex);
}

const ISSUER_ABI = [
  // ... (keep the LogCredentialIssued event here)
  {
    type: "event",
    name: "CrossChainMessageEmitted",
    inputs: [{ name: "sequence", type: "uint64", indexed: false }],
    anonymous: false,
  },
];
const MIRROR_ABI = [
  {
    inputs: [{ internalType: "bytes", name: "_vaa", type: "bytes" }],
    name: "receiveAndVerifyVAA",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

async function fetchVAA(chainId, emitterAddress, sequence) {
  const url = `https://api.testnet.wormholescan.io/api/v1/signed_vaa/${chainId}/${emitterAddress}/${sequence}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("VAA not found");
  const data = await response.json();
  if (!data.vaaBytes) throw new Error("VAA not found in response");
  return Buffer.from(data.vaaBytes, "base64");
}

async function fetchVAAWithRetry(
  chainId,
  emitterAddress,
  sequence,
  maxAttempts = 10,
  delayMs = 60000
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const vaa = await fetchVAA(chainId, emitterAddress, sequence);
      return vaa;
    } catch (e) {
      if (attempt === maxAttempts) throw e;
      console.log(
        `VAA not found, retrying in ${
          delayMs / 1000
        }s... (attempt ${attempt}/${maxAttempts})`
      );
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

// --- Main application logic is now in this function ---
function runListener() {
  console.log("🚀 Starting VAA listener for manual relay...");

  const sepoliaProvider = new ethers.WebSocketProvider(
    process.env.SEPOLIA_RPC_URL
  );
  const amoyProvider = new ethers.WebSocketProvider(process.env.AMOY_RPC_URL);
  const amoyWallet = new ethers.Wallet(
    process.env.PRIVATE_KEY_AMOY,
    amoyProvider
  );

  const issuerContract = new ethers.Contract(
    process.env.ISSUER_ADDRESS,
    ISSUER_ABI,
    sepoliaProvider
  );
  const mirrorContract = new ethers.Contract(
    process.env.MIRROR_ADDRESS,
    MIRROR_ABI,
    amoyWallet
  );

  console.log(
    `📡 Listening for events on Issuer contract: ${process.env.ISSUER_ADDRESS}`
  );
  console.log(`🪞 Mirror contract on Amoy: ${process.env.MIRROR_ADDRESS}`);

  // --- FINAL LISTENER LOGIC ---

  // Listen for the event that gives us the sequence number directly
  issuerContract.on("CrossChainMessageEmitted", async (sequence, event) => {
    const txHash = event.log.transactionHash;

    console.log("\n✅ Cross-Chain Message Published on Sepolia!");
    console.log(`   • Sequence:   ${sequence.toString()}`);
    console.log(`   • Sepolia tx: ${txHash}`);

    try {
      // The emitter address is your Issuer contract address, padded to 32 bytes
      const emitterAddress = getEmitterAddressEth(issuerContract.target);

      console.log("📡 Fetching VAA from Wormhole RPC…");

      const vaaBytes = await fetchVAAWithRetry(
        CHAIN_ID_ETHEREUM,
        emitterAddress,
        sequence.toString()
      );

      const vaaHex = "0x" + vaaBytes.toString("hex");
      console.log("✅ VAA fetched successfully!");
      console.log("Submitting VAA to Mirror contract on Amoy...");

      const tx = await mirrorContract.receiveAndVerifyVAA(vaaHex);

      console.log("⏳ Waiting for transaction confirmation on Amoy...");
      const receiptPoly = await tx.wait();

      console.log("✅🎉 Successfully mirrored credential to Amoy!");
      console.log(`   - Amoy Tx Hash: ${receiptPoly.transactionHash}`);
    } catch (error) {
      console.error(
        "❌ An error occurred during the relay process:",
        error.message
      );
    }
  });

  // --- END OF FINAL LISTENER LOGIC ---

  // We add a listener for connection errors on the provider
  sepoliaProvider.on("error", (error) => {
    console.error(
      "Provider error detected, will attempt to restart listener:",
      error
    );
    // When an error occurs, we throw it to trigger the catch block below
    throw error;
  });

  console.log("✅ Listener is now active and waiting for events...");
}

// --- This new block manages the listener's lifecycle ---
async function startApp() {
  while (true) {
    try {
      runListener();
      // Keep the script running
      await new Promise(() => {});
    } catch (error) {
      console.error(
        "Listener crashed with a connection error. Restarting in 10 seconds...",
        error.message
      );
      // Wait for 10 seconds before restarting
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

// Start the application
startApp();
