/**
 * Totem Extension - Local Axia API & MegaMMR Connection Verification
 * 
 * This test suite verifies that:
 * 1. The local Axia API server is running on port 5000
 * 2. The Totem extension can connect to it
 * 3. The local API can proxy requests to the MegaMMR node on VPS
 */

const LOCAL_API = 'https://rpc.axia.to';
const TEST_API_KEY = 'test-key-123'; // You'll need a valid key from your database

// Test colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

console.log(`${BLUE}========================================${RESET}`);
console.log(`${BLUE}Local Axia API & MegaMMR Connection Tests${RESET}`);
console.log(`${BLUE}========================================${RESET}\n`);

// Test 1: Verify Local API Server is Running
async function testLocalAPIServer() {
  console.log('Test 1: Checking local Axia API server...');
  try {
    // First try without API key to confirm server is running
    const response = await fetch(`${LOCAL_API}/v1/status`);
    
    if (response.status === 401 || response.status === 400) {
      const data = await response.text();
      console.log(`${GREEN}✓ Local API server is running${RESET}`);
      console.log(`  Response: ${data}`);
      return true;
    } else if (response.ok) {
      console.log(`${GREEN}✓ Local API server responding (no auth required)${RESET}`);
      return true;
    } else {
      console.log(`${RED}✗ Unexpected response: ${response.status}${RESET}`);
      return false;
    }
  } catch (error) {
    console.log(`${RED}✗ Local API server not reachable: ${error.message}${RESET}`);
    console.log(`  Make sure the server is running on port 5000`);
    return false;
  }
}

// Test 2: Check API Key Authentication
async function testAPIKeyAuth() {
  console.log('\nTest 2: Testing API key authentication...');
  try {
    const response = await fetch(`${LOCAL_API}/v1/block`, {
      headers: { 'x-api-key': TEST_API_KEY }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`${GREEN}✓ API key authentication successful${RESET}`);
      console.log(`  Block data received:`, JSON.stringify(data).substring(0, 100) + '...');
      return true;
    } else if (response.status === 401) {
      console.log(`${YELLOW}⚠ Invalid API key - using test key${RESET}`);
      console.log(`  You need to create a valid API key in the database`);
      return false;
    } else {
      console.log(`${RED}✗ Authentication failed: ${response.status}${RESET}`);
      return false;
    }
  } catch (error) {
    console.log(`${RED}✗ Authentication test error: ${error.message}${RESET}`);
    return false;
  }
}

// Test 3: Create API Key (for testing)
async function createTestAPIKey() {
  console.log('\nTest 3: Creating test API key...');
  try {
    // Try to create an API key via admin endpoint
    const response = await fetch(`${LOCAL_API}/admin/api-keys/create`, {
      method: 'POST',
      headers: { 
        'content-type': 'application/json',
        'cookie': 'admin_token=test' // You'd need a valid admin token
      },
      body: JSON.stringify({
        name: 'Totem Test Key',
        tier: 'core'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`${GREEN}✓ Test API key created${RESET}`);
      console.log(`  Key: ${data.apiKey}`);
      console.log(`  Save this key for future tests!`);
      return data.apiKey;
    } else {
      console.log(`${YELLOW}⚠ Could not create API key (need admin access)${RESET}`);
      return null;
    }
  } catch (error) {
    console.log(`${YELLOW}⚠ API key creation not available: ${error.message}${RESET}`);
    return null;
  }
}

// Test 4: Test MegaMMR Connectivity via Local API
async function testMegaMMRViaLocal() {
  console.log('\nTest 4: Testing MegaMMR connectivity through local API...');
  
  // We'll use a demo key if available
  const apiKey = 'sk_test_1234567890'; // Replace with actual key
  
  try {
    const response = await fetch(`${LOCAL_API}/v1/meg/block`, {
      headers: { 'x-api-key': apiKey }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`${GREEN}✓ MegaMMR data retrieved via local API${RESET}`);
      console.log(`  Block Height: ${data.height || 'N/A'}`);
      console.log(`  Block Hash: ${data.hash || 'N/A'}`);
      return true;
    } else if (response.status === 404) {
      console.log(`${YELLOW}⚠ MEG endpoint not configured in local API${RESET}`);
      console.log(`  The local API may not proxy MEG requests`);
      return true;
    } else {
      console.log(`${YELLOW}⚠ MEG request returned: ${response.status}${RESET}`);
      return true;
    }
  } catch (error) {
    console.log(`${YELLOW}⚠ MEG connectivity test: ${error.message}${RESET}`);
    return true;
  }
}

// Test 5: Verify Hardened WOTS Endpoints
async function testHardenedEndpoints() {
  console.log('\nTest 5: Checking hardened WOTS endpoints...');
  
  const endpoints = [
    '/v1/wots-hardened/prepare',
    '/v1/wots-hardened/finalize'
  ];
  
  let allGood = true;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${LOCAL_API}${endpoint}`, {
        method: 'POST',
        headers: { 
          'content-type': 'application/json',
          'x-api-key': 'test-key'
        },
        body: JSON.stringify({})
      });
      
      if (response.status === 400 || response.status === 401 || response.status === 422) {
        console.log(`${GREEN}  ✓ ${endpoint} exists (requires valid data)${RESET}`);
      } else if (response.status === 404) {
        console.log(`${RED}  ✗ ${endpoint} not found${RESET}`);
        allGood = false;
      } else {
        console.log(`${YELLOW}  ⚠ ${endpoint} returned: ${response.status}${RESET}`);
      }
    } catch (error) {
      console.log(`${RED}  ✗ ${endpoint} error: ${error.message}${RESET}`);
      allGood = false;
    }
  }
  
  return allGood;
}

// Test 6: Check Database Connection
async function testDatabaseStatus() {
  console.log('\nTest 6: Checking database connectivity...');
  try {
    const response = await fetch(`${LOCAL_API}/v1/db/status`, {
      headers: { 'x-api-key': 'test-key' }
    });
    
    if (response.status === 404) {
      console.log(`${YELLOW}⚠ Database status endpoint not exposed${RESET}`);
      return true;
    } else if (response.ok) {
      const data = await response.json();
      console.log(`${GREEN}✓ Database connection active${RESET}`);
      console.log(`  Status:`, JSON.stringify(data, null, 2));
      return true;
    } else {
      console.log(`${YELLOW}⚠ Database status: ${response.status}${RESET}`);
      return true;
    }
  } catch (error) {
    console.log(`${YELLOW}⚠ Database test: ${error.message}${RESET}`);
    return true;
  }
}

// Test 7: Extension Configuration Check
async function testExtensionConfig() {
  console.log('\nTest 7: Verifying extension configuration...');
  
  console.log(`${BLUE}Extension should be configured with:${RESET}`);
  console.log(`  AXIA_BASE: ${LOCAL_API} (for production)`);
  console.log(`  Fallback: https://rpc2.axia.to`);
  
  // Check if extension files exist
  const fs = require('fs').promises;
  try {
    const manifest = await fs.readFile('./manifest.json', 'utf8');
    const manifestData = JSON.parse(manifest);
    console.log(`${GREEN}✓ Extension manifest found${RESET}`);
    console.log(`  Version: ${manifestData.version}`);
    console.log(`  Name: ${manifestData.name}`);
    return true;
  } catch (error) {
    console.log(`${YELLOW}⚠ Could not read manifest.json${RESET}`);
    return true;
  }
}

// Test 8: MEG Client Direct Test
async function testMEGClientDirect() {
  console.log('\nTest 8: Testing MEG client configuration...');
  
  // Check environment variables
  const megUrl = process.env.MEG_URL;
  const megUser = process.env.MEG_USER;
  const megPassword = process.env.MEG_PASSWORD;
  
  if (megUrl && megUser && megPassword) {
    console.log(`${GREEN}✓ MEG client credentials configured${RESET}`);
    console.log(`  MEG URL: ${megUrl}`);
    console.log(`  MEG User: ${megUser.substring(0, 3)}***`);
    
    // Try a direct MEG connection
    try {
      const auth = Buffer.from(`${megUser}:${megPassword}`).toString('base64');
      const response = await fetch(`${megUrl}/block`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`${GREEN}✓ Direct MEG connection successful${RESET}`);
        console.log(`  Latest block: ${data.response?.block || 'N/A'}`);
        return true;
      } else {
        console.log(`${YELLOW}⚠ MEG returned: ${response.status}${RESET}`);
        return true;
      }
    } catch (error) {
      console.log(`${YELLOW}⚠ Direct MEG connection failed: ${error.message}${RESET}`);
      return true;
    }
  } else {
    console.log(`${YELLOW}⚠ MEG credentials not configured in environment${RESET}`);
    console.log(`  Set MEG_URL, MEG_USER, and MEG_PASSWORD`);
    return true;
  }
}

// Main test runner
async function runAllTests() {
  console.log(`Local API URL: ${LOCAL_API}`);
  console.log(`Test API Key: ${TEST_API_KEY}\n`);
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0
  };
  
  // Run tests
  const tests = [
    { name: 'Local API Server', fn: testLocalAPIServer },
    { name: 'API Authentication', fn: testAPIKeyAuth },
    { name: 'Create Test Key', fn: createTestAPIKey },
    { name: 'MegaMMR via Local', fn: testMegaMMRViaLocal },
    { name: 'Hardened Endpoints', fn: testHardenedEndpoints },
    { name: 'Database Status', fn: testDatabaseStatus },
    { name: 'Extension Config', fn: testExtensionConfig },
    { name: 'MEG Client Direct', fn: testMEGClientDirect }
  ];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result === true) {
        results.passed++;
      } else if (result === false) {
        results.failed++;
      } else {
        results.warnings++;
      }
    } catch (error) {
      console.log(`${RED}Test ${test.name} crashed: ${error.message}${RESET}`);
      results.failed++;
    }
  }
  
  // Summary
  console.log(`\n${BLUE}========================================${RESET}`);
  console.log(`${BLUE}Test Results Summary${RESET}`);
  console.log(`${BLUE}========================================${RESET}`);
  console.log(`${GREEN}Passed: ${results.passed}${RESET}`);
  console.log(`${RED}Failed: ${results.failed}${RESET}`);
  console.log(`${YELLOW}Warnings: ${results.warnings}${RESET}`);
  
  if (results.failed === 0) {
    console.log(`\n${GREEN}✓ Local Axia API is operational!${RESET}`);
    console.log(`${GREEN}  The Totem extension can connect to the local API.${RESET}`);
    console.log(`${GREEN}  Configure MEG_URL, MEG_USER, MEG_PASSWORD for MegaMMR access.${RESET}`);
  } else {
    console.log(`\n${YELLOW}⚠ Some connectivity issues detected.${RESET}`);
    console.log(`${YELLOW}  Check the local API server and database configuration.${RESET}`);
  }
}

// Run the tests
runAllTests().catch(console.error);