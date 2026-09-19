# Statechain Entity (SE) relational contract — RFC-007

**Scope:** RFC-007 §3.6 row `@totemsdk/se-server` (**Retain**) and row
`@totemsdk/statechain` / Phase 4 gate: *"SE relational contract documented
(PostgreSQL stays); statechain recover-without-SE + client-side
reopen/corruption tests."*

This document records the contract the SE server makes against its PostgreSQL
database so the persistence guarantee is answerable per surface — **who owns
what, how it may fail, and how it is verified**. It is a *contract doc*, not a
migration plan: PostgreSQL stays as the SE's storage engine, and the client-side
recovery/durability work lives in `@totemsdk/statechain` (`durable-store.ts`).

## 1. Ownership boundary

| Surface | Owner | Contract |
|---|---|---|
| `statechain_records` (ownership, state, encrypted reclaim fields, transfer count) | **se-server** (SE operator) | Relational ACID; the SE is the coordination authority for `coinId`-to-owner state. |
| `statechain_revocations` | **se-server** | Exactly-once revocation: a revoked party's key must never co-sign a transfer again. |
| `statechain_nonces` | **se-server** | Atomic nonce consumption: one challenge can be redeemed exactly once per 5-min window. |
| `statechain_sign_log` | **se-server** | Append-only audit trail of sign events (billing/dispute evidence). |
| `reclaim_tx_hex_enc` (current owner's pre-signed unilateral reclaim TX) | **se-server at rest + wallet/caller durably** | Encrypted at rest *and* owned durably by the caller. The SE is **not** the recovery authority: unilateral recovery must work without SE storage or cooperation (§3). |

**Rule (RFC-007 §4.1).** The client (`@totemsdk/statechain`) never writes into
SE storage and the SE never depends on client storage. The durable client-side
copy is the independent recovery copy; the SE copy is coordination state.

## 2. Tables (schema as migrated in `src/db.ts`)

- `statechain_records(chain_id PK, project_id, coin_id, token_id,
  statechain_script, locking_address, se_public_key, current_owner_party_id,
  current_owner_pkd, transfer_count, status CHECK in
  ('active','claimed','disputed'), reclaim_tx_hex_enc, created_at, updated_at)`
- `statechain_revocations(id, chain_id FK ON DELETE CASCADE,
  revoked_party_id, revoked_pkd, revoked_at)`
- `statechain_nonces(id, chain_id, nonce UNIQUE, expires_at)`
- `statechain_sign_log(id, chain_id, event_type, logged_at)`

## 3. Guarantees and how they are met

| Guarantee | Mechanism | Failure behavior |
|---|---|---|
| Ownership state is ACID | Single `UPDATE … SET current_owner_* = $N … WHERE chain_id = $1` per transfer (`updateStatechainOwner`) | Under concurrent revocations, the last committed transfer wins; status column is constrained by a `CHECK` so an invalid transition is a write error, never a silent corrupt row. |
| Reclaim-tx stored encrypted at rest | AES-256-GCM, key = `HMAC-SHA256(SE seed, "statechain-reclaim-tx-v1")`, nonce/ct/tag in one `enc:`-prefixed string (`src/seKey.ts`) | A tampered ciphertext fails GCM auth on `decryptReclaimTx` (throws) — it is **never** returned as plaintext. The format string carries no version; changing it requires its own migration. |
| Nonces consumed exactly once | `DELETE FROM statechain_nonces WHERE nonce = $1 AND expires_at > NOW() RETURNING chain_id` (`consumeNonce`) | Atomically deletes; a second redemption deletes 0 rows → rejected. A call that does not first `issueNonce` cannot authenticate. |
| Revocation is exactly-once | `INSERT INTO statechain_revocations` with no dedupe predicate; `isRevoked` reads the table. Re-signing a revoked key requires a fresh nonce + new owner. | A replay of a previous transfer's blinded signature is bound to a consumed nonce → rejected. |
| Timelock alerts for disputed chains | `getApproachingTimelockChains`: `status='disputed' AND updated_at < NOW() - INTERVAL '7 days'` | Read-only scan; alerting is best-effort. |
| Schema evolution | `migrateStatechainTables`: `CREATE TABLE IF NOT EXISTS` + index creates, idempotent on startup | Unknown rows are never deleted; no silent re-initialisation. |

## 4. What this contract is NOT

- **Not a replication policy.** PostgreSQL's durability is the engine's;
  `@totemsdk/storage` claims nothing about it.
- **Not a substitute for client recovery.** If the SE server is lost/compromised
  and the caller lost its durable `StateChain` copy (`reclaimTx` + owner fields),
  the funds are unrecoverable. That is why the client-side store (RFC-007 Phase 4
  `createDurableStateChainStore`) persists the full record and exposes
  `getRecoveryReport` / `verifyRecoverability` (below).
- **Not an encryption home for everything.** Only `reclaim_tx_hex_enc` is
  server-side encrypted here; wallet vaults and watermarks keep their own layers.

## 5. Client-side recovery material (RFC-007 Phase 4)

`@totemsdk/statechain` `createDurableStateChainStore(adapter, opts)` persists the
caller's `StateChain` records — including `reclaimTx`, `reclaimAddress`,
`lockingAddress`, `coinId`, `amount`, and `transferHistory` — over the shared
`@totemsdk/storage` snapshot primitive:

- **reopen:** a fresh store over the same backing adapter restores every chain
  (reopen test).
- **corruption:** an unsupported on-disk version or a structurally invalid chain
  raises `StorageError` `corrupt` — **never** silently re-initialised,
  **never** collapsed into `not-found`.
- **recover-without-SE:** `getRecoveryReport(chainId)` /
  `verifyRecoverability()` assert SE-independent recoverability:
  `reclaimTx` present, `reclaimAddress`/`lockingAddress`/`coinId`/`amount`
  present, and `verifyStateChain` passes. `reclaimAbandoned` then broadcasts the
  stored `reclaimTx` with no SE interaction (RFC-007 §5).

**Ownership, restated:** the wallet/caller durably owns unilateral recovery
material; recovery without SE cooperation must **not** depend solely on SE
storage. The SE never learns UTXO value or party identity beyond what the
protocol reveals.
