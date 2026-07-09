> **Historical Document — v1.0.0 SDK Migration Era (November 2025)**
> This document was created during the initial SDK migration from legacy wallet code.
> The migration is now complete (v2.1.0, February 2026). Retained as a historical record.

# SDK Migration Rollback Runbook

## Overview

This document provides procedures for rolling back from the new SDK-based wallet initialization to the legacy implementation. Rollback may be necessary if issues are detected during the staged rollout or if users experience problems with the SDK code path.

## Rollback Triggers

### Automatic Rollback (Recommended)

The SDK migration includes automatic rollback when error thresholds are exceeded:

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Initialization failure rate | > 5% in 1 hour | Auto-disable SDK mode |
| Critical error count | > 10 in 15 minutes | Immediate rollback |
| Balance sync failure rate | > 10% in 30 minutes | Disable SDK balance streaming |
| Transaction failure rate | > 3% in 1 hour | Revert to legacy tx path |

### Manual Rollback Triggers

Consider manual rollback if:
- Users report wallet unlock failures
- Balance displays are incorrect or delayed
- Transaction signing fails consistently
- Service worker crashes repeatedly
- Memory usage exceeds normal thresholds

## Rollback Procedures

### Level 1: Feature Flag Override (User-Level)

**Scope:** Individual user  
**Impact:** Minimal - only affects single installation  
**Recovery Time:** Immediate

```javascript
// Execute in browser DevTools console (extension context)
chrome.storage.local.set({ 
  walletConfig: { 
    initMode: 'legacy',
    sdkDisabledReason: 'manual_override',
    sdkDisabledAt: Date.now()
  } 
});

// Reload extension
chrome.runtime.reload();
```

**Verification:**
```javascript
chrome.storage.local.get('walletConfig', (result) => {
  console.log('Init mode:', result.walletConfig?.initMode);
});
```

### Level 2: Global Feature Flag Rollback (Server-Side)

**Scope:** All users in rollout group  
**Impact:** Moderate - affects all canary/rollout users  
**Recovery Time:** < 5 minutes (after config propagation)

**Backend Configuration Update:**
```typescript
// packages/axia-api/src/config/feature-flags.ts
export const SDK_MIGRATION_CONFIG = {
  enabled: false,  // <- Set to false for rollback
  rolloutPercentage: 0,
  canaryGroups: [],
  forceDisableUntil: Date.now() + (24 * 60 * 60 * 1000), // 24h cooldown
};
```

**API Endpoint (if implemented):**
```bash
curl -X POST https://api.axia.network/admin/feature-flags/sdk-migration \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": false, "reason": "elevated_error_rate"}'
```

### Level 3: Emergency Extension Rollback

**Scope:** All users  
**Impact:** High - requires extension update  
**Recovery Time:** 24-48 hours (Chrome Web Store review)

1. **Prepare Legacy Build:**
   ```bash
   cd packages/totem-extension
   git checkout pre-sdk-migration
   npm run build:production
   ```

2. **Submit to Chrome Web Store:**
   - Upload to Chrome Developer Dashboard
   - Mark as critical security/stability fix
   - Request expedited review

3. **Emergency Sideload (Designer Mode Only):**
   ```bash
   # Distribute pre-built legacy extension to affected users
   # User loads unpacked extension from chrome://extensions
   ```

## Recovery Procedures

### Watermark State Recovery

If SDK migration corrupts watermark state, use the recovery CLI:

```bash
# Install recovery tool
npm install -g @totem/recovery-cli

# Export current state (before recovery)
totem-recovery export --output backup-$(date +%Y%m%d).json

# Restore from backup
totem-recovery restore --input backup-20251126.json

# Sync watermark from server
totem-recovery sync-watermark --address <wallet_address>
```

**Manual Watermark Recovery:**
```javascript
// In extension DevTools console
const watermarkStore = await import('./stores/watermark');

// Get server watermark
const response = await fetch(
  `${AXIA_BASE}/v1/${PROJECT_ID}/wots/watermark/${address}`
);
const serverState = await response.json();

// Update local state
await watermarkStore.setState({
  next_l1: serverState.next_l1,
  next_l2: serverState.next_l2,
  next_l3: serverState.next_l3,
  usedIndices: serverState.used_indices || []
});
```

### Lease State Recovery

If lease state is corrupted or out of sync:

```bash
# CLI recovery
totem-recovery recover-leases --address <wallet_address>

# Force release all leases and re-acquire
totem-recovery reset-leases --force
```

**Manual Lease Recovery:**
```javascript
// In extension DevTools console
const leaseStore = await import('./stores/lease');

// Clear corrupted leases
await leaseStore.clear();

// Leases will be re-acquired on next transaction
console.log('Leases cleared. New leases will be acquired on next tx.');
```

### Balance Cache Recovery

If balance display is incorrect:

```javascript
// Clear balance cache
await chrome.storage.local.remove('meg_balance_cache');

// Force refresh from MEG
const balanceManager = await import('./services/MegBalanceStreamManager');
await balanceManager.forceRefresh();
```

## Monitoring During Rollback

### Key Metrics to Watch

```typescript
// Prometheus queries for rollback monitoring
const ROLLBACK_METRICS = {
  // Initialization success rate
  initSuccessRate: 'rate(wallet_init_success_total[5m]) / rate(wallet_init_attempts_total[5m])',
  
  // Error rate by mode
  errorsByMode: 'sum(rate(wallet_errors_total[5m])) by (init_mode)',
  
  // Balance sync latency
  balanceSyncP99: 'histogram_quantile(0.99, rate(balance_sync_duration_seconds_bucket[5m]))',
  
  // Transaction success rate
  txSuccessRate: 'rate(tx_finalize_success_total[5m]) / rate(tx_finalize_attempts_total[5m])',
};
```

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Init failure rate | > 2% | > 5% |
| Balance sync latency P99 | > 5s | > 15s |
| Transaction failure rate | > 1% | > 3% |
| Service worker restarts | > 5/hour | > 20/hour |

## Balance Streaming Integration

### Independence from SDK Mode

The MEG balance streaming feature operates **independently** of the SDK migration flag. This means:

- Balance streaming works in both `legacy` and `sdk` initialization modes
- Toggling `initMode` does not affect balance stream connections
- The `balance-stream` port handler in `background/index.ts` is always active

This independence is by design to ensure users always have real-time balance updates regardless of the SDK rollout status.

### Balance Streaming Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SDK Mode Toggle                              │
│   ┌─────────────────┐              ┌─────────────────┐          │
│   │  legacy mode    │              │   sdk mode      │          │
│   └─────────────────┘              └─────────────────┘          │
│           │                               │                      │
│           └───────────┬──────────────────┘                      │
│                       │                                          │
│                       ▼                                          │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  balance-stream port handler (always active)             │   │
│   │  → MegBalanceStreamManager singleton                     │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Rollback Behavior by Tier

| Rollback Level | Balance Streaming Impact |
|----------------|-------------------------|
| Level 1 (User Override) | No impact - streaming continues |
| Level 2 (Global Flag) | No impact - streaming continues |
| Level 3 (Emergency Extension) | May require reconnection after extension reload |

### Balance Streaming Verification Steps

After any rollback, verify balance streaming is functioning:

```javascript
// In extension DevTools console (background context)

// 1. Check MegBalanceStreamManager state
console.log('Connection state:', megBalanceStreamManager.getConnectionState());
// Expected: 'connected' or 'polling'

// 2. Check active listeners
console.log('Listener count:', megBalanceStreamManager.getListenerCount());

// 3. Force reconnection if needed
await megBalanceStreamManager.reconnect();
```

### Balance Streaming Troubleshooting

**Symptom: Balance not updating after rollback**

1. Check if port handler is receiving messages:
   ```javascript
   // Add temporary logging
   chrome.runtime.onConnect.addListener((port) => {
     console.log('[Debug] Port connected:', port.name);
   });
   ```

2. Verify WebSocket connection:
   ```javascript
   // Check connection state
   megBalanceStreamManager.getConnectionState();
   // If 'disconnected', force reconnect:
   await megBalanceStreamManager.reconnect();
   ```

3. Check for cached balance:
   ```javascript
   const cached = await megBalanceStreamManager.getCachedBalance(address);
   console.log('Cached balance:', cached);
   ```

**Symptom: Balance streaming degraded to polling**

This is expected fallback behavior when WebSocket connection fails. Polling provides the same data with higher latency (~30s vs real-time).

To force WebSocket reconnection:
```javascript
megBalanceStreamManager.stop();
await megBalanceStreamManager.start(addresses);
```

### Telemetry During Rollback

Balance streaming emits the following telemetry events that can help diagnose rollback issues:

| Event | Description |
|-------|-------------|
| `balance_stream_connected` | WebSocket connection established |
| `balance_stream_disconnected` | WebSocket connection lost |
| `balance_stream_fallback` | Degraded to HTTP polling |
| `balance_stream_error` | Error during streaming |
| `balance_update_received` | Balance update processed |

Query these in the telemetry dashboard to verify streaming health during rollback:
```sql
SELECT 
  event_type,
  COUNT(*) as count,
  AVG(CASE WHEN event_type = 'balance_update_received' THEN latency_ms END) as avg_latency
FROM extension_telemetry
WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND event_type LIKE 'balance_stream%'
GROUP BY event_type;
```

## Post-Rollback Checklist

- [ ] Confirm all users on legacy code path
- [ ] Verify transaction flow working correctly
- [ ] Check balance sync functioning
- [ ] **Verify balance streaming active** (check telemetry for `balance_stream_connected` events)
- [ ] Review error logs for root cause
- [ ] Document incident timeline
- [ ] Schedule post-mortem meeting

## Rollback Decision Matrix

| Symptom | Severity | Recommended Action |
|---------|----------|-------------------|
| Single user reports unlock issue | Low | Level 1 (user override) |
| Multiple users same error | Medium | Level 2 (global flag) |
| Transaction failures > 3% | High | Level 2 + investigation |
| Balance display incorrect | Medium | Clear cache + Level 1 |
| Extension crashes on load | Critical | Level 3 (emergency) |
| Security vulnerability | Critical | Level 3 (emergency) |

## Communication Templates

### User-Facing Message (Minor Issues)
```
We've detected an issue with a recent update and have automatically 
switched you to our stable fallback mode. Your wallet and funds are 
safe. We're working on a fix.
```

### User-Facing Message (Emergency Rollback)
```
We're temporarily rolling back a recent wallet update due to 
stability issues. Your wallet has been reverted to the previous 
stable version. All funds are safe and accessible. We apologize 
for any inconvenience.
```

## Appendix: Rollback Verification Commands

```bash
# Check current init mode across user base (requires analytics access)
SELECT 
  init_mode,
  COUNT(*) as user_count,
  AVG(init_duration_ms) as avg_init_time
FROM wallet_telemetry
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY init_mode;

# Check error distribution
SELECT 
  error_type,
  init_mode,
  COUNT(*) as error_count
FROM wallet_errors
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY error_type, init_mode
ORDER BY error_count DESC;
```
