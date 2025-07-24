// This JavaScript file handles the logic for the credential verifier UI.

// I'm selecting the HTML elements I'll need to interact with.
const cidInput = document.getElementById("cidInput");
const verifyEthBtn = document.getElementById("verifyEthBtn");
const verifyPolyBtn = document.getElementById("verifyPolyBtn");
const status = document.getElementById("status");
const credentialDisplay = document.getElementById("credentialDisplay");

// I'm defining the ABIs for the contracts.
const ISSUER_ABI = [
  {
    type: "function",
    name: "cidIssuer",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
];
const MIRROR_ABI = ISSUER_ABI;

// I'm defining the deployed addresses and the chain IDs for my target networks.
const ISSUER_ADDRESS = "0x13376Af705aE97b1B24AbA5dFa0D999a78bBEBd2"; // Ethereum Sepolia
const MIRROR_ADDRESS = "0xc356d2b2294F07778E9BdE7fc282fF6E99AB6568"; // Polygon Amoy
const SEPOLIA_CHAIN_ID = 11155111;
const AMOY_CHAIN_ID = 80002;

// I'm adding event listeners to my verify buttons.
verifyEthBtn.addEventListener("click", () => verifyCredential("ethereum"));
verifyPolyBtn.addEventListener("click", () => verifyCredential("polygon"));

// This async function handles the entire verification process.
async function verifyCredential(network) {
  // I'm resetting the UI for a new verification attempt.
  status.textContent = "";
  credentialDisplay.style.display = "none";

  try {
    // I'm getting the CID the user entered.
    const enteredCid = cidInput.value.trim();
    if (!enteredCid) {
      throw new Error("Please enter an IPFS CID.");
    }

    // I'm calling my new function to perform the on-chain check first.
    const issuerAddress = await checkBlockchain(network, enteredCid);

    // If the on-chain check is successful, I'll fetch and decrypt the file.
    await fetchAndDecryptFile(enteredCid, issuerAddress);
  } catch (error) {
    console.error(error);
    status.textContent = `❌ ${error.message}`;
  }
}

// I'm creating a dedicated function for the blockchain verification part.
async function checkBlockchain(network, cid) {
  status.textContent = `Verifying on ${network}...`;
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const targetNetworkId =
    network === "ethereum" ? SEPOLIA_CHAIN_ID : AMOY_CHAIN_ID;
  const currentNetwork = await provider.getNetwork();

  if (currentNetwork.chainId.toString() !== targetNetworkId.toString()) {
    throw new Error(
      `Wrong Network: Please switch MetaMask to ${
        network.charAt(0).toUpperCase() + network.slice(1)
      }.`
    );
  }

  const contractAddress =
    network === "ethereum" ? ISSUER_ADDRESS : MIRROR_ADDRESS;
  const contract = new ethers.Contract(contractAddress, ISSUER_ABI, provider);
  const cidHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(cid));
  const issuerAddress = await contract.cidIssuer(cidHash);

  if (issuerAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      "Verification Failed: This CID is not recorded on the blockchain."
    );
  }

  // If the check succeeds, I'll return the issuer's address.
  return issuerAddress;
}

// I'm creating a new async function to handle fetching, decrypting, and displaying the file.
async function fetchAndDecryptFile(cid, issuerAddress) {
  status.innerHTML = `✅ <strong>On-Chain Verification Successful!</strong><br>Issued by: ${issuerAddress}<br>Fetching encrypted file from IPFS...`;

  // I'm constructing the IPFS gateway URL.
  const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
  // I'm fetching the encrypted file.
  const response = await fetch(gatewayUrl);
  if (!response.ok) {
    throw new Error("Could not fetch file from IPFS.");
  }

  // I'm getting the encrypted text from the response.
  const encryptedText = await response.text();

  // I'm now prompting the user for the password to decrypt the file.
  const decryptionKey = prompt(
    "Please enter the password to decrypt the credential:"
  );
  if (!decryptionKey) {
    throw new Error("Decryption password is required.");
  }

  status.textContent = "Decrypting file...";

  let decryptedDataUrl;
  try {
    // I'm using CryptoJS to decrypt the content.
    const decryptedBytes = CryptoJS.AES.decrypt(encryptedText, decryptionKey);
    // I'm converting the decrypted bytes back into a UTF-8 string (our original Base64 data URL).
    decryptedDataUrl = decryptedBytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    // If an error occurs here, it's almost certainly due to a bad password creating malformed data.
    console.error("Decryption failed:", e);
    // I'm throwing my own, user-friendly error.
    throw new Error("Decryption failed. The password may be incorrect.");
  }

  // I'm also checking if the resulting string is empty, which is another sign of failure.
  if (!decryptedDataUrl) {
    throw new Error("Decryption failed. The password may be incorrect.");
  }

  // If decryption is successful, I'll display the result in the iframe.
  credentialDisplay.src = decryptedDataUrl;
  credentialDisplay.style.display = "block";
  status.innerHTML = `✅ <strong>Credential Verified and Decrypted Successfully!</strong><br>Issued by: ${issuerAddress}`;
}
