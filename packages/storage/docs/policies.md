# Storage policies

Operational and engineering policies for code that persists state through
`@totemsdk/storage`, and for contributors to the package. Policies here are
normative for every Totem package that touches a storage backend; violations
are review blockers.

## 1. Durability policy

- Any consumer that **publishes** writes to other parties, or whose state must
  survive a process crash, MUST use a `durably-acknowledged` store
  (`SqliteStore` or `FileStore`) and MUST call
  `assertCapabilities(store, { acknowledge: 'durably-acknowledged', atomic: true })`
  at startup so a misconfigured backing store fails fast.
- `MemoryStore` is for ephemeral tests only, never for runtime persistence.
- `durably-acknowledged` means a write is acknowledged only after SQLite
  (WAL + `synchronous=FULL`) or the filesystem (fsync) has it on durable
  storage — not merely buffered.

## 2. Atomicity / CAS policy

- Multi-table or multi-record mutations MUST go through one shared primitive:
  `transactionalSync(…)` for batches, `transitionAndEnqueue(…)` for
  CAS-guarded updates paired with an outbox enqueue. Never issue several
  statements as "one logical op" outside a transaction.
- All concurrency control is **revision-based CAS**. Writers read a revision,
  build the descendant, and `conditionalUpdate` (or `transitionAndEnqueue`).
  A CAS miss (`write-failed`) means "somebody else changed it" — the caller
  must re-read and re-try or abandon; it is never a disk error.
- `SqliteStore` runs transactions on one connection (`BEGIN … COMMIT`, rollback
  on throw). `busy_timeout` governs contention; consumers opening a file that
  other processes share SHOULD pass an explicit `busyTimeoutMs`.
- Outbox enqueue (`INSERT OR REPLACE`) shares the commit with its CAS update.
  If the CAS touches zero rows the enqueue is rolled back with it — a caller
  seeing `false` MUST NOT assume the message was enqueued.

## 3. Data-at-rest policy

- **`@totemsdk/storage` never persists private keys.** Stores hold stable
  references/IDs (keys, digests, addresses, nonces); secrets live in memory in
  `Uint8Array` and are zeroed after use per the root
  [crypto policy](../../docs/security/crypto-policy.md) §3/§11.
- Any consumer that does need encrypted key material at rest MUST encrypt with
  AES-256-GCM (unique IV per encryption) before writing, per crypto policy §11.
- Never write secrets, seeds, or private keys into `record_json` style blobs,
  logs, or `StorageError` details.

## 4. Artifact digest verification

- All artifact reads MUST be verified against the `ArtifactRef` digest before
  the bytes are trusted. `ArtifactStore.get` returns `corrupt` (never the bytes)
  when verification fails, and `not-found`\ `unavailable` are distinct from
  tampering.
- Only `ArtifactStore` (digest-verified) or a backend that has passed
  `runBackendConformance` may be used for content-addressed byte storage.
- Add a new backend by implementing `ArtifactStoreBackend` and wiring it by
  config — never by registering it in the SDK (no provider registry).

## 5. No-silent-downgrade policy

- Consumers MUST validate required capabilities with `assertCapabilities` and
  fail startup rather than degrade silently on a weaker store.
- Never catch a capability failure and fall back to an unacknowledged adapter.
- `StorageError` codes are part of the API contract:
  `not-found` (absent) is never folded into `corrupt` (broken) or `unavailable`
  (down), and vice versa.

## 6. Error taxonomy usage

- Store implementations raise `StorageError` with one of:
  `not-found | corrupt | unavailable | write-failed`.
- A thrown `StorageError` must carry a `code`; use `isStorageError`/
  `asStorageError` when translating foreign errors so the taxonomy is stable
  at the boundary.

## 7. Contribution policy

- All changes to `packages/storage/src/**` require at least one maintainer
  review; anything touching durability, CAS semantics, or the codec additionally
  requires the review notes of the root
  [CONTRIBUTING.md](../../CONTRIBUTING.md) §Cryptographic Code Requirements.
- Any new storage consumer MUST run `runCoreConformance` (adapters) /
  `runBackendConformance` (artifact backends) and keep the storage→core DAG
  lint green (`scripts/verify-storage-dag.mjs`).
- Consumer migrations onto `SqliteStore` primitives MUST preserve row/record
  shape ("records unchanged in shape") unless the RFC explicitly changes the
  schema; schema changes are an RFC-level decision.

## References

- RFC-007 — [storage consolidation](../../docs/rfc/RFC-007-STORAGE-CONSOLIDATION.md)
- [crypto-policy.md](../../docs/security/crypto-policy.md)
- [SECURITY.md](../../SECURITY.md)
- [CONTRIBUTING.md](../../CONTRIBUTING.md)
