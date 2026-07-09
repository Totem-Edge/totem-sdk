# Live Testing Mode - Smoke Test Plan

**Version**: 1.0  
**Last Updated**: October 28, 2025  
**Purpose**: Validate Live↔Mock mode toggle functionality, storage key synchronization, and API client auto-reload

---

## Prerequisites

### Test Environment Setup
- [ ] Totem Extension Dev server running (`npm run dev:ui`)
- [ ] Axia Backend API running on localhost:8000
- [ ] Valid Axia API credentials available
- [ ] Chrome DevTools open for storage inspection

### ⚠️ CRITICAL: Environment Variable Configuration

**Before running these tests**, verify environment variable state:

```bash
# Check if VITE_AXIA_* variables are set
cd packages/totem-extension
cat .env.local 2>/dev/null | grep VITE_AXIA

# If variables ARE set:
# - Test Case 2 (Live Mode) will use env vars and IGNORE localStorage settings
# - Mode toggle will appear ineffective (known behavior)
# - This is EXPECTED if you want persistent Live mode during development

# If variables are NOT set:
# - Mode toggle will work as designed
# - localStorage settings take precedence
# - Recommended for running this smoke test
```

**Recommended Test Configuration**:
1. **Option A (Clean Test)**: Remove or rename `.env.local` to test toggle behavior
2. **Option B (Env Override Test)**: Keep `.env.local` and document expected behavior in Test Case 7

### Required Test Data
```bash
# Example valid credentials (replace with your actual values)
API_URL: https://api.axia.to
PROJECT_ID: your-project-id-here

# Or use local dev server for testing
API_URL: http://localhost:8000
PROJECT_ID: test-project-123
```

### Evidence Capture Requirements
For each test case, capture:
- **Screenshots**: Header indicators, Settings panel, Storage inspector
- **Console Logs**: Filter for `[DesignerConfig]` and `[AxiaRpcClient]`
- **Network Tab**: XHR/Fetch requests showing API URL
- **Storage State**: localStorage before/after mode changes

Use the Test Results Template at the end of this document to record findings.

### Browser Tools Required
- Chrome DevTools (Storage Inspector, Console, Network)
- Screenshot tool (Snipping Tool, DevTools screenshot feature)

---

## Test Case 1: Mock Mode (Default Behavior)

### Objective
Verify default Mock mode works correctly before testing Live mode

### Steps
1. **Navigate to Totem Designer**
   - Open: `http://localhost:6000/totem-dev/`
   - Wait for popup to load

2. **Verify Default Mode**
   - **Expected**: Header shows `🟢 MOCK` badge
   - **Expected**: Status shows "DESIGNER MODE"
   - **Expected**: No API connection status shown

3. **Inspect Storage Keys**
   - Open DevTools → Application → Local Storage → `http://localhost:6000`
   - **Expected**: `designer_mode` = `"mock"` (or not present)
   - **Expected**: `AXIA_BASE` key NOT present
   - **Expected**: `AXIA_PROJECT_ID` key NOT present

4. **Check Console Logs**
   - Open DevTools → Console
   - **Expected**: `[DesignerConfig] Mock mode - cleared AXIA keys`
   - **Expected**: No API error messages

5. **Test Basic Functionality**
   - View Home screen with balance display
   - Navigate to Send, Activity, Settings pages
   - **Expected**: All pages load with mock data
   - **Expected**: No network requests to Axia API

### Success Criteria
✅ Mock mode indicator visible  
✅ Storage keys correctly absent  
✅ Console shows mock mode initialization  
✅ UI functions with local mock data  

---

## Test Case 2: Switch to Live Mode

### Objective
Validate transition from Mock → Live mode with storage synchronization

### Steps

1. **Navigate to Settings**
   - Click "⚙️ Settings" in bottom navigation
   - Scroll to "🔧 Developer Tools" section
   - **Expected**: Section visible (Designer mode only)

2. **Configure Live Mode**
   - Current mode shows: `MOCK`
   - Click "Switch to LIVE Mode" button
   - **Wait for UI update** (~500ms)

3. **Enter API Credentials**
   - **Axia API Base URL**: Enter `http://localhost:8000` (or production URL)
   - **Axia Project ID**: Enter your valid project ID
   - Click "💾 SAVE CONFIGURATION"
   - **Expected**: "✓ Configuration saved successfully" message

4. **Verify Header Indicator**
   - Return to Home screen
   - **Expected**: Header shows `🔴 LIVE` badge
   - **Expected**: Connection status: "● CONNECTED" (green)
   - **Expected**: Quota meter shows real API usage

5. **Inspect Storage Keys (Critical)**
   - DevTools → Application → Local Storage
   - **Expected**: `designer_mode` = `"live"`
   - **Expected**: `designer_api_url` = `"http://localhost:8000"`
   - **Expected**: `designer_project_id` = `"[your-project-id]"`
   - **🔴 CRITICAL**: `AXIA_BASE` = `"http://localhost:8000"`
   - **🔴 CRITICAL**: `AXIA_PROJECT_ID` = `"[your-project-id]"`

6. **Check Console Logs**
   - **Expected**: `[DesignerConfig] Mode changed: mock → live`
   - **Expected**: `[DesignerConfig] Synchronized to AXIA keys: { baseUrl: "http://localhost:8000", projectId: "..." }`
   - **Expected**: `[AxiaRpcClient] Config reloaded from storage`

7. **Verify API Connectivity**
   - DevTools → Network tab (filter: XHR/Fetch)
   - Navigate to Home screen
   - **Expected**: Network request to `http://localhost:8000/api/rpc` or production URL
   - **Expected**: Request includes `X-Project-ID` header
   - **Expected**: Response status 200 (or appropriate error if quota exceeded)

8. **Test Live Data Loading**
   - Check balance display
   - **Expected**: Real balance from API (or 0 if new wallet)
   - View quota meter in Settings
   - **Expected**: Shows actual quota consumption
   - Navigate to Send → Select address
   - **Expected**: Uses real WOTS lease from API

### Success Criteria
✅ Live mode indicator appears  
✅ Storage keys synchronized (`AXIA_BASE` and `AXIA_PROJECT_ID` present)  
✅ Console shows synchronization logs  
✅ Network requests go to configured API URL  
✅ UI displays real API data  
✅ Quota meter shows live usage  

---

## Test Case 3: Switch Back to Mock Mode

### Objective
Validate transition from Live → Mock mode with storage cleanup

### Steps

1. **Return to Settings**
   - Navigate to Settings → Developer Tools
   - Current mode shows: `LIVE`

2. **Disable Live Mode**
   - Click "Switch to MOCK Mode" button
   - **Wait for UI update**

3. **Verify Header Indicator**
   - Return to Home screen
   - **Expected**: Header shows `🟢 MOCK` badge
   - **Expected**: No connection status shown

4. **Inspect Storage Keys (Critical)**
   - DevTools → Application → Local Storage
   - **Expected**: `designer_mode` = `"mock"`
   - **Expected**: `designer_api_url` still persisted (for next toggle)
   - **Expected**: `designer_project_id` still persisted
   - **🔴 CRITICAL**: `AXIA_BASE` key REMOVED
   - **🔴 CRITICAL**: `AXIA_PROJECT_ID` key REMOVED

5. **Check Console Logs**
   - **Expected**: `[DesignerConfig] Mode changed: live → mock`
   - **Expected**: `[DesignerConfig] Mock mode - cleared AXIA keys`
   - **Expected**: `[AxiaRpcClient] Config reloaded from storage`

6. **Verify Mock Data Restored**
   - DevTools → Network tab
   - Navigate to Home, Send, Activity pages
   - **Expected**: NO network requests to Axia API
   - **Expected**: UI shows local mock data
   - **Expected**: Quota meter shows mock data (if visible)

### Success Criteria
✅ Mock mode indicator restored  
✅ Canonical keys cleared (`AXIA_BASE`, `AXIA_PROJECT_ID` absent)  
✅ Designer keys preserved for next toggle  
✅ Console shows cleanup logs  
✅ No API network requests  
✅ Mock data loads correctly  

---

## Test Case 4: AxiaRpcClient Auto-Reload

### Objective
Verify AxiaRpcClient automatically picks up config changes without manual reload

### Steps

1. **Start in Mock Mode**
   - Verify header shows `🟢 MOCK`

2. **Monitor Console for Reload Events**
   - DevTools → Console
   - Filter for: `[AxiaRpcClient]`

3. **Toggle to Live Mode**
   - Settings → Switch to LIVE
   - Enter credentials and save
   - **Expected**: Console shows `[AxiaRpcClient] Config reloaded from storage`
   - **Expected**: Config reload happens within 1 second of mode change

4. **Test Immediate API Call**
   - Without refreshing the page, navigate to Send screen
   - Click "Request WOTS Lease"
   - **Expected**: Request goes to LIVE API URL
   - **Expected**: Uses credentials from storage

5. **Toggle Back to Mock**
   - Switch back to MOCK mode
   - **Expected**: Console shows another reload event
   - Navigate to Send screen
   - **Expected**: No API requests (mock mode)

### Success Criteria
✅ AxiaRpcClient reloads automatically on mode change  
✅ No page refresh required  
✅ API calls use updated config immediately  
✅ Reload events visible in console  

---

## Test Case 5: Persistence Across Page Reloads

### Objective
Ensure mode and credentials persist after browser reload

### Steps

1. **Configure Live Mode**
   - Switch to LIVE mode
   - Enter valid credentials
   - Save configuration

2. **Hard Reload Browser**
   - Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   - Wait for page to fully reload

3. **Verify Mode Persisted**
   - **Expected**: Header still shows `🔴 LIVE`
   - **Expected**: Storage keys still present (`AXIA_BASE`, `AXIA_PROJECT_ID`)
   - **Expected**: Settings shows correct API URL and Project ID

4. **Test Functionality**
   - Navigate to Home screen
   - **Expected**: Loads real API data without re-configuration

5. **Switch to Mock and Reload**
   - Switch to MOCK mode
   - Hard reload browser again
   - **Expected**: Header shows `🟢 MOCK`
   - **Expected**: Canonical keys absent

### Success Criteria
✅ Live mode persists across reloads  
✅ Mock mode persists across reloads  
✅ Credentials remembered for next toggle  
✅ No re-configuration needed  

---

## Test Case 6: Error Handling

### Objective
Validate graceful error handling for invalid configurations

### Steps

1. **Invalid API URL**
   - Switch to LIVE mode
   - Enter invalid URL: `http://invalid-domain-12345.com`
   - Enter valid Project ID
   - Save configuration
   - **Expected**: Connection status shows "● DISCONNECTED" (red)
   - **Expected**: Console shows network error (not crash)

2. **Missing Project ID**
   - Enter valid API URL
   - Leave Project ID empty
   - Save configuration
   - Navigate to Send screen
   - **Expected**: API request fails gracefully
   - **Expected**: Error message shown to user

3. **Switch Back to Mock**
   - Switch to MOCK mode
   - **Expected**: App recovers and uses mock data
   - **Expected**: No lingering errors

### Success Criteria
✅ Invalid URL doesn't crash app  
✅ Missing credentials show clear errors  
✅ Switching to Mock mode always works  
✅ Error states clear when switching modes  

---

## Test Case 7: Environment Variable Precedence

### Objective
Validate that environment variables (VITE_AXIA_*) take precedence over localStorage settings

### Prerequisites
- Create `.env.local` file with valid credentials

### Steps

1. **Set Environment Variables**
   ```bash
   cd packages/totem-extension
   cat > .env.local << EOF
   VITE_AXIA_API_URL=http://localhost:8000
   VITE_AXIA_PROJECT_ID=env-test-project-123
   EOF
   ```

2. **Restart Dev Server**
   - Stop dev server (`Ctrl+C`)
   - Run `npm run dev:ui`
   - Wait for server to start

3. **Verify Env Var Precedence**
   - Open Designer: `http://localhost:6000/totem-dev/`
   - Navigate to Settings → Developer Tools
   - **Expected**: Mode shows `LIVE` (env vars force Live mode)
   - **Expected**: API URL shows `http://localhost:8000` (from .env.local)
   - **Expected**: Project ID shows `env-test-project-123` (from .env.local)

4. **Attempt to Switch to Mock Mode**
   - Click "Switch to MOCK Mode" button
   - **Expected**: Mode switches to MOCK in Settings UI
   - Return to Home screen
   - Check Network tab
   - **Expected**: API requests STILL go to `http://localhost:8000` (env vars override)
   - **Expected**: Header shows `🔴 LIVE` (env vars win)

5. **Inspect Storage Keys**
   - DevTools → Application → Local Storage
   - **Expected**: `AXIA_BASE` = `"http://localhost:8000"` (from env, not localStorage)
   - **Expected**: `AXIA_PROJECT_ID` = `"env-test-project-123"` (from env)
   - **Expected**: `designer_mode` = `"mock"` (localStorage setting, but ignored)

6. **Verify Priority Order**
   - Change API URL in Settings to `http://different-url.com`
   - Save configuration
   - Hard reload browser
   - Check Network tab
   - **Expected**: Requests still go to `http://localhost:8000` (env vars take priority)
   - **Expected**: localStorage settings are ignored

7. **Remove Environment Variables**
   ```bash
   rm packages/totem-extension/.env.local
   ```
   - Restart dev server
   - Reload Designer
   - **Expected**: Now localStorage settings take effect
   - **Expected**: Mode toggle works normally

### Success Criteria
✅ Environment variables override localStorage  
✅ Mode toggle UI updates but env vars still control behavior  
✅ Priority order documented: env vars → localStorage → defaults  
✅ Removing env vars restores localStorage control  

### Documentation Notes
This test validates the **documented precedence behavior**:
1. **Environment Variables** (VITE_AXIA_*) - Highest priority
2. **localStorage** (designer_*, AXIA_*) - Medium priority
3. **Defaults** (constants.ts) - Lowest priority

**Use Case**: Developers can set `.env.local` for persistent Live mode during feature development, while QA/testing teams can use the Settings panel toggle for temporary mode changes.

---

## Edge Cases & Regression Tests

### Edge Case 1: Rapid Mode Toggling
- Toggle MOCK → LIVE → MOCK → LIVE rapidly (5 times in 10 seconds)
- **Expected**: Storage keys stay consistent
- **Expected**: No race conditions or stale data

### Edge Case 2: Multiple Tabs
- Open Designer in two browser tabs
- Change mode in Tab 1
- **Expected**: Tab 2 reflects changes (via storage events)
- **Expected**: Both tabs stay synchronized

### Edge Case 3: Storage Key Mismatch Prevention
- Manually set `AXIA_BASE_URL` in localStorage (legacy key)
- Reload page
- **Expected**: AxiaRpcClient ignores `AXIA_BASE_URL`
- **Expected**: Only `AXIA_BASE` is used

---

## Troubleshooting Guide

### Issue: Live mode toggle doesn't update header
**Check**:
- Console for synchronization logs
- Storage keys are correctly set
- Page was not manually refreshed mid-toggle

**Fix**: Hard reload browser and retry

### Issue: API requests still go to mock endpoint
**Check**:
- `AXIA_BASE` key in localStorage (not `AXIA_BASE_URL`)
- Network tab shows actual request URL
- Console shows AxiaRpcClient reload event

**Fix**: Clear all `designer_*` and `AXIA_*` keys, reconfigure

### Issue: Storage keys not synchronized
**Check**:
- Console for `[DesignerConfig] Synchronized to AXIA keys` log
- Verify `DesignerConfigManager.synchronizeToAxiaKeys()` is called

**Fix**: Possible bug - report to development team

---

## Test Results Template

```markdown
## Test Execution Results

**Date**: [YYYY-MM-DD]  
**Tester**: [Name]  
**Environment**: [Local Dev / Production]  
**Environment Variables Set**: [Yes / No] - If yes, list values

### Evidence Captured
- [ ] Screenshots saved to: _______________________________
- [ ] Console logs exported to: _______________________________
- [ ] Network HAR file saved to: _______________________________
- [ ] Storage inspector screenshots: _______________________________

### Test Case 1: Mock Mode (Default)
- [ ] PASS / [ ] FAIL
- **Notes**: _______________________________
- **Evidence**: Screenshot of header showing 🟢 MOCK, localStorage keys

### Test Case 2: Switch to Live Mode
- [ ] PASS / [ ] FAIL
- **Notes**: _______________________________
- **Evidence**: Screenshot of 🔴 LIVE header, storage keys (AXIA_BASE, AXIA_PROJECT_ID), network request to API

### Test Case 3: Switch Back to Mock Mode
- [ ] PASS / [ ] FAIL
- **Notes**: _______________________________
- **Evidence**: Screenshot showing cleared AXIA_* keys, console logs of cleanup

### Test Case 4: AxiaRpcClient Auto-Reload
- [ ] PASS / [ ] FAIL
- **Notes**: _______________________________
- **Evidence**: Console log showing "[AxiaRpcClient] Config reloaded from storage" after mode change

### Test Case 5: Persistence Across Reloads
- [ ] PASS / [ ] FAIL
- **Notes**: _______________________________
- **Evidence**: Before/after screenshots of storage keys across hard reload

### Test Case 6: Error Handling
- [ ] PASS / [ ] FAIL
- **Notes**: _______________________________
- **Evidence**: Screenshot of error states, console error messages

### Test Case 7: Environment Variable Precedence
- [ ] PASS / [ ] FAIL
- **Notes**: _______________________________
- **Evidence**: Screenshot of .env.local file, network tab showing env var URL used despite localStorage changes

### Edge Cases Tested
- [ ] Rapid Mode Toggling - Result: _______________________________
- [ ] Multiple Tabs Sync - Result: _______________________________
- [ ] Storage Key Mismatch Prevention - Result: _______________________________

### Bugs Found
1. **Severity**: [Critical / High / Medium / Low] - **Description**: _______________________________
2. **Severity**: [Critical / High / Medium / Low] - **Description**: _______________________________
3. _______________________________

### Performance Notes
- Mode toggle response time: _______ ms
- AxiaRpcClient reload time: _______ ms
- API request latency: _______ ms

### Overall Result
- [ ] ALL TESTS PASSED - Ready for production
- [ ] TESTS FAILED - Requires fixes before merge

### Recommendations
1. _______________________________
2. _______________________________
```

---

## Next Steps After Testing

1. **If all tests pass**: Document results and mark feature as production-ready
2. **If tests fail**: File bugs with reproduction steps from this test plan
3. **Update documentation**: Add any new findings to `tests/README.md`
4. **Regression tests**: Use failures to inform automated test coverage (Task #4)
