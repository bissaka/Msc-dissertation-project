// SPDX-License-Identifier: UNLICENSED
// services.js - Business logic services (encryption, IPFS, etc.)

/**
 * Encrypt a file using AES encryption with PBKDF2 key derivation
 * @param {File} file - The file to encrypt
 * @param {string} key - The encryption key
 * @returns {Promise<File>} - Returns the encrypted file
 */
export async function encryptFile(file, key) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      // 1. Generate a random salt for each encryption
      const salt = CryptoJS.lib.WordArray.random(128 / 8);

      // 2. Derive a key from the password using PBKDF2
      const derivedKey = CryptoJS.PBKDF2(key, salt, {
        keySize: 256 / 32,
        iterations: 10000 // A higher number makes it slower
      });

      // 3. Encrypt the file content with the derived key
      const encrypted = CryptoJS.AES.encrypt(e.target.result, derivedKey.toString());

      // 4. Combine salt and ciphertext to be stored together
      const combinedData = salt.toString() + encrypted.toString();

      const encryptedBlob = new Blob([combinedData], { type: "text/plain" });
      resolve(new File([encryptedBlob], `${file.name}.enc`));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a file to IPFS via the backend server
 * @param {File} file - The file to upload
 * @returns {Promise<string>} - Returns the IPFS CID
 */
export async function uploadToIPFS(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("http://localhost:3000/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("IPFS upload failed. Is the backend server running?");
  }
  
  const result = await response.json();
  return result.cid;
}

/**
 * Fetch and decrypt a file from IPFS using PBKDF2 key derivation
 * @param {string} cid - The IPFS CID
 * @param {string} decryptionKey - The decryption key
 * @returns {Promise<string>} - Returns the decrypted data URL
 */
export async function fetchAndDecryptFile(cid, decryptionKey) {
  const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
  const response = await fetch(gatewayUrl);
  if (!response.ok) {
    throw new Error("Could not fetch file from IPFS.");
  }
  const combinedData = await response.text();

  // 1. Extract the salt and the ciphertext
  // The salt is 32 hex characters (16 bytes * 2 chars/byte)
  const salt = CryptoJS.enc.Hex.parse(combinedData.substring(0, 32));
  const encryptedText = combinedData.substring(32);

  // 2. Re-derive the same key using the password and the extracted salt
  const derivedKey = CryptoJS.PBKDF2(decryptionKey, salt, {
    keySize: 256 / 32,
    iterations: 10000
  });

  // 3. Decrypt the content with the derived key
  const decryptedBytes = CryptoJS.AES.decrypt(encryptedText, derivedKey.toString());
  const decryptedDataUrl = decryptedBytes.toString(CryptoJS.enc.Utf8);

  if (!decryptedDataUrl) {
    throw new Error("Decryption failed. The password may be incorrect.");
  }

  return decryptedDataUrl;
} 