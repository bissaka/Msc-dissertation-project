// SPDX-License-Identifier: UNLICENSED
// ui.js - UI manipulation and DOM helper functions

// --- DOM Elements ---
let statusDiv,
  fileInput,
  issueBtn,
  batchIssueBtn,
  cidInput,
  verifyEthBtn,
  verifyPolyBtn,
  credentialDisplay;

/**
 * Initialize DOM elements for the institution page
 */
export function initializeInstitutionUI() {
  fileInput = document.getElementById("credentialFile");
  issueBtn = document.getElementById("issueBtn");
  batchIssueBtn = document.getElementById("batchIssueBtn");
  statusDiv = document.getElementById("status");
}

/**
 * Initialize DOM elements for the verifier page
 */
export function initializeVerifierUI() {
  cidInput = document.getElementById("cidInput");
  verifyEthBtn = document.getElementById("verifyEthBtn");
  verifyPolyBtn = document.getElementById("verifyPolyBtn");
  statusDiv = document.getElementById("status");
  credentialDisplay = document.getElementById("credentialDisplay");
}

/**
 * Get the file from the file input
 * @returns {File} - Returns the selected file
 */
export function getFileFromInput() {
  if (!fileInput.files || fileInput.files.length === 0) {
    throw new Error("Please select a file to upload.");
  }
  return fileInput.files[0];
}

/**
 * Get all files from the file input
 * @returns {FileList} - Returns all selected files
 */
export function getAllFilesFromInput() {
  if (!fileInput.files || fileInput.files.length === 0) {
    throw new Error("Please select at least one file to upload.");
  }
  return fileInput.files;
}

/**
 * Get the CID from the input field
 * @returns {string} - Returns the entered CID
 */
export function getCidFromInput() {
  const enteredCid = cidInput.value.trim();
  if (!enteredCid) {
    throw new Error("Please enter an IPFS CID.");
  }
  return enteredCid;
}

/**
 * Update the status message
 * @param {string} message - The message to display
 */
export function updateStatus(message) {
  if (statusDiv) {
    statusDiv.textContent = message;
  }
}

/**
 * Update the status message with HTML content
 * @param {string} html - The HTML content to display
 */
export function updateStatusHTML(html) {
  if (statusDiv) {
    statusDiv.innerHTML = html;
  }
}

/**
 * Show credential display
 * @param {string} dataUrl - The data URL to display
 */
export function showCredentialDisplay(dataUrl) {
  if (credentialDisplay) {
    credentialDisplay.src = dataUrl;
    credentialDisplay.style.display = "block";
  }
}

/**
 * Hide credential display
 */
export function hideCredentialDisplay() {
  if (credentialDisplay) {
    credentialDisplay.style.display = "none";
  }
}

/**
 * Reset the verifier UI for a new verification attempt
 */
export function resetVerifierUI() {
  if (statusDiv) {
    statusDiv.textContent = "";
  }
  hideCredentialDisplay();
}

/**
 * Handle application errors and display user-friendly messages
 * @param {Error} error - The error object
 */
export function handleAppError(error) {
  let message = error.message;

  if (error.code === "ACTION_REJECTED") {
    message = "You rejected the transaction in MetaMask.";
  } else if (error.code === "INSUFFICIENT_FUNDS") {
    message = "You have insufficient funds for this transaction.";
  } else if (error.reason) {
    message = `Transaction failed: ${error.reason}`;
  }

  updateStatusHTML(`<strong>Error:</strong> ${message}`);
}

/**
 * Prompt user for encryption password with strong password validation
 * @returns {string} - Returns the validated strong password
 */
export function promptForEncryptionPassword() {
  let encryptionKey = null;
  const passwordCriteria = `Password must be at least 8 characters long and contain:
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (e.g., !, @, #, $)`;

  const strongPasswordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

  while (true) {
    encryptionKey = prompt(
      "Please enter a password to encrypt the credential file.\n\n" +
        passwordCriteria
    );

    if (encryptionKey === null) {
      // User cancelled the prompt
      throw new Error("Encryption password is required.");
    }

    if (strongPasswordRegex.test(encryptionKey)) {
      // Password is strong, break the loop
      break;
    } else {
      // Password is not strong, alert the user and loop again
      alert(
        "Password does not meet the strength requirements. Please try again."
      );
    }
  }

  return encryptionKey;
}

/**
 * Prompt user for decryption password
 * @returns {string|null} - Returns the password or null if cancelled
 */
export function promptForDecryptionPassword() {
  const decryptionKey = prompt(
    "Please enter the password to decrypt the credential:"
  );
  if (!decryptionKey) {
    throw new Error("Decryption password is required.");
  }
  return decryptionKey;
}

/**
 * Generate a random password for batch operations
 * @returns {string} - Returns a 16-character alphanumeric password
 */
export function generateRandomPassword() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Create and download a CSV file
 * @param {Array} data - Array of objects with filename, ipfs_cid, decryption_password
 * @param {string} filename - Name of the CSV file
 */
export function downloadCSV(data, filename) {
  const headers = ["filename", "ipfs_cid", "decryption_password"];
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      [
        `"${row.filename}"`,
        `"${row.ipfs_cid}"`,
        `"${row.decryption_password}"`,
      ].join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Confirm batch issuance with user
 * @returns {boolean} - Returns true if user confirms, false otherwise
 */
export function confirmBatchIssuance() {
  return confirm(
    "The Secret Key File has been downloaded. This is your only copy of the decryption passwords. Do you want to proceed with the on-chain transaction?"
  );
}
