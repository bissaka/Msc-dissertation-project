// I'm importing the 'express' module, which is the framework I'll use to build the web server.
const express = require("express");
// I'm importing the 'multer' module, which will help me handle file uploads from HTML forms.
const multer = require("multer");
// I'm importing the 'cors' module to handle Cross-Origin Resource Sharing, allowing my frontend to talk to this server.
const cors = require("cors");
// I'm importing the 'dotenv' module to load my secret API keys from the .env file.
require("dotenv").config();
// I'm adding these lines to debug and see what variables are being loaded.
console.log("Pinata API Key Loaded:", process.env.PINATA_API_KEY);
console.log("Pinata Secret Key Loaded:", process.env.PINATA_API_SECRET);
// I'm importing the Pinata SDK, which provides easy-to-use functions for interacting with the Pinata IPFS service.
const pinataSDK = require("@pinata/sdk");
// I'm importing the built-in 'stream' module, which I need to handle the file data.
const stream = require("stream");

// I'm creating an instance of my Express application.
const app = express();
// I'm defining the port number for my server, using the one from my .env file or defaulting to 3000.
const PORT = process.env.PORT || 3000;

// I'm telling my Express app to use the CORS middleware. This is crucial for allowing browser requests.
app.use(cors());

// I'm setting up Multer to store uploaded files in memory as a buffer, rather than saving them to disk.
const storage = multer.memoryStorage();
// I'm creating a Multer instance with the storage configuration, ready to be used as middleware.
const upload = multer({ storage: storage });

// I'm initializing the Pinata SDK using the API key and secret stored in my .env file.
const pinata = new pinataSDK(
  process.env.PINATA_API_KEY,
  process.env.PINATA_API_SECRET
);

// I'm defining the main endpoint for my server: a POST request to '/upload'.
// I'm using the 'upload.single('file')' middleware to process a single file from a form field named 'file'.
app.post("/upload", upload.single("file"), async (req, res) => {
  // I'm checking if the request actually contains a file.
  if (!req.file) {
    // If there's no file, I'm sending back a 400 error with a clear message.
    return res.status(400).json({ error: "No file uploaded." });
  }

  // I'm starting a try-catch block to handle potential errors during the upload process.
  try {
    // I'm creating a readable stream from the file buffer that Multer has provided me.
    const fileStream = stream.Readable.from(req.file.buffer);

    // I'm setting up some options for the Pinata upload.
    const options = {
      // I'm defining the metadata for the file on Pinata.
      pinataMetadata: {
        // I'm setting the name of the file on Pinata to be the original name of the uploaded file.
        name: req.file.originalname,
      },
    };

    // I'm calling the Pinata SDK's 'pinFileToIPFS' method to upload the file.
    // I'm passing the file stream and the options I defined.
    const result = await pinata.pinFileToIPFS(fileStream, options);

    // If the upload is successful, I'm sending back a JSON response.
    // The response contains the IPFS Hash, which I'm labeling as 'cid'.
    return res.json({ cid: result.IpfsHash });
  } catch (error) {
    // If any error occurs in the 'try' block, I'll catch it here.
    // I'm logging the detailed error to my server's console for debugging.
    console.error("Error uploading to Pinata:", error);
    // I'm sending back a 500 Internal Server Error to the client.
    return res.status(500).json({ error: "Failed to upload file to Pinata." });
  }
});

// I'm starting my Express server and telling it to listen for requests on the specified port.
app.listen(PORT, () => {
  // Once the server is running, I'm logging a confirmation message to the console.
  console.log(`Server is running on port ${PORT}`);
});
