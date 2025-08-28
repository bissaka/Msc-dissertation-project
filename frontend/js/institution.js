// SPDX-License-Identifier: UNLICENSED
// institution.js - High-level application workflow for credential issuance

// Import shared constants
import { SEPOLIA_CHAIN_ID } from "./constants.js";

// Import blockchain functions
import {
  connectToWallet,
  getIssuerContract,
  getCoreBridgeContract,
  batchIssueCredentials,
} from "./blockchain.js";

// Import services
import { encryptFile, uploadToIPFS } from "./services.js";

// Import UI functions
import {
  initializeInstitutionUI,
  getFileFromInput,
  getAllFilesFromInput,
  updateStatus,
  updateStatusHTML,
  handleAppError,
  promptForEncryptionPassword,
  generateRandomPassword,
  downloadCSV,
  confirmBatchIssuance,
} from "./ui.js";

// Initialize UI elements
initializeInstitutionUI();

/**
 * Reads a file and returns it as a Uint8Array.
 * @param {File} file The file to read.
 * @returns {Promise<Uint8Array>}
 */
function readFileAsBytes(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(new Uint8Array(event.target.result));
    };
    reader.onerror = (err) => {
      reject(err);
    };
    reader.readAsArrayBuffer(file);
  });
}

// --- Main Click Handlers ---
issueBtn.addEventListener("click", async () => {
  try {
    // This check ensures only one file is processed for single issuance.
    if (getAllFilesFromInput().length > 1) {
      throw new Error(
        "Please select only one file for single credential issuance. Use the 'Issue Batch' button for multiple files."
      );
    }
    updateStatusHTML("Starting process...");
    const originalFile = getFileFromInput();
    updateStatus("Hashing file content...");
    const fileBytes = await readFileAsBytes(originalFile);
    const contentHash = ethers.utils.keccak256(fileBytes);
    const encryptionKey = promptForEncryptionPassword();
    const encryptedFile = await encryptFile(originalFile, encryptionKey);
    const cid = await uploadToIPFS(encryptedFile);
    const signer = await connectToWallet(SEPOLIA_CHAIN_ID);
    await issueOnChain(
      signer,
      cid,
      contentHash,
      originalFile.name,
      encryptionKey
    );
  } catch (error) {
    handleAppError(error);
  }
});

batchIssueBtn.addEventListener("click", async () => {
  try {
    await handleBatchIssuance();
  } catch (error) {
    handleAppError(error);
  }
});

// --- High-level workflow functions ---

async function issueOnChain(
  signer,
  cid,
  contentHash,
  originalFilename,
  encryptionKey
) {
  updateStatus("Preparing transaction...");
  const issuerContract = getIssuerContract(signer);
  const coreBridge = getCoreBridgeContract(signer.provider);

  // Get the cheap message fee from the Core Bridge contract
  const fee = await coreBridge.messageFee();
  updateStatusHTML(
    `Sending transaction with Wormhole fee (${ethers.utils.formatEther(
      fee
    )} ETH)...`
  );

  // Call the 'issueCredential' function on your contract with content hash
  const tx = await issuerContract.issueCredential(cid, contentHash, {
    value: fee,
  });

  console.log(
    `[START] Ethereum Tx Confirmed by User & Sent: ${new Date().toISOString()}`
  );
  console.log(`        Tx Hash: ${tx.hash}`);

  updateStatusHTML(
    `Transaction sent. Waiting for confirmation...<br>Tx Hash: <a href="https://sepolia.etherscan.io/tx/${tx.hash}" target="_blank">${tx.hash}</a>`
  );
  const receipt = await tx.wait();

  updateStatusHTML(`
    <strong>✅ Credential issued on Sepolia!</strong><br>
    The off-chain listener will now pick this up and relay it to Amoy.<br>
    <strong>IPFS CID:</strong> ${cid}<br>
    <strong>Content Hash:</strong> ${contentHash}<br>
    <strong>Block:</strong> ${receipt.blockNumber}
  `);

  // Alert the user and prepare data for download
  alert(
    "Credential issued successfully! Your Secret Key File will now be downloaded."
  );

  const credentialData = [
    {
      filename: originalFilename,
      ipfs_cid: cid,
      decryption_password: encryptionKey,
    },
  ];

  // Create a unique filename and trigger the download
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const csvFilename = `credential-password-${timestamp}.csv`;
  downloadCSV(credentialData, csvFilename);
}

/**
 * Handle batch credential issuance workflow
 */
async function handleBatchIssuance() {
  updateStatusHTML("Starting batch issuance process...");

  // Step a: Get all selected files
  const files = getAllFilesFromInput();

  // This check ensures at least two files are selected for a batch.
  if (files.length < 2) {
    throw new Error("Please select at least two files for batch issuance.");
  }

  updateStatus(`Processing ${files.length} files...`);

  // Step b: Create array to hold credential data
  const batchData = [];
  const cids = [];
  const contentHashes = [];

  // Step c: Loop through each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    updateStatus(`Processing file ${i + 1} of ${files.length}: ${file.name}`);

    try {
      // Step c.i: Hash the file content
      const fileBytes = await readFileAsBytes(file);
      const contentHash = ethers.utils.keccak256(fileBytes);

      // Step c.ii: Generate random password
      const password = generateRandomPassword();

      // Step c.iii: Encrypt the file
      const encryptedFile = await encryptFile(file, password);

      // Step c.iv: Upload to IPFS
      const cid = await uploadToIPFS(encryptedFile);

      // Step c.v: Store data in array
      batchData.push({
        filename: file.name,
        ipfs_cid: cid,
        decryption_password: password,
      });

      cids.push(cid);
      contentHashes.push(contentHash);

      updateStatus(`✅ Processed: ${file.name}`);
    } catch (error) {
      updateStatusHTML(`❌ Error processing ${file.name}: ${error.message}`);
      throw error;
    }
  }

  // Step d: Generate CSV string
  updateStatus("Generating secret key file...");

  // Step e: Create downloadable link and trigger download
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `credential-passwords-${timestamp}.csv`;
  downloadCSV(batchData, filename);

  updateStatus(
    "Secret key file downloaded. Please confirm to proceed with on-chain transaction."
  );

  // Step f: Confirm with user
  const userConfirmed = confirmBatchIssuance();

  // Step g: Proceed with on-chain transaction if confirmed
  if (userConfirmed) {
    updateStatus("User confirmed. Proceeding with on-chain transaction...");
    const signer = await connectToWallet(SEPOLIA_CHAIN_ID);

    updateStatus("Sending batch transaction...");
    const receipt = await batchIssueCredentials(signer, cids, contentHashes);

    updateStatusHTML(`
      <strong>✅ Batch credentials issued on Sepolia!</strong><br>
      <strong>Files processed:</strong> ${files.length}<br>
      <strong>Transaction Hash:</strong> <a href="https://sepolia.etherscan.io/tx/${receipt.transactionHash}" target="_blank">${receipt.transactionHash}</a><br>
      <strong>Block:</strong> ${receipt.blockNumber}<br>
      <br>
      <strong>⚠️ Important:</strong> Keep your secret key file safe. It contains the only copy of the decryption passwords.
    `);
  } else {
    updateStatus("Batch issuance cancelled by user.");
  }
}

// --- Initialize ---
updateStatus("Ready to issue credentials.");
