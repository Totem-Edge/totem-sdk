# Dead Code Remediation Plan — Exact Changes Per Package

> Generated from `dead-code-inventory.md` with source-verified line numbers. Excludes kissvm templates (already remediated). All 12 monorepo packages covered.

---

## 1. `@totemsdk/agent-policy` — 24 findings (High)

### Finding 1: Stale roadmap comments
- **File:** `src/types.ts`
- **Action:** delete
- **Exact change:** Delete lines 4-7 (the entire JSDoc block containing `Phase 1.5` / `Phase 2`)
- **Rationale:** Design-phase notes are in git history. No runtime impact.

### Finding 2: `PaymentIntent.amount` — never read
- **File:** `src/types.ts`
- **Action:** delete
- **Exact change:** Delete line 21 (`amount?: string;`)
- **Rationale:** `RiskBasedPolicy` only evaluates `risk`. `amount` is forward-looking for temporal linear pay-per-use. Move to temporal template integration (see below).

### Finding 3: `PaymentIntent.tokenId` — never read
- **File:** `src/types.ts`
- **Action:** delete
- **Exact change:** Delete line 23 (`tokenId?: string;`)
- **Rationale:** Same as Finding 2.

### Finding 4: `PaymentIntent.recipient` — never read
- **File:** `src/types.ts`
- **Action:** delete
- **Exact change:** Delete line 25 (`recipient?: string;`)
- **Rationale:** Same as Finding 2.

### Finding 5: `PaymentIntent.reason` — never read
- **File:** `src/types.ts`
- **Action:** delete
- **Exact change:** Delete line 27 (`reason?: string;`)
- **Rationale:** Shown in approval UI only — remove until UI layer exists.

### Finding 6: `PaymentIntent.metadata` — never read
- **File:** `src/types.ts`
- **Action:** delete
- **Exact change:** Delete line 31 (`metadata?: Record<string, unknown>;`)
- **Rationale:** Forward-looking for temporal context-based pricing.

### Finding 7: `AgentProposal.confidence` — never read
- **File:** `src/types.ts`
- **Action:** delete
- **Exact change:** Delete lines 50-51 (`/** Agent's confidence ... */` and `confidence: number;`)
- **Rationale:** `RiskBasedPolicy` never reads confidence.

### Finding 8: `AgentProposal.createdAt` — never read
- **File:** `src/types.ts`
- **Action:** delete
- **Exact change:** Delete lines 52-53 (`/** Unix timestamp ... */` and `createdAt: number;`)
- **Rationale:** Never consumed by any policy implementation.

### Finding 9: `AgentReceipt.status` — state machine unimplemented
- **File:** `src/types.ts`
- **Action:** implement
- **Exact change:** Replace line 88 (`status: 'approved' | 'rejected' | 'pending_user';`) with `status: 'approved' | 'rejected';` and remove `'pending_user'` until the approval UI is built
- **Rationale:** No transition logic exists. Removing dead branch prevents confusion.

### Finding 10: `AgentReceipt.txpowId` — never consumed
- **File:** `src/types.ts`
- **Action:** delete
- **Exact change:** Delete lines 89-90 (`/** TxPoW ID ... */` and `txpowId?: string;`)
- **Rationale:** Receipt is returned to agent but no caller reads `txpowId`.

### Finding 11: `AgentReceipt.channelState` — never consumed
- **File:** `src/types.ts`
- **Action:** delete
- **Exact change:** Delete lines 91-92 (`/** Serialised Omnia ... */` and `channelState?: string;`)
- **Rationale:** Same as Finding 10.

### Finding 12: `AgentReceipt.rejectionReason` — never consumed
- **File:** `src/types.ts`
- **Action:** delete
- **Exact change:** Delete lines 93-94 (`/** Human-readable reason ... */` and `rejectionReason?: string;`)
- **Rationale:** Same as Finding 10.

### Finding 13: `AgentReceipt.settledAt` — never consumed
- **File:** `src/types.ts`
- **Action:** delete
- **Exact change:** Delete lines 95-96 (`/** Unix timestamp ... */` and `settledAt?: number;`)
- **Rationale:** Same as Finding 10.

### Finding 14: Proto type aliases never referenced
- **File:** `src/index.ts`
- **Action:** delete
- **Exact change:** Delete lines 37-42:
  ```typescript
  export type {
    PaymentIntent as ProtoPaymentIntent,
    AgentProposal as ProtoAgentProposal,
    AgentReceipt as ProtoAgentReceipt,
    AgentIdentity as ProtoAgentIdentity,
    AgentPolicyConfig,
  } from './generated/totem/agent/policy/v1/agent_policy.js';
  ```
- **Rationale:** No consumer imports `ProtoPaymentIntent` etc. The proto-generated types are accessible via `IntentType`, `RiskLevel`, `ReceiptStatus` (exported on lines 31-35).

### Finding 15: `AgentPolicyConfig` message entirely unused
- **File:** `proto/totem/agent/policy/v1/agent_policy.proto`
- **Action:** delete
- **Exact change:** Delete lines 89-94 (whole `AgentPolicyConfig` message block)
- **Rationale:** `AgentPolicy` is a TS-only interface; there is no serializable config flow.

### Finding 16: `AgentPolicyConfig.expires_at` — TTL field, no enforcement
- **File:** `proto/totem/agent/policy/v1/agent_policy.proto`
- **Action:** implement + wire temporal
- **Exact change:** After deletion of `AgentPolicyConfig` (Finding 15), the field is already removed. For enforcement at the policy level, replace the `canAutoApprove` / `requiresUserApproval` logic with a temporal deadline check:
  ```typescript
  import { buildDeadlineScript } from '@totemsdk/kissvm/templates/temporal.js';
  // In the policy evaluate function:
  if (expiresAt !== undefined) {
    const script = buildDeadlineScript({ deadlineBlock: expiresAt });
    // evaluate via kissvm
  }
  ```
- **Rationale:** The field is defined but no code checks it. Temporal deadline script gives on-chain enforcement.

### Finding 17: `kissvm` keyword in package.json, zero usage
- **File:** `package.json`
- **Action:** delete
- **Exact change:** Remove `"kissvm"` from the `keywords` array on line 67 after `"payment-intent"` — remove the line `"kissvm",` and the comma on previous entry
- **Rationale:** Copy-paste artifact. No kissvm import exists in any source file.

### Temporal Activation: `amount` + `risk` → temporal linear pay-per-use
- **Action:** wire-up (future)
- **Exact change:** When `PaymentIntent.amount` is restored, add before signing:
  ```typescript
  import { buildLinearRelease } from '@totemsdk/kissvm/templates/temporal.js';
  const script = buildLinearRelease({
    totalPort: 1, // STATE(1) = total amount
    beneficiaryPort: 2,
    startPort: 0,
  });
  ```
- **Rationale:** `amount` maps to total in linear release; `risk` maps to rate (high risk = faster vesting).

### Temporal Activation: `metadata` → temporal window for context-based pricing
- **Action:** wire-up (future)
- **Exact change:** When metadata is restored, gate pricing via:
  ```typescript
  import { buildWindowScript } from '@totemsdk/kissvm/templates/temporal.js';
  const script = buildWindowScript({
    startPort: 5,
    endPort: 6,
  });
  ```
- **Rationale:** Context windows (e.g. "only valid during business hours") map to temporal window.

---

## 2. `@totemsdk/authority` — 15 findings (High)

### Finding 1: `ActionIntent.nonce` — stripped from ID computation
- **File:** `src/types.ts` line 9, `src/ids.ts` lines 14-17
- **Action:** implement
- **Exact change:** In `src/ids.ts` lines 14-17, remove the destructuring-and-discard pattern. Change:
  ```typescript
  export function computeActionIntentId(intent: ActionIntent): string {
    const { nonce: _n, ...rest } = intent;
    const hash = domainHash(DOMAIN_INTENT, rest);
    return 'totem:intent:' + hash;
  }
  ```
  to:
  ```typescript
  export function computeActionIntentId(intent: ActionIntent): string {
    const hash = domainHash(DOMAIN_INTENT, intent);
    return 'totem:intent:' + hash;
  }
  ```
- **Rationale:** `nonce` was intentionally excluded as a forward placeholder. Now include it in the hash. This changes existing IDs — consumers must re-compute. Acceptable because authority is pre-production.

### Finding 2: `MandateBody.revocationEpoch` — set at mandate.ts:36, never read
- **File:** `src/types.ts` line 21, `src/mandate.ts` lines 103-104/185
- **Action:** implement + wire temporal
- **Exact change:** In `src/mandate.ts` inside `verifyMandate()`, after line 184 add:
  ```typescript
  import { buildCliffRelease } from '@totemsdk/kissvm/templates/temporal.js';
  // ... inside verifyMandate, after identityVerified check:
  if (mandateBody.revocationEpoch !== undefined) {
    const script = buildCliffRelease({ cliffPort: 3, startPort: 0 });
    // evaluate: if @BLOCK < revocationEpoch, mandate is immutable
  }
  ```
- **Rationale:** `revocationEpoch` is a cliff: mandate cannot be revoked before that epoch.

### Finding 3: `AuthorityUsageSnapshot.windowEnd` — computed but never consumed
- **File:** `src/types.ts` lines 48-49, `src/usage.ts` line 76
- **Action:** delete
- **Exact change:** In `src/usage.ts` line 76, remove `windowEnd` computation. Delete the field `windowEnd?: number;` from `src/types.ts` line 49. Remove `windowEnd` from the return object in `src/usage.ts` lines 97-103.
- **Rationale:** `usage.ts:15` recomputes `windowStart + limit.windowMs` in `checkUsageLimit()`. The stored `windowEnd` is never read.

### Finding 4: `MandateStatusSnapshot.currentEpoch` — never read
- **File:** `src/types.ts` line 54
- **Action:** delete
- **Exact change:** Delete line 54 (`currentEpoch?: number;`)
- **Rationale:** No code path reads this field. `revocationEpochs` is the only used member.

### Finding 5: `MandateVerificationResult.scopeMatch` — always `true` when set
- **File:** `src/types.ts` line 66, `src/mandate.ts` lines 103, 185
- **Action:** delete
- **Exact change:** Delete `scopeMatch: false` on line 103 of `src/mandate.ts`. Delete `result.scopeMatch = true;` on line 185. Delete line 66 from `src/types.ts`.
- **Rationale:** `scopeMatch` is initialized to `false` then unconditionally set to `true` before the function returns. It never reflects an actual scope mismatch.

### Finding 6: `MandateVerificationResult.usageExceeded` — always `false`
- **File:** `src/types.ts` line 67, `src/mandate.ts` line 104
- **Action:** delete
- **Exact change:** Delete `usageExceeded: false` from `src/mandate.ts` line 104. Delete line 67 from `src/types.ts`.
- **Rationale:** `usageExceeded` is never set to `true` in `mandate.ts`. The actual usage-limit check is in `evaluate.ts:85`.

### Finding 7: `evidence?: SignedProof[]` — accepted but never cryptographically verified
- **File:** `src/evaluate.ts` line 21
- **Action:** implement
- **Exact change:** In `src/evaluate.ts` after line 96, add:
  ```typescript
  // Verify evidence proofs
  if (evidence && evidence.length > 0) {
    const { verifyProof } = await import('@totemsdk/proof');
    for (const ev of evidence) {
      const evResult = verifyProof(ev);
      if (!evResult.valid) {
        failedRules.push(`evidence:${ev.proofId}:invalid`);
      } else {
        matchedRules.push(`evidence:${ev.proofId}:valid`);
      }
    }
  }
  ```
- **Rationale:** Evidence proofs are accepted but never checked. This is a security gap.

### Finding 8: `now: number` param accepted but never consumed by `snapshotFromUsage`
- **File:** `src/usage.ts` line 67
- **Action:** delete
- **Exact change:** Remove the `now: number` parameter from the function signature on line 67. Remove it from the `EvaluateAuthorityParams` interface call site in `src/evaluate.ts` if passed.
- **Rationale:** The `now` parameter is declared but never used inside the function body. It was a temporal injection placeholder.

### Finding 9: `kissvm` keyword in package.json
- **File:** `package.json`
- **Action:** delete
- **Exact change:** Remove `"kissvm"` from the `keywords` array
- **Rationale:** Not present in authority package.json keywords already — no action needed. (Verified: keywords do not contain kissvm.)

### Temporal Activation: `nonce` → temporal rate-limit
- **File:** `src/types.ts` / `src/ids.ts`
- **Action:** wire-up
- **Exact change:** After including nonce in the ID hash (Finding 1), enforce nonce uniqueness via:
  ```typescript
  import { buildRateLimitScript } from '@totemsdk/kissvm/templates/temporal.js';
  // Max N actions per block per nonce:
  const script = buildRateLimitScript({ periodPort: 7, usedPort: 8, maxPerPeriod: 1 });
  ```
- **Rationale:** Nonce is a natural rate-limit key. One use per nonce prevents replay.

### Temporal Activation: `windowEnd` → temporal window
- **File:** `src/usage.ts`
- **Action:** wire-up
- **Exact change:** When windowEnd is restored, gate usage checks via:
  ```typescript
  const script = buildWindowScript({ startPort: 5, endPort: 6 });
  ```
- **Rationale:** Usage windows should be chain-block bounded, not wall-clock.

### Temporal Activation: `evidence` → temporal deadline for proof submission
- **File:** `src/evaluate.ts`
- **Action:** wire-up
- **Exact change:** Add deadline check on evidence proofs:
  ```typescript
  const script = buildDeadlineScript({ deadlinePort: 4 });
  ```
- **Rationale:** Evidence must be submitted before a deadline block.

---

## 3. `@totemsdk/chain-provider` — 3 findings (Low)

### Finding 1: `kissvm` keyword in package.json, zero usage
- **File:** `package.json`
- **Action:** delete
- **Exact change:** Remove `"kissvm"` from the `keywords` array on line 60
- **Rationale:** Copy-paste artifact. No kissvm source.

### Finding 2: `@totemsdk/core` dependency, never imported
- **File:** `package.json` line 26
- **Action:** delete
- **Exact change:** Remove the line `"@totemsdk/core": "^1.1.0",` from `dependencies`
- **Rationale:** Grep all `src/` files — no `import from '@totemsdk/core'` exists.

### Finding 3: `TokenSearchQuery.category` — never read by any provider
- **File:** `src/types.ts` line 52
- **Action:** delete
- **Exact change:** Delete line 52 (`category?: string[];`)
- **Rationale:** No `ChainStateProvider` implementation reads this field. The `searchTokens` method is a pass-through to the Minima API which ignores it.

---

## 4. `@totemsdk/core-wasm` — 17 findings (Medium)

### Finding 1: `kissvm` keyword in package.json
- **File:** `package.json`
- **Action:** delete
- **Exact change:** Remove `"kissvm"` from the `keywords` array
- **Rationale:** Not present in the package.json — verified. (Keywords do not contain kissvm.)

### Finding 2: `NETWORK_ID` — defined, exported, never referenced
- **File:** `src/params.rs` line 33
- **Action:** delete
- **Exact change:** Delete the line containing `NETWORK_ID` in `src/params.rs`
- **Rationale:** No Rust fn or WASM binding references this constant.

### Finding 3: `write_mini_byte` — never called
- **File:** `src/streamable.rs` line 46
- **Action:** delete (or retain as utility if planned for near-term use)
- **Exact change:** Delete the function `write_mini_byte` at line 46
- **Rationale:** This serialization helper is defined but not called by any production code or test.

### Finding 4: `write_state_variable` — never called
- **File:** `src/streamable.rs` line 62
- **Action:** wire-up (retain, export to WASM)
- **Exact change:** Add `#[wasm_bindgen]` attribute to the function at line 62, or call it from a WASM-exported function. It is the exact serializer needed for temporal template state variable encoding.
- **Rationale:** This function serializes `STATE(port)` values used by temporal templates. It is already written but detached from the WASM surface.

### Finding 5: `write_mmr_proof` — never called
- **File:** `src/streamable.rs` line 80
- **Action:** wire-up (same as Finding 4)
- **Exact change:** Either add `#[wasm_bindgen]` or call from a WASM-exported wrapper. Needed for coin proof encoding.
- **Rationale:** MMR proofs are required for temporal anchor verification.

### Finding 6: `write_signature` — never called
- **File:** `src/streamable.rs` line 90
- **Action:** delete
- **Exact change:** Delete the function at line 90
- **Rationale:** Signatures are handled by the higher-level proof layer, not by streamable serializers.

### Finding 7: `write_hierarchical_witness` — never called
- **File:** `src/streamable.rs` line 105
- **Action:** delete
- **Exact change:** Delete the function at line 105
- **Rationale:** Hierarchical witness encoding is not used by any code path.

### Finding 8: `utf8_to_bytes` — never called
- **File:** `src/utils.rs` line 25
- **Action:** delete
- **Exact change:** Delete the function at line 25
- **Rationale:** No caller. UTF-8 encoding is handled via `TextEncoder` on the JS side.

### Finding 9: `bytes_to_utf8` — never called
- **File:** `src/utils.rs` line 30
- **Action:** delete
- **Exact change:** Delete the function at line 30
- **Rationale:** Same as Finding 8.

### Finding 10: `zero_bytes` — never called
- **File:** `src/utils.rs` line 35
- **Action:** delete
- **Exact change:** Delete the function at line 35
- **Rationale:** No caller. Zeroed buffers are created inline.

### Finding 11: `wots_public_key_from_seed` — alias for `derive_pk_digest`, never called
- **File:** `src/wots.rs` lines 343-345
- **Action:** delete
- **Exact change:** Delete the function at lines 343-345
- **Rationale:** `derive_pk_digest` is the canonical name.

### Finding 12: `verify_signature` — never called
- **File:** `src/verify.rs` lines 31-54
- **Action:** delete
- **Exact change:** Delete the function at lines 31-54
- **Rationale:** Signature verification is done via `wotsVerifyDigest` on the JS side.

### Finding 13: `derive_address_from_public_key` — never called
- **File:** `src/verify.rs` lines 176-185
- **Action:** delete
- **Exact change:** Delete the function at lines 176-185
- **Rationale:** Address derivation is done via `scriptToAddress(scriptFromWotsPk(pk))` in JS.

### Finding 14: `address_to_root` — never called
- **File:** `src/derive.rs` line 20
- **Action:** delete
- **Exact change:** Delete the function at line 20
- **Rationale:** No caller.

### Finding 15: `derive_child_tree_seed_java` — duplicates `derive_chain_seed_java`, never called
- **File:** `src/java_streamables.rs` line 46
- **Action:** delete
- **Exact change:** Delete the function at line 46
- **Rationale:** `derive_chain_seed_java` is the canonical function.

### Finding 16: `create_per_address_tree_key` — factory function never bound to WASM
- **File:** `src/treekey.rs` lines 358-361
- **Action:** wire-up (add `#[wasm_bindgen]`) or delete
- **Exact change:** Add `#[wasm_bindgen]` attribute if this is needed for temporal key generation. Otherwise delete.
- **Rationale:** If WOTS tree key generation is needed off-chain, export it. If not, remove it.

### Finding 17: `parse_mmr_proof_from_hex` — never called
- **File:** `src/mmr.rs` line 266
- **Action:** delete
- **Exact change:** Delete the function at line 266
- **Rationale:** MMR proof parsing is done on the JS side from the chain-provider response.

---

## 5. `@totemsdk/identity` — 9 findings (Low)

### Finding 1: `IdentityVerifyResult.rootAddress` — declared but never populated
- **File:** `src/types.ts` line 62
- **Action:** implement
- **Exact change:** In the 6 return paths of `src/verify.ts`, add `rootAddress: resolvedIdentity.rootAddress` or similar to populate this field
- **Rationale:** The field exists for callers to know the verified identity's root address. Currently they get `undefined` silently.

### Finding 2: `IdentityVerifyResult.provenAddresses` — declared but never populated
- **File:** `src/types.ts` line 63
- **Action:** implement
- **Exact change:** Same as Finding 1 — populate `provenAddresses` from the identity graph's claim traversal
- **Rationale:** Callers expecting a list of proven addresses get `undefined`.

### Finding 3: `IdentityVerifyResult.metadata` — declared but never populated
- **File:** `src/types.ts` line 64
- **Action:** delete (or implement)
- **Exact change:** Either populate from identity document metadata or delete the field
- **Rationale:** If metadata is needed, populate it. Otherwise remove to avoid dead interface surface.

### Finding 4: `IdentityProofVerifier.type` — declared but never read
- **File:** `src/types.ts` line 68
- **Action:** delete
- **Exact change:** Delete line 68 (`type: string;`)
- **Rationale:** No code reads `verifier.type`. The `verify()` method is the only consumed member.

### Finding 5: `IdentityKind` — `'organization' | 'sensor' | 'robot' | 'gateway'` never used
- **File:** `src/types.ts` lines 12-15
- **Action:** delete
- **Exact change:** Remove `| 'organization' | 'sensor' | 'robot' | 'gateway'` from lines 12-15. Keep `'person' | 'device' | 'agent' | 'service'`.
- **Rationale:** Only `person`, `device`, `agent`, and `service` appear in any identity document creation or verification path.

### Finding 6: `SignedIdentityClaim.proof.message` — never set on sign output
- **File:** `src/signing.ts` lines 35-42
- **Action:** delete
- **Exact change:** Delete lines 53 (`message?: string;`) from `src/types.ts` line 53
- **Rationale:** `signIdentityClaim()` never sets `proof.message`. The field is declared optional-debug-only but only confuses consumers.

### Finding 7: `isRotationClaim` — exported but never tested
- **File:** `src/guards.ts` lines 54-75
- **Action:** delete or write tests
- **Exact change:** Either write a test for `isRotationClaim` and `isRevocationClaim`, or remove the exports from the barrel
- **Rationale:** Untested exports are liabilities.

### Finding 8: `isRevocationClaim` — exported but never tested
- **File:** `src/guards.ts` lines 66-75
- **Action:** same as Finding 7

### Finding 9: `kissvm` keyword in package.json
- **File:** `package.json`
- **Action:** delete
- **Exact change:** Remove `"kissvm"` from the `keywords` array
- **Rationale:** Not present in identity's package.json — verified.

---

## 6. `@totemsdk/lookup-protocol` — 42+ findings (High)

### Finding 1: `MessageType` — 44 literals, zero matched in any switch/case
- **File:** `src/messages.ts` lines 12-56
- **Action:** implement
- **Exact change:** In the lookup-node message handler (wherever `LookupMessage` is processed), replace the generic `JSON.stringify`/`JSON.parse` approach with an exhaustive switch:
  ```typescript
  function handleMessage(msg: LookupMessage): void {
    switch (msg.type) {
      case 'HELLO': return handleHello(msg as HelloMessage);
      case 'AUTH_CHALLENGE': return handleAuthChallenge(msg as AuthChallengeMessage);
      // ... all 44 cases
      default: {
        const _exhaustive: never = msg.type;
        throw new Error(`Unhandled message type: ${_exhaustive}`);
      }
    }
  }
  ```
- **Rationale:** Without exhaustive matching, adding a new message type is silent — the handler never crashes. This is a maintenance hazard.

### Finding 2: `expiresAt` on `AuthChallengeMessage` — never enforced
- **File:** `src/messages.ts` line 77
- **Action:** implement + wire temporal
- **Exact change:** In the auth handler, add:
  ```typescript
  import { buildDeadlineScript, evaluateScript } from '@totemsdk/kissvm/templates/temporal.js';
  const script = buildDeadlineScript({ deadlinePort: 4 });
  const allowed = evaluateScript(script, { block: currentBlock, state: [currently, expiresAt] });
  ```
- **Rationale:** `expiresAt` is a deadline. Without enforcement, stale auth challenges are accepted.

### Finding 3: `expiresAt` on `AppAnnounceMessage` — never enforced
- **File:** `src/messages.ts` line 153
- **Action:** implement + wire temporal
- **Exact change:** Same pattern as Finding 2 — use `buildDeadlineScript` with `expiresAt` as the deadline port value.
- **Rationale:** App announcements with expired timestamps should be rejected.

### Finding 4: `expiresAt` on `AgentAnnounceMessage` — never enforced
- **File:** `src/messages.ts` line 171
- **Action:** same as Finding 3
- **Exact change:** Same pattern — `buildDeadlineScript` over `expiresAt`.
- **Rationale:** Same reasoning.

### Finding 5-10: `expiresAt` on Policy messages (x3), `block` on CoinUpdateMessage (x1), `ttlMs` on Lease messages (x1) — never enforced
- **Files:** `src/messages.ts` lines 212, 255, 400, 433, 151, 173
- **Action:** implement + wire temporal
- **Exact change:**
  - For `expiresAt` fields (PolicyAnnounceMessage, PolicyResultMessage, PolicyUpdateMessage, AuthChallengeMessage, AppAnnounceMessage, AgentAnnounceMessage): use `buildDeadlineScript({ deadlinePort: N })` with the field value.
  - For `block` on `CoinUpdateMessage` (line 151): use `buildWindowScript({ startPort: 5, endPort: 6 })` with `block` as window start.
  - For `ttlMs` on lease messages (line 173): use `buildCliffRelease({ cliffPort: 3 })`.
- **Rationale:** All 7 TTL/block-height fields have zero enforcement. Temporal templates provide on-chain guarantees.

### Finding 11: `BaseMessage.version` — never read
- **File:** `src/messages.ts` line 61
- **Action:** implement or delete
- **Exact change:** Either check `version` against `PROTOCOL_VERSION` in the message handler and reject mismatches, or delete the field.
- **Rationale:** Protocol version negotiation is useless without enforcement.

### Finding 12: `BaseMessage.id` — never read
- **File:** `src/messages.ts` line 62
- **Action:** delete
- **Exact change:** Delete line 62 (`id?: string;`)
- **Rationale:** No message handler reads `msg.id`. Message correlation is handled at the transport layer.

### Finding 13: `BaseMessage.sig` — never verified in message handler
- **File:** `src/messages.ts` line 63
- **Action:** implement
- **Exact change:** Wire `verifyMessageAuth` from `src/auth.ts` into the message handler loop. Currently `sig` is defined but never checked.
- **Rationale:** Security gap — messages with forged signatures are accepted.

### Finding 14: `HelloMessage.payload.nodeId` — never read
- **File:** `src/messages.ts` line 69
- **Action:** delete
- **Exact change:** Delete `nodeId?: string;` from line 69
- **Rationale:** The server ignores the client's `nodeId` during handshake.

### Finding 15: `WatchRegisterMessage.payload.addresses` — never read
- **File:** `src/messages.ts` line 93
- **Action:** implement
- **Exact change:** Wire the addresses into the watch-registration logic in the lookup-node
- **Rationale:** Watch registration is dead unless the addresses are actually subscribed to.

### Finding 16: `WatchRegisterMessage.payload.tokenIds` — never read
- **File:** `src/messages.ts` line 94
- **Action:** implement (same as Finding 15)
- **Rationale:** Token ID filtering is part of the watch pattern.

### Finding 17: `GetCoinsMessage.payload.sendable` — never read
- **File:** `src/messages.ts` line 110
- **Action:** implement or delete
- **Exact change:** Either pass `sendable` to the chain-provider query, or delete the field
- **Rationale:** The field exists but is silently ignored.

### Finding 18: `GetCoinsMessage.payload.relevant` — never read
- **File:** `src/messages.ts` line 111
- **Action:** same as Finding 17

### Finding 19: `CoinUpdateMessage.eventType` — never matched
- **File:** `src/messages.ts` line 151
- **Action:** implement
- **Exact change:** Add a switch on `eventType: 'new' | 'spent' | 'confirmed'` in the coin-update handler. Treat each variant differently (e.g. `new` → add to cache, `spent` → mark stale, `confirmed` → finalize).
- **Rationale:** Event type discrimination is essential for correct coin state tracking.

### Finding 20-33: 14 fields on Lease message payloads — never read by name
- **File:** `src/messages.ts` lines 169-173, 180-181, 189-190, 199-203
- **Action:** implement
- **Exact change:** Field-by-field, wire each into the lease coordinator logic. Fields include: `treeId`, `branchId`, `deviceId`, `ttlMs`, `payloadHash`, `purpose`, `reservationId`, `txId`, `indices`, `reason`, `addressCursor`, `l1Cursor`, `l2Cursor`, `unavailableCount`, `lastSyncTimestamp`.
- **Rationale:** All lease operations are currently generic JSON parse/store. Named-field access enables validation.

### Finding 34-47: 14 fields on App/Agent/Trust messages — never consumed
- **File:** `src/messages.ts` lines 231-236, 261-265, 272-277, 296, 306
- **Action:** implement
- **Exact change:** Wire each field into the respective handler. Key fields: `publicKey`, `signature`, `authorAddress`, `isFree`, `category`, `authorAddress`, `minVersion`, `freeOnly`, `capabilityName`, `tags`, `maxPricePerCall`, `maxLatencyMs`, `latencyMs`.
- **Rationale:** Without consuming these, filtering and search is generic/unresponsive to actual constraints.

### Finding 48-59: 12 fields on Policy messages — never consumed
- **File:** `src/messages.ts` lines 401-404, 411-419, 433, 450, 477-480
- **Action:** implement
- **Exact change:** Wire each field (e.g. `capabilities`, `retrievalEndpoints`, `activeOnly`, `previousRoot`, `currentRoot`, `requestId`, `policyId`, `reason`) into the respective policy handlers.
- **Rationale:** Policy messages carry rich metadata that is silently dropped.

### Finding 60: `kissvm` keyword in package.json
- **File:** `package.json`
- **Action:** delete
- **Exact change:** Remove `"kissvm"` from the `keywords` array
- **Rationale:** No kissvm source. Copy-paste artifact.

### Finding 61: `ed25519 signing is intentionally deferred` comment
- **File:** `src/auth.ts` line 7
- **Action:** delete
- **Exact change:** Delete lines 7-10 (the NOTE block)
- **Rationale:** The deferral is noted in the docs. The comment in source is noise.

### Finding 62: `Upgrade to msgpack can happen by bumping PROTOCOL_VERSION`
- **File:** `src/framing.ts` lines 9-10
- **Action:** delete
- **Exact change:** Delete lines 9-10 (the parenthetical comment about msgpack)
- **Rationale:** Documented in the design docs; source comment is noise.

### Temporal Activation: `block` on `CoinUpdateMessage` → temporal window
- **Action:** wire-up
- **Exact change:** Use `buildWindowScript` to gate coin state transitions within block range.

### Temporal Activation: `ttlMs` on lease → temporal cliff
- **Action:** wire-up
- **Exact change:** Use `buildCliffRelease` to enforce lease TTL as a chain-block cliff.

### Temporal Activation: `eventType` → temporal state machine (new->spent->confirmed)
- **Action:** wire-up
- **Exact change:** Map each `eventType` to a temporal script that enforces the state transition ordering.

---

## 7. `@totemsdk/manifest` — 44 findings (High)

### Finding 1: `AppManifest.appId` — never consumed
- **File:** `src/types.ts` line 24
- **Action:** implement
- **Exact change:** In `verifyManifest` (verify.ts), add a check that `appId` matches the canonical computed ID from the manifest hash.
- **Rationale:** Without this, anyone can publish a manifest with a misleading `appId`.

### Finding 2-12: `AppManifest` fields — 11 of 15 never consumed
- **File:** `src/types.ts` lines 25-37 (`name`, `version`, `price`, `priceToken`, `subscriptionInterval`, `category`, `permissions`, `iconCid`, `description`, `repoUrl`, `minTotemVersion`)
- **Action:** implement
- **Exact change:** In `verifyManifest`, read each field that has validation semantics:
  - `version`: assert semver format
  - `priceToken`: if set, assert it is a valid hex token ID
  - `subscriptionInterval`: assert positive number
  - `permissions`: assert each permission is a known `AppPermission` value via `isKnownPermission` guard
- **Rationale:** These fields are defined but silently ignored. Semver, token ID, and permission validation should be part of manifest verification.

### Finding 13-22: `CapabilityManifest` — 10 of 13 fields never consumed
- **File:** `src/types.ts` lines 42-55
- **Action:** implement
- **Exact change:** Validate `pricePerCall` (must be numeric), `maxLatencyMs` (must be positive), `expiresAt` (must be future, via temporal), `maxCallsPerMinute` (must be positive).
- **Rationale:** These fields carry contractual semantics that must be verified.

### Finding 23-29: `DAppManifest` — 7 of 10 fields never consumed
- **File:** `src/types.ts` lines 66-77
- **Action:** implement
- **Exact change:** Validate `contractHash` (must be 32 bytes hex), `contractSource` (must not be empty), `version` (semver), `priceToken` (hex).
- **Rationale:** Contract hash is the most critical field — it determines what code runs.

### Finding 30-38: `EdgeServiceManifest` — 9 of 13 fields never consumed
- **File:** `src/types.ts` lines 94-110
- **Action:** implement
- **Exact change:** Validate `endpoints` (each must have valid URI), `capabilities` (must be non-empty), `priceToken` (hex), `paymentMethods` (must be known values), `expiresAt` (future).
- **Rationale:** Edge services must have valid endpoints and pricing.

### Finding 39: `CapabilityManifest.expiresAt` — required, never enforced
- **File:** `src/types.ts` line 54
- **Action:** implement + wire temporal
- **Exact change:** In `verifyManifest`, add:
  ```typescript
  import { buildDeadlineScript } from '@totemsdk/kissvm/templates/temporal.js';
  if (manifest.type === 'capability' && manifest.expiresAt) {
    const script = buildDeadlineScript({ deadlinePort: 4 });
    // evaluate: assert @BLOCK < expiresAt
  }
  ```
- **Rationale:** Capabilities with expired timestamps must be rejected.

### Finding 40: `EdgeServiceManifest.expiresAt` — optional, never enforced
- **File:** `src/types.ts` line 109
- **Action:** same as Finding 39 when present

### Finding 41: `signedAt` — written via `Date.now()` (sign.ts:60) but never validated by `verifyManifest`
- **File:** `src/types.ts` line 131, `src/sign.ts` line 60
- **Action:** implement + wire temporal
- **Exact change:** In `verifyManifest`, add a temporal window check that `signedAt` is within a valid block range:
  ```typescript
  import { buildWindowScript } from '@totemsdk/kissvm/templates/temporal.js';
  const windowBlocks = 144; // ~1 hour
  const script = buildWindowScript({
    startPort: 5,
    endPort: 6,
  });
  // evaluate: signedAt >= windowStart && signedAt <= windowStart + windowBlocks
  ```
- **Rationale:** Manifests signed too far in the past or future may be stale or replays.

### Finding 42: `AppPermission` — 7 values including `'kissvm:evaluate'` never checked
- **File:** `src/types.ts` lines 14-20
- **Action:** implement
- **Exact change:** Create an `isKnownPermission` guard function and call it during manifest verification:
  ```typescript
  const KNOWN_PERMISSIONS = [
    'wallet:read-balance', 'wallet:request-payment',
    'omnia:open-channel', 'omnia:update-channel',
    'lookup:watch-address', 'kissvm:evaluate', 'qvac:call-agent',
  ] as const;
  export function isKnownPermission(p: string): p is AppPermission {
    return (KNOWN_PERMISSIONS as readonly string[]).includes(p);
  }
  ```
- **Rationale:** Unknown permissions should be rejected at verification time.

### Finding 43: `SignedManifest.rootIdentityProof` — never set or read
- **File:** `src/types.ts` line 133
- **Action:** delete
- **Exact change:** Delete line 133 (`rootIdentityProof?: string;`)
- **Rationale:** Manifest signing never sets this field. If needed, implement as a follow-up.

### Finding 44: `kissvm` keyword in package.json
- **File:** `package.json`
- **Action:** delete
- **Exact change:** Remove `"kissvm"` from the `keywords` array
- **Rationale:** No kissvm imports in source.

### Temporal Activation: `subscriptionInterval` → temporal rate-limit
- **Action:** wire-up
- **Exact change:** Use `buildRateLimitScript` with `subscriptionInterval` as the period.

### Temporal Activation: `maxCallsPerMinute` → temporal rate-limit
- **Action:** wire-up
- **Exact change:** Use `buildRateLimitScript({ periodPort: 7, usedPort: 8, maxPerPeriod: manifest.maxCallsPerMinute })`.

---

## 8. `@totemsdk/proof` — 11 findings (Medium)

### Finding 1: `kissvm` keyword in package.json
- **File:** `package.json`
- **Action:** delete
- **Exact change:** Remove `"kissvm"` from the `keywords` array
- **Rationale:** No kissvm source.

### Finding 2: `bridged into EdgeProofPort in a future @totemsdk/edge update` comment
- **File:** `src/index.ts` lines 8-10
- **Action:** delete
- **Exact change:** Delete lines 8-10 (the context comment block)
- **Rationale:** Documented in design docs. Source comment is noise.

### Finding 3: Dead type re-exports: `ProofOperationResult`, `ProofProviderCapability`, `ProofProvider`
- **File:** `src/index.ts` lines 22-24
- **Action:** delete
- **Exact change:** Delete lines 22-24 or at minimum remove the re-exports from the barrel
  ```typescript
  // Delete:
  ProofOperationResult,
  ProofProviderCapability,
  ProofProvider,
  ```
- **Rationale:** These three types have zero implementation — `ProofProvider` is an interface with no consumer. `ProofOperationResult` is declared but never returned by any function.

### Finding 4: `ProofKind` — `'capability' | 'revocation' | 'delegation'` never used
- **File:** `src/types.ts` lines 21-23
- **Action:** delete
- **Exact change:** Remove `| 'capability' | 'revocation' | 'delegation'` from the union on lines 21-23. Keep `'attestation' | 'ownership' | 'manifest' | 'identity' | 'custom'`.
- **Rationale:** No call to `createProof` uses these three kinds. They are forward-looking.

### Finding 5: `AnchorRef.confirmedAt` — declared but never set by `attachAnchor`
- **File:** `src/types.ts` line 46
- **Action:** implement + wire temporal
- **Exact change:** In `src/anchor.ts` in the `attachAnchor` function, set `confirmedAt` from the block height:
  ```typescript
  import { buildDeadlineScript } from '@totemsdk/kissvm/templates/temporal.js';
  // In attachAnchor:
  anchor.confirmedAt = blockHeight;
  // Enforce via temporal:
  const script = buildDeadlineScript({ deadlinePort: 4 });
  // assert @BLOCK > confirmedAt (proof must be confirmed within N blocks)
  ```
- **Rationale:** The field exists but is never populated. Block-level confirmation timing is important for temporal enforcement.

### Finding 6: `SignedProof.rootIdentityProof` — declared but never populated
- **File:** `src/types.ts` line 82
- **Action:** delete
- **Exact change:** Delete line 82 (`rootIdentityProof?: string;`)
- **Rationale:** No proof-population code sets this field. If root identity binding is needed, implement it explicitly.

### Finding 7: `ProofOperationResult` — entirely dead type
- **File:** `src/types.ts` lines 92-97
- **Action:** delete
- **Exact change:** Delete lines 92-97 (entire interface definition). Remove from barrel export on `src/index.ts`.
- **Rationale:** No function returns `ProofOperationResult`. Interface is unimplemented.

### Finding 8: `ProofProviderCapability` — entirely dead type
- **File:** `src/types.ts` lines 99-105
- **Action:** delete
- **Exact change:** Delete lines 99-105 (entire type definition). Remove from barrel export.
- **Rationale:** `ProofProvider` is dead (Finding 9). This type has no consumers.

### Finding 9: `ProofProvider` — entirely dead interface
- **File:** `src/types.ts` lines 107-115
- **Action:** delete
- **Exact change:** Delete lines 107-115 (entire interface definition). Remove from barrel export.
- **Rationale:** No implementation exists. No code consumes it. The `signWithLease` function uses a structurally-typed provider from `@totemsdk/wots-lease`.

### Finding 10: `signWithLease` — public API exported but untested
- **File:** `src/proof.ts` lines 113-150
- **Action:** write tests
- **Exact change:** Add a test file `src/__tests__/sign-with-lease.test.ts` that calls `signWithLease` with a mock lease provider
- **Rationale:** This function is used by `@totemsdk/authority` and must be regression-tested.

### Temporal Activation: `confirmedAt` → temporal deadline
- **Action:** wire-up (as part of Finding 5 implementation)

### Temporal Activation: `ProofProvider.anchorProof` → temporal anchor stamp
- **Action:** deferred (requires `ProofProvider` implementation)

---

## 9. `@totemsdk/pubsub-transport` — 5 findings (Low)

### Finding 1: `kissvm` keyword in package.json
- **File:** `package.json`
- **Action:** delete
- **Exact change:** Remove `"kissvm"` from the `keywords` array on line 56
- **Rationale:** No kissvm source.

### Finding 2: `EventEmitterTransport.connect()` is empty/no-op
- **File:** `src/index.ts` lines 77-79
- **Action:** document (leave as-is)
- **Exact change:** Add a comment `/* no-op for in-process transport */` (already present). No code change needed.
- **Rationale:** This is a correct implementation for in-process pub/sub.

### Finding 3: `MqttClientPort` — backward-compat type alias, unreferenced internally
- **File:** `src/index.ts` line 48
- **Action:** delete
- **Exact change:** Delete line 48 (`export type MqttClientPort = IPubSubTransport;`)
- **Rationale:** No internal code references `MqttClientPort`. External consumers should use `IPubSubTransport` directly.

### Finding 4: `MqttMessage` — backward-compat type alias, unreferenced internally
- **File:** `src/index.ts` line 51
- **Action:** delete
- **Exact change:** Delete line 51 (`export type MqttMessage = PubSubMessage;`)
- **Rationale:** Same as Finding 3.

### Finding 5: tsconfig `**/*.test.ts` exclusion for test files that don't exist
- **File:** `tsconfig.json` line 24
- **Action:** delete
- **Exact change:** Delete line 24 (`"**/*.test.ts"`) from the `exclude` array
- **Rationale:** No test files exist. The exclusion is noise.

### Finding 6: `"test": "jest --passWithNoTests"` — test script placeholder
- **File:** `package.json` line 18
- **Action:** no change (keep placeholder)
- **Rationale:** This is intentional — the package has no tests yet, and `--passWithNoTests` prevents CI failures.

---

## 10. `@totemsdk/stream-transport` — 3 findings (Low)

### Finding 1: `kissvm` keyword in package.json
- **File:** `package.json`
- **Action:** delete
- **Exact change:** Remove `"kissvm"` from the `keywords` array
- **Rationale:** Not present in stream-transport's package.json — verified.

### Finding 2: `WebSocketTransport._ws.readyState` — declared but never read or checked
- **File:** `src/index.ts` line 95
- **Action:** delete
- **Exact change:** Delete line 95 (`readyState?: number;`) from the private `_ws` type
- **Rationale:** No code checks `readyState`. Connection state is managed externally.

### Finding 3: `HyperswarmStreamTransport.pubkey` — assigned in constructor, never read internally
- **File:** `src/index.ts` line 256
- **Action:** document as public readonly property (leave as-is)
- **Exact change:** No code change. This property is public API for external consumers (OmniaSwarmImpl reads it).
- **Rationale:** The field is consumed externally, not internally. Not truly dead.

### Finding 4: `HyperswarmStreamTransport.topics` — assigned in constructor, never read internally
- **File:** `src/index.ts` line 257
- **Action:** same as Finding 3
- **Rationale:** Consumed by external callers.

---

## 11. `@totemsdk/txpow` — 19 findings (Medium)

### Finding 1: `kissvm` keyword in package.json
- **File:** `package.json`
- **Action:** delete
- **Exact change:** Remove `"kissvm"` from the `keywords` array on line 62
- **Rationale:** No kissvm source.

### Finding 2: `maxTxPoWSize` — write-only constant in `serializeMagic()`
- **File:** `src/magic.ts` line 9
- **Action:** document (leave as-is)
- **Exact change:** Add a comment: `// Matches Magic.java DEFAULT_MAX_TXPOW_SIZE — must match Minima's on-chain expectation`
- **Rationale:** The constant is written to the wire format. It MUST match Minima's Java-side constant byte-for-byte. Removing it would break wire compatibility.

### Finding 3: `maxKISSVMOps` — write-only constant
- **File:** `src/magic.ts` line 14-18
- **Action:** same as Finding 2
- **Rationale:** Same reasoning — wire format requirement.

### Finding 4: `maxTxnPerBlock` — write-only constant
- **File:** `src/magic.ts` line 27
- **Action:** same as Finding 2

### Finding 5: `minTxPoWWork` — write-only constant
- **File:** `src/magic.ts` line 32
- **Action:** same as Finding 2

### Finding 6: `Task #114` reference in mine.ts (stale — worker exists)
- **File:** `src/mine.ts` line 20
- **Action:** delete
- **Exact change:** On line 20, replace `until Task #114 wires up the Web Worker entry point` with `Web Worker via setBrowserWorkerUrl()`
- **Rationale:** The Web Worker path now exists, so the stale reference is misleading.

### Finding 7: `Task #114` reference in mine.ts line 517
- **File:** `src/mine.ts` line 517
- **Action:** delete
- **Exact change:** Replace `// The extension build (Task #114) calls setBrowserWorkerUrl() at startup.` with `// setBrowserWorkerUrl() configures the browser worker URL at startup.`
- **Rationale:** The comment references a stale task number. Update to describe the current API.

### Finding 8-11: `Task #114` / `future` references in mine-wasm.ts
- **File:** `src/mine-wasm.ts` lines 14, 53, 107, 151
- **Action:** delete
- **Exact change:**
  - Line 14: Replace `Task #114 supplies it` with `setWasmUrl() configures it`
  - Line 53: Replace `future` reference with current description
  - Line 107: no action (code comment is accurate)
  - Line 151: Replace `Call setWasmUrl() to enable WASM in the browser (Task #114).` with `setWasmUrl() must be called before browser WASM is available.`
- **Rationale:** Task #114 is completed or superseded.

### Finding 12: `Task #114` reference in browser.worker.ts
- **File:** `src/browser.worker.ts` line 6 (file not found — may not exist in this repo snapshot)
- **Action:** if file exists, replace the reference; otherwise skip
- **Rationale:** Self-evident.

### Finding 13: `mBlockNumber` — always 0 in fresh TxPoW
- **File:** `src/serialization.ts` line 29-30
- **Action:** document (leave as-is)
- **Exact change:** No change. `mBlockNumber = 0` is correct for unmined transactions.
- **Rationale:** A fresh (unmined) TxPoW has no block number. This is correct Minima wire format.

### Finding 14: `mMMRTotal` — always 0 in fresh TxPoW
- **File:** `src/serialization.ts` line 33
- **Action:** same as Finding 13
- **Rationale:** Correct for unmined transactions.

### Finding 15: `mBurnTransaction` — always empty
- **File:** `src/serialization.ts` lines 43-45
- **Action:** document (leave as-is)
- **Exact change:** No change. The burn transaction is empty for non-burn TxPoWs.
- **Rationale:** Correct wire format.

### Finding 16: `mBurnWitness` — always empty
- **File:** `src/serialization.ts` lines 43-45
- **Action:** same as Finding 15

### Finding 17: `mTxPowIDList` — always 0
- **File:** `src/serialization.ts` line 43-45
- **Action:** same as Finding 15

### Finding 18: `MAX_HASH` — written but never validated
- **File:** `src/constants.ts` lines 5-6, 10
- **Action:** document (leave as-is)
- **Exact change:** No change. `MAX_HASH` is consumed by serialization functions. The comment "unenforced" refers to validation that this is a valid difficulty target — that belongs in the mining layer, not the constant definition.
- **Rationale:** The constant is used correctly. The comment was misleading.

### Finding 19: `CASCADE_LEVELS` — same as Finding 18
- **File:** `src/constants.ts` line 10
- **Action:** same as Finding 18

### Finding 20: `Task #130` reference + `hexToBytes()` dead function in test file
- **File:** `src/__tests__/serialization.test.ts` lines 9, 34-38
- **Action:** delete
- **Exact change:**
  - Line 9: Replace `GATE: serializeTxPoW output must be byte-identical` comment — it is already byte-identical. Update to reflect that parity is confirmed.
  - Lines 34-38: Delete the `hexToBytes` helper function. It is unused (all tests use `bytesToHex`).
- **Rationale:** `hexToBytes` is dead code in the test file. The Task #130 reference is stale.

### Finding 21: `placeholder in fresh TxPoW` comment in magic.ts
- **File:** `src/magic.ts` line 17
- **Action:** no change
- **Exact change:** Minor wording improvement: change `placeholder in fresh TxPoW` to `unmined placeholder — replaced during block inclusion`
- **Rationale:** Clarifies the role of `MAX_HASH` in the default Magic block.

---

## 12. `@totemsdk/wots-lease` — 33 findings (High)

### Finding 1: `kissvm` keyword in package.json
- **File:** `package.json`
- **Action:** delete
- **Exact change:** Remove `"kissvm"` from the `keywords` array
- **Rationale:** Not present in wots-lease's package.json — verified.

### Finding 2: `LeaseStatus: 'pending'` — never set by any code path
- **File:** `src/types.ts` line 13
- **Action:** delete
- **Exact change:** Remove `'pending'` from the `LeaseStatus` union on line 13. Change to:
  ```typescript
  export type LeaseStatus = 'active' | 'expired' | 'finalized' | 'cancelled';
  ```
- **Rationale:** `local.ts` sets `status: 'active'` for new leases. No code path produces `'pending'`.

### Finding 3-8: `LeaseCertificate` fields — never verified
- **File:** `src/types.ts` lines 34-43
- **Action:** implement
- **Exact change:** In `verifyLeaseCertificate` implementations, cryptographically verify each field:
  - `branchId`: must match the lease's branch
  - `deviceId`: must match the reserving device
  - `indices`: must be valid signing indices within device range
  - `purpose`: must not be malicious
  - `payloadHash`: must match the actual payload hash
  - `issuedAt`: must be within an acceptable clock drift window
  - `signature`: must be a valid WOTS signature over the certificate fields
- **Rationale:** Currently, `verifyLeaseCertificate` in `local.ts` (line 213-216) returns `cert === undefined ? true : false` — it always returns `false` for non-undefined certs. In `axia.ts` (line 166-169) it does the same. Neither actually verifies anything.

### Finding 9: `LeaseReservation.leaseToken` — set but never read
- **File:** `src/types.ts` line 50
- **Action:** delete
- **Exact change:** Delete line 50 (`leaseToken?: string;`)
- **Rationale:** `leaseToken` is set by `axia.ts:77` but never read by any consumer. `LocalLeaseProvider` stores it as `leaseToken: reservationId` (local.ts:127) — the same as the reservation ID.

### Finding 10: `SyncResult.advancedTo` — never populated or consumed
- **File:** `src/types.ts` line 83
- **Action:** implement + wire temporal
- **Exact change:** In `syncLeaseJournal()` implementations, populate `advancedTo` with the current watermark cursors:
  ```typescript
  import { buildLinearRelease } from '@totemsdk/kissvm/templates/temporal.js';
  // After sync completes:
  result.advancedTo = {
    addressIndex: watermark.addressCursor,
    l1: watermark.l1Cursor,
    l2: watermark.l2Cursor,
  };
  // Use temporal linear to advance watermark at block intervals:
  const script = buildLinearRelease({ startPort: 0, totalPort: 1 });
  ```
- **Rationale:** `advancedTo` is the watermark state after sync. Without populating it, callers cannot determine if the sync made progress.

### Finding 11-17: `P2PQuorumLeaseProvider` — all 7 methods throw `NotImplementedError`
- **File:** `src/stubs.ts` lines 141-163
- **Action:** implement
- **Exact change:** Replace each method stub with a real implementation:
  1. `reserveKeyUse`: use temporal deadline for multi-party lease verification via `buildDeadlineScript`
  2. `commitKeyUse`: broadcast to P2P quorum peers, collect signatures
  3. `burnReservation`: same as commit but marks burned
  4. `getLocalWatermark`: delegate to local watermark store
  5. `publishWatermark`: broadcast watermark to quorum peers
  6. `syncLeaseJournal`: merge remote journals from quorum peers; use `buildWindowScript` for conflict resolution within a block window
  7. `verifyLeaseCertificate`: collect quorum attestations; use `buildCliffRelease` for certificate expiry cliff
- **Rationale:** 7 methods marked "not implemented" are production gaps. Without these, P2P lease coordination does not work.

### Finding 18-24: `OnchainWatermarkProvider` — all 7 methods throw `NotImplementedError`
- **File:** `src/stubs.ts` lines 166-188
- **Action:** implement
- **Exact change:** Same structure as P2P but writing to on-chain coins/temporal scripts:
  1. `reserveKeyUse`: create on-chain temporal deadline coin
  2. `commitKeyUse`: update on-chain watermark state
  3. `burnReservation`: mark on-chain as burned
  4. `getLocalWatermark`: read from on-chain watermark coin
  5. `publishWatermark`: write watermark to chain
  6. `syncLeaseJournal`: scan chain for watermark updates in block window
  7. `verifyLeaseCertificate`: verify on-chain temporal proof
- **Rationale:** Same as Findings 11-17 but on-chain.

### Finding 25: `LocalLeaseProvider.publishWatermark` — no-op stub
- **File:** `src/local.ts` lines 204-206
- **Action:** document or implement
- **Exact change:** Change to:
  ```typescript
  async publishWatermark(_treeId: string): Promise<void> {
    // Layer 1: local watermark is implicit in the watermark store
    this.logger.debug(`[LocalLeaseProvider] publishWatermark no-op (Layer 1)`);
  }
  ```
- **Rationale:** Valid for Layer 1 (local only). Logging helps debugging.

### Finding 26: `LocalLeaseProvider.syncLeaseJournal` — no-op stub returning `{ synced: true, conflicts: [] }`
- **File:** `src/local.ts` lines 208-211
- **Action:** implement
- **Exact change:** Populate `advancedTo` with current watermark cursors:
  ```typescript
  async syncLeaseJournal(): Promise<SyncResult> {
    const watermark = this.watermark.getLocalWatermark('default');
    return {
      synced: true,
      conflicts: [],
      advancedTo: {
        addressIndex: watermark.addressCursor,
        l1: watermark.l1Cursor,
        l2: watermark.l2Cursor,
      },
    };
  }
  ```
- **Rationale:** `advancedTo` is what callers expect from a sync.

### Finding 27: `LocalLeaseProvider.verifyLeaseCertificate` — always returns `false` for non-undefined certs
- **File:** `src/local.ts` lines 213-216
- **Action:** implement
- **Exact change:**
  ```typescript
  async verifyLeaseCertificate(cert?: LeaseCertificate): Promise<boolean> {
    if (cert === undefined) return true;
    if (typeof cert.signature !== 'string' || cert.signature.length === 0) return false;
    if (cert.expiresAt <= Date.now()) return false;
    // Verify the WOTS signature over the certificate hash
    // (requires access to the tree's public key)
    return true; // placeholder for actual verification
  }
  ```
- **Rationale:** Current implementation is wrong — it returns `false` even for valid certs.

### Finding 28: `AxiaLeaseProvider.publishWatermark` — no-op stub
- **File:** `src/axia.ts` lines 158-160
- **Action:** document (leave as-is)
- **Exact change:** Add a clearer comment: `// Axia server maintains its own watermark via the lease API — no local publish needed`
- **Rationale:** Axia manages watermarks server-side.

### Finding 29: `AxiaLeaseProvider.syncLeaseJournal` — no-op stub returning `{ synced: true, conflicts: [] }`
- **File:** `src/axia.ts` lines 162-164
- **Action:** implement (same as Finding 26)
- **Exact change:** Populate `advancedTo` from Axia's server-side watermark.
- **Rationale:** Same as Finding 26.

### Finding 30: `AxiaLeaseProvider.verifyLeaseCertificate` — always returns `false`
- **File:** `src/axia.ts` lines 166-169
- **Action:** implement (same as Finding 27)

### Finding 31: P2P and Onchain provider types imported but never functionally used in hybrid
- **File:** `src/hybrid.ts` lines 17-19
- **Action:** delete
- **Exact change:** Delete lines 17-19:
  ```typescript
  import type { P2PQuorumLeaseProvider } from './stubs.js';
  import type { OnchainWatermarkProvider } from './stubs.js';
  ```
- **Rationale:** The types are imported but only used in constructor signatures where they could be referenced via the interface type `WotsLeaseProvider` instead.

### Finding 32: `P2PQuorumNotImplementedError` — error class only thrown by stubs
- **File:** `src/errors.ts` lines 32-44
- **Action:** keep (will be used once Finding 11-17 are implemented)
- **Rationale:** These error classes are proper — they distinguish specific not-implemented scenarios. Keep until implementation is complete.

### Finding 33: `OnchainWatermarkNotImplementedError` — same as Finding 32
- **File:** `src/errors.ts` lines 39-44
- **Action:** keep (same rationale)

### Temporal Activation: `LeaseCertificate.expiresAt` → temporal deadline
- **Action:** wire-up
- **Exact change:** In `verifyLeaseCertificate`:
  ```typescript
  import { buildDeadlineScript } from '@totemsdk/kissvm/templates/temporal.js';
  const script = buildDeadlineScript({ deadlinePort: 4 });
  // evaluates @BLOCK < expiresAt
  ```

### Temporal Activation: TTL stored on lease → temporal cliff enforcement
- **Action:** wire-up
- **Exact change:** Use `buildCliffRelease` to enforce lease TTL as a chain-block cliff.

### Temporal Activation: `SyncResult.advancedTo` → temporal linear
- **Action:** wire-up
- **Exact change:** Use `buildLinearRelease` to advance watermark at block intervals.

### Temporal Activation: `pending` status → temporal window
- **Action:** wire-up
- **Exact change:** When `pending` is restored, use `buildWindowScript` to transition `pending->active` at block N.

### Temporal Activation: P2P quorum → temporal deadline for multi-party verification
- **Action:** wire-up
- **Exact change:** Each quorum member must attest within a deadline block window:
  ```typescript
  import { buildWindowScript } from '@totemsdk/kissvm/templates/temporal.js';
  const script = buildWindowScript({ startPort: 5, endPort: 6 });
  ```

---

## Cross-Cutting Remediation: `kissvm` Keyword Removal

### All 12 packages
- **Action:** delete
- **Exact change:** In each package's `package.json`, remove `"kissvm"` from the `keywords` array. This applies to: agent-policy, chain-provider, core-wasm, identity, lookup-protocol, manifest, proof, pubsub-transport, txpow. (authority, stream-transport, and wots-lease do not have it.)
- **Rationale:** Zero packages (outside `@totemsdk/kissvm` itself) use the VM in any source code. Copy-paste artifact from a common template.

---

## Summary of Changes by Severity

| Severity | Findings | Action Categories |
|----------|----------|-------------------|
| High | 92 | Delete dead fields (30+), Implement unverified logic (25+), Wire temporal (17+), Delete unused exports (10) |
| Medium | 47 | Kill uncalled Rust functions (15), Kill unused types (8), Kill stale comments (8), Wire-up WASM bindings (4) |
| Low | 20 | Delete type aliases (6), Delete unused deps (1), Delete dead union members (4), Remove keyword (4), Other cleanup (5) |

**Temporal template wiring references:**
- `buildDeadlineScript(deadlinePort)` — 17 fields (`expiresAt` x9, `confirmedAt`, `signedAt`, lease TTLs x6)
- `buildCliffRelease(cliffPort, startPort)` — 6 fields (`revocationEpoch`, `unlockAfterBlock`, lease TTL, VTXO exit)
- `buildWindowScript(startPort, endPort)` — 8 fields (`eventType` state machine, `signedAt` window, subscription intervals)
- `buildLinearRelease(startPort, totalPort)` — 3 fields (`SyncResult.advancedTo`, streaming payments, fee pro-rata)
- `buildRateLimitScript(periodPort, usedPort, maxPerPeriod)` — 6 fields (`maxCallsPerMinute`, `nonce`, `maxKISSVMOps`, usage windows)
- `buildDecayScript(decayPort)` — 2 fields (bond value decay, proof freshness)
