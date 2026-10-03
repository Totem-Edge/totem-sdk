# RFC-020: Multi-Package Adversarial Hardening — Key Identity, WOTS Leasing, Verification Stubs, Composition & Serializer Parity

**Status:** Draft — remediation contract (P0, P1 and P2 landed)
**Created:** 2026-09-29
**Revised:** 2026-10-01
**Authors:** Totem SDK Contributors
**Depends on:** RFC-009 (KISSVM signature fidelity), RFC-016 (template hardening), RFC-018 (adversarial remediation), SECURITY.md invariants
**Touches:** `@totemsdk/kissvm`, `@totemsdk/recursive-mast`, `@totemsdk/tx-builder`, `@totemsdk/core`, `@totemsdk/core-wasm`, `@totemsdk/wots-lease`, `@totemsdk/identity`, `@totemsdk/provider-bond`, `@totemsdk/liquidity-bond`, `@totemsdk/governance`, `@totemsdk/authority`, `@totemsdk/agent-policy`, `@totemsdk/omnia`, `@totemsdk/omnia-host`, `@totemsdk/connect`, `@totemsdk/se-server`, `@totemsdk/txpow`, `@totemsdk/edge-mqtt`, `@totemsdk/root-identity`, `@totemsdk/storage`, `@totemsdk/lookup-node`, `@totemsdk/intelligence`, `@totemsdk/server`, `@totemsdk/realtime`, `@totemsdk/minima-rpc`, `@totemsdk/mcp-server`, `@totemsdk/statechain`
**Evidence:** two independent adversarial audits of `main` @ `451ad77a609047bde725c22ce9c54b2ab20e754d`:
- **Pass 1** (in-scope scripts): `docs/audits/kissvm-recursive-mast-adversarial-2026-09.md`
- **Pass 2** (SDK-wide, 65 packages / ~182k LOC, four trust-zone deep-dives + lead re-read of every Critical/High marked **V**)

---

## 1. Summary

RFC-018 fixed a large share of the first adversarial pass but left **two Critical and
fourteen High** findings on the hardened surface. The second pass found that RFC-018
itself **introduced** two new criticals:

- **P0-1 (`TXB-MULTISIG-005`)** — `MultisigManager.load()` verifies a persisted
  signature against `s.publicKey` but counts it by the **Map key**, which the record
  writer controls. One attacker signature duplicated under configured signers' keys
  produces `ready` with no legitimate signer.
- **P0-2 (`KISSVM-KEYIDENT-001`)** — key identity is not canonical: `verifySignedBy`
  strips `0x`, while `normalizeHex`/`kissvmEq` do not. A bare-hex owner equal to the
  service-entity key bypasses `ASSERT prevOwner NEQ se` and collapses the *stable*
  statechain `MULTISIG(2)` to 1-of-1. RFC-018's oracle claim (Minima counts
  `MULTISIG` positions) still holds; the defect is **key identity**, not the
  evaluator's counting.

The remaining highs span composition (`toNestedMastScript` branch-terminal `RETURN`),
simulation/production divergence (forced legacy MAST), signing canonicalization
(disclosed script body/evidence unbound), the invariant gate (blind to dead code
after terminal `MAST`), experimental economics, and WASM/TS serializer parity.

**Pass 2 extended the audit SDK-wide** (65 packages / ~182k LOC, four trust zones).
It found that **all three invariants stated in `SECURITY.md` are currently
violated**:

- **WOTS one-time-key reuse** is reachable through ≥4 independent public APIs
  (tx-builder, omnia-host, liquidity-bond, root-identity) and the Axia lease
  provider's replay detection is silently disabled (**C1, C2**).
- **Private-key material can be logged** (`TOTEM_SEED_DEBUG`, `setWotsLogger`, and
  the shared SE seed reused for reclaim-key derivation) — see §4.6.
- **Byte-exact serialization has divergent address helpers** (`SHA3(script)` vs
  `mmrLeafExact`) plus WASM/TS serializer divergence — see §4.2 P1-11 and §4.6.

Pass‑1 (in-scope): **2 Critical** (P0-1, P0-2) / **14 High**. Pass‑2 (SDK-wide):
**5 Critical** (C1–C5) / **12 High** (H1–H12), plus a large Medium/Low tail. C5
duplicates in-scope P1-13 (`validateExternalSignature`), which is reclassified
Critical. Unmarked Pass‑2 items are agent-reported and require confirmation before
remediation; line numbers are against the current working tree (note:
`packages/storage` has uncommitted changes).

This RFC is the contract for a **multi-package** hardening pass. Every item ships
with a **negative regression test executed through `evaluateScript`/the executable
API**; string-presence assertions are not accepted as proof.

---

## 2. Goals

1. Make **key identity canonical** across the VM, templates, and `tx-builder`, so
   equality/inequality guards and signature lookup agree byte-for-byte.
2. Make **multisig readiness sound**: `ready ⇔ threshold unique configured signers
   produced valid signatures over `sha3_256(transactionHex)`, at load and in memory.
3. Make **proof/MAST composition fail closed** for every control-flow shape, not only
   straight-line `RETURN TRUE` tails.
4. Make **simulation evaluate exactly what production evaluates** (no forced legacy
   MAST fallback).
5. Make **request signing bind what executes** (full disclosed scripts + evidence).
6. Make the **invariant gate structural over all terminal ops**, and I3 enforced
   without caller opt-in.
7. Restore **WASM ↔ TS serializer byte/digest parity** for real (precomputed)
   transactions, token scales, and signed values.
8. Close the remaining **experimental economic/authorization** holes.

**Pass-2 (SDK-wide) goals:**

9. **Eliminate all WOTS key reuse:** a single mandatory `WotsLeaseProvider`
   reservation path, no default/hardcoded indices, write-ahead persistence of the
   incremented counter before any signature is returned, and monotonic enforcement
   in `setUses`/`setRootUses`/`restoreWatermarkState`.
10. **Delete every hand-rolled verifier stub** (`validateExternalSignature`,
    `provider-bond` identity/bond proofs, `recursive-mast` branch stubs, wots-lease
    `verifyLeaseCertificate(undefined)`) or route it through the already-correct
    `@totemsdk/identity` / canonical encoders.
11. **Close authorization bypasses** in `omnia-host` (default-open control plane),
    `connect` (optional approval + discarded origin), `se-server` (unauthenticated
    `/create`), `edge-mqtt` (optional command-signature verification), and
    `provider-bond` (attacker-supplied identity graphs).
12. **Stop leaking secrets:** compile out seed/private-key logging; HKDF
    domain-separation for SE reclaim keys; no tokens in URLs/query params.
13. **Harden parsers and sandboxes:** KISSVM `FUNCTION` frame limits + no string
    argument injection; storage artifact path traversal; storage codec prototype
    pollution; registry `__proto__` keys; bounded numeric parsing.
14. **Enforce scope and accounting:** identity claim-scope enforcement;
    governance tally binding; liquidity-bond chain-confirmed funding; agent-policy
    usage metering.

## 3. Non-goals

- Changing Minima consensus semantics (notably `MULTISIG` position counting).
- Redesigning the policy vocabulary or the RFC-007 storage contracts.
- Completing the deferred chunked-artifact work (RFC-007 Amendment A).

---

## 4. Findings → remediation matrix

### 4.1 P0 — release blockers

| # | Finding | File / symbol | Remediation | Acceptance |
|---|---------|---------------|-------------|------------|
| **P0-1** | **C1 `TXB-MULTISIG-005`** — load binding forgery (`load()` verifies `s.publicKey`, counts Map key) | `tx-builder/src/multisig-manager.ts:189-201, 385-390` | Derive identity from one source: verify `verifyWotsSignature(sig, digest, s.publicKey)` **and** require `normalizePk(key) === normalizePk(s.publicKey)`; rebuild the Map key from `normalizePk(s.publicKey)`; reject mismatched persisted keys (`MultisigStorageError('corrupt')`) | Record with Map key `A` but `publicKey:C` ⇒ `isReady===false`; duplicate `publicKey` under two keys counts 1 |
| **P0-2** | **C2 `KISSVM-KEYIDENT-001`** — key identity asymmetric (`verifySignedBy` strips `0x`; `normalizeHex`/`kissvmEq` preserve it) | `kissvm/src/eval.ts:742-748, 1120-1136`; manifest `statechain.ts:22-52` | Canonicalize keys: `normalizeHex` returns lowercase **without** `0x`; compare all key guards/lookups through it. Add a canonical `NEQ` guard to statechain (`ASSERT prevOwner NEQ se` in canonical form) | `buildStatechainScript` with bare-hex owner `== sePk`, only the SE signature ⇒ `false`; same for `0x`-prefixed; VM test `"<h>" NEQ "0x<h>"` is **false** in canonical compare |
| **P0-3** | **`TXB-MULTISIG-006`** — `load()` never rebinds digest to `transactionHex` | `multisig-manager.ts:189-201` | `if (normalize(recomputeDigest(transactionHex)) !== normalize(transactionDigest)) throw MultisigStorageError('corrupt')` before re-verification | Tamper only `transactionHex` ⇒ load rejects / `isReady===false` |
| **P0-4** | **`KISSVM-MULTISIG-THRESHOLD-001`** — `MULTISIG(0 …)`/negative allow-all; governance builders don't validate | `eval.ts:348-356`; `governance.ts:104,137,305,351`; `invariants.ts:49-52` | Evaluator: reject `threshold <= 0` (throw or return false). Builders: validate `1 ≤ t ≤ unique(keys)` and reject duplicate/empty keys at construction | `ASSERT MULTISIG(0 …)` ⇒ `false`; treasury/mandate/proposal builders throw on `0`/`-1`/duplicate keys |
| **P0-5** | **`RM-SIM-001`** — `simulatePolicyTransaction` forces `allowLegacyMastBranches:true`, so proof-less plans "simulate" but cannot execute | `recursive-mast/src/kissvm/simulation.ts:27-38` | Remove the forced flag; require `plan.scriptProofs` non-empty or fail with an explicit error; if a dev mode is retained, gate it on an explicit parameter and never default it | Plan without proofs ⇒ simulation and production both fail identically |

**P0 landed.** `MultisigManager.load()` rebinds `transactionDigest` to `transactionHex`, re-verifies each signature against its **own `publicKey`**, and keys the map by the canonical identity (duplicates collapse). KISSVM key identity is canonical (`normalizeHex` → lowercase without `0x`; `SIGNEDBY`/`CHECKSIG`/`MULTISIG` and `EQ`/`NEQ` compare canonically, so the statechain distinctness guard is sound), and `MULTISIG(threshold <= 0)` is now unsatisfiable. Governance builders (proposal/treasury/mandate) and `authorizeMultisig` validate `1 ≤ t ≤ unique(keys)` and reject duplicate/empty keys. `simulatePolicyTransaction` no longer forces the legacy MAST path: a proof-less plan fails closed unless `allowLegacyMastBranches` is explicitly passed.

### 4.2 P1 — before any production authorizing use

| # | Finding | File / symbol | Remediation | Acceptance |
|---|---------|---------------|-------------|------------|
| **P1-1** | `RM-SIGN-001` (High) — canonical request binds only `disclosedScripts[].scriptHash` and `evidence[].evidenceId` | `recursive-mast/src/policy-signing.ts:216-249, 455-459` | Include full canonicalised `disclosedScripts` (script, proof, policyRoot) and `evidence` (type/data/signerPkd/signature); in `verifySigningRequest` recompute `computeScriptHash(ds.script) === ds.scriptHash` (and require root) | Mutating `ds.script`/`ds.mmrProof`/`ds.policyRoot` or `evidence.data` changes signed bytes; tampered request fails verification |
| **P1-2** | `RM-SIGN-002` (Medium) — `collectSigningResponses`/`acceptResponse` signature verification optional (`roleKeys?`); duplicate role overwrite | `policy-signing.ts:329-423`; `signing-session.ts:203-254` | Make `roleKeys` mandatory; verify each signature against the manifest-bound role key; one signature per role; reject a second distinct signer for a signed role; bind `requestId` | Attacker roles `['a','b']` vs required `['owner','regulator']` ⇒ `complete:false`; forged role signature ⇒ rejected; duplicate role ⇒ rejected |
| **P1-3** | `RM-COMPOSE-002` (High) — stripper only removes a text-terminal `RETURN`; a `RETURN TRUE` inside a taken `IF` branch survives, making the appended `MAST child` dead | live `kissvm/src/mast/layered-policy.ts:123-137`; `kissvm/src/mast/proof-chain.ts:215-226, 228-243` | Parse the layer; require the injected `MAST` to be the last top-level statement of a delegating layer; reject layers whose AST contains a top-level `RETURN` (or a reachable branch `RETURN`) before the injected `MAST` | 3-layer chain with `IF … THEN RETURN TRUE` in layer 0 ⇒ build throws or all children run; failing layer 2 ⇒ overall `false` |
| **P1-4** | `RM-DUP-001` (High) — `recursive-mast` `{proof-chain,layered-policy,policy-tree,mast-compiler}.ts` shadowed dead copies; `buildLayeredPolicy(...).tree` roots ≠ composed roots | `recursive-mast/src/index.ts:52-67,109-117,284-292`; `recursive-mast/src/layered-policy.ts` (dead) | Delete one copy; re-export the live `kissvm/src/mast/*` modules; unify `tree` roots with the composed-script roots (or document a single canonical root and derive both from it) | `rm.buildLayeredPolicy === kv.buildLayeredPolicy`; `tree` roots equal composed roots; no module has two implementations |
| **P1-5** | `RM-PROOF-001` (Medium) — `verifyProofChain` has no expected-root binding | `kissvm/src/mast/proof-chain.ts` (live); dead twin in `recursive-mast` | Add `expectedRoot` and assert `links[0].policyRoot === expectedRoot` | Self-consistent chain with attacker root ⇒ `valid:false` unless the expected root matches |
| **P1-6** | `INV-001` (High) — terminal-op-awareness: `findUnreachableStatements` flags only dead code after `RETURN`, not after terminal `MAST`/`EXEC`/`EXEC_MAST` | `kissvm/src/invariants.ts:162-176, 251` | Treat `RETURN|EXEC|EXEC_MAST|MAST_STMT` as terminators; report the dead-statement span; make I3 enforceable without caller-supplied `immutablePorts` (or require per-template declarations from a registry) | Sensor-proof/firmware class (checks after `MAST`) ⇒ violation; fixed signer + mutable unlock ⇒ I3 violation without caller opt-in |
| **P1-7** | `EXP-01` (High) — `buildSensorProofScript` freshness/`VERIFYOUT`/state checks dead after terminal `MAST` | `kissvm/src/templates/sensor-proof.ts:55-85` | Reorder: all reading/freshness/`VERIFYOUT` assertions before `MAST`; make `maxAge`/`reading` mandatory | Stale `sigTime` ⇒ `evaluateScript(...).passed===false` |
| **P1-8** | `EXP-02` (High) — `buildDataEscrowScript` omits release condition when its optional companion is absent; no `VERIFYOUT` | `kissvm/src/templates/data-privacy.ts:261-332` | Make the release condition and its parameters mandatory; `throw` when omitted; add `VERIFYOUT(@INPUT beneficiary @AMOUNT @TOKENID TRUE)` | Omitted `oraclePort`/`releaseBlock`/threshold ⇒ build throws; event unset ⇒ `false` |
| **P1-9** | `EXP-03` (High) — `buildMultiSigTreasuryScript` caps the whole input `@AMOUNT` (per-coin) | `kissvm/src/templates/treasury.ts:26-78` | Count the output amount (`GETOUTAMT`/`VERIFYOUT` amount), not `@AMOUNT`; require `recipientPkd`; document per-UTXO state or bind to a singleton | Two coins each spending `cap` in one period ⇒ second fails; cap bounds value leaving |
| **P1-10** | `EXP-04` (High) — compliance `attribute` stage threshold read from mutable `STATE`, no signer | `kissvm/src/templates/compliance.ts:119-130` | Read threshold from `PREVSTATE` + continuity; authorize the attribute issuer | `threshold=0` ⇒ `false`; unauthorized attribute ⇒ `false` |
| **P1-11** | `TXB-SERIAL-001` (High) — WASM serializer hardcodes output `coinid=0x00`, diverging from TS for precomputed txs | `core-wasm/src/transaction.rs:402-450, 104-120`; `core/src/transaction.ts` | Add `coinid` to `TransactionOutputJson` (default `0x00`); serialize `hex_to_bytes(output.coinid)`; extend parity test with non-zero output coin ids and `precomputeTransactionCoinID` | TS and WASM bytes/digests equal for a precomputed output |
| **P1-12** | `TXB-WOTS-001` (High) — `buildPoolFundTx` defaults `lpKeyIndex=0`; index reused | `tx-builder/src/fund-tx.ts:102-142` | Require a caller-supplied, lease-checked `lpKeyIndex` (no default); integrate `LeaseStore`/`WatermarkStore`; persist/attest the index in `SignedFundingIntent` | Two intents with the same leased index ⇒ second throws lease/watermark error |
| **P1-13** | `CORE-WIT-001` (High) — `validateExternalSignature` is a stub returning `true`; `aggregateSignatures` trusts `validated` | `core/src/scripts/witness-serializer.ts:318-375` | Re-verify via `wotsVerify`/`wotsVerifyDigest` against the configured key set; rename to `isStructurallyWellFormed` if it cannot verify; gate `aggregateSignatures` on cryptographic verification | Invalid signature ⇒ `false`; aggregate drops it |
| **P1-14** | `TXB-MULTISIG-007` (Medium) — `configured` uses `normalizePk` (strips `0x`), Map keys keep `0x`, so `0x`-prefixed configs never reach `ready` | `multisig-manager.ts:88-90, 385-388` + `addOwnSignature`/`importExternalSignature` | Build Map keys with `normalizePk(publicKey)` and compare via `normalizePk` everywhere | `0x`-prefixed 2-of-2 with two genuine signatures ⇒ `ready`; counts match `getSignatureStatus` |

### 4.3 P2 — hardening / consistency

| # | Finding | File | Remediation |
|---|---------|------|-------------|
| **P2-1** | `STABLE-003` governance mutable timelock + `NEQ 0x00` anchors | `kissvm/src/templates/governance.ts:279-358` | Timelock from `PREVSTATE`; bind outcome/tally/snapshot to committed values (`PREVSTATE`/`PROOF`) |
| **P2-2** | `STABLE-004` `computeRelease` ≠ on-chain when `duration<=0` | `kissvm/src/templates/temporal.ts:53-57,211-226` | Fail closed on `vestEnd <= vestStart`, or make both sides return 0; shared predicate |
| **P2-3** | `STABLE-005` rate-limit permissionless | `temporal.ts:132-154` | Require a fixed/committed actor, or explicitly declare permissionless and drop the unused `beneficiary` |
| **P2-4** | `STABLE-006/007/013` vote submission self-declared; proposal timings mutable; quorum unit | `governance.ts:103-207,226-260` | Bind voter/weight to a committed snapshot; commit timings; fix quorum units |
| **P2-5** | `STABLE-008` bond release permissionless + unbounded vesting | `provider-bond.ts:229-262` | Require a signer/governance path; clamp `vested = MIN(vested, bondAmount)` |
| **P2-6** | `STABLE-009` `governance.computeScriptHash` non-canonical | `governance.ts:3-7` | Delegate to `computeCanonicalScriptHash` |
| **P2-7** | `EXP-06/07/08/10/11/13/15` experimental correctness | `firmware-update`, `payment-channel`, `legal`, `recovery`, `migration` | Reorder post-`MAST` checks; bind outputs; commit settlement fields; fail closed on unrecognised jurisdiction; fix `buildStateMachineWorkflow` expressions; correct migration transition semantics |
| **P2-8** | `RM-F7` witness signatures keyed by role string + `0x` misparse | `recursive-mast/src/transaction/transaction-plan.ts:68-95` | Key by the signer's actual pubkey digest; parse with `hexToBytes` |
| **P2-9** | `RM-F9` rotation `authorizerPkd`/`reason` and action unbound | `recursive-mast/src/transaction/{rotation,action}-transaction.ts` | Derive/validate the rotation branch from `authorizerPkd`; persist the action/reason or document as informational |
| **P2-10** | `TXB-SERIAL-002/003` token scale lost; negative MiniNumber | `core/src/transaction.ts:408-462`; `core-wasm/src/streamable.rs` | Carry `totalAmountScale`; decode two's-complement sign (or reject negatives); byte-exact round-trip tests |
| **P2-11** | `TXB-FUND-001` funding-intent replay/no expiry | `tx-builder/src/fund-tx.ts:26-188` | Add `expiresAt`; require a nonce store / on-chain verifier at acceptance |
| **P2-12** | `TXB-COIN-001` no spent/expiry; case-sensitive dedup | `tx-builder/src/coin-selection.ts:148-209` | Filter spent/expired; normalize `coinId` before dedup |
| **P2-13** | `TXB-MULTISIG-008/009` live-object aliasing; `getAllPending` terminal clobber | `multisig-manager.ts:401-408,552-567` | Return copies/frozen read models; skip expiry rewrite for terminal statuses |
| **P2-14** | `STABLE-010` dead `RETURN` after terminal `MAST`; unused security params (STABLE-011, EXP-16) | `identity.ts`, `authority.ts`, `industrial-action.ts`, `provider-bond.ts`, `wots-lease.ts`, `voting.ts`, `recovery.ts` | Remove dead code; wire or reject unused security parameters |

---

### 4.4 Pass 2 — SDK-wide Critical (65 packages / ~182k LOC)

> Pass‑2 line numbers are against the current working tree (note: `packages/storage`
> has uncommitted changes). Items marked **V** were re-read and confirmed by the lead;
> unmarked items are agent-reported and require confirmation before remediation.

| # | Finding | File / symbol | Remediation | Acceptance |
|---|---------|---------------|-------------|------------|
| **C1** | **WOTS one-time-key reuse** reachable through multiple public APIs **V**. (a) `fund-tx.ts:103,113,124` — `lpKeyIndex ?? 0`, `nonce ?? Date.now()`, then `wotsSign(..., lpKeyIndex, digest)`; omit `lpKeyIndex` → every fund intent signs leaf 0. (b) `omnia-host/src/signing.ts:226` — `wotsSign(perAddressSeed, 0, payload)` hardcoded. (c) `liquidity-bond/src/pool-manifest.ts:53` — `{ addressIndex:0, l1:0, l2:0 }` every autobond. (d) `root-identity/src/UnifiedIdentityWallet.ts:204,224,392-404` — counters in-memory only; `setRootUses`/`restoreWatermarkState` accept any non-negative value; crash/replay reissues an index | `tx-builder`, `omnia-host`, `liquidity-bond`, `root-identity` | Remove all defaulted/hardcoded indices. Require an explicit reservation from `@totemsdk/wots-lease`; persist the incremented counter **write-ahead** before returning a signature; enforce monotonicity in `setUses`/`setRootUses`/`restoreWatermarkState` | Omitting the index builds fail; two calls with the same lease throw; crash-after-sign then reopen never reissues; `restoreWatermarkState` to a lower cursor throws |
| **C2** | **WOTS reuse detection silently disabled in the Axia lease provider V** — `wots-lease/src/axia.ts:109-113,116-125,142-150`: `markUnavailable(addressIndex)` while `getLocalWatermark(treeId)` reads tree `"wallet"` (cursor always 0); `journal.append({ treeId: reservationId })` should be `params.treeId`, so the duplicate-slot check never fires; `reserveKeyUse` never calls `isUnavailable` | `wots-lease/src/axia.ts` | Use the real `treeId` consistently; call `isUnavailable` before accepting server indices; verify a server signature over assigned indices | A replaying/hostile lease server handing out the same index ⇒ reservation rejected; journal duplicate-slot check fires on a repeated `(treeId, wotsIndex)` |
| **C3** | **Any delegated address (any scope) can bind manifests / revoke / rotate an identity V-adjacent** — `identity/src/manifest-binding.ts:107-121` includes `...resolved.controlledAddresses` in the valid-signer set; `identity/src/resolver.ts:55-154` accepts `revokes`, `rotates_to`, `payment_recipient`, `service_endpoint` from any first-level delegate without claim-scope enforcement | `identity` | Enforce per-claim-type scope; remove `controlledAddresses` from manifest signers; require `status === 'active'` before accepting revoke/rotate | A `data:read`-only delegate cannot sign a manifest, revoke the principal, rotate ownership, or redirect payments |
| **C4** | **`provider-bond` trusts attacker-supplied identity graphs and bond proofs; verification is a stub V** — `identity.ts:22-34,44-62` reads `claim.proof.address` with no signature/issuer/scope/expiry check and never calls `verifyManifest`; `bond-proof.ts:9-39` accepts self-declared `manual`/`declared` amounts, and `visible-balance`/`future-live-chain` return `ok:true` without calling `verifier.verify`; `bond-proof.ts:66-71` passes `declared` with no attached proof | `provider-bond` | Resolve identities via `@totemsdk/identity`; always `await verifier.verify`; cryptographically verify `totem-proof`; require a proof per declaration; call `verifyManifest` | Forged identity graph / phantom bond ⇒ verification fails; `verifyBondStack` rejects a declaration without a proof |
| **C5** | **`validateExternalSignature` always returns `true` V** — `core/src/scripts/witness-serializer.ts:364-375`; exported from `@totemsdk/core`; `aggregateSignatures` includes the `totemSignature` proof unconditionally | `core` | Implement real `wotsVerifyDigest`, or delete the export; gate `aggregateSignatures` on verification (**duplicate of P1-13**) | Junk signature ⇒ `false`; aggregate drops it |

**Pass-2 criticals landed (C1–C5).**
- **C1** — defaulted/hardcoded WOTS indices removed: `fund-tx` requires `lpKeyIndex`;
  `omnia-host` honors the reserved leaf; `liquidity-bond` requires caller indices;
  `root-identity` cursors are forward-only and validated.
- **C2** — Axia lease provider rejects a replayed index (`IndicesUnavailableError`),
  keys the watermark/journal by the real `treeId`, and fails closed on unverifiable
  certificates.
- **C3** — identity claim-type scope enforced: manifest signers exclude
  `controlledAddresses`; revoke/rotate require root/controller; payment/endpoint
  require `identity:manage`/`*`.
- **C4** — `provider-bond` resolves identity graphs via `@totemsdk/identity`,
  verifies the manifest signature, and requires an independent verifier plus an
  attached proof for every bond declaration.
- **C5** — `validateExternalSignature` performs real `wotsVerifyDigest`;
  `aggregateSignatures` requires the digest and drops unverified signatures.

### 4.5 Pass 2 — SDK-wide High

| # | Finding | File / symbol | Remediation | Acceptance |
|---|---------|---------------|-------------|------------|
| **H1** | **`omnia-host` control plane unauthenticated and origin-unrestricted by default V** — `api/jsonrpc.ts:99-105,160-163`; `config.ts:112,131-132`: `allowedOrigins`/`controlToken` default `undefined` → `isOriginAllowed` returns true and bearer check skipped; state-changing methods (`totem_omniaPay`, `…OpenChannel`, `…Settle`, `…SpliceIn/Out`) reachable via browser CSRF (`text/plain`) or `ws://`; `OMNIA_HOST_BIND=0.0.0.0` exposes to network | `omnia-host` | Fail closed — require a token for non-loopback binds; reject state-changing methods without a token; default `allowedOrigins` to deny; require `application/json` + CSRF header | No-token state-changing call from a browser origin ⇒ `401/403`; loopback dev unaffected |
| **H2** | **`connect` wallet: approval optional, requesting origin discarded V** — `wallet.ts:609` gates approval on `options.approve` existing; `wallet.ts:628-633` calls `dispatch(method, params)` without `origin`; `index.ts:142-147` trusts any `totem:announce` | `connect` | Make `approve` mandatory for `requiresApproval` methods; forward `origin`; authenticate announcements | Wallet without approval callback refuses to sign/submit; approval UI receives the requesting origin |
| **H3** | **`se-server` `POST /create` unauthenticated → SE WOTS leaf exhaustion V** — `router.ts:161-189` accepts an attacker-chosen `ownerPublicKeyDigest` with no signature/coin/lock check; with unauthenticated `/:chainId/challenge` + blind-sign, an attacker loops `create→challenge→blind-sign` to burn the SE's leased leaf space (RFC-008); `projectId` always `'default'` | `se-server` | Require an authenticated owner for `/create` and on-chain proof the coin is locked to the advertised script; per-owner leaf quotas | Unauthenticated `/create` rejected; allocation bounded per owner |
| **H4** | **`txpow` admission accepts prover-controlled block difficulty V** — `admission/verify.ts:139-150` computes `superLevel` from `proof.template.blockDifficulty` and `isBlock = superLevel >= 0` | `txpow` | Derive template fields only from a trusted freshly-fetched template; require byte-match | Prover-set max difficulty ⇒ rejected |
| **H5** | **`edge-mqtt` command signature verification optional while `requireSignedCommands` defaults true V** — `command-handler.ts:222` `if (envelope && config.verifyCommandSignature)`; no verifier ⇒ any publisher forges `issuerIdentity`; `ledger.mark()` at `:215` runs before verification (replay-slot poisoning DoS) | `edge-mqtt` | Fail closed when an envelope is present but no verifier; verify before marking the ledger | Forged envelope with no verifier ⇒ rejected; replayed envelope does not poison the slot |
| **H6** | **`governance`/`authority` can mint mandates from unbound tallies V** — `governance/src/execution.ts:11-50` checks `status==='passed'` and trusts a separately passed tally, never comparing to `proposal.voteTally`; `ids.ts:11-13` + `proposal.ts:28-46` bind only the action count (signed proposal replayable against a different same-length action set); `authority/src/usage.ts:26-31` `BigInt(proposed.amount)` unvalidated (negative replenishes budget, non-numeric throws) | `governance`, `authority` | Recompute and bind the tally hash into the proposal ID/proof; validate amounts as non-negative decimals | Mismatched tally ⇒ execution rejected; different same-length actions ⇒ different ID; negative amount ⇒ rejected |
| **H7** | **`liquidity-bond` phantom positions withdrawable V** — `position.ts:14-18,30` no/declared funding still yields `status:'active'`; `computeAvailableLiquidity:77-83` uses `max(allocated,reserved)` not sum; `withdrawal.ts:51-83` ignores allocations/reservations/receipts | `liquidity-bond` | Refuse positions without chain-confirmed funding; use `allocated + reserved`; require a consumed hash-verified receipt | Unfunded/declared position cannot withdraw; liquidity is the sum; reused receipt rejected |
| **H8** | **KISSVM sandbox escapes via `FUNCTION` V** — `kissvm/src/eval.ts:681-706`: (1) `subVm = new VMState(...)` resets `instructionCount`/call depth and never copies them back (unlike `executeSubScript` at `:947`) → per-frame limits, CPU/native-stack exhaustion; (2) `scriptlet.replaceAll('$'+i, argValues[i])` textually injects `STATE()`-derived argument values into re-parsed code → opcode injection | `kissvm` | Share one instruction counter/depth across frames; bind arguments as variables, never string substitution | Recursive `FUNCTION` hits the shared limit; a `$1` containing opcodes cannot alter control flow |
| **H9** | **`omnia` funding-script injection V** — `script.ts:7-9,24` `kissHex` does no hex validation; `publicKeyDigest` with newlines/opcodes survives into `MULTISIG(2 …)`; acceptor only compares its own recomputation to `proposal.fundingScript` | `omnia` (also `recursive-mast/delegation.ts:51-68`, `core/src/scripts/contract-helpers.ts`) | Validate `publicKeyDigest` as exactly 64 hex chars before interpolation | Non-hex/injected digest ⇒ build throws |
| **H10** | **Storage artifact path traversal V** — `storage/src/artifacts/backends/local-fs-backend.ts:39-42` hex-encodes namespace but interpolates `ref.digest` raw (`digest = "../../../etc/passwd"` escapes root for read/write/delete); `ArtifactStore.delete` (`artifact-store.ts:87-95`) never verifies the digest | `storage` | Validate `digest` against `^[0-9a-f]{64}$`; reject separators | Traversal digest ⇒ rejected on put/get/delete |
| **H11** | **`lookup-node` anonymous abuse reported** — `session.ts:139-193` ephemeral Ed25519 key treated as authenticated, per-session rate limit reset on reconnect, no concurrent-session cap; `lease.ts:90-99` first caller claims any `treeId` and can reserve/burn arbitrary indices; `watchlist.ts:49-93` anonymous monitoring of arbitrary addresses | `lookup-node` | Per-IP/identity fuzzy limits; max sessions; credential-scoped tree ownership; ownership proofs for watches | Reconnect does not reset budget; unowned `treeId` claim rejected; watch requires proof |
| **H12** | **Storage codec prototype pollution V** — `storage/src/codec.ts:124-127` `out[unescapeKey(key)] = …` follows the `__proto__` setter; `jsonClean` (`snapshot.ts:97-101`) has the same pattern | `storage` | `Object.defineProperty` for own keys, or reject `__proto__`/`constructor`/`prototype` | Malicious key cannot alter `Object.prototype`; round-trip safe |

**Pass-2 Highs landed (H1–H12).**
- **H1** omnia-host control plane: browser origins default-deny; non-loopback bind
  requires a control token; `application/json` required (text/plain CSRF rejected).
- **H2** connect: approval is mandatory for approval-required methods; the
  requesting origin is forwarded to the approval callback.
- **H3** se-server: `/create` requires an owner-signed request bound to the coinId
  and body.
- **H4** txpow: block difficulty is taken from a trusted template (byte-match).
- **H5** edge-mqtt: signed envelopes fail closed without a verifier and are
  verified before the replay slot is marked.
- **H6** governance/authority: proposal id binds the full action set; execution
  tally must match the committed tally; authority amounts are validated.
- **H7** liquidity-bond: unfunded positions cannot withdraw; liquidity is
  `allocated + reserved`.
- **H8** kissvm: `FUNCTION` binds args as values (no opcode injection) and shares
  the parent instruction/call budget.
- **H9** omnia/recursive-mast: WOTS digests validated before script interpolation.
- **H10** storage: artifact digests validated (path traversal rejected).
- **H11** lookup-node (partial): concurrent-session cap + reconnect-resistant
  per-identity rate limit. **Residual:** credential-scoped tree ownership proofs
  (lease) and watchlist ownership proofs.
  **Superseded by RFC-032:** the "ephemeral Ed25519 key treated as authenticated"
  root cause is removed — the lookup stack is now WOTS/TreeKey (post-quantum), the
  node verifies identity + enforces per-identity nonce monotonicity (replay
  rejection) on every message, and the ephemeral Ed25519 key is gone.
- **H12** storage: codec/snapshot define own properties (no prototype pollution).

### 4.6 Pass 2 — Medium, secret exposure, and clean areas

**Medium (condensed):**
- WOTS keygen index validation — `core/src/tx/TransactionService.ts:167-175` (`l1/l2` from `/prepare` unvalidated; `uses=l1*64+l2` can be `NaN`/negative/`Infinity`); `treekey.ts:579` `setUses` unvalidated; `baseConversion` (`:641-660`) loops unboundedly. Validate safe integers/range.
- SE ownership root never verified — `statechain/src/verify.ts:55-85` reads `sePublicKey` from the untrusted chain object; root proof never checked.
- Non-canonical address algorithm exported — `core/src/scripts/witness-serializer.ts:377-382`, `tx-builder/src/multisig-manager.ts:250-255`, `core/src/scripts/contract-helpers.ts:591-596` compute `SHA3(script)` instead of `mmrLeafExact`; violates the byte-parity invariant and can burn funds. (Relates to P2-6.)
- Legacy MMR parser — `witness-serializer.ts:121-157` reads a 4-byte length where Java writes 1 byte.
- Intelligence trusts self-asserted principal — `intelligence/src/content-access.ts:106-109` (setting `context.principal` reads another principal's workspaces).
- KISSVM DoS — `MiniNumber.ts:279-292` unbounded exponent (`[1e100000000]`); `eval.ts:669-675` unbounded `BITSET` shift; `parser.ts:626-631` unbounded recursion.
- `recursive-mast` signature stubs — `branch-capsule.ts:152,220` (non-empty string = authorized; JSON replacer drops `Uint8Array` proof); `encrypted-branch.ts:87-124` (decrypted script not bound to `scriptHash`); `delegation.ts` string injection.
- `agent-policy` enforcement gaps — `grant-bound-autonomy.ts:356-377` mandate `maxTotal` never metered from verified effects; `grant-usage.ts:316-336` negative usage deltas bypass caps; `maxOutstandingChannelExposure` dead (always adds `"0"`); `autonomy.ts:221-225` stale-quote check skipped when timestamp omitted.
- Tokens in URLs — `server/src/client.ts:101`, `realtime/PortfolioStreamManager.ts:385`, `omnia-host/jsonrpc.ts:113-116` (leak via logs/history).
- `server` default `apiKey:'totem-shared'` (`client.ts:69`); `sendTransaction.ts:210` accepts arbitrary `axiaBaseUrl` (SSRF).
- `omnia-host` O(n²) body read (`jsonrpc.ts:82`), 10 MB per connection, no concurrency cap.
- Registry prototype pollution — `provider-bond/registry.ts:26,42-77`, `liquidity-bond/registry.ts:30,45-95` (`providerId:'__proto__'`).
- `wots-lease` predictable IDs (`local.ts:32-37` `Math.random` fallback) and `verifyLeaseCertificate(undefined)` returns `true` (`local.ts:491`, `axia.ts:167`) — fail-open.
- `mcp-server` tool code injection — `tools.ts:297-399` interpolates unvalidated identifiers into generated TS.
- `minima-rpc` host-header injection — `raw-http.ts:66-77`.
- `storage` namespace prefix collision — `namespace.ts:16-43` (`user:1` vs `user:10`).

**Data / secret exposure:**
- **Seed debug logging reachable at runtime V-adjacent** — `core/src/javaStreamables.ts:185-188` logs `baseSeed[0:8]` whenever `globalThis.TOTEM_SEED_DEBUG` is set (any co-resident script can set it); `setWotsLogger`/`setTreeKeyLogger` (`core/src/wots.ts:34-45`, `treekey.ts:45-56`) dump master seeds and expanded private keys and are exported from the package root. **Compile these out of production builds.**
- **SE key reuse** — `se-server/src/seKey.ts:15-19` derives the AES key for every reclaim tx from the same seed used for WOTS root identity; use HKDF domain separation and per-chain keys.
- `se-server` binds `0.0.0.0` unconditionally (`src/index.ts:83`, `go/server.go:60`); signatures accepted as query params (`router.ts:414-441`) → log exposure.

**Clean areas (verified):**
- SQL parameterized throughout (`lookup-node/storage.ts`, `se-server/db.ts`, omnia-host stores, Go `db.go`).
- WOTS verification math constant-time (`core-wasm/src/wots.rs:290-345`, `core/src/verify.ts:148-155`).
- Key-generation RNG uses CSPRNG; BIP39 wordlist unbiased.
- `chain-provider/src/resolve.ts:87-94` `assertConsentedNodeUrl` correctly blocks SSRF tricks.
- Core proof/identity/manifest verification binds addresses to recomputed digests.
- `se-server/src/ownerAuth.ts` + `db.ts` nonce/CAS design is sound (the gap is the unauthenticated `/create`).
- `@totemsdk/wots-lease` journal is hash-chained append-only with correct recovery (the gaps are the Axia provider and the raw tx-builder/omnia signing helpers).

### 4.7 Combined priority remediation order

1. **C1/C2/C3/H6/H7** — WOTS reuse (all paths) + verification stubs/self-declared value. These directly break the `SECURITY.md` invariants.
2. **C4/H1/H2/H3/H5** — authorization bypasses: `provider-bond`, `omnia-host`, `connect`, `se-server /create`, `edge-mqtt`.
3. **C5/H4/H8/H9/H10/H12** — stub verifiers, `txpow` difficulty, KISSVM `FUNCTION` escapes, script injection, artifact path traversal, codec prototype pollution.
4. **H11 + Medium** — DoS/rate limiting, claim-scope enforcement, secret logging, parity helpers.

**Two systemic fixes close most of the surface:** (a) a single mandatory
`WotsLeaseProvider` reservation path with no default index and write-ahead
persistence; (b) replace every hand-rolled `verifyX` stub and raw string
interpolation with the already-correct `@totemsdk/identity` and
`canonicalJson`/typed-encoder utilities.

---

## 5. Root cause

Two recurring mistakes drive P0:

1. **Identity is compared in more than one representation.** Signature lookup,
   equality guards, Map keys, and configured signer sets each normalize differently,
   so "same key" and "same signer" disagree. This yields the KISSVM statechain
   collapse (C2) and the tx-builder readiness forgery/liveness defects.
2. **Persistence/verification binding is inferred, not enforced.** A record's
   identity (`Map key`), its claimed public key (`s.publicKey`), and its transaction
   (`transactionHex` ↔ `transactionDigest`) are allowed to disagree.

The secondary pattern is **terminal-op blindness**: `MAST`/`EXEC` terminate the
script, but both the composition strippers and the invariant gate only reason about
`RETURN`, so checks that are textually present can be unreachable.

Pass 2 shows the same two root causes at SDK scale:

3. **Signature/key material is treated as a value you can `?? 0`.** Defaults,
   hardcoded indices, in-memory-only counters, and replay-blind lease providers make
   WOTS one-time-key reuse reachable (C1, C2). The fix is structural: **one mandatory
   reservation path with write-ahead persistence**, not per-call validation.
4. **"Verification" is frequently a stub or a self-declaration.** `return true`,
   `ok:true`, presence-only proofs, attacker-supplied identity graphs, and
   `Math.random` IDs. The fix is to **delete hand-rolled verifiers** and route through
   the already-correct `@totemsdk/identity`, `canonicalJson`, and typed encoders.
5. **Untrusted input is interpolated into code/SQL/paths/objects.** Script text
   (`FUNCTION` args, `publicKeyDigest`), artifact paths (`ref.digest`), and codec keys
   (`__proto__`) cross trust boundaries unvalidated.

---

## 6. Test requirements (must exist before the gate passes)

- **Key identity:** VM test that `"<h>"` and `"0x<h>"` compare equal under canonical
  key identity; statechain SE-only ⇒ `false` for bare-hex **and** `0x` state.
- **Multisig storage:** tamper Map key vs `publicKey`; tamper `transactionHex`; tamper
  `validated`; duplicate `publicKey` under two keys; `0x`-prefixed keys reach `ready`.
- **Composition:** 3+ layer chain, layer containing `IF … THEN RETURN TRUE`, and a
  failing downstream layer ⇒ overall `false`; `RETURN FALSE` layer ⇒ throws.
- **Simulation parity:** a proof-less plan fails in simulation exactly as in production.
- **Signing:** nested mutation of `disclosedScripts`/`evidence` changes signed bytes;
  tampered request fails; wrong role/key rejected; duplicate role rejected.
- **Invariant gate:** dead code after `MAST`/`EXEC` flagged; I3 enforced without caller
  opt-in.
- **Serializer parity:** TS↔WASM bytes/digests equal for precomputed output coin ids,
  token scales `{0,8,44}`, and negative MiniNumbers.
- **Experimental:** full-script negative tests for sensor-proof, data-escrow, treasury
  cap, compliance threshold.
- **Canonical MAST vector:** `compileMastTree → ScriptProof → evaluateScript('MAST …')`
  agrees with a Minima node.
- **WOTS lease (SDK-wide):** omitting an index fails; two same-index reservations
  throw; crash-after-sign then reopen never reissues; `restoreWatermarkState` to a
  lower cursor throws; a replaying lease server is rejected (C1, C2).
- **Verification stubs (SDK-wide):** forged identity graph / phantom bond /
  `validateExternalSignature` junk ⇒ verified `false` (C4, C5).
- **Authorization defaults (SDK-wide):** no-token non-loopback `omnia-host` call ⇒
  rejected; wallet without `approve` ⇒ refuses; unauthenticated `se-server /create`
  ⇒ rejected; `edge-mqtt` forged envelope with no verifier ⇒ rejected (H1–H5).
- **Parser/sandbox (SDK-wide):** `FUNCTION` shares limits and cannot be opcode-injected;
  artifact traversal digest rejected; codec `__proto__` key neutralised (H8–H12).
- **Secret exposure:** production build contains no `TOTEM_SEED_DEBUG` / WOTS-key
  logging; SE reclaim keys are domain-separated; no tokens in URLs.

---

## 7. Production gate

Do not treat the SDK as production-ready until:

- **zero open Critical** and **zero open High authorization/economic** findings across
  both passes (Pass‑1 2C/14H; Pass‑2 5C/12H; C5 duplicates P1-13);
- the three `SECURITY.md` invariants hold under adversarial test: no WOTS index reuse
  anywhere, no private-key material logged, and byte-exact serialization/address
  helpers agree (`mmrLeafExact`);
- `ready ⇔ threshold unique configured signers with valid signatures over
  `sha3_256(transactionHex)``, proven with a storage-tamper adversarial test at load
  and in memory;
- key identity is canonical across `verifySignedBy`, `normalizeHex`/`kissvmEq`, and
  `tx-builder`, with the statechain SE-only test returning `false` for both encodings;
- simulation and production evaluate identically (no forced legacy MAST);
- composed multi-layer policies are demonstrated end-to-end for 3+ layers, including
  a layer with a branch-terminal `RETURN`, with negative tests;
- signed requests bind full disclosed scripts and evidence, with nested-field
  mutation tests;
- the invariant gate rejects dead code after every terminal op;
- WASM↔TS serializer byte/digest parity holds for precomputed transactions, token
  scales, and signed values;
- all C4/C5/H1–H12 bypasses have negative tests, every `verifyX` stub is deleted or
  cryptographically real, and no untrusted input reaches code/SQL/paths/objects
  unvalidated;
- every exported authorizing template has an adversarial negative test executed
  through `evaluateScript`, and `dist` is CI-reproducible.

---

## 8. Compatibility & migration

- The `normalizeHex` change (canonical, no `0x`) is a **behavioural change** for any
  script relying on `0x`-preserving string comparison; ship with a minor bump and a
  migration note. Integer/state semantics are unchanged.
- `MultisigManager` load-path changes reject previously-accepted tampered records
  (`MultisigStorageError('corrupt')`); legitimate records are unaffected.
- Removing `allowLegacyMastBranches:true` from simulation may fail plans that were
  only ever exercised with legacy branches; those plans must supply canonical
  `ScriptProof`s.
- Deleting the shadowed `recursive-mast` modules is a source-layout change only; the
  public exports are unchanged.
- **WOTS lease (SDK-wide):** removing default indices is **breaking** for `fund-tx`,
  `omnia-host`, `liquidity-bond`, and `root-identity`; callers must supply (and
  reserve) an index. Ship with a major/minor bump per package and a migration note.
- **Secret logging removal is a build-time change** — `setWotsLogger`/`setTreeKeyLogger`
  and `TOTEM_SEED_DEBUG` must be absent from production builds; tests that rely on
  them move behind an explicit debug entrypoint.
- **`omnia-host` fail-closed default** may break existing unauthenticated local dev
  flows; loopback remains the exception, non-loopback requires a token.
- **`se-server /create`** now requires an authenticated owner + on-chain lock proof;
  clients must supply them.

---

## 9. Open questions

1. **Canonical key form** — should `normalizeHex` drop `0x` globally, or should a new
   `canonicalKey()` be introduced and used only at key boundaries (lower blast radius,
   more call sites)? Prefer the latter if any script semantics depend on `0x`.
2. **`MULTISIG` threshold ≤ 0** — throw (fail hard) or return `false` (fail closed)?
3. **I3 enforcement** — require a per-template immutable-port registry, or infer
   immutable ports from `PREVSTATE` reads? The registry is explicit but needs upkeep.
4. **Legacy MAST** — remove `allowLegacyMastBranches` entirely, or keep it as an
   explicit dev-only flag never defaulted?
5. **WASM serializer ownership** — is `core-wasm` the source of truth for the wire
   format, or is `core/src/transaction.ts`? The parity fix must name one.
6. **WOTS lease** — one mandatory `WotsLeaseProvider` implementation, or per-package
   adapters over a shared interface? A single path is safer but couples packages.
7. **Identity claim scope** — where is the claim-type → required-scope map
   authoritative (`@totemsdk/identity` vs each consumer)?
8. **Secret logging** — compile-time removal, or runtime-disabled-by-default with an
   explicit opt-in entrypoint that is itself gated?
9. **Prototype-pollution policy** — reject `__proto__`/`constructor`/`prototype` in
   all decoders, or use null-prototype objects end-to-end?

---

## 10. References

- Prior pass: `docs/audits/kissvm-recursive-mast-adversarial-2026-09.md`, RFC-018.
- `SECURITY.md` (the three invariants violated: WOTS one-time keys, no private-key
  logging, byte-exact serialization).
- `docs/rfc/RFC-016-KISSVM-TEMPLATE-SECURITY-HARDENING.md`, `docs/rfc/RFC-009-...`,
  `docs/rfc/RFC-008-FEDERATED-STATECHAIN.md` (SE leaf lease).
- Pass‑2 packages: `wots-lease/src/axia.ts`, `identity/src/{manifest-binding,resolver}.ts`,
  `provider-bond/src/{identity,bond-proof}.ts`, `omnia-host/src/api/jsonrpc.ts`,
  `connect/src/wallet.ts`, `se-server/src/{router,seKey}.ts`, `txpow/src/admission/verify.ts`,
  `edge-mqtt/src/command-handler.ts`, `governance/src/*`, `authority/src/usage.ts`,
  `liquidity-bond/src/{position,withdrawal}.ts`, `omnia/src/script.ts`,
  `storage/src/{codec,namespace}.ts`, `storage/src/artifacts/backends/local-fs-backend.ts`,
  `core/src/{scripts/witness-serializer,javaStreamables,wots}.ts`, `core/src/tx/TransactionService.ts`,
  `lookup-node/src/*`, `agent-policy/src/*`, `server/src/client.ts`, `mcp-server/src/tools.ts`,
  `minima-rpc/src/raw-http.ts`.
- `packages/kissvm/src/{eval.ts,invariants.ts}`, `packages/kissvm/src/mast/*`, `packages/kissvm/src/templates/*`
- `packages/recursive-mast/src/{policy-signing.ts,signing-session.ts,proof-chain.ts,layered-policy.ts,kissvm/*}`
- `packages/tx-builder/src/{multisig-manager.ts,fund-tx.ts,coin-selection.ts}`
- `packages/core/src/transaction.ts`, `packages/core-wasm/src/transaction.rs`
