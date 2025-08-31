
const express = require("express");

const multer = require("multer");

const cors = require("cors");

require("dotenv").config();


const pinataSDK = require("@pinata/sdk");

const stream = require("stream");


const app = express();

const PORT = process.env.PORT || 3000;


const corsOptions = {
  origin: [
    "http://127.0.0.1:5500", 
    "http://localhost:5500", 
    "http://127.0.0.1:3000", 
    "http://localhost:3000", 
    "file://", 
    "http://127.0.0.1:5641",
  ],
  credentials: true, 
  optionsSuccessStatus: 200, 
};


app.use(cors(corsOptions));


const storage = multer.memoryStorage();

const upload = multer({ storage: storage });


const pinata = new pinataSDK(
  process.env.PINATA_API_KEY,
  process.env.PINATA_API_SECRET
);


app.post("/upload", upload.single("file"), async (req, res) => {
  
  if (!req.file) {
    
    return res.status(400).json({ error: "No file uploaded." });
  }

  
  try {
    
    const fileStream = stream.Readable.from(req.file.buffer);

    
    const options = {
      
      pinataMetadata: {
        
        name: req.file.originalname,
      },
    };

    
    const result = await pinata.pinFileToIPFS(fileStream, options);

    
    return res.json({ cid: result.IpfsHash });
  } catch (error) {
    
    console.error("Error uploading to Pinata:", error);
    
    return res.status(500).json({ error: "Failed to upload file to Pinata." });
  }
});


app.listen(PORT, () => {
  
  console.log(`Server is running on port ${PORT}`);
  console.log(`CORS enabled for origins: ${corsOptions.origin.join(", ")}`);
});
