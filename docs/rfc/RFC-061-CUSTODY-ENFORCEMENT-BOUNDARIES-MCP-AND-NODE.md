# RFC-061 — Custody Enforcement Boundaries: Hosted Signing, MCP, and Direct Node Execution

**Status:** Draft — P0 follow-on to RFC-058
**Priority:** P0
**Created:** 2026-10-20
**Authors:** Totem SDK Contributors
**Depends on:** RFC-058 (Custody Modes and Disclosure Gate), RFC-039 (Custody Conformance), RFC-038 (VTXO Operator), RFC-037 (Unified WOTS Signatures), RFC-013 (Wallet Self-Hosted Mode), RFC-014 (Wallet Connect Parity), RFC-010 (MASH Policy Wallets), node RFC-0011 (Capability Manifest and MCP), node RFC-0013 (MCP Profile Surface)
**Touches:** `omnia`, `omnia-host`, `omnia-factory`, `omnia-vtxo`, `omnia-pool`, `omnia-splice`, `omnia-relay`, `extensions/totem-extension`, `edge-email`, `hawk-node` command dispatch and MCP server

> **Positioning.** RFC-058 defined custody modes and the browser-extension
> disclosure gate. That gate is necessary but not sufficient: it only protects keys
> held by the extension. A hosted operator, an MCP agent, or a direct node command can
> produce a liquidity commitment without the extension ever seeing it. This RFC makes
> the enforcement boundary explicit: **the custody gate belongs at the signer**, and
> every signing surface must either enforce it or refuse to expose signing.

---

## 1. Summary

This RFC decides:

1. **The signer is the enforcement boundary.** Extension UI is the enforcement point
   for browser-held keys; the host/operator signer is the enforcement point for
   hosted keys. A gate that exists only in the extension is not a control for
   MCP or direct node execution.
2. **Acknowledgements are portable and disclosure-bound.** An acknowledgement is
   valid only for the exact `disclosureId` (mode + disclosure hash + version +
   material terms) and cannot be replayed under different terms.
3. **Hosted `omnia-host` emits hosted `SignRequest`s and signs through a
   `SignerPort`.** The prepare/submit flow is not allowed to fall back to
   `makeSelfCustody()` or to a local seed when `custody.mode = 'hosted'`.
4. **MCP is prepare-first and never a raw signing surface.** Omnia MCP tools expose
   unsigned intents (`prepare*`) by default. Submitting requires an externally
   produced signature or an operator policy decision; raw `sign`, unrestricted
   `txnmine`, and unaudited transaction submission are not exposed.
5. **Direct node signing is guarded at command dispatch.** In hosted mode, commands
   that can sign or move value are denied unless they pass the custody policy. Raw
   node signing is an operator-only path, not a user-funds path.
6. **Every decision is auditable.** A hosted signature records the operation, the
   disclosure hash/version, the acknowledgement id, the policy decision, and the
   signer identity.
7. **Self-custody is unchanged.** A local-seed, self-custody host is the operator's
   own key; no hosted disclosure is required, but an audit trail is retained.
8. **Money-moving node/MCP actions require a second factor.** Password/API-token
   auth is not sufficient for hosted signing, key rotation, or recovery.
9. **edge-email is a recovery notification channel, not a recovery authority.**
   Email reset links are single-use, short-lived and never sufficient alone to
   reset 2FA.

---

## 2. Motivation

### 2.1 The extension gate is one boundary, not the boundary

RFC-058 §8 protects dApp/provider/WalletConnect signatures produced by the
extension. It cannot protect:

- a hosted `omnia-host` that signs with an operator key;
- an MCP server that invokes a node command;
- a node operator using `sign` or a raw transaction command;
- a server-side agent holding a delegated signer.

In those paths the extension never sees the digest or the custody metadata, so
"the extension will warn" is not a security argument.

### 2.2 MCP turns node commands into a remote API

Node RFC-0011 exposes commands through a capability manifest and MCP. Without an
explicit boundary, an MCP client can request any exposed command. If money-moving
commands are exposed, the MCP transport becomes a signing oracle. The MCP surface
must be prepare-first, authenticated, and policy-gated.

### 2.3 Direct node execution bypasses Omnia intents

`sign` and `txnmine` operate on raw digests/transactions. They do not know about
channel intent, disclosure, or `SignRequest` context. A hosted deployment cannot
claim the disclosure gate applies if these commands remain callable by a remote
caller.

---

## 3. Goals and non-goals

**Goals**

- Make hosted signing fail closed at the signer for every Omnia mutation.
- Define a portable acknowledgement that can be verified by the extension, host,
  MCP server, and node.
- Expose Omnia MCP tools without exposing a signing oracle.
- Guard direct node signing in hosted mode.
- Provide audit records sufficient to reconstruct who approved what, under which
  disclosure.
- Keep self-custody behaviour and RFC-039's package gate unchanged.

**Non-goals**

- Shipping a KMS/HSM/MPC implementation in the default SDK.
- Building a general-purpose consent framework; scope is liquidity commitments.
- Legal classification of any operator or jurisdiction.
- Changing on-chain custody scripts.
- Replacing node RFC-0011/0013; this RFC adds the custody layer they depend on.

---

## 4. Definitions

- **Signing boundary** — the component that holds or controls key material and
  produces a signature: extension, host `SignerPort`, MCP operator signer, or node
  command signer.
- **Liquidity commitment** — as defined in RFC-058 §4: channel/factory funding,
  splice-in, VTXO mint/deposit, pool deposit/allocate, and positions representing
  that capital.
- **Disclosure id** — stable digest over `mode`, operator identity, jurisdiction,
  disclosure hash/version, policy summary, withdrawal terms and material powers.
- **Acknowledgement** — a record (optionally signed) that a subject acknowledged a
  specific disclosure id.
- **Prepare-only** — a tool/command that builds an unsigned `SignRequest` and never
  produces a signature.
- **Hosted mode** — `custody.mode = 'hosted'` with an explicit operator and
  disclosure; never inferred from a seed being present.

---

## 5. Decisions

### D1 — Enforce at the signer, not at the transport

Every signing surface MUST call the same custody check before producing a
signature:

```ts
assertCustodyAllowsSigning(request: SignRequest, ack?: CustodyAcknowledgement): void
```

- `self`: allowed; no hosted disclosure required.
- `trust-minimised`: requires a valid acknowledgement and the configured mitigation
  metadata.
- `hosted`: requires a complete `CustodyContext`, a matching acknowledgement, and a
  positive policy decision.

Transports (HTTP JSON-RPC, WebSocket, MCP, relay) MUST NOT be the only place the
check runs. A new transport added later inherits the check automatically.

### D2 — Portable acknowledgement

The extension-local acknowledgement from RFC-058 is promoted to a shared schema:

```ts
export interface CustodyAcknowledgement {
  disclosureId: string;        // stable id from RFC-058/061
  disclosureHash: string;
  disclosureVersion: string;
  subjectId: string;           // user/identity/operator subject
  acknowledgedAt: number;
  expiresAt?: number;
  /** Optional proof; required when the ack crosses a trust boundary. */
  signature?: Uint8Array;
  signerPublicKeyDigest?: string;
}
```

Rules:

- The ack is bound to `disclosureId`; a hash/version/terms change invalidates it.
- A host MUST verify the ack against its configured disclosure; it MUST NOT trust a
  caller-supplied "acknowledged: true" boolean.
- When the ack is produced by a user wallet for a remote host/MCP caller, it SHOULD
  be signed by a dedicated acknowledgement key (not a channel-signing leaf) and
  include a freshness window.
- The same ack MAY be reused for the same disclosure until it expires, but never
  across disclosures.
- A hosted signer MUST reject a missing, malformed, expired, or mismatched ack.

### D3 — Hosted host prepare/sign/submit

`omnia-host` currently rejects hosted prepare and emits `makeSelfCustody()` for
self mode. Hosted mode becomes a first-class path:

1. Config supplies operator identity, entity, jurisdiction, key management,
   disclosure hash/version/terms, policy summary and powers.
2. The host builds `context.custody` once and attaches it to every prepared
   `SignRequest`.
3. Prepare methods return requests only when the caller is authorized to see them.
4. Submit either:
   - verifies an externally supplied signature and ack, or
   - calls `SignerPort.sign()` and applies the result.
5. The host MUST NOT fall back to a local seed when hosted signing fails.

`createPolicySignerPort` is extended to require hosted custody, a valid ack, domain
allowlists, amount limits, signer allowlists and an operator authorization hook.

### D4 — MCP is prepare-first

- The Omnia MCP provider (node RFC-0011 Amendment A) exposes `prepare*` tools by
  default: open channel, pay/update, settle, splice in/out, factory opening, VTXO
  receipt, pool operations.
- No MCP tool exposes raw `sign`, arbitrary digest signing, unrestricted
  `txnmine`, or a submit path that can sign on the caller's behalf.
- A `submit*` tool, if enabled at all, accepts an externally produced signature and
  runs the same `assertCustodyAllowsSigning` check. It never supplies the key.
- Every Omnia tool result includes the attached custody context and, when hosted,
  the required disclosure id.
- MCP tools are gated by node RFC-0013 Phase 0 (`node.features` and per-command
  gate), plus caller identity/scope.
- The `omnia-agent` preset is prepare+read only unless an operator explicitly
  enables a policy-approved submit surface.

### D5 — Direct node signing is operator-only

In hosted mode, the node command dispatcher applies a custody guard:

- deny raw `sign` and unrestricted `txnmine`/transaction submission to remote
  callers;
- deny Omnia commands that lack custody metadata or a valid ack;
- allow internal hosting paths only when they call the policy signer;
- record an audit entry for every allow/deny decision.

Self-custody node operators may keep raw signing, but the path is labelled as
operator-only and audited. A hosted deployment must not rely on “the user could
have used the extension” to justify a raw node signature.

### D6 — Audit and reconciliation

Every hosted signature writes an audit record containing:

- operation id, domain, channel/factory/splice/VTXO/pool id;
- disclosure id/hash/version;
- acknowledgement id and subject;
- policy decision (allow/deny, rule id, limits);
- signer identity (operator/KMS key id, not secret material);
- digest and timestamp/result.

Audit records are durable and queryable. In-memory records are insufficient for a
hosted deployment.

### D7 — Fail-closed matrix

| Path | Key holder | Gate |
|---|---|---|
| Extension dApp/provider/WalletConnect | Extension | Disclosure popup + ack (implemented RFC-058) |
| Coordinator host | Wallet | Extension gate on the `SignRequest` |
| Hosted host | Operator `SignerPort` | Custody context + ack + policy port |
| MCP prepare | None | No signature produced |
| MCP submit | Operator/wallet | Same signer check; never a raw key |
| Node raw `sign`/`txnmine` | Node operator | Denied in hosted mode; operator-only otherwise |
| Local-seed self-custody | Operator | No hosted disclosure; audit only |

---


### D8 — Two-factor authentication at the node

2FA protects the operator account and the signing surface, not merely the UI.

**Required for**

- MCP `submit*` / operator-approval actions (prepare/read remains open to scoped
  callers);
- node commands that sign, move value, rotate keys, change custody policy, or
  reset credentials;
- hosted `SignerPort` policy approvals above configured limits;
- operator-console login and recovery settings.

**Methods**

- **TOTP (RFC 6238)** as the baseline; WebAuthn/passkeys preferred where available.
- Recovery codes generated at enrollment and stored hashed.
- No SMS as a primary factor.
- Secrets encrypted at rest (KMS/OS keychain); never logged.

**Enforcement**

- 2FA is verified by the node/host command middleware, not only by the UI.
- A successful challenge issues a short-lived, single-use `MfaAssertion` bound to
  the operation digest, amount, disclosure id and expiry.
- Assertions are consumed by the signer/policy port; replay is rejected.
- Rate-limit challenges, lock after repeated failures, and audit every decision.
- A missing assertion fails closed for money-moving actions.

```ts
interface MfaChallenge {
  challengeId: string;
  purpose: 'sign' | 'submit' | 'key-rotation' | 'recovery' | 'admin';
  operationHash: string;
  disclosureId?: string;
  expiresAt: number;
  attempts: number;
}

interface MfaAssertion {
  challengeId: string;
  method: 'totp' | 'webauthn' | 'recovery-code';
  proof: Uint8Array | string;
  issuedAt: number;
}
```

MCP agents should not receive TOTP secrets. For autonomous agents, use RFC-010
policy-scoped keys with limits; 2FA is reserved for enrollment, policy changes,
key rotation and human-approved submissions.

### D9 — 2FA reset via edge-email

`edge-email` provides an `EmailTransportPort` and gateway; it is deliberately a
transport, not a trust authority. A reset must remain safe if the mailbox is
compromised.

**Enrollment**

- Verify the recovery address at setup (confirmation token).
- Store the address, a hash of the verification, and the reset policy; never store
  the 2FA secret in email.

**Reset flow**

1. The user initiates reset from an authenticated session or a device that still
   holds a valid session.
2. The node creates a high-entropy, single-use token; stores only its hash with a
   short TTL (10–15 minutes), bound to account, request id and source.
3. `edge-email` sends the link/token. The email contains no secret material and no
   signing capability.
4. The link opens the operator console; the reset still requires **one of**:
   - a recovery code,
   - an existing trusted device/session approval,
   - N-of-M operator/admin approval.
5. A cooling-off period (default 24h, configurable up to 72h) applies when the
   second factor is unavailable. Signing and key rotation are disabled for the
   account during cooling-off.
6. On completion, invalidate all sessions, pending MFA challenges, API tokens and
   reset tokens; write an audit event and notify the recovery address and operator
   channels.

**Abuse controls**

- Email alone never completes a reset; it only starts a request.
- Single-use tokens, hashed at rest, constant-time comparison, rate limits,
  anti-enumeration responses, and POST/confirm (not GET) completion.
- Bind the token to the request and source; reject reuse and cross-account use.
- Use SPF/DKIM/DMARC, a dedicated reset domain, and an anti-phishing phrase in the
  email.
- If `edge-email` is unavailable, fall back to recovery codes or operator quorum;
  never disable 2FA.

**Configuration (names illustrative)**

- `NODE_MFA=enabled|required`
- `NODE_MFA_METHODS=totp,webauthn`
- `NODE_MFA_RECOVERY_EMAIL`
- `NODE_MFA_RESET_TTL_SECONDS` / `NODE_MFA_RESET_DELAY_SECONDS`
- `NODE_MFA_REQUIRE_QUORUM`

## 6. Threat model

| Bypass | Required mitigation |
|---|---|
| dApp hides custody metadata | Extension treats missing metadata as self-custody; a hosted host must attach it server-side, not trust the dApp |
| Caller sends `acknowledged: true` | Host verifies ack id/hash/version/freshness (and signature across trust boundaries) |
| Replay ack under a changed disclosure | Ack bound to `disclosureId`; mismatch rejected |
| MCP calls raw signing | Raw signing tools are absent; command dispatch denies them in hosted mode |
| MCP calls submit with arbitrary bytes | Submit verifies intent signature, domain, signers, limits and disclosure |
| Node operator uses `sign` directly | Hosted mode disables remote raw signing; internal use is audited/operator-only |
| Host falls back to `OMNIA_HOST_SEED` | Hosted signing requires `SignerPort`; fallback is a hard error |
| Self-custody mode claims hosted powers | Custody validation rejects operator movement/freeze/discretion in self mode |
| Stolen password/API token signs funds | Money-moving actions require a single-use MFA assertion bound to the operation |
| MFA code replay | Assertions are single-use, expire, and bind operation/amount/disclosure |
| Compromised recovery mailbox resets 2FA | Email only starts reset; recovery code/device/quorum plus cooling-off required |
| Reset link replay or enumeration | Hashed single-use tokens, TTL, rate limits, generic responses, POST completion |

---

## 7. Work plan

### Phase A — Shared schema and acknowledgement (2–3 days)

- Move disclosure validation/id/warnings into `@totemsdk/omnia`.
- Add `CustodyAcknowledgement` + verification helpers.
- Reuse from the extension gate; keep storage/UI in the extension.
- Tests: ack binding, expiry, mismatch, replay.

### Phase B — Hosted host context and policy signer (3–5 days)

- Add hosted custody config and `context.custody`.
- Attach hosted custody to channel/factory/splice/VTXO/pool prepare requests.
- Extend `createPolicySignerPort` with ack verification and policy rules.
- Hosted submit via `SignerPort` or verified external signatures.
- Durable audit store.
- Tests: every mutation rejects missing/mismatched ack; self mode unaffected.

### Phase C — MCP surface (3–4 days)

- Implement node RFC-0011 Amendment A Omnia provider and `omnia-agent` preset.
- Prepare-only tools; no raw signing; authenticated caller scopes.
- Attach custody to responses; reject hosted calls without policy/ack.
- Tests: tool catalog, unsupported/denied cases, submit-without-signature denial.

### Phase D — Node command guard (2–3 days)

- Add custody middleware at command dispatch.
- Hosted mode denies raw `sign`, unrestricted `txnmine` and unaudited submission.
- Audit allow/deny decisions.
- Tests: remote raw sign denied; internal policy signer allowed; self mode unchanged.

### Phase F — Node 2FA and edge-email recovery (7–12 days)

- TOTP enrollment/challenge/assertion and recovery codes (3–4 days).
- Command/MCP middleware + operation-bound assertions (2–3 days).
- edge-email reset request, verification, cooling-off and notifications (3–4 days).
- WebAuthn and N-of-M quorum can follow as a second slice (3–4 days).
- Tests: replay, expiry, email compromise, enumeration, lost-device recovery.

### Phase E — Negative/bypass review and live validation (2 days)

- Adversarial tests across extension/host/MCP/node boundaries.
- Re-run S4/S5/S6/S7/S10 with hosted mode once the Minima node is redeployed.
- Document residual risks and operator runbooks.

**Estimate:** 12–18 engineer-days, or 2.5–3.5 weeks for one engineer.
Phases A+B are the minimum hosted-host deliverable; C is required before Omnia is
exposed over MCP; D can initially ship as “deny raw signing in hosted mode.”

---

## 8. Acceptance criteria

1. A hosted `SignRequest` always carries a complete custody context with
   `disclosureHash` and `disclosureVersion`.
2. A hosted signer refuses a request with no ack, a stale ack, or an ack for a
   different disclosure.
3. The extension and host compute the same `disclosureId` for the same terms.
4. MCP exposes no tool that can sign an arbitrary digest or raw transaction.
5. MCP `submit*` requires a valid external signature/policy decision; it cannot
   silently sign.
6. Hosted node command dispatch rejects remote raw `sign`/unaudited submission.
7. Audit records reconstruct operation, disclosure, ack, policy and signer.
8. Self-custody flows and existing tests are unchanged.
9. Negative tests cover replay, metadata spoofing, expiry, fallback-to-seed and
   cross-transport bypass.
10. Money-moving node/MCP actions without a valid MFA assertion are denied.
11. A reset initiated by edge-email cannot complete with the email token alone and
    invalidates all sessions/tokens on completion.

---

## 9. Open questions

1. **Ack transport:** signed ack token returned by the wallet, or operator-console
   acknowledgement stored server-side? Or both (wallet proof plus operator record)?
2. **Ack key:** root identity key, dedicated acknowledgement key, or operator
   service key?
3. **MCP submit:** permanently prepare-only, or opt-in submit with externally
   signed payloads?
4. **Raw node commands:** deny entirely in hosted mode, or allow for an explicit
   operator allowlist?
5. **Multi-tenant policy:** per-user limits/allowlists in the first pass, or one
   deployment-wide policy?
6. **Audit retention:** local durable store vs exported SIEM/indexer.
7. **2FA scope:** require for all hosted signing, or only above thresholds and for
   admin/key-rotation actions?
8. **Recovery fallback:** recovery codes vs trusted device vs operator quorum, and
   the default cooling-off period?
9. **WebAuthn availability:** can the node assume a browser/operator console, or
   must TOTP be the only universal baseline?

---

## 10. Out of scope

- Extension popup implementation (landed in RFC-058 follow-up).
- Axia watchtower/S11.
- Live on-chain validation until the Minima node is redeployed.
- Legal/compliance classification and marketing language.

---

## 11. References

- RFC-058 — Custody Modes, Non-Custodial Defaults, and the Liquidity Commitment
  Disclosure Gate
- RFC-039 — Custody Conformance
- RFC-010 — MASH Policy Wallets
- node RFC-0011 — Node Capability Manifest and MCP (Amendment A, Omnia provider)
- node RFC-0013 — MCP Profile Surface
- `@totemsdk/edge-email` — IMAP/SMTP gateway and transport port
