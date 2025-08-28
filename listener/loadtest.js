// loadtest.js - v3 (Ethers v6 Syntax)
// A script for Experiment 3: Throughput and Reliability Under Load

require("dotenv").config();
const ethers = require("ethers");

// The path needs to go "up" one folder from /listener to the root, then into /frontend/js
const {
  ISSUER_ADDRESS,
  ISSUER_ABI,
  CORE_BRIDGE_ADDRESS_SEPOLIA,
  CORE_BRIDGE_ABI,
} = require("../frontend/js/constants.js");

// --- Configuration ---
const NUMBER_OF_TRANSACTIONS = 20;
const DELAY_BETWEEN_TRANSACTIONS_MS = 5000; // 5 seconds

// --- Main Test Function ---
async function runLoadTest() {
  console.log("🚀 Starting Throughput and Reliability Load Test...");
  console.log(`Will attempt to send ${NUMBER_OF_TRANSACTIONS} transactions.`);

  // Setup the provider and wallet for Sepolia (Ethers v6 syntax)
  const sepoliaProvider = new ethers.JsonRpcProvider(
    process.env.SEPOLIA_RPC_URL
  );
  const sepoliaWallet = new ethers.Wallet(
    process.env.PRIVATE_KEY_SEPOLIA,
    sepoliaProvider
  );

  console.log(`Issuing transactions from wallet: ${sepoliaWallet.address}`);

  // Get contract instances
  const issuerContract = new ethers.Contract(
    ISSUER_ADDRESS,
    ISSUER_ABI,
    sepoliaWallet
  );
  const coreBridge = new ethers.Contract(
    CORE_BRIDGE_ADDRESS_SEPOLIA,
    CORE_BRIDGE_ABI,
    sepoliaProvider
  );

  // Get the Wormhole fee once to reuse it
  const fee = await coreBridge.messageFee();
  console.log(
    `Using a constant Wormhole fee of ${ethers.formatEther(
      // Ethers v6 syntax
      fee
    )} ETH for all transactions.`
  );

  let transactionsSent = 0;

  for (let i = 0; i < NUMBER_OF_TRANSACTIONS; i++) {
    try {
      const credentialId = `load-test-${i + 1}-${Date.now()}`;
      const contentHash = ethers.keccak256(
        // Ethers v6 syntax
        ethers.toUtf8Bytes(credentialId) // Ethers v6 syntax
      );

      console.log(
        `\n[${i + 1}/${NUMBER_OF_TRANSACTIONS}] Sending transaction...`
      );
      const tx = await issuerContract.issueCredential(
        credentialId,
        contentHash,
        { value: fee }
      );
      transactionsSent++;

      console.log(`   ✅ Transaction sent! Hash: ${tx.hash}`);

      // We don't wait for confirmation here to simulate rapid fire, just a delay
      await new Promise((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_TRANSACTIONS_MS)
      );
    } catch (error) {
      console.error(
        `   ❌ Failed to send transaction ${i + 1}: ${error.message}`
      );
    }
  }

  console.log("\n\n--- Load Test Finished ---");
  console.log(`Total transactions sent to the network: ${transactionsSent}`);
  console.log("-----------------------------------------");
  console.log("Monitor your listener.js console to count successful relays.");
  console.log("-----------------------------------------");
}

runLoadTest().catch((error) => {
  console.error("A critical error occurred during the load test:", error);
  process.exit(1);
});
