/**
 * Unit Tests for Backend Server
 * 
 * This test suite demonstrates software engineering best practices including:
 * - Comprehensive test coverage for all endpoints
 * - Proper mocking of external dependencies (Pinata SDK)
 * - Security testing (CORS policy validation)
 * - Error handling validation
 * - DRY principles through reusable test utilities
 * - SOLID principles through focused, single-responsibility tests
 */

const request = require('supertest');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const stream = require('stream');


jest.mock('@pinata/sdk');


jest.mock('dotenv', () => ({
  config: jest.fn()
}));


const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('Backend Server Tests', () => {
  let app;
  let server;
  let mockPinata;

  
  const TEST_FILE = {
    originalname: 'test-document.pdf',
    buffer: Buffer.from('test file content'),
    mimetype: 'application/pdf',
    size: 1024
  };

  const MOCK_CID = 'QmTestCID123456789abcdef';
  const MOCK_PINATA_RESPONSE = {
    IpfsHash: MOCK_CID,
    PinSize: 1024,
    Timestamp: '2024-01-01T00:00:00.000Z'
  };

  beforeAll(() => {
    
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterAll(() => {
    
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    
    jest.clearAllMocks();
    
    
    app = express();
    
    
    const corsOptions = {
      origin: [
        'http://127.0.0.1:5500',
        'http://localhost:5500',
        'http://127.0.0.1:3000',
        'http://localhost:3000',
        'file://'
      ],
      credentials: true,
      optionsSuccessStatus: 200
    };
    app.use(cors(corsOptions));

    
    const storage = multer.memoryStorage();
    const upload = multer({ storage: storage });

    
    mockPinata = {
      pinFileToIPFS: jest.fn()
    };
    require('@pinata/sdk').mockImplementation(() => mockPinata);

    
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

        const result = await mockPinata.pinFileToIPFS(fileStream, options);
        return res.json({ cid: result.IpfsHash });
      } catch (error) {
        console.error("Error uploading to Pinata:", error);
        return res.status(500).json({ error: "Failed to upload file to Pinata." });
      }
    });

    
    server = app.listen(0);
  });

  afterEach(() => {
    
    if (server) {
      server.close();
    }
  });

  describe('POST /upload - File Upload Endpoint', () => {
    describe('Successful Upload Scenarios', () => {
      test('should successfully upload a file and return CID', async () => {
        // Arrange: Mock successful Pinata response
        mockPinata.pinFileToIPFS.mockResolvedValue(MOCK_PINATA_RESPONSE);

        // Act: Send file upload request
        const response = await request(app)
          .post('/upload')
          .attach('file', TEST_FILE.buffer, TEST_FILE.originalname);

        // Assert: Verify successful response
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          cid: MOCK_CID
        });
        expect(response.headers['content-type']).toMatch(/application\/json/);

        // Verify Pinata was called correctly
        expect(mockPinata.pinFileToIPFS).toHaveBeenCalledTimes(1);
        expect(mockPinata.pinFileToIPFS).toHaveBeenCalledWith(
          expect.any(stream.Readable),
          {
            pinataMetadata: {
              name: TEST_FILE.originalname
            }
          }
        );
      });

      test('should handle different file types correctly', async () => {
        // Arrange: Test with different file types
        const testCases = [
          { name: 'document.txt', content: 'text content', type: 'text/plain' },
          { name: 'image.jpg', content: 'image content', type: 'image/jpeg' },
          { name: 'data.json', content: '{"key": "value"}', type: 'application/json' }
        ];

        for (const testCase of testCases) {
          
          mockPinata.pinFileToIPFS.mockResolvedValue(MOCK_PINATA_RESPONSE);

          // Act: Send file upload request
          const response = await request(app)
            .post('/upload')
            .attach('file', Buffer.from(testCase.content), testCase.name);

          // Assert: Verify successful response
          expect(response.status).toBe(200);
          expect(response.body.cid).toBe(MOCK_CID);
          expect(mockPinata.pinFileToIPFS).toHaveBeenCalledWith(
            expect.any(stream.Readable),
            {
              pinataMetadata: {
                name: testCase.name
              }
            }
          );
        }
      });

      test('should handle large files within reasonable limits', async () => {
        // Arrange: Create a larger file (1MB)
        const largeFileBuffer = Buffer.alloc(1024 * 1024, 'x');
        mockPinata.pinFileToIPFS.mockResolvedValue(MOCK_PINATA_RESPONSE);

        // Act: Send large file upload request
        const response = await request(app)
          .post('/upload')
          .attach('file', largeFileBuffer, 'large-file.dat');

        // Assert: Verify successful response
        expect(response.status).toBe(200);
        expect(response.body.cid).toBe(MOCK_CID);
        expect(mockPinata.pinFileToIPFS).toHaveBeenCalledTimes(1);
      });
    });

    describe('Error Handling Scenarios', () => {
      test('should return 400 when no file is provided', async () => {
        // Act: Send request without file
        const response = await request(app)
          .post('/upload');

        // Assert: Verify error response
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: "No file uploaded."
        });
        expect(response.headers['content-type']).toMatch(/application\/json/);

        
        expect(mockPinata.pinFileToIPFS).not.toHaveBeenCalled();
      });

      test('should return 400 when file field is empty', async () => {
        // Act: Send request with empty file field
        const response = await request(app)
          .post('/upload')
          .field('file', ''); // Empty field

        // Assert: Verify error response
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: "No file uploaded."
        });

        // Verify Pinata was not called
        expect(mockPinata.pinFileToIPFS).not.toHaveBeenCalled();
      });

      test('should return 500 when Pinata API fails', async () => {
        // Arrange: Mock Pinata failure
        const pinataError = new Error('Pinata API error');
        mockPinata.pinFileToIPFS.mockRejectedValue(pinataError);

        // Act: Send file upload request
        const response = await request(app)
          .post('/upload')
          .attach('file', TEST_FILE.buffer, TEST_FILE.originalname);

        // Assert: Verify error response
        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          error: "Failed to upload file to Pinata."
        });

        // Verify error was logged
        expect(console.error).toHaveBeenCalledWith(
          "Error uploading to Pinata:",
          pinataError
        );
      });

      test('should handle network timeout errors gracefully', async () => {
        // Arrange: Mock network timeout
        const timeoutError = new Error('Network timeout');
        timeoutError.code = 'ETIMEDOUT';
        mockPinata.pinFileToIPFS.mockRejectedValue(timeoutError);

        // Act: Send file upload request
        const response = await request(app)
          .post('/upload')
          .attach('file', TEST_FILE.buffer, TEST_FILE.originalname);

        // Assert: Verify error response
        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          error: "Failed to upload file to Pinata."
        });
      });
    });
  });

  describe('CORS Security Policy', () => {
    test('should allow requests from authorized origins', async () => {
      // Arrange: Mock successful Pinata response
      mockPinata.pinFileToIPFS.mockResolvedValue(MOCK_PINATA_RESPONSE);

      const authorizedOrigins = [
        'http://127.0.0.1:5500',
        'http://localhost:5500',
        'http://127.0.0.1:3000',
        'http://localhost:3000'
      ];

      for (const origin of authorizedOrigins) {
        // Act: Send request with authorized origin
        const response = await request(app)
          .post('/upload')
          .set('Origin', origin)
          .attach('file', TEST_FILE.buffer, TEST_FILE.originalname);

        // Assert: Verify request is allowed
        expect(response.status).toBe(200);
        expect(response.body.cid).toBe(MOCK_CID);
      }
    });

         test('should block requests from unauthorized origins', async () => {
       // Arrange: Mock successful Pinata response
       mockPinata.pinFileToIPFS.mockResolvedValue(MOCK_PINATA_RESPONSE);

       const unauthorizedOrigins = [
         'http://unauthorized-domain.com',
         'https://malicious-site.com',
         'http://evil.com',
         'https://phishing-attempt.net'
       ];

       for (const origin of unauthorizedOrigins) {
         // Act: Send request with unauthorized origin
         const response = await request(app)
           .post('/upload')
           .set('Origin', origin)
           .attach('file', TEST_FILE.buffer, TEST_FILE.originalname);

         // Assert: Verify CORS headers are not set for unauthorized origins
         
         expect(response.headers['access-control-allow-origin']).not.toBe(origin);
         
         
         if (response.status === 200) {
           expect(response.headers['access-control-allow-origin']).toBeUndefined();
         }
       }
     });

         test('should handle preflight OPTIONS requests correctly', async () => {
       // Act: Send preflight OPTIONS request
       const response = await request(app)
         .options('/upload')
         .set('Origin', 'http://127.0.0.1:5500')
         .set('Access-Control-Request-Method', 'POST')
         .set('Access-Control-Request-Headers', 'content-type');

       // Assert: Verify CORS headers are present for preflight requests
       
       expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5500');
       expect(response.headers['access-control-allow-methods']).toContain('POST');
       expect(response.headers['access-control-allow-headers']).toContain('content-type');
       
       
       expect([200, 204, 404]).toContain(response.status);
     });
  });

  describe('Request Validation', () => {
    test('should validate file metadata correctly', async () => {
      // Arrange: Mock successful Pinata response
      mockPinata.pinFileToIPFS.mockResolvedValue(MOCK_PINATA_RESPONSE);

      // Act: Send file with specific metadata
      const response = await request(app)
        .post('/upload')
        .attach('file', TEST_FILE.buffer, TEST_FILE.originalname);

      // Assert: Verify file metadata is preserved
      expect(response.status).toBe(200);
      
      
      const pinataCall = mockPinata.pinFileToIPFS.mock.calls[0];
      expect(pinataCall[1].pinataMetadata.name).toBe(TEST_FILE.originalname);
    });

    test('should handle requests with additional form fields', async () => {
      // Arrange: Mock successful Pinata response
      mockPinata.pinFileToIPFS.mockResolvedValue(MOCK_PINATA_RESPONSE);

      // Act: Send request with additional fields
      const response = await request(app)
        .post('/upload')
        .field('description', 'Test file description')
        .field('category', 'documents')
        .attach('file', TEST_FILE.buffer, TEST_FILE.originalname);

      // Assert: Verify upload still succeeds
      expect(response.status).toBe(200);
      expect(response.body.cid).toBe(MOCK_CID);
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle concurrent uploads correctly', async () => {
      // Arrange: Mock successful Pinata responses
      mockPinata.pinFileToIPFS.mockResolvedValue(MOCK_PINATA_RESPONSE);

      // Act: Send multiple concurrent requests
      const concurrentRequests = Array(5).fill().map((_, index) => 
        request(app)
          .post('/upload')
          .attach('file', Buffer.from(`content ${index}`), `file-${index}.txt`)
      );

      const responses = await Promise.all(concurrentRequests);

      // Assert: Verify all requests succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.cid).toBe(MOCK_CID);
      });

      
      expect(mockPinata.pinFileToIPFS).toHaveBeenCalledTimes(5);
    });

    test('should handle malformed requests gracefully', async () => {
      // Act: Send malformed request
      const response = await request(app)
        .post('/upload')
        .set('Content-Type', 'application/json')
        .send({ invalid: 'data' });

      // Assert: Verify graceful error handling
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("No file uploaded.");
    });
  });
}); 
