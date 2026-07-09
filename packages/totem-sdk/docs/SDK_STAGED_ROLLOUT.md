> **Historical Document — v1.0.0 SDK Migration Era (November 2025)**
> This document was created during the initial SDK migration from legacy wallet code.
> The migration is now complete (v2.1.0, February 2026). Retained as a historical record.

# SDK Staged Rollout Configuration

This document describes how to progressively roll out the SDK-based wallet initialization in the Totem Extension.

## Rollout Groups

The SDK migration uses four rollout groups:

| Group | Description | Target Audience |
|-------|-------------|-----------------|
| `disabled` | SDK is completely disabled (default) | Pre-release |
| `internal` | SDK enabled for all users in group | Internal testing |
| `canary` | SDK enabled for 10% of users | Early adopters |
| `production` | SDK enabled for all users | General availability |

## Rollout Progression

```
disabled → internal → canary → production
```

### Phase 1: Disabled (Current Default)

All users use the legacy initialization path. This is the safe default for initial deployment.

```typescript
// Default configuration
{
  rolloutGroup: 'disabled',
  initMode: 'auto'
}
```

### Phase 2: Internal Testing

Enable SDK for internal team testing. Set rollout group via:

**Option A: Developer Console**
```javascript
chrome.storage.local.set({ 'axia:sdk:rolloutGroup': 'internal' });
```

**Option B: Message API**
```javascript
chrome.runtime.sendMessage({ type: 'sdk:setRolloutGroup', params: ['internal'] });
```

**Verification:**
```javascript
chrome.runtime.sendMessage({ type: 'sdk:getStats' }, console.log);
// Expected: { rolloutGroup: 'internal', ... }
```

### Phase 3: Canary Rollout (10%)

Enable SDK for 10% of users based on extension ID hash. This provides:
- Gradual exposure to real-world conditions
- Early detection of issues before full rollout
- Automatic rollback protection (3 errors → 24h cooldown)

```javascript
chrome.storage.local.set({ 'axia:sdk:rolloutGroup': 'canary' });
```

**Canary Selection:**
Users are assigned to canary based on a deterministic hash of their extension ID:
```typescript
const hash = simpleHash(chrome.runtime.id);
const bucket = hash % 100;
const isCanary = bucket < 10; // 10% of users
```

### Phase 4: Production Rollout (100%)

After successful canary validation:

```javascript
chrome.storage.local.set({ 'axia:sdk:rolloutGroup': 'production' });
```

## Manual Overrides

Users can manually force SDK or legacy mode regardless of rollout group:

**Force SDK Mode:**
```javascript
chrome.runtime.sendMessage({ type: 'sdk:setMode', params: ['sdk'] });
```

**Force Legacy Mode:**
```javascript
chrome.runtime.sendMessage({ type: 'sdk:setMode', params: ['legacy'] });
```

## Auto-Rollback Protection

The SDK migration includes automatic rollback protection:

| Parameter | Value | Description |
|-----------|-------|-------------|
| Error Threshold | 3 errors | Triggers auto-rollback |
| Time Window | 1 hour | Error count resets after 1 hour |
| Cooldown Period | 24 hours | SDK disabled for 24h after auto-rollback |

When auto-rollback triggers:
1. SDK mode is disabled
2. Legacy mode is used for 24 hours
3. After cooldown, rollout group evaluation resumes

## Monitoring Telemetry

Track rollout success with the SDK stats API:

```javascript
chrome.runtime.sendMessage({ type: 'sdk:getStats' }, (response) => {
  console.log('SDK Stats:', response.result);
  // {
  //   successRate: 0.95,      // 95% success rate
  //   totalInits: 100,         // Total initialization attempts
  //   currentMode: 'auto',     // Current mode setting
  //   rolloutGroup: 'canary',  // Active rollout group
  //   isDisabled: false,       // Auto-rollback status
  //   errorCount: 0            // Current error count
  // }
});
```

## Chrome Web Store Rollout

For Chrome Web Store submissions, use the built-in staged rollout:

1. **Initial Release:** Submit with `disabled` rollout group
2. **Staged Rollout:** Use Chrome Web Store's 10% → 50% → 100% staged rollout
3. **Progressive Enable:** Increment rollout group as store rollout progresses

## Emergency Rollback

If issues are discovered post-rollout:

### User-Level Rollback
```javascript
chrome.runtime.sendMessage({ type: 'sdk:setMode', params: ['legacy'] });
```

### Global Rollback (Admin)
Publish extension update with:
```javascript
// In SdkMigrationManager.ts - change default
rolloutGroup: (result[STORAGE_KEYS.SDK_ROLLOUT_GROUP] as RolloutGroup) || 'disabled',
```

### Emergency Sideload
See `SDK_ROLLBACK_RUNBOOK.md` for emergency sideload procedures.

## Configuration Reference

### Storage Keys
| Key | Type | Description |
|-----|------|-------------|
| `axia:sdk:initMode` | `'sdk' \| 'legacy' \| 'auto'` | Manual mode override |
| `axia:sdk:rolloutGroup` | `'internal' \| 'canary' \| 'production' \| 'disabled'` | Rollout group |
| `axia:sdk:disabledReason` | `string` | Auto-rollback reason |
| `axia:sdk:disabledAt` | `number` | Auto-rollback timestamp |
| `axia:sdk:errorCount` | `number` | Current error count |

### Message API
| Message Type | Params | Description |
|--------------|--------|-------------|
| `sdk:getConfig` | - | Get current configuration |
| `sdk:getStats` | - | Get telemetry stats |
| `sdk:setMode` | `['sdk' \| 'legacy']` | Set mode manually |
| `sdk:setRolloutGroup` | `[RolloutGroup]` | Set rollout group |
| `sdk:reset` | - | Reset to defaults |

## Rollout Checklist

- [ ] Internal testing complete (1 week minimum)
- [ ] All parity tests passing (69/69)
- [ ] Chaos tests passing (37/37)
- [ ] E2E tests passing
- [ ] Telemetry dashboard configured
- [ ] Rollback procedures documented and tested
- [ ] On-call team briefed on rollback procedures
- [ ] Canary period complete (2 weeks minimum)
- [ ] Success rate > 99%
- [ ] No critical issues in canary
- [ ] Production rollout approved
