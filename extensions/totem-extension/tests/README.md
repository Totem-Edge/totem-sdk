# Totem Wallet Tests

This directory contains tests for the Totem Wallet extension.

## Test Categories

### 1. Designer Mode Smoke Tests

**File:** `designer-mode-smoke.test.ts`

These tests verify that Designer mode (dev-popup.html) properly stores wallet data after creation.

**Run Tests:**
```bash
cd packages/totem-extension
npm test tests/designer-mode-smoke.test.ts
```

**What is tested:**
- ✅ `walletSetup` flag is set to `true`
- ✅ `walletAddresses` contains exactly 64 MX addresses
- ✅ `encryptedSeed` is properly stored
- ✅ All addresses are unique
- ✅ Address indices are sequential (0-63)
- ✅ Designer mode warning logs are present

---

## Manual Testing for Designer Mode

Since Designer mode runs in the browser, some tests require manual verification:

### Manual Test Checklist

1. **Open Totem Wallet Designer**
   - Navigate to `/admin/totem-dev` in your browser
   
2. **Create New Wallet**
   - Click "CREATE WALLET"
   - Complete all onboarding steps:
     - Write down the 24-word recovery phrase
     - Verify random words (positions change each time)
     - Set a password

3. **Verify Storage Keys**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Run:
     ```javascript
     chrome.storage.local.get(['walletSetup', 'walletAddresses', 'encryptedSeed'], (result) => {
       console.log('Wallet Setup:', result.walletSetup);
       console.log('Total Addresses:', result.walletAddresses?.length);
       console.log('Encrypted Seed:', result.encryptedSeed ? 'Present' : 'Missing');
       
       // Verify all addresses
       if (result.walletAddresses) {
         console.log('First address:', result.walletAddresses[0]);
         console.log('Last address:', result.walletAddresses[63]);
       }
     });
     ```

4. **Expected Output**
   ```
   Wallet Setup: true
   Total Addresses: 64
   Encrypted Seed: Present
   First address: { address: "MX00000000...", publicKey: "0x...", index: 0 }
   Last address: { address: "MX00000063...", publicKey: "0x...", index: 63 }
   ```

5. **Verify Persistence**
   - Refresh the page (F5)
   - Wallet should load correctly
   - Should see your balance (not "No Account")
   - Addresses should be visible in the UI

6. **Check Designer Mode Warning**
   - Open Console
   - Look for:
     ```
     [Totem] 🔧 Designer mode active - background service worker bypassed
     ```

7. **Test Wallet Functionality**
   - ✅ Balance displays correctly
   - ✅ Can view all 64 addresses
   - ✅ Can switch between addresses
   - ✅ Send page loads
   - ✅ Activity page loads

---

## Production Build Testing

After building the extension for production:

### Build and Install

1. **Download Build**
   - Go to `/admin/totem-dev`
   - Click "Download Build"
   - Extract `totem-wallet.zip`

2. **Install in Chrome**
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extracted folder

3. **Verify Production Mode**
   - Open extension popup
   - Check Console for:
     ```
     Should NOT see: "Designer mode active"
     Should see: Normal wallet logs
     ```

4. **Test Wallet Creation**
   - Create a new wallet
   - Verify all 64 addresses are generated
   - Test sending/receiving (on testnet)

---

## Common Issues

### Issue: "No Account" after wallet creation

**Check:**
```javascript
chrome.storage.local.get(['walletSetup', 'walletAddresses'], console.log);
```

**Expected:**
- `walletSetup: true`
- `walletAddresses: Array(64)`

**Fix:** If missing, wallet creation failed. Check console for errors.

---

### Issue: Designer mode activating in production

**Check:**
```javascript
console.log('Runtime ID:', chrome.runtime.id);
```

**Expected:**
- Production: Should be a unique Chrome extension ID (e.g., `abcdef123456...`)
- Designer: Should be `'totem-dev-extension-id'`

**Fix:** If Designer mode activates in production, the runtime ID detection is broken.

---

### Issue: Low entropy seed phrases ("abandon abandon...")

**Check:**
- Designer mode should use local `generateMnemonic()` function
- Should generate unique 24-word phrases each time

**Fix:** Ensure `isDesignerMode()` detection is working correctly.

---

## Test Configuration

If jest is not configured, add to `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "jsdom",
    "roots": ["<rootDir>/tests"],
    "testMatch": ["**/*.test.ts"],
    "moduleNameMapper": {
      "\\.(css|less|scss|sass)$": "identity-obj-proxy"
    }
  }
}
```

---

## CI/CD Integration

To run tests in CI:

```yaml
# .github/workflows/test.yml
- name: Run Totem Tests
  run: |
    cd packages/totem-extension
    npm install
    npm test
```

---

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Use descriptive test names
3. Add comments explaining what is being tested
4. Update this README with new test categories

---

# Live Testing Mode

## Overview

The Totem Wallet Designer supports two testing modes:

- **Mock Mode** (default): Uses simulated API responses, no real network calls
- **Live Mode**: Connects to the real Axia API using your project credentials

## Prerequisites

Before using Live Testing Mode, you need:

1. **Axia API Project ID** from [dashboard.axia.to](https://dashboard.axia.to)
2. **Axia API URL** (usually `https://api.axia.to` or your dev environment URL)
3. **Running Axia Backend API** (for local development)

## Setup Instructions

### Step 1: Get Your Project ID

1. Go to [dashboard.axia.to](https://dashboard.axia.to)
2. Sign in with your Replit account
3. Navigate to **Project Settings**
4. Copy your **Project ID** (format: `proj_xxxxxxxxxxxxx` or `totem-shared`)

### Step 2: Configure Environment Variables (Optional)

For permanent configuration, create a `.env.local` file in `packages/totem-extension/`:

```bash
VITE_AXIA_API_URL=https://api.axia.to
VITE_AXIA_PROJECT_ID=your-project-id-here
```

These environment variables will be automatically loaded in Designer mode.

### Step 3: Enable Live Mode

#### Option A: Using Environment Variables

If you set up `.env.local`, the wallet will automatically use Live mode when you start the Designer:

```bash
npm run dev:ui
```

#### Option B: Using Settings Panel

1. Open the Totem Designer (`npm run dev:ui`)
2. Navigate to **Settings** (⚙️ icon in bottom navigation)
3. Scroll to the **🔧 Developer Tools** section
4. Toggle mode to **LIVE**
5. Enter your **API URL** and **Project ID**
6. Click **💾 SAVE CONFIGURATION**
7. Refresh the popup to apply changes

### Step 4: Verify Connection

After switching to Live mode, check the header:

- **🔴 LIVE** indicator should appear (instead of **🟢 MOCK**)
- Network status should show **ONLINE** if connection is successful
- Quota meter should display real quota usage from the API

## Switching Between Modes

### Mock Mode → Live Mode

1. Go to **Settings** → **Developer Tools**
2. Select **LIVE** mode
3. Enter API URL and Project ID
4. Click **SAVE CONFIGURATION**
5. Refresh the popup

### Live Mode → Mock Mode

1. Go to **Settings** → **Developer Tools**
2. Select **MOCK** mode
3. Click **SAVE CONFIGURATION**
4. Refresh the popup

Changes persist across popup reloads.

## Configuration Priority

The system uses the following priority order for configuration:

1. **Environment variables** (`.env.local` - highest priority)
2. **localStorage overrides** (set via Settings panel)
3. **Default bootstrap config** (fallback)

If you set environment variables, they will override Settings panel changes.

## Troubleshooting

### CORS Errors

**Error**: `Access to fetch at 'https://api.axia.to/...' from origin 'https://...repl.co' has been blocked by CORS policy`

**Solution**:

- **Local Development**: Ensure `NODE_ENV` is NOT set to `production` in your Axia API
- **Production**: Contact the Axia team to whitelist your Replit dev URL
- **Workaround**: Use `http://localhost:8000` as the API URL if running Axia API locally

### Invalid Project ID

**Error**: `Error: Invalid project ID or project disabled`

**Symptoms**:

- All API calls return 401 Unauthorized
- Quota meter shows 0/0 requests

**Solution**:

1. Verify your Project ID is correct (check dashboard.axia.to)
2. Ensure your project is enabled (not suspended)
3. Check for typos in the Project ID input

### Network Timeout

**Error**: `NetworkError: Failed to fetch` or timeout after 30s

**Symptoms**:

- Wallet shows "OFFLINE" status
- API calls never complete

**Solution**:

1. Check your internet connection
2. Verify the API URL is correct and reachable
3. Check if Axia API is running (for local development: `cd packages/axia-api && npm run dev`)
4. Try switching to Mock mode temporarily to test the UI

### Missing Quota Data

**Symptoms**:

- Quota meter shows "0 / 10000" even after making requests
- Daily/monthly limits not updating

**Possible Causes**:

- API version mismatch (update to latest)
- Project not properly configured on backend
- Quota tracking disabled in project settings

**Solution**:

1. Check browser console for error messages
2. Verify API responses include quota headers (`X-Quota-Remaining-Daily`, etc.)
3. Contact support if issue persists

### Configuration Not Persisting

**Symptoms**:

- Mode resets to MOCK after refresh
- API URL/Project ID disappear

**Solution**:

1. Check browser console for storage errors
2. Clear browser cache and try again:
   ```javascript
   chrome.storage.local.clear()
   ```
3. Ensure you're using the dev-popup.html (Designer mode), not production build

## Common Error Messages

| Error Message | Meaning | Solution |
|---------------|---------|----------|
| `Invalid config: missing required fields` | Bootstrap config incomplete | Check API URL and Project ID are both set |
| `Failed to fetch bootstrap config: 404` | `/totem.json` endpoint not found | Verify API URL is correct (should be base URL like `https://api.axia.to`) |
| `Quota Exceeded` (429) | Daily or monthly limit reached | Wait for quota reset or upgrade plan |
| `Project disabled` (403) | Project suspended or disabled | Contact Axia support |
| `Method not allowed` (405) | RPC method not enabled for project | Check project permissions in dashboard |

## API Endpoints Used

When in Live mode, the wallet makes calls to these endpoints:

- **POST** `/v1/{projectId}` - JSON-RPC 2.0 proxy (all Minima RPC methods)
- **GET** `/totem.json` - Bootstrap configuration
- **GET** `/wots/hardened/watermark` - WOTS key watermark for sync
- **POST** `/wots/hardened/lease` - WOTS lease token generation

## Developer Notes

### Mock API Behavior

In Mock mode, the wallet uses simulated responses defined in:

- `packages/totem-extension/dev-popup.html` (mock `chrome.runtime.sendMessage`)
- No actual network calls are made
- Useful for offline development and UI testing

### Live Mode Internals

When Live mode is enabled:

1. `DesignerConfigManager.setConfig()` updates storage
2. `AxiaRpcClient.reloadConfig()` is triggered automatically
3. Bootstrap config is fetched from `{API_URL}/totem.json`
4. Subsequent RPC calls use `{API_URL}/v1/{PROJECT_ID}`

### Storage Keys

Live mode configuration is stored in `chrome.storage.local`:

- `designer_mode`: `'mock'` or `'live'`
- `designer_api_url`: API base URL
- `designer_project_id`: Project ID
- `AXIA_BASE`: Canonical base URL (synchronized from designer config) **⚠️ CRITICAL: Must be AXIA_BASE, not AXIA_BASE_URL**
- `AXIA_PROJECT_ID`: Canonical project ID (synchronized from designer config)

**See "Storage Key Contract" section below for full technical details.**

## Testing Checklist

Before switching to Live mode, verify:

- [ ] Axia API is running and accessible
- [ ] You have a valid Project ID
- [ ] Project has sufficient quota remaining
- [ ] CORS is configured correctly (dev mode allows all origins)
- [ ] Network connectivity is stable

## Security Notes

- **Never commit `.env.local`** to version control
- **Never share your Project ID publicly** (treat it like an API key)
- **Use Mock mode for public demos** to avoid quota consumption
- **Production builds automatically disable Designer mode** (see webpack.config.js safety checks)

---

# Storage Key Contract

## Overview

This section documents the **canonical storage keys** used for Axia API configuration in the Totem Wallet extension. Understanding this contract is critical for maintaining compatibility between components.

## ⚠️ CRITICAL RULE

**NEVER change the canonical storage key names** (`AXIA_BASE`, `AXIA_PROJECT_ID`) without updating ALL consumers. Changing these keys will break the integration between DesignerConfigManager and AxiaRpcClient.

## Canonical Keys

These are the **official, authoritative** storage keys that all components MUST use:

| Key Name | Type | Purpose | Example Value |
|----------|------|---------|---------------|
| `AXIA_BASE` | `string` | Axia API base URL | `"https://api.axia.to"` or `"http://localhost:8000"` |
| `AXIA_PROJECT_ID` | `string` | Axia project identifier | `"proj_xxxxx"` or `"totem-shared"` |

### ❌ Legacy/Incorrect Key Names

These key names are **WRONG** and must **NEVER** be used:

- ~~`AXIA_BASE_URL`~~ (incorrect - do not use)
- ~~`AXIA_API_URL`~~ (incorrect - do not use)
- ~~`AXIA_URL`~~ (incorrect - do not use)

**Historical Context**: The storage key mismatch bug (Oct 2025) occurred when `DesignerConfigManager` wrote `AXIA_BASE_URL` while `AxiaRpcClient` read `AXIA_BASE`, breaking Live Testing Mode entirely. This has been fixed and test coverage added.

## Producers and Consumers

### Producers (Writers)

**DesignerConfigManager** (`src/config/DesignerConfigManager.ts`):
- Writes `AXIA_BASE` and `AXIA_PROJECT_ID` in Live mode
- Clears these keys in Mock mode
- Method: `synchronizeToAxiaKeys()`

```typescript
// CORRECT: DesignerConfigManager writes canonical keys
await chrome.storage.local.set({
  AXIA_BASE: config.apiUrl,           // ✅ Correct key name
  AXIA_PROJECT_ID: config.projectId,  // ✅ Correct key name
});
```

### Consumers (Readers)

**AxiaRpcClient** (`src/core/api/AxiaRpcClient.ts`):
- Reads `AXIA_BASE` and `AXIA_PROJECT_ID`
- Method: `loadBootstrapConfig()`

**Bootstrap Loader** (`src/core/config/bootstrap.ts`):
- Reads `AXIA_BASE` and `AXIA_PROJECT_ID`
- Merges with environment variables

```typescript
// CORRECT: AxiaRpcClient reads canonical keys
const result = await chrome.storage.local.get(['AXIA_BASE', 'AXIA_PROJECT_ID']);
const baseUrl = result.AXIA_BASE;         // ✅ Correct key name
const projectId = result.AXIA_PROJECT_ID; // ✅ Correct key name
```

## Synchronization Flow

### Designer Mode Keys → Canonical Keys

`DesignerConfigManager` maintains separate "designer_*" keys and synchronizes them to canonical `AXIA_*` keys:

```
User Input (Settings Panel)
  ↓
designer_mode = 'live'
designer_api_url = 'http://localhost:8000'
designer_project_id = 'test-123'
  ↓
DesignerConfigManager.synchronizeToAxiaKeys()
  ↓
AXIA_BASE = 'http://localhost:8000'        ← Canonical key
AXIA_PROJECT_ID = 'test-123'               ← Canonical key
  ↓
AxiaRpcClient.loadBootstrapConfig()
  ↓
API calls use http://localhost:8000
```

### Complete Storage Key Flow

```typescript
// Step 1: User changes mode in Settings
await DesignerConfigManager.setConfig({
  mode: 'live',
  apiUrl: 'http://localhost:8000',
  projectId: 'test-123'
});

// Step 2: Designer keys are written
chrome.storage.local.set({
  'designer_mode': 'live',
  'designer_api_url': 'http://localhost:8000',
  'designer_project_id': 'test-123'
});

// Step 3: Canonical keys are synchronized
chrome.storage.local.set({
  'AXIA_BASE': 'http://localhost:8000',       // ← AxiaRpcClient reads this
  'AXIA_PROJECT_ID': 'test-123'               // ← AxiaRpcClient reads this
});

// Step 4: AxiaRpcClient automatically reloads
// (via chrome.storage.onChanged listener)
AxiaRpcClient.loadBootstrapConfig();

// Step 5: Subsequent API calls use new config
fetch(`${AXIA_BASE}/v1/${AXIA_PROJECT_ID}`, { ... });
```

## Configuration Priority

The system uses a 3-tier priority system:

### Priority 1: Environment Variables (Highest)

```typescript
// packages/totem-extension/.env.local
VITE_AXIA_API_URL=https://api.axia.to
VITE_AXIA_PROJECT_ID=prod-project-456
```

- Takes precedence over localStorage
- Set at build time via Vite
- Cannot be changed at runtime
- **Use case**: Permanent Live mode during development

### Priority 2: localStorage (Medium)

```typescript
// Written by DesignerConfigManager
localStorage.setItem('AXIA_BASE', 'http://localhost:8000');
localStorage.setItem('AXIA_PROJECT_ID', 'test-123');
```

- User-configurable via Settings panel
- Can be changed at runtime
- Persists across page reloads
- **Use case**: Temporary mode switching for testing

### Priority 3: Default Config (Fallback)

```typescript
// src/config/constants.ts
const DEFAULT_AXIA_BASE = 'https://api.axia.to';
const DEFAULT_PROJECT_ID = '';
```

- Used when no env vars or localStorage overrides exist
- **Use case**: First-time setup or after reset

## Code Examples

### ✅ CORRECT Implementations

**Writing canonical keys:**
```typescript
// DesignerConfigManager.synchronizeToAxiaKeys()
await chrome.storage.local.set({
  AXIA_BASE: apiUrl,           // ✅ Correct
  AXIA_PROJECT_ID: projectId,  // ✅ Correct
});
```

**Reading canonical keys:**
```typescript
// AxiaRpcClient.loadBootstrapConfig()
const { AXIA_BASE, AXIA_PROJECT_ID } = await chrome.storage.local.get([
  'AXIA_BASE',        // ✅ Correct
  'AXIA_PROJECT_ID',  // ✅ Correct
]);
```

### ❌ INCORRECT Implementations

**Using wrong key names:**
```typescript
// ❌ WRONG - This will break AxiaRpcClient
await chrome.storage.local.set({
  AXIA_BASE_URL: apiUrl,      // ❌ Wrong key name
  AXIA_API_URL: apiUrl,       // ❌ Wrong key name
  AXIA_URL: apiUrl,           // ❌ Wrong key name
});
```

**Not synchronizing keys:**
```typescript
// ❌ WRONG - Designer keys alone don't update AxiaRpcClient
await chrome.storage.local.set({
  designer_api_url: apiUrl,
  designer_project_id: projectId,
  // Missing: AXIA_BASE and AXIA_PROJECT_ID synchronization
});
```

## Regression Test Coverage

Automated tests prevent storage key mismatches:

**File**: `test/unit/config/DesignerConfigManager.test.ts`

```typescript
describe('synchronizeToAxiaKeys - CRITICAL REGRESSION TESTS', () => {
  it('should write AXIA_BASE (not AXIA_BASE_URL) in Live mode', async () => {
    // Ensures correct key name is used
    expect(mockStorage['AXIA_BASE']).toBe('http://localhost:8000');
    expect(mockStorage['AXIA_BASE_URL']).toBeUndefined(); // Must NOT exist
  });

  it('should match AxiaRpcClient.loadBootstrapConfig expectations', async () => {
    // Verifies key names align between writer and reader
    const expectedKeys = ['AXIA_BASE', 'AXIA_PROJECT_ID'];
    const unexpectedKeys = ['AXIA_BASE_URL', 'AXIA_API_URL', 'AXIA_URL'];
    
    expectedKeys.forEach(key => expect(mockStorage[key]).toBeDefined());
    unexpectedKeys.forEach(key => expect(mockStorage[key]).toBeUndefined());
  });
});
```

**Run tests:**
```bash
cd packages/totem-extension
npx jest test/unit/config/DesignerConfigManager.test.ts
```

## Troubleshooting

### Issue: Live mode toggle doesn't work

**Symptoms:**
- Settings panel shows "LIVE" but header still shows "MOCK"
- API requests still go to mock endpoints
- Network tab shows no real API calls

**Diagnosis:**
```javascript
// Check if canonical keys are set correctly
chrome.storage.local.get(['AXIA_BASE', 'AXIA_PROJECT_ID', 'AXIA_BASE_URL'], (result) => {
  console.log('AXIA_BASE:', result.AXIA_BASE);              // Should have value in Live mode
  console.log('AXIA_PROJECT_ID:', result.AXIA_PROJECT_ID);  // Should have value in Live mode
  console.log('AXIA_BASE_URL:', result.AXIA_BASE_URL);      // Should be undefined
});
```

**Expected Output (Live Mode):**
```
AXIA_BASE: "http://localhost:8000"
AXIA_PROJECT_ID: "test-123"
AXIA_BASE_URL: undefined  ← MUST be undefined
```

**Fix:**
1. Clear all storage keys:
   ```javascript
   chrome.storage.local.clear()
   ```
2. Reload the extension
3. Reconfigure Live mode via Settings panel

### Issue: AxiaRpcClient uses wrong endpoint

**Symptoms:**
- API calls go to unexpected URL
- 404 errors on API requests
- Wrong project ID in requests

**Diagnosis:**
```javascript
// Verify AxiaRpcClient is reading correct keys
const client = AxiaRpcClient.getInstance();
console.log('Client config:', client.config);
```

**Expected Output:**
```javascript
{
  baseUrl: "http://localhost:8000",  // Matches AXIA_BASE
  projectId: "test-123",             // Matches AXIA_PROJECT_ID
  timeout: 30000
}
```

**Fix:**
If config is wrong, check:
1. Canonical keys in storage (use diagnosis script above)
2. Environment variables (`.env.local`)
3. Priority order (env vars override localStorage)

### Issue: Storage key mismatch detected

**Error Message:**
```
[DesignerConfig] Warning: AXIA_BASE_URL detected but AXIA_BASE missing
```

**Cause:** Legacy code or manual storage manipulation used wrong key names

**Fix:**
```javascript
// Remove legacy keys
chrome.storage.local.remove(['AXIA_BASE_URL', 'AXIA_API_URL', 'AXIA_URL']);

// Re-save with correct keys
chrome.storage.local.set({
  AXIA_BASE: 'http://localhost:8000',
  AXIA_PROJECT_ID: 'test-123'
});
```

## Migration Guide

### Migrating from AXIA_BASE_URL to AXIA_BASE

If you have code using the old key name, follow these steps:

**Step 1: Find all references**
```bash
cd packages/totem-extension
grep -r "AXIA_BASE_URL" src/
```

**Step 2: Replace with canonical key**
```typescript
// Before (incorrect)
const baseUrl = result.AXIA_BASE_URL;

// After (correct)
const baseUrl = result.AXIA_BASE;
```

**Step 3: Clear user storage**
```javascript
// Add migration script to run once
chrome.storage.local.get(['AXIA_BASE_URL'], async (result) => {
  if (result.AXIA_BASE_URL && !result.AXIA_BASE) {
    // Migrate old key to new key
    await chrome.storage.local.set({ AXIA_BASE: result.AXIA_BASE_URL });
    await chrome.storage.local.remove(['AXIA_BASE_URL']);
    console.log('[Migration] Migrated AXIA_BASE_URL → AXIA_BASE');
  }
});
```

**Step 4: Run tests**
```bash
npx jest test/unit/config/DesignerConfigManager.test.ts
```

## Summary

| Aspect | Details |
|--------|---------|
| **Canonical Keys** | `AXIA_BASE`, `AXIA_PROJECT_ID` |
| **Writer** | `DesignerConfigManager.synchronizeToAxiaKeys()` |
| **Readers** | `AxiaRpcClient.loadBootstrapConfig()`, `bootstrap.ts` |
| **Priority** | Env Vars → localStorage → Defaults |
| **Tests** | `test/unit/config/DesignerConfigManager.test.ts` |
| **Forbidden Keys** | `AXIA_BASE_URL`, `AXIA_API_URL`, `AXIA_URL` |

**Key Takeaway**: Always use `AXIA_BASE` (not `AXIA_BASE_URL`) and `AXIA_PROJECT_ID`. Any deviation will break Live Testing Mode.
