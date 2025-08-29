# Cross-Chain Verifiable Credentials using Wormhole and IPFS

This project presents a decentralized application (DApp) for issuing and verifying credentials across different blockchains. It leverages the **Wormhole** protocol for cross-chain communication, **IPFS** for decentralized file storage, and **Ethereum/Polygon** for on-chain logic. This system allows an institution to issue a credential on one chain (e.g., Ethereum Sepolia) and have it be verifiable on another (e.g., Polygon Amoy), ensuring data integrity and interoperability.

---

## 🚀 How It Works

The application is composed of four main components that work in concert to create a seamless cross-chain experience:

1.  **Smart Contracts (Solidity):**
    * `Issuer.sol`: Deployed on the source chain (Ethereum Sepolia). This contract is responsible for issuing new credentials. It records a hash of the credential's content and its IPFS CID, then emits an event via the Wormhole protocol.
    * `Mirror.sol`: Deployed on the destination chain (Polygon Amoy). This contract listens for messages from the `Issuer` contract via Wormhole and stores the credential data, creating a mirrored record.

2.  **Backend Server (Node.js/Express):**
    * A simple server that handles the secure upload of encrypted credential files to IPFS via the Pinata service. This abstracts away API keys and provides a single endpoint for the frontend.

3.  **Wormhole Listener (Node.js):**
    * A dedicated off-chain service that monitors the `Issuer` contract for new credential events. When an event is detected, it fetches the corresponding Verified Action Approval (VAA) from the Wormhole network and relays it to the `Mirror` contract on the destination chain.

4.  **Frontend (HTML, CSS, JavaScript):**
    * Provides two user-friendly interfaces: one for the issuing institution to upload and issue credentials, and another for a verifier to check the validity of a credential on either blockchain.

---

## ✨ Features

* **Cross-Chain Issuance & Verification:** Issue on one chain, verify on another.
* **Decentralized Storage:** Credential files are stored on IPFS, ensuring they are tamper-proof and perpetually accessible.
* **End-to-End Encryption:** Credentials are encrypted client-side before being uploaded to IPFS, ensuring privacy.
* **Single & Batch Issuance:** Supports the issuance of a single credential or a batch of credentials in a single transaction.
* **Revocation Capability:** The owner of the contracts can revoke credentials on-chain.
* **Comprehensive Testing:** Includes a full suite of tests for the smart contracts (Foundry) and the backend server (Jest).

---

## 🛠️ Technology Stack

* **Blockchain:** Solidity, Ethereum (Sepolia), Polygon (Amoy)
* **Smart Contract Development:** Foundry
* **Cross-Chain Protocol:** Wormhole
* **Decentralized Storage:** IPFS (via Pinata)
* **Backend:** Node.js, Express.js
* **Frontend:** HTML, CSS, JavaScript, Ethers.js
* **Testing:** Jest

---

## 🏁 Getting Started

Follow these instructions to set up and run the project locally. The project is structured as a monorepo with separate packages for each component.

### Prerequisites

* [Node.js](https://nodejs.org/en/) (v18 or later)
* [Foundry](https://getfoundry.sh/) (for smart contract development)
* [MetaMask](https://metamask.io/) browser extension
* A Pinata account for IPFS uploads.
* RPC URLs for Ethereum Sepolia and Polygon Amoy (e.g., from Alchemy or Infura).

### 1. Project Setup

Clone the repository and install the dependencies for the `backend` and `listener` services:

```bash
git clone <your-repository-url>
cd <your-repository-folder>

# Install backend dependencies
cd backend
npm install
cd ..

# Install listener dependencies
cd listener
npm install
cd ..
```

2. Environment Variables
You will need to create three separate .env files, one inside each of the backend, listener, and contracts directories.

A. backend/.env file:
```bash
# Pinata API Keys
PINATA_API_KEY="YOUR_PINATA_API_KEY"
PINATA_API_SECRET="YOUR_PINATA_API_SECRET"
```

B. listener/.env file:
```bash
# Blockchain RPC URLs & Private Key for Relaying
SEPOLIA_RPC_URL="YOUR_SEPOLIA_RPC_URL"
AMOY_RPC_URL="YOUR_AMOY_RPC_URL"
PRIVATE_KEY_AMOY="YOUR_AMOY_RELAYER_PRIVATE_KEY"
```

C. contracts/.env file:
```bash
# Blockchain RPC URLs & Private Keys for Deployment
SEPOLIA_RPC_URL="YOUR_SEPOLIA_RPC_URL"
AMOY_RPC_URL="YOUR_AMOY_RPC_URL"
PRIVATE_KEY_SEPOLIA="YOUR_SEPOLIA_DEPLOYER_PRIVATE_KEY"
PRIVATE_KEY_AMOY="YOUR_AMOY_DEPLOYER_PRIVATE_KEY"
```

3. Smart Contract Deployment and Linking
This is a three-step process that must be done from the contracts directory.

```bash
cd contracts
```

Step 3.1: Deploy the Issuer Contract to Sepolia
```bash
forge script script/DeployIssuer.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify -vvvv
```
After this command finishes, copy the deployed contract address for the Issuer.

Step 3.2: Deploy the Mirror Contract to Amoy
```bash
export ISSUER_ADDRESS="<PASTE_ISSUER_ADDRESS_FROM_STEP_3.1>"
forge script script/DeployMirror.s.sol --rpc-url $AMOY_RPC_URL --broadcast --verify -vvvv
```
After this command finishes, copy the deployed contract address for the Mirror.

Step 3.3: Link the Contracts Together
This final command tells the Issuer contract where the Mirror contract is.
```bash
cast send $ISSUER_ADDRESS "setMirrorContract(address)" <PASTE_MIRROR_ADDRESS_FROM_STEP_3.2> --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY_SEPOLIA
```
Finally, navigate back to the root directory and update the ISSUER_ADDRESS and MIRROR_ADDRESS in frontend/js/constants.js with the new contract addresses.
```bash
cd ..
```

4. Running the Application Components
You will need to run three separate processes in three different terminals from the project's root directory.

Terminal 1: Start the Backend Server
```bash
node backend/server.js
```

Terminal 2: Start the Wormhole Listener
```bash
node listener/listener.js
```

Terminal 3: Serve the Frontend
The easiest way to show the front end is using the Live Server extension in VS Code.

5. Using the Application
To Issue: Open the institution.html page, connect your MetaMask wallet to the Sepolia network, select a file, and issue the credential.

To Verify: Open the verifier.html page, connect your MetaMask wallet to either Sepolia or Amoy, paste the IPFS CID of the credential, and click verify.

🧪 Testing
The project includes a comprehensive suite of tests for both the smart contracts and the backend.

Smart Contract Tests
Navigate to the contracts directory and run the Foundry tests:
```bash
cd contracts
forge test
cd ..
```

Backend Server Tests
Navigate to the backend directory and run the Jest tests:
```bash
cd backend
npm test
cd ..
```

📂 Project Structure
```bash
.
├── backend/
│   ├── .env
│   ├── server.js
│   ├── server.test.js
│   ├── jest.config.js
│   └── package.json
│
├── contracts/
│   ├── .env
│   ├── src/
│   │   ├── Issuer.sol
│   │   └── Mirror.sol
│   ├── script/
│   │   ├── DeployIssuer.s.sol
│   │   └── DeployMirror.s.sol
│   ├── test/
│   │   ├── Issuer.t.sol
│   │   └── Mirror.t.sol
│   └── foundry.toml
│
├── frontend/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── institution.js
│   │   ├── verifier.js
│   │   ├── ui.js
│   │   ├── services.js
│   │   ├── blockchain.js
│   │   └── constants.js
│   ├── institution.html
│   └── verifier.html
│
├── listener/
│   ├── .env
│   ├── listener.js
│   ├── loadtest.js
│   └── package.json
│
└── .gitignore
```
