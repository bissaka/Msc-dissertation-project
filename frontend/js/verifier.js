// This JavaScript file handles the logic for the credential verifier UI.

// Import blockchain functions
import {
  connectToWallet,
  getContractForNetwork,
  getTargetNetworkId,
} from "./blockchain.js";

// Import services
import { fetchAndDecryptFile } from "./services.js";

// Import UI functions
import {
  initializeVerifierUI,
  getCidFromInput,
  updateStatus,
  updateStatusHTML,
  showCredentialDisplay,
  resetVerifierUI,
  promptForDecryptionPassword,
} from "./ui.js";

// Initialize UI elements
initializeVerifierUI();

// I'm adding event listeners to my verify buttons.
verifyEthBtn.addEventListener("click", () => verifyCredential("ethereum"));
verifyPolyBtn.addEventListener("click", () => verifyCredential("polygon"));

// This async function handles the entire verification process.
async function verifyCredential(network) {
  // I'm resetting the UI for a new verification attempt.
  resetVerifierUI();

  try {
    // I'm getting the CID the user entered.
    const enteredCid = getCidFromInput();

    // I'm calling my new function to perform the on-chain check first.
    const issuerAddress = await checkBlockchain(network, enteredCid);

    // If the on-chain check is successful, I'll fetch and decrypt the file.
    await processCredentialFile(enteredCid, issuerAddress);
  } catch (error) {
    updateStatus(`❌ ${error.message}`);
  }
}

// I'm creating a dedicated function for the blockchain verification part.
async function checkBlockchain(network, cid) {
  updateStatus(`Verifying on ${network}...`);

  const targetNetworkId = getTargetNetworkId(network);
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const currentNetwork = await provider.getNetwork();

  // ==================== ADD THIS ENHANCED LOG ====================
  console.log("--- NETWORK VERIFICATION CHECK ---");
  console.log(`Requested Verification On: ${network}`);
  console.log(`Target Network ID: ${targetNetworkId}`);
  console.log(`MetaMask's Current Network ID: ${currentNetwork.chainId}`);
  console.log("------------------------------------");
  // =============================================================

  if (currentNetwork.chainId.toString() !== targetNetworkId.toString()) {
    throw new Error(
      `Wrong Network: Please switch MetaMask to ${
        network.charAt(0).toUpperCase() + network.slice(1)
      }.`
    );
  }

  const contract = getContractForNetwork(network, provider);
  const cidHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(cid));

  // Check if credential exists
  const issuerAddress = await contract.cidIssuer(cidHash);

  if (issuerAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      "Verification Failed: This CID is not recorded on the blockchain."
    );
  }

  // Check revocation status
  const isRevoked = await contract.isRevoked(cidHash);

  if (isRevoked) {
    throw new Error("Verification Failed: This credential has been revoked.");
  }

  // If all checks pass, return the issuer's address.
  return issuerAddress;
}

// I'm creating a new async function to handle fetching, decrypting, and displaying the file.
async function processCredentialFile(cid, issuerAddress) {
  updateStatusHTML(
    `✅ <strong>On-Chain Verification Successful!</strong><br>Issued by: ${issuerAddress}<br>Fetching encrypted file from IPFS...`
  );

  // Get decryption password from user
  const decryptionKey = promptForDecryptionPassword();

  updateStatus("Decrypting file...");

  try {
    // Fetch and decrypt the file using the service
    const decryptedDataUrl = await fetchAndDecryptFile(cid, decryptionKey);

    // Display the result
    showCredentialDisplay(decryptedDataUrl);
    updateStatusHTML(
      `✅ <strong>Credential Verified and Decrypted Successfully!</strong><br>Issued by: ${issuerAddress}`
    );
  } catch (e) {
    throw new Error("Decryption failed. The password may be incorrect.");
  }
}
