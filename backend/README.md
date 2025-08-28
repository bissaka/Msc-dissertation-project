# Backend Server - Unit Testing Documentation

## Overview

This backend server provides a secure file upload service that integrates with IPFS through Pinata. The server includes comprehensive unit tests that demonstrate software engineering best practices including proper mocking, security testing, and error handling validation.

## Testing Setup

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

```bash
# Install dependencies
npm install

# Install testing dependencies
npm install --save-dev jest supertest
```

### Test Scripts

The following npm scripts are available for testing:

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

### Test File: `server.test.js`

The test suite is organized into logical groups following the **SOLID principles**:

#### 1. **POST /upload - File Upload Endpoint**

##### Successful Upload Scenarios
- **`should successfully upload a file and return CID`**: Tests the happy path with proper mocking
- **`should handle different file types correctly`**: Validates support for various file formats
- **`should handle large files within reasonable limits`**: Tests performance with 1MB files

##### Error Handling Scenarios
- **`should return 400 when no file is provided`**: Validates input validation
- **`should return 400 when file field is empty`**: Tests edge case handling
- **`should return 500 when Pinata API fails`**: Tests external API failure handling
- **`should handle network timeout errors gracefully`**: Tests network error scenarios

#### 2. **CORS Security Policy**

- **`should allow requests from authorized origins`**: Validates CORS whitelist functionality
- **`should block requests from unauthorized origins`**: Tests security against unauthorized domains
- **`should handle preflight OPTIONS requests correctly`**: Tests CORS preflight handling

#### 3. **Request Validation**

- **`should validate file metadata correctly`**: Ensures file metadata preservation
- **`should handle requests with additional form fields`**: Tests form field handling

#### 4. **Performance and Reliability**

- **`should handle concurrent uploads correctly`**: Tests concurrent request handling
- **`should handle malformed requests gracefully`**: Tests error resilience

## Software Engineering Best Practices Demonstrated

### 1. **DRY (Don't Repeat Yourself) Principle**

```javascript
// Reusable test data constants
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
```

### 2. **SOLID Principles**

#### Single Responsibility Principle
Each test focuses on a single aspect of functionality:
- File upload success
- Error handling
- Security validation
- Performance testing

#### Open/Closed Principle
Tests are easily extensible without modifying existing test logic:
```javascript
// Easy to add new file types
const testCases = [
  { name: 'document.txt', content: 'text content', type: 'text/plain' },
  { name: 'image.jpg', content: 'image content', type: 'image/jpeg' },
  { name: 'data.json', content: '{"key": "value"}', type: 'application/json' }
];
```

#### Dependency Inversion Principle
External dependencies are properly mocked:
```javascript
// Mock external dependencies
jest.mock('@pinata/sdk');
jest.mock('dotenv', () => ({
  config: jest.fn()
}));
```

### 3. **Comprehensive Mocking Strategy**

#### External API Mocking
```javascript
// Mock Pinata SDK to avoid actual API calls
mockPinata = {
  pinFileToIPFS: jest.fn()
};
require('@pinata/sdk').mockImplementation(() => mockPinata);
```

#### Environment Mocking
```javascript
// Mock environment variables
jest.mock('dotenv', () => ({
  config: jest.fn()
}));
```

### 4. **Security Testing**

#### CORS Policy Validation
```javascript
test('should block requests from unauthorized origins', async () => {
  const unauthorizedOrigins = [
    'http://unauthorized-domain.com',
    'https://malicious-site.com'
  ];
  
  for (const origin of unauthorizedOrigins) {
    const response = await request(app)
      .post('/upload')
      .set('Origin', origin)
      .attach('file', TEST_FILE.buffer, TEST_FILE.originalname);
    
    expect(response.headers['access-control-allow-origin']).not.toBe(origin);
  }
});
```

### 5. **Error Handling Validation**

#### Comprehensive Error Scenarios
- Network timeouts
- API failures
- Invalid inputs
- Malformed requests

### 6. **Performance Testing**

#### Concurrent Request Handling
```javascript
test('should handle concurrent uploads correctly', async () => {
  const concurrentRequests = Array(5).fill().map((_, index) => 
    request(app)
      .post('/upload')
      .attach('file', Buffer.from(`content ${index}`), `file-${index}.txt`)
  );

  const responses = await Promise.all(concurrentRequests);
  responses.forEach(response => {
    expect(response.status).toBe(200);
  });
});
```

## Test Configuration

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(spec|test).js'],
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true
};
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Running Tests

### Basic Test Execution
```bash
npm test
```

### Watch Mode (Development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Results

### Expected Output
```
 PASS  ./server.test.js
  Backend Server Tests
    POST /upload - File Upload Endpoint
      Successful Upload Scenarios
        √ should successfully upload a file and return CID
        √ should handle different file types correctly
        √ should handle large files within reasonable limits
      Error Handling Scenarios
        √ should return 400 when no file is provided
        √ should return 400 when file field is empty
        √ should return 500 when Pinata API fails
        √ should handle network timeout errors gracefully
    CORS Security Policy
      √ should allow requests from authorized origins
      √ should block requests from unauthorized origins
      √ should handle preflight OPTIONS requests correctly
    Request Validation
      √ should validate file metadata correctly
      √ should handle requests with additional form fields
    Performance and Reliability
      √ should handle concurrent uploads correctly
      √ should handle malformed requests gracefully

Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
```

## Best Practices for Adding New Tests

### 1. **Follow the Existing Structure**
- Group related tests using `describe()` blocks
- Use descriptive test names that explain the scenario
- Follow the Arrange-Act-Assert pattern

### 2. **Mock External Dependencies**
- Always mock external APIs and services
- Use `jest.mock()` for module-level mocking
- Reset mocks between tests with `jest.clearAllMocks()`

### 3. **Test Both Success and Failure Cases**
- Include positive test cases (happy path)
- Include negative test cases (error scenarios)
- Test edge cases and boundary conditions

### 4. **Validate Security Aspects**
- Test input validation
- Test authorization and access control
- Test CORS and security headers

### 5. **Use Meaningful Assertions**
- Assert specific values, not just truthiness
- Check response status codes, headers, and body
- Verify that external services are called correctly

## Troubleshooting

### Common Issues

1. **Tests failing due to CORS**: Ensure CORS configuration matches the test environment
2. **Mock not working**: Check that mocks are properly reset between tests
3. **Timeout errors**: Increase `testTimeout` in Jest configuration for slow operations

### Debug Mode
```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test
npm test -- --testNamePattern="should successfully upload"
```

## Conclusion

This test suite demonstrates comprehensive unit testing practices that ensure:
- **Reliability**: All code paths are tested
- **Security**: CORS and input validation are verified
- **Performance**: Concurrent operations are validated
- **Maintainability**: Tests are well-organized and documented
- **Extensibility**: New tests can be easily added following established patterns

The tests follow industry best practices and provide confidence in the server's functionality while serving as documentation for expected behavior. 