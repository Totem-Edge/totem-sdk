# SDK audit remediation — findings ledger (AUD-001 … AUD-046)

**Date:** 2026-09-25
**Scope:** all `@totemsdk/*` packages plus the `extensions/*` scaffolds
**Baseline audited:** `audit/` critic suite, dated 2026-09-16
**Reconciled against:** `0d60345` (2026-09-25)
**Verification gate:** `node scripts/verify-workspace.mjs --typecheck --lint --test`

> This is the tracking ledger for the 46 findings in the 2026-09-16 critic
> report plus the backlog gaps identified during reconciliation. Each row is
> reconciled against source at `0d60345`; a finding is only marked **FIXED**
> when the vulnerable code path is gone at that revision. **PARTIAL** means the
> primary path is fixed but a documented residual remains. The raw critic
> artifacts (`audit/`) are retired — they import modules that no longer exist
> and two of their tests encode vulnerable behaviour (AUD-016, AUD-044).

---

## 1. Summary

| Status | Count |
|---|---|
| FIXED | 17 |
| PARTIAL | 7 |
| OPEN | 22 |
| **Total** | **46** |

Backlog (gap analysis, not part of the 46): see §4.

---

## 2. Workstream C — KISSVM policy anchor (this change)

The 2026-09-16 report flagged the policy anchor as **not fail-closed with zero
tests**. It is fixed here.

### 2.1 Defects found

1. **Fail-open action selector.** `buildPolicyAnchorScript()` only emitted `IF`
   branches for `actionType` 0–4 and then fell through to `RETURN TRUE`. Any
   other value (`-1`, `5`, `999`, or a non-numeric value that compared false)
   skipped every MAST branch and **succeeded**.
2. **Spender-supplied MAST roots.** The normal/rotation/epoch branches read the
   root to execute from `STATE(actionRoot + 1)` — a state slot the spender
   controls — so an attacker could `MAST` an arbitrary root of their choosing.
   The committed `PREVSTATE` roots were declared but never bound to execution.
3. **Dead-code continuity.** A bare `MAST <root>` statement in the evaluator
   throws `ReturnSignal` and **terminates the whole script with the branch
   result** (`packages/kissvm/src/eval.ts:242`). The anchor's post-branch
   `ASSERT VERIFYOUT(...)` was therefore unreachable whenever a branch ran —
   the successor-anchor covenant was never enforced.
4. **No port validation.** `PolicyAnchorConfig.ports` was unchecked, so a
   collision between the action-argument slot and a committed slot silently
   reinterpreted one state value two ways.
5. **Duplicate implementation.** `packages/recursive-mast/src/policy-anchor.ts`
   carried a byte-identical vulnerable copy, and the recursive-mast transaction
   planners imported the local copy rather than the canonical one.

### 2.2 Fix

- **Fail-closed selector.** The script now emits an explicit whitelist
  (`ASSERT actionType EQ 0 OR …`) built from exactly the branches that are
  emitted (3/4 only when a recovery/emergency root is configured), and ends in
  `RETURN FALSE` as a default.
- **Committed-root binding.** Normal actions must select one of the committed
  `PREVSTATE` roots; rotation and epoch advancement `MAST` the committed owner
  root. No branch executes a spender-supplied root.
- **Continuity before MAST.** Subject, manifest, epoch, and root-preservation
  checks — plus `VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)` — run inside
  each branch *before* `MAST`, because `MAST` short-circuits.
- **Rotation is exactly-one-change.** The argument slot names the committed root
  port to rotate; every other root port must be preserved.
- **`validatePolicyAnchorConfig()`** rejects duplicate ports, reserved port 0,
  non-integer/negative ports, and an `actionRoot + 1` collision.
- **Deduplication.** `recursive-mast/src/policy-anchor.ts` is now a re-export
  shim of `@totemsdk/kissvm`, so the transaction planners use the canonical
  code.

### 2.3 Evidence

- `packages/kissvm/src/__tests__/policy-anchor.test.ts` — **27 adversarial
  tests** through the real evaluator: out-of-range/disabled action types,
  non-committed roots, changed manifest/epoch/roots, subject mismatch, missing
  successor output, multi-root rotation, skipped/non-advancing epoch, and
  unset recovery root.
- `node scripts/verify-workspace.mjs --typecheck --lint --test` → **124 gates
  passed, 0 failed**.

### 2.4 Residual (tracked as follow-up)

- KISSVM exposes **no output-count primitive**, so the anchor can enforce the
  successor only at the input index; duplicate-anchor-output prevention must be
  enforced by the revealed branch or the transaction planner.
- Manifest rotation is not modelled; the manifest commitment is required to be
  unchanged by every branch. A future manifest-rotation branch is needed.
- WASM parity: the TS evaluator is covered. Parity against the built
  `kissvm_wasm` artifact should be run in CI once the artifact is available
  (`evaluateScriptWasm` is mocked in unit tests).

---

## 3. Findings ledger (AUD-001 … AUD-046)

| ID | P | Finding | Status | Evidence / next action |
|---|---|---|---|---|
| AUD-001 | P1 | PWA message signing reuses a one-time key across popups/unlocks | OPEN | `extensions/totem-pwa-wallet/src/approval/VerifyApproval.tsx:129`. Reserve a durable slot before every signature; coordinate across tabs. |
| AUD-002 | P1 | Extension verification requests capture the same WOTS slot before approval | OPEN | `extensions/totem-extension/src/background/index.ts:2638`. Reserve at request time, not approval time. |
| AUD-003 | P1 | SE server signs every message with WOTS key index zero | FIXED | `packages/se-server/src/seKey.ts` — monotonic index selection; covered by package tests. |
| AUD-004 | P1 | Separate local lease providers allocate the same WOTS slot | PARTIAL | `packages/wots-lease/src/local.ts`. Primary allocation fixed; concurrent multi-provider race remains. Needs cross-provider CAS. |
| AUD-005 | P1 | Specific reservations can go behind a synchronized watermark | FIXED | `packages/wots-lease/src/watermark.ts`. |
| AUD-006 | P1 | Registry signing defaults repeatedly select the same WOTS indices | FIXED | `packages/liquidity-bond/src/root.ts`. |
| AUD-007 | P1 | Extension dApps can impersonate another connected origin | OPEN | `extensions/totem-extension/src/background/index.ts:1004`. Bind origin at connect and check per request. |
| AUD-008 | P1 | Extension popup details are not bound to the window being approved | OPEN | `extensions/totem-extension/src/background/index.ts:404`. |
| AUD-009 | P1 | Omnia control API accepts unauthenticated requests from untrusted WebSocket origins | OPEN | `packages/omnia-host/src/api/jsonrpc.ts:106`. Enforce origin allowlist + auth. |
| AUD-010 | P1 | Minima RPC parameter interpolation allows command injection | PARTIAL | `packages/minima-rpc/src/transport.ts:63`. ~1 of ~35 branches sanitized; complete parameterization. |
| AUD-011 | P1 | RPC transport repeats operations after ambiguous failures | OPEN | `packages/minima-rpc/src/transport.ts:446`. Add idempotency keys / no blind retry. |
| AUD-012 | P1 | Statechain verification does not bind ownership or `txHex` to the signed transaction | PARTIAL | `packages/statechain/src/verify.ts:130`. No tx-body parse yet; bind signed digest to ownership + body. |
| AUD-013 | P1 | Signed registry states can be replayed at a forged anchor/sequence | PARTIAL | `packages/liquidity-bond/src/root.ts:147`. Signature covers root only; include anchor + sequence. |
| AUD-014 | P1 | A pool writer can change another pool's registry state | OPEN | `packages/liquidity-bond/src/root.ts:264`. |
| AUD-015 | P1 | Registry transition application can skip signature verification | PARTIAL | `packages/liquidity-bond/src/root.ts:205`. `verifier.verify` still optional; make it mandatory. |
| AUD-016 | P1 | Default personal lease certificate verification accepts arbitrary nonempty signatures | OPEN | `packages/wots-lease/src/certificate.ts:83`. Retired critic test encoded the vulnerable behaviour. |
| AUD-017 | P1 | Authority decisions do not bind action actor/principal to the mandate | FIXED | `packages/authority/src/evaluate.ts`. |
| AUD-018 | P1 | Authority usage limits stop applying after the first window | PARTIAL | `packages/authority/src/usage.ts` fixed in TS; **Rust/WASM mirror `packages/authority/rust/src/usage.rs` still vulnerable**. |
| AUD-019 | P1 | GrantBoundPolicy drops monetary usage after commit | FIXED | `packages/agent-policy/src/grant-bound.ts`. |
| AUD-020 | P1 | Grant quota checks and reservation are not atomic | FIXED | `packages/agent-policy/src/grant-bound.ts`. |
| AUD-021 | P2 | Reservation IDs collide across unrelated actions/runs | FIXED | `packages/agent-policy/src/grant-usage.ts`. |
| AUD-022 | P2 | Expired reservations permanently block new work | FIXED | `packages/agent-policy/src/grant-usage.ts`. |
| AUD-023 | P1 | Industrial execution accepts a different context/executor kind | FIXED | `packages/industrial-action/src/executor.ts`. |
| AUD-024 | P2 | Industrial receipt integrity does not protect outcome/contents | FIXED | `packages/industrial-action/src/receipt.ts`. |
| AUD-025 | P1 | SE advertises a public key unrelated to its real WOTS signer | FIXED | `packages/se-server/src/seKey.ts`. |
| AUD-026 | P1 | SE owner authentication does not bind operation/request body | FIXED | `packages/se-server/src/router.ts`. |
| AUD-027 | P1 | SE ownership changes race against stale database snapshots | FIXED | `packages/se-server/src/router.ts`. |
| AUD-028 | P1 | HTTP statechain registration is a no-op after funding | OPEN | `packages/statechain/src/httpClient.ts:106`. Implement post-funding registration. |
| AUD-029 | P2 | SE claim endpoint signs the text of hex rather than the tx digest | PARTIAL | `packages/se-server/src/router.ts:252`. No confirmation state machine. |
| AUD-030 | P1 | MQTT signatures do not bind the payload sent to the executor | OPEN | `packages/edge-mqtt/src/command-handler.ts:34`. |
| AUD-031 | P1 | MQTT signature verification bypassed by legacy unsigned path | OPEN | `packages/edge-mqtt/src/command-handler.ts:136`. Remove/guard unsigned path. |
| AUD-032 | P2 | MQTT replay cache clears commands that are still valid | FIXED | `packages/edge-mqtt/src/command-handler.ts`. |
| AUD-033 | P1 | FileStore conditional updates are not atomic CAS | FIXED | `packages/storage/src/adapters/file-store.ts`. |
| AUD-034 | P2 | Storage codec confuses ordinary objects with reserved type tags | FIXED | `packages/storage/src/codec.ts`. |
| AUD-035 | P1 | Trust index accepts forged reviewer records with verification enabled | OPEN | `packages/lookup-node/src/trust.ts:55`. |
| AUD-036 | P1 | PWA send converts normal Mx addresses into unrelated bytes | OPEN | `extensions/totem-pwa-wallet/src/pages/Send.tsx:66`. |
| AUD-037 | P2 | PWA coin selection truncates precision needed by serialization | OPEN | `extensions/totem-pwa-wallet/src/core/buildTxnRow.ts:479`. |
| AUD-038 | P2 | Deposit verification rounds underfunded claims down | OPEN | `packages/chain-provider/src/verify-deposit.ts:203`. |
| AUD-039 | P2 | Deposit-verifier wrapper removes class provider methods | OPEN | `packages/chain-provider/src/verify-deposit.ts:187`. |
| AUD-040 | P1 | PWA build mode returns a signed transaction as `unsignedHex` | OPEN | `extensions/totem-pwa-wallet/src/approval/SendApproval.tsx:171`. |
| AUD-041 | P1 | PWA approval origin and return channel can be spoofed | OPEN | `extensions/totem-pwa-wallet/src/approval/VerifyApproval.tsx:22`. |
| AUD-042 | P2 | PWA parent-signature cache shared across different account keys | OPEN | `extensions/totem-pwa-wallet/src/core/WalletManager.ts:262`. |
| AUD-043 | P2 | PWA cannot build from current source/dependencies | OPEN | `extensions/totem-pwa-wallet/src/core/WalletManager.ts:291`. Build blocker. |
| AUD-044 | P2 | Quorum commits use the local reservation ID for every peer | OPEN | `packages/wots-lease/src/quorum.ts:223`. Retired critic test encoded the vulnerable behaviour. |
| AUD-045 | P1 | Go SE cryptography is a placeholder, not interoperable WOTS | FIXED | `packages/se-server/go/sekey.go`. |
| AUD-046 | P2 | Native-token coin selection can select unrelated tokens | OPEN | `packages/tx-builder/src/coin-selection.ts:163`. |

---

## 4. Backlog gaps (not in the 46)

| Gap | Status | Notes |
|---|---|---|
| KISSVM policy anchor fail-closed + tests | **FIXED (WS-C)** | See §2. |
| Proof identity | PARTIAL | Identity model exists; proof-level identity binding incomplete. |
| Identity org model | PARTIAL | Org hierarchy partial. |
| Root-identity lease | PARTIAL | Root identity not fully leased. |
| `OwnershipProof` | PARTIAL | Type/flow incomplete. |
| Direct Minima anchoring + `AnchorReceipt` | PARTIAL | No direct anchoring receipt. |
| Integritas positioning | PARTIAL | Positioning/docs incomplete. |
| Governance docs | PARTIAL | Governance documentation incomplete. |
| Authority role scopes / `distinctActors` | ABSENT | No role-scope enforcement. |
| Workflow verifier | ABSENT | No end-to-end workflow verifier. |
| Numeric-attestation template | ABSENT | — |
| Raster video types | ABSENT | — |
| `@totemsdk/evidence-store` | ABSENT | — |
| `sdk-tests` full-flow fixture | ABSENT | Harness exists; full-flow fixture missing. |
| Hardware-signer abstraction | ABSENT | — |

---

## 5. Verification

```
node scripts/verify-workspace.mjs --typecheck   # 62 passed
node scripts/verify-workspace.mjs --lint        # 63 passed
node scripts/verify-workspace.mjs --test        # 124 passed
```

All three gates pass at the commit that lands this document. `audit/` is
retired and is not part of any gate.
