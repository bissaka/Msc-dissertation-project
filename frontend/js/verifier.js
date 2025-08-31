// This JavaScript file handles the logic for the credential verifier UI.


import {
  connectToWallet,
  getContractForNetwork,
  getTargetNetworkId,
} from "./blockchain.js";


import { fetchAndDecryptFile } from "./services.js";


import {
  initializeVerifierUI,
  getCidFromInput,
  updateStatus,
  updateStatusHTML,
  showCredentialDisplay,
  resetVerifierUI,
  promptForDecryptionPassword,
} from "./ui.js";


initializeVerifierUI();


verifyEthBtn.addEventListener("click", () => verifyCredential("ethereum"));
verifyPolyBtn.addEventListener("click", () => verifyCredential("polygon"));


async function verifyCredential(network) {
  
  resetVerifierUI();

  try {
    
    const enteredCid = getCidFromInput();

    
    const issuerAddress = await checkBlockchain(network, enteredCid);

    
    await processCredentialFile(enteredCid, issuerAddress);
  } catch (error) {
    updateStatus(`❌ ${error.message}`);
  }
}


async function checkBlockchain(network, cid) {
  updateStatus(`Verifying on ${network}...`);

  const targetNetworkId = getTargetNetworkId(network);
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const currentNetwork = await provider.getNetwork();

  console.log("--- NETWORK VERIFICATION CHECK ---");
  console.log(`Requested Verification On: ${network}`);
  console.log(`Target Network ID: ${targetNetworkId}`);
  console.log(`MetaMask's Current Network ID: ${currentNetwork.chainId}`);
  console.log("------------------------------------");

  if (currentNetwork.chainId.toString() !== targetNetworkId.toString()) {
    throw new Error(
      `Wrong Network: Please switch MetaMask to ${
        network.charAt(0).toUpperCase() + network.slice(1)
      }.`
    );
  }

  const contract = getContractForNetwork(network, provider);
  const cidHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(cid));

  
  const issuerAddress = await contract.cidIssuer(cidHash);

  if (issuerAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      "Verification Failed: This CID is not recorded on the blockchain."
    );
  }

  
  const isRevoked = await contract.isRevoked(cidHash);

  if (isRevoked) {
    throw new Error("Verification Failed: This credential has been revoked.");
  }

  
  return issuerAddress;
}


async function processCredentialFile(cid, issuerAddress) {
  updateStatusHTML(
    `✅ <strong>On-Chain Verification Successful!</strong><br>Issued by: ${issuerAddress}<br>Fetching encrypted file from IPFS...`
  );

  
  const decryptionKey = promptForDecryptionPassword();

  updateStatus("Decrypting file...");

  try {
    
    const decryptedDataUrl = await fetchAndDecryptFile(cid, decryptionKey);

    
    showCredentialDisplay(decryptedDataUrl);
    updateStatusHTML(
      `✅ <strong>Credential Verified and Decrypted Successfully!</strong><br>Issued by: ${issuerAddress}`
    );
  } catch (e) {
    throw new Error("Decryption failed. The password may be incorrect.");
  }
}
