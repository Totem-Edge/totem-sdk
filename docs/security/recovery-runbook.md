# Key, lease and disaster recovery runbook

**Status:** RFC-063 B4 — tested procedures (not prose-only)
**Owner:** Totem SDK maintainers
**Related:** [threat model](threat-model.md) §7.5, [crypto policy](crypto-policy.md),
RFC-007 (storage durability), RFC-013 (self-hosted lease), RFC-031 (WASM/legacy),
RFC-058/061 (custody boundaries)

> **Invariant.** A WOTS leaf must never sign twice. Every procedure below is
> fail-closed: if recovery cannot prove a safe next index, it aborts instead of
> starting at zero. Never clear, delete or “reset” lease state to make a node
> start; that is key reuse.

## 1. Primitives and where they are enforced

| Need | Primitive | Fail-closed behaviour | Test |
|---|---|---|---|
| Next signing index / journal | `LocalLeaseProvider` (`packages/wots-lease/src/local.ts`), `LeaseJournal` | Reopening burns reservations that were journaled but not committed; a burned index is never reissued | `wots-lease/src/__tests__/reservation-recovery.test.ts`, `journal.test.ts` |
| Restore/import watermark | `seedLeaseWatermark` / `exportLeaseWatermark` (`packages/wots-lease/src/seed.ts`) | Priority: on-chain cursor → exported blob → operator high-water. No source and no `fresh` ⇒ `WatermarkSeedRequiredError`; a seed behind the cursor ⇒ `WatermarkSeedRegressionError` | `seed.test.ts`, `watermark.test.ts` |
| Torn storage journal | `createJournal(...).recover()` (`packages/storage/src/journal.ts`) | Rolls back an unrecorded tail; a gap below the contiguous head is `corrupt`, not absence | `storage/src/__tests__/journal.test.ts` |
| CAS snapshots | `@totemsdk/storage/snapshot` revision-CAS | Corrupt or unsupported record version raises `StorageError{code:'corrupt'}`; never silently reinitialises | `snapshot-store.test.ts`, `cas-fuzz.test.ts` |
| Channel state | `SyncSqliteStore` + `recoverChannel` (`packages/omnia-host/src/stores/sqlite-store.ts`) | Recovery drops the runtime signer; the host must rebind it before routing (CAN-002) | `omnia-host/src/__tests__/stores.test.ts` |
| Observation journal | `createSqliteObservationStore` (`packages/omnia-host/src/observe/store.ts`) | Calls `journal.recover()` before use; cursor is contiguous | `observe` suites |
| Human approval gate | `MfaPurpose` `'key-rotation'` / `'recovery'` (`packages/omnia-host/src/mfa.ts`) | Rotation and recovery actions can require a second factor | `omnia-host/src/__tests__/mfa.test.ts` |

## 2. Procedures

### A. Process restart after a crash

1. Reopen the stores normally; do **not** delete `*.sqlite`, journal files or
   lease keys.
2. Read the recovery report: `headBefore`, `headAfter`,
   `repairedUnrecordedTail`, `gapAt`.
3. If `gapAt` is non-empty, stop and preserve the files — that is corruption, not
   a torn tail. Escalate with the report.
4. Resume only when the journal head is contiguous.

### B. Lost or rolled-back watermark / lease snapshot

1. Reopen `LocalLeaseProvider`; `initialize()` burns any reservation that was
   journaled but not committed, so the next index advances rather than repeats.
2. Do not restore an older watermark “to unstick” a node.
3. If the journal and watermark are both gone, treat the keyspace as **burned**
   and use procedure D (new seed), not index 0.

### C. Restore or import a wallet/keyspace

1. Prefer the on-chain cursor (`OnchainWatermarkProvider.syncLeaseJournal()`).
2. Otherwise require an exported blob (`exportLeaseWatermark`) or an
   operator-provided high-water mark.
3. Pass `fresh: true` **only** for a genuinely new, never-used keyspace.
4. Never lower a cursor: a regression throws; keep the higher value.

### D. Device key compromise or planned rotation

There is no automatic rotation API. Rotation is a deliberate, fail-closed
migration:

1. Stop the compromised signer and preserve logs/state for the incident.
2. Export the watermark if the device is still readable.
3. Declare every leaf under the old seed burned; derive a **new** seed/identity
   (root-identity/derivation path).
4. Seed the new keyspace with an operator high-water mark at least as high as the
   exported/chain cursor; never start at 0.
5. Update `OMNIA_LOCAL_PUBKEY` / `OMNIA_LOCAL_PARTY_ID` /
   `OMNIA_LOCAL_ADDRESS_INDEX` and any signer-port configuration.
6. Require the `'key-rotation'` MFA purpose for the rotation operation and record
   it in the audit store.
7. Re-pair peers/channels; old channels stay bound to the old identity.

### E. Disk loss / full disaster recovery

1. Restore the storage directory from backup.
2. Run journal recovery (A) and verify CAS snapshots open; corruption fails
   closed.
3. Seed the watermark from the on-chain cursor first. If the chain is
   unreachable, require an exported blob or operator high-water mark.
4. If neither exists, the keyspace is unusable for signing until an operator
   supplies a trustworthy high-water mark. Do not sign.

### F. Channel state after restore

1. Reopen `SyncSqliteStore`; channels are recovered from snapshots.
2. Recovered channels have no `localSigner` (store `rebind` step). Confirm the
   host signer is attached before routing or settling (`CAN-002`).
3. If a channel cannot be recovered, do not reconstruct a mutable state from
   peers; re-open or abandon it through the normal factory/splice path.

## 3. Executable verification

The procedures above are exercised by the suites named in §1. Run the focused
gate before/after a recovery drill:

```bash
node scripts/verify-recovery-procedures.mjs
# or
pnpm run verify:recovery
```

It runs the lease, storage and host recovery suites and exits non-zero on any
failure. A recovery drill is not complete until this gate and the post-restore
node smoke test pass.

## 4. Do not

- Delete or truncate lease state, journals or watermark rows to force startup.
- Restore an older watermark or replay a lease reservation.
- Start a restored/rotated keyspace at index 0.
- Sign with a recovered channel whose signer was not rebound.
- Rotate a key without exporting the old watermark when the device is readable.
