// --- START OF FINAL CONSTANTS SECTION ---

// --- PASTE YOUR LATEST DEPLOYED ADDRESSES HERE ---
const ISSUER_ADDRESS_STRING = "0x13376Af705aE97b1B24AbA5dFa0D999a78bBEBd2";
const MIRROR_ADDRESS_AMOY_STRING = "0xc356d2b2294F07778E9BdE7fc282fF6E99AB6568";
// --- END OF ADDRESSES ---

const RELAYER_ADDRESS_STRING = "0x7B1bD7a6b4E61c2a123AC6BC2cbfC614437D0470"; // Official Sepolia Relayer

// We pre-process the addresses to prevent Ethers.js errors.
const ISSUER_ADDRESS = ethers.utils.getAddress(ISSUER_ADDRESS_STRING);
const MIRROR_ADDRESS_AMOY = ethers.utils.getAddress(MIRROR_ADDRESS_AMOY_STRING);
const RELAYER_ADDRESS_SEPOLIA = ethers.utils.getAddress(RELAYER_ADDRESS_STRING);

const WORMHOLE_CHAIN_ID_AMOY = 5; // Wormhole Chain ID for Amoy/Polygon
const SEPOLIA_CHAIN_ID = 11155111; // MetaMask Network ID

// Must match the on‑chain relayer: three args, no address
const RELAYER_ABI = [
  "function quoteEVMDeliveryPrice(uint16,uint256,uint256) view returns (uint256 nativeFee, uint256 relayerFee)",
];

const ISSUER_ABI = [
  {
    type: "function",
    name: "issueCredentialWithRelay", // This must match your Issuer.sol
    inputs: [{ name: "_cid", type: "string", internalType: "string" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "event",
    name: "LogCredentialIssued",
    inputs: [
      { name: "issuer", type: "address", indexed: true },
      { name: "cid", type: "string", indexed: false },
      { name: "cidHash", type: "bytes32", indexed: true },
    ],
    anonymous: false,
  },
];

// --- END OF FINAL CONSTANTS SECTION ---

const fileInput = document.getElementById("credentialFile");
const issueBtn = document.getElementById("issueBtn");
const statusDiv = document.getElementById("status");

issueBtn.addEventListener("click", async () => {
  try {
    const originalFile = getFileFromInput();
    const encryptionKey = prompt(
      "Please enter a password to encrypt the credential file:"
    );
    if (!encryptionKey) {
      throw new Error("Encryption password is required.");
    }
    const encryptedFile = await encryptFile(originalFile, encryptionKey);
    const cid = await uploadToIPFS(encryptedFile);
    const signer = await connectToWallet();
    await issueOnChain(signer, cid);
  } catch (error) {
    handleAppError(error);
  }
});

function getFileFromInput() {
  statusDiv.textContent = "Checking for file...";
  if (!fileInput.files || fileInput.files.length === 0) {
    throw new Error("Please select a file to upload.");
  }
  return fileInput.files[0];
}

async function encryptFile(file, key) {
  statusDiv.textContent = "Encrypting file...";
  const reader = new FileReader();
  const fileContents = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
  const encrypted = CryptoJS.AES.encrypt(fileContents, key).toString();
  const encryptedBlob = new Blob([encrypted], { type: "text/plain" });
  return new File([encryptedBlob], `${file.name}.enc`, { type: "text/plain" });
}

async function uploadToIPFS(file) {
  statusDiv.textContent = "Uploading encrypted file to IPFS...";
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("http://localhost:3000/upload", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error("File upload to backend failed.");
  }
  const result = await response.json();
  statusDiv.textContent = `Encrypted file uploaded successfully to IPFS.`;
  return result.cid;
}

async function connectToWallet() {
  statusDiv.textContent = "Connecting to MetaMask...";
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const network = await provider.getNetwork();
  if (network.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      "Wrong Network: Please switch MetaMask to the Sepolia testnet."
    );
  }
  return provider.getSigner();
}

async function issueOnChain(signer, cid) {
  statusDiv.innerHTML = `Preparing transaction...`;
  const issuerContract = new ethers.Contract(
    ISSUER_ADDRESS,
    ISSUER_ABI,
    signer
  );

  const relayerContract = new ethers.Contract(
    RELAYER_ADDRESS_SEPOLIA,
    RELAYER_ABI,
    signer.provider
  );

  const gasLimit = 200000;
  const receiverValue = 0; // no native tokens forwarded
  // const receiver = MIRROR_ADDRESS_AMOY; // Mirror contract on Amoy (no longer needed)

  statusDiv.innerHTML = "Getting delivery cost quote from Wormhole Relayer...";
  const [nativeFee, relayerFee] = await relayerContract.quoteEVMDeliveryPrice(
    WORMHOLE_CHAIN_ID_AMOY,
    receiverValue,
    gasLimit
  );

  const totalFee = nativeFee.add(relayerFee);
  statusDiv.innerHTML = `Sending transaction via Relayer...<br>Total Cost: ${ethers.utils.formatEther(
    totalFee
  )} ETH`;

  // Call the issueCredentialWithRelay function with the correct total fee.
  const tx = await issuerContract.issueCredentialWithRelay(cid, {
    value: totalFee,
  });

  await tx.wait();
  statusDiv.innerHTML = `<strong>✅ Credential message sent!</strong><br>Delivery to Amoy will complete automatically.`;
}

function handleAppError(error) {
  console.error(error);
  if (error.code === "ACTION_REJECTED") {
    statusDiv.innerHTML = `<strong>Error:</strong> You rejected the transaction in MetaMask.`;
  } else if (error.code === "INSUFFICIENT_FUNDS") {
    statusDiv.innerHTML = `<strong>Error:</strong> Insufficient funds to complete the transaction.`;
  } else if (error.code === "UNPREDICTABLE_GAS_LIMIT" && error.reason) {
    statusDiv.innerHTML = `<strong>Error:</strong> ${error.reason}`;
  } else if (error.message && error.message.includes("Failed to fetch")) {
    statusDiv.innerHTML = `<strong>Error:</strong> Cannot connect to the backend server. Please make sure it is running.`;
  } else if (error.message) {
    statusDiv.innerHTML = `<strong>Error:</strong> ${error.message}`;
  } else {
    statusDiv.innerHTML = `<strong>An unexpected error occurred.</strong> Please check the console for details.`;
  }
}
