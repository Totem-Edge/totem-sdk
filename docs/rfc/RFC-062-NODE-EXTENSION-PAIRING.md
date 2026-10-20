# RFC-062 — Node/Extension Pairing and Local-Node Provisioning

**Status:** Draft — P1
**Priority:** P1
**Created:** 2026-10-20
**Authors:** Totem SDK Contributors
**Depends on:** RFC-013 (Wallet Self-Hosted Mode), RFC-014 (Wallet Connect Parity), RFC-061 (Custody Enforcement Boundaries), node RFC-0011 (Capability Manifest and MCP), node RFC-0013 (MCP Profile Surface)
**Touches:** `extensions/totem-extension`, `chain-provider`, `wots-lease`, `omnia-relay`, `omnia-host`, `hawk-node` CLI/RPC, pairing and consent storage

> **Positioning.** The extension already lets a user select “My own node” by
> entering an RPC URL, testing it, and consenting. That is functional but fragile:
> users must find the URL, copy credentials, and have no cryptographic way to know
> which node they reached. A `link` command that merely prints a URL is not enough.
> This RFC defines **pairing**: a one-time, fingerprint-pinned exchange that
> provisions a scoped session and, when available, the local lease and Omnia
> relay/coordination endpoints.

---

## 1. Summary

This RFC decides:

1. **The feature is pairing, not linking.** The command is `pair` (optionally
   aliased to `link`), and its output is a one-time pairing invitation, never a
   long-lived credential.
2. **Loopback first, remote explicit.** Pairing listens on `127.0.0.1`/`::1` by
   default. Non-loopback pairing requires explicit opt-in and TLS.
3. **No credentials in URLs or QR codes.** A short-lived one-time code is exchanged
   for a scoped session credential over the pairing channel.
4. **The extension pins the node identity.** The extension verifies and stores the
   node public key/fingerprint, network and genesis hash; a later change fails
   closed and requires re-pairing.
5. **Credentials are scoped and revocable.** Scopes are least-privilege
   (`chain.read`, `chain.submit`, optional `omnia.relay`/`omnia.coordinate`).
   Signing, seed access and node administration are never granted by pairing.
6. **Axia remains a deliberate choice.** Pairing a local node does not silently
   replace Axia. Fallback is explicit, visible and reversible.
7. **The pair command can provision more than an RPC URL.** It can advertise the
   local/hybrid lease path, on-chain watermark endpoint and Omnia relay/host
   endpoint, but only with the same consent and scoping rules.
8. **Custody gates are unchanged.** If the paired node can also sign (hosted
   mode), RFC-061 disclosure/2FA rules apply; pairing never implies signing
   authority.

---

## 2. Motivation

### 2.1 The current flow is manual and unauthenticated

The extension supports:

- `chain.mode = 'axia' | 'minima-rpc'` with `minimaRpcUrl`;
- `lease.mode = 'axia' | 'local' | 'hybrid'`;
- a consent registry that records the user-approved node URL and fails closed if
  the persisted URL is not consented.

What it does not provide:

- a trusted way to discover the local node;
- proof that the URL belongs to the node the user thinks it does;
- protection against a changed URL, DNS rebinding, or a local impostor;
- a clean way to provision the lease/watermark and Omnia endpoints at the same
  time;
- revocation and audit of linked clients.

### 2.2 “Link” commands tend to leak credentials

A command that prints `http://127.0.0.1:9002?token=...` puts a bearer token into
shell history, screenshots, logs and QR images. The token is usually long-lived.
That is the wrong default for a wallet.

### 2.3 A local node should be a first-class provider

Running a local Minima node should be the safest and best-performing configuration.
It should not require the user to understand RPC ports, CORS, tokens or lease
modes. Pairing is the UX and security layer that makes local-node mode usable
without turning the node into a public signing service.

---

## 3. Goals and non-goals

**Goals**

- One-command pairing from the node plus a guided extension flow.
- Cryptographic node identity, fingerprint pinning and network verification.
- One-time pairing codes and scoped, revocable session credentials.
- Explicit consent for loopback and remote endpoints.
- Provision the chain RPC, lease/watermark and Omnia endpoints the extension needs.
- Preserve the existing manual URL flow as a fallback.
- Keep Axia and local-node modes explicit and reversible.

**Non-goals**

- Granting transaction-signing or seed access from pairing.
- Replacing RFC-061's custody/2FA gates for a hosted signer.
- A public node directory or automatic peer discovery.
- A general-purpose OAuth/identity provider.
- Changing Minima P2P “links” or peer discovery.

---

## 4. Definitions

- **Node identity** — a long-lived public key owned by the node process (or its
  installation), plus network/genesis metadata.
- **Fingerprint** — a human-verifiable digest of the node identity public key.
- **Pairing session** — a short-lived server-side record containing a hashed
  one-time code, allowed extension origin, requested scopes, attempts and expiry.
- **Pairing invitation** — the command output/QR: endpoint, node fingerprint,
  network/genesis hash, optional one-time code and expiry. It is not a credential.
- **Linked node** — a stored extension record: endpoint, node identity, fingerprint,
  network, scopes, credential, consent timestamp.
- **Scoped credential** — a bearer or device-bound token limited to explicit scopes
  and revocable from the node.
- **Local mode** — loopback pairing.
- **Remote mode** — a non-loopback endpoint, requiring TLS and explicit consent.

---

## 5. Decisions

### D1 — `pair`, with `link` as an alias

The node command is:

```text
totem-node pair [--qr] [--json] [--ttl 300] [--scopes chain.read,chain.submit]
```

`link` MAY be accepted as an alias for discoverability, but documentation and
output should say “pair” to avoid confusion with Minima P2P links.

### D2 — Loopback by default

- Bind to `127.0.0.1` and `::1` only.
- Refuse non-loopback binding unless `--listen <addr>` is supplied.
- Non-loopback requires TLS and a second explicit confirmation in the extension.
- Never enable public RPC “just to pair”.

### D3 — One-time code exchange

Pairing is a two-step exchange:

1. The node creates a pairing session:
   - high-entropy code (or short user-typed code plus high-entropy secret),
   - hash stored server-side, never the plaintext,
   - TTL (default 300 seconds, maximum 900),
   - allowed origin (`chrome-extension://<id>`), requested/offered scopes,
   - attempt counter and rate limit.
2. The extension posts the code plus its device public key to the pairing endpoint.
3. On success, the node returns:
   - node identity and fingerprint,
   - network and genesis hash,
   - scoped credential,
   - optional lease/watermark and Omnia endpoint descriptors.
4. The pairing session is consumed; replay fails.

The invitation/QR MAY include the one-time code for UX, but the code is never a
long-lived secret and expires with the session. Long-lived tokens MUST NOT appear
in URLs, QR codes or command output.

### D4 — Node identity and pinning

- Node identity SHOULD be an Ed25519 key persisted with the node installation; if
  unavailable, use the TLS certificate public key.
- `nodeId = base58(sha3_256(publicKey))`; `fingerprint = sha256(publicKey)`.
- The extension displays the fingerprint during pairing and stores it.
- On every cold start and before changing endpoint, the extension fetches the node
  identity and checks fingerprint, network and genesis hash.
- A mismatch disables the linked node and prompts re-pairing. It MUST NOT silently
  update the stored identity.
- Remote mode additionally pins the TLS certificate fingerprint.

### D5 — Scoped, revocable credentials

Offered scopes:

| Scope | Allows |
|---|---|
| `chain.read` | tip, coins, balances, token info |
| `chain.submit` | submit an already-signed TxPoW |
| `omnia.relay` | connect to the local Omnia relay/WebSocket |
| `omnia.coordinate` | call the local Omnia host prepare/read API (never sign) |

Forbidden scopes:

- `sign` / raw digest signing;
- seed/key export;
- node admin, peer management, shutdown;
- direct `txnmine`/transaction construction that can bypass Omnia intents.

Credentials MUST be:

- random, hashed at rest;
- bound to the extension device public key and origin;
- scoped and expiring (short access token plus rotation, or a long-lived token with
  rotation and revocation — see open questions);
- revocable via `totem-node pair list` / `pair revoke <id>`;
- audited on issue, use, rotation and revocation.

### D6 — Extension consent and fail-closed changes

- Pairing shows endpoint, node identity, fingerprint, network/genesis, requested
  scopes and lease/Omnia endpoints.
- The user explicitly confirms; the result is stored in the existing consent
  registry, extended with node id/fingerprint.
- Changing endpoint, fingerprint, network or scopes requires re-consent.
- A failed identity/network check leaves the node disabled; the extension does not
  fall back to Axia unless the user explicitly selects it.
- Manual URL entry remains available for advanced users, using the same checks.

### D7 — Axia coexistence

- Axia remains the default until the user selects a local node.
- Selecting a local node is explicit and reversible.
- The extension MUST NOT silently fall back to Axia when the local node is down,
  misconfigured or unpaired. It shows an error and offers “Use Axia” as a user
  action.
- Lease mode is selected explicitly (`axia`, `local`, `hybrid`); pairing may
  recommend a mode based on node capabilities but cannot enable it silently.

### D8 — Provisioning lease, watermark and Omnia endpoints

The pairing response may include:

```ts
interface PairedNodeCapabilities {
  chain: { rpcUrl: string; network: string; genesisHash: string };
  lease?: {
    modes: Array<'local' | 'hybrid'>;
    onchainWatermarkUrl?: string;
  };
  omnia?: {
    relayUrl?: string;
    hostControlUrl?: string;
    transportPubkey?: string;
  };
}
```

- All endpoints are consented and fingerprinted as part of the same pairing.
- `omnia.coordinate` exposes prepare/read operations only; signing remains with the
  wallet or the RFC-061 hosted signer.
- If the node is a hosted signer, pairing does not grant signing; RFC-061 2FA and
  disclosure gates apply.

### D9 — Revocation and audit

The node keeps a durable record per linked client:

```ts
interface LinkedClient {
  clientId: string;
  extensionOrigin: string;
  devicePublicKey: string;
  scopes: string[];
  createdAt: number;
  lastUsedAt: number;
  expiresAt?: number;
  revokedAt?: number;
}
```

Audit events: pairing start/success/failure, code expiry, scope denial, identity
change, token rotation/revocation, and remote-mode use. Codes, tokens and device
private keys are never logged.

---

## 6. Pairing protocol

### 6.1 Sequence

```text
Node CLI                         Extension
   |  pair (create session)          |
   |------------------------------->|  QR/deep link or code
   |                                |  user reviews endpoint/fingerprint
   |<--- POST /pair/v1/complete ----|  code + device pubkey + scopes
   |  verify code/origin/scopes     |
   |  consume session               |
   |--- node identity + token ----->|
   |                                |  pin identity, store consent
   |<--- GET /v1/identity ----------|  verify fingerprint/genesis
   |--- identity ------------------->|
   |                                |  enable local node
```

### 6.2 Endpoints

Illustrative, versioned:

- `GET /pair/v1/info?code=...` — non-secret metadata for the confirmation screen
  (node name, fingerprint, network, scopes). The code may be in the query only for
  this short-lived info call; the exchange itself uses POST.
- `POST /pair/v1/complete` — one-time exchange; body includes code, device public
  key, extension origin, requested scopes.
- `GET /node/v1/identity` — pinned identity/network data for revalidation.
- `POST /pair/v1/rotate` — rotate a session credential using the device key.
- `POST /pair/v1/revoke` — local operator action or authenticated client revoke.

All state-changing endpoints require `Origin`/`Host` validation, CSRF protection and
rate limiting. GET must never complete pairing.

### 6.3 Failure modes

| Failure | Result |
|---|---|
| Wrong/expired code | generic failure, attempt counted |
| Replayed code | rejected; session already consumed |
| Origin mismatch | rejected |
| Fingerprint or genesis mismatch | linked node disabled; re-pair required |
| Scope not offered | rejected |
| Node unreachable after pairing | explicit error; no silent Axia fallback |
| Token revoked | 401; extension prompts re-pair |

---

## 7. UX

### Node

```text
$ totem-node pair --qr
Pair this node with your Totem extension

Node:        home-minima
Network:     mainnet
Fingerprint: 8f3c 91a2 77de 0b41
Endpoint:    http://127.0.0.1:9002
Expires:     4m 58s

[QR]  totem://pair?node=...&fp=...&code=...
Code: 7K4P-2M9Q

Waiting for the extension…
```

`--json` returns the same fields for tooling; it never returns the session token.

### Extension

1. “Connect local node” → scan/paste invitation.
2. Confirmation screen: node name, fingerprint, network/genesis, endpoint, scopes,
   lease/Omnia endpoints, warnings.
3. Explicit “Pair” action.
4. Success screen with “Test connection” and “Revoke”.
5. Settings shows the linked node, last check, fingerprint, scopes and revoke.

---

## 8. Threat model

| Threat | Mitigation |
|---|---|
| Local impostor node | fingerprint verification and pinning |
| DNS rebinding / malicious web origin | loopback bind, Host/Origin allowlist, no wildcard CORS |
| Pairing code theft | short TTL, hashing, single use, rate limit, attempt cap |
| Token leak via URL/log/QR | tokens never in URLs/QR; code only, short-lived |
| Replay of pairing response | one-time session; device-bound credential |
| Stolen extension token | scoped, revocable, origin/device-bound, short expiry/rotation |
| Node identity swap | fingerprint/genesis mismatch disables node; re-pair required |
| Silent provider downgrade | explicit Axia/local choice; no automatic fallback |
| Pairing grants signing | no sign/admin scopes; RFC-061 applies to hosted signing |
| Remote plaintext exposure | TLS + certificate pin; explicit opt-in only |

---

## 9. Work plan

### Phase A — Node pairing core (3–4 days)

- Persistent node identity + fingerprint.
- Pairing session store, one-time codes, TTL/attempts/rate limits.
- `/pair/v1/*` endpoints with Origin/Host checks and loopback binding.
- CLI `pair` output (text/JSON/QR), `pair list`, `pair revoke`.
- Tests: expiry, replay, wrong code, origin mismatch, rate limit.

### Phase B — Extension pairing UI and pinning (3–4 days)

- Invitation parser and confirmation screen.
- Device key generation and exchange.
- Consent storage extended with node id/fingerprint/network.
- Cold-start revalidation and fail-closed handling.
- Manual URL flow preserved.
- Tests: pinning, mismatch, revoke, no silent Axia fallback.

### Phase C — Scopes, rotation and audit (2–3 days)

- Scoped credentials, rotation, revocation.
- Durable linked-client records and audit events.
- Node RPC middleware for scope enforcement.
- Tests: scope denial, revoked token, rotation.

### Phase D — Lease/Omnia provisioning (2–4 days)

- Advertise local/hybrid lease and on-chain watermark endpoints.
- Advertise Omnia relay/host prepare/read endpoints.
- Extension consent for each endpoint; no signing scope.
- Tests: capability negotiation, missing capabilities, endpoint change.

### Phase E — Security review and integration (2–3 days)

- DNS rebinding, CSRF, remote TLS pinning, token leakage checks.
- End-to-end loopback pairing on macOS/Linux.
- Documentation and operator runbook.

**Estimate:** 12–18 engineer-days; chain-only MVP (Phases A–C) is ~7–9 days.

---

## 10. Acceptance criteria

1. `totem-node pair` produces a one-time invitation; no long-lived token appears in
   output, URL or QR.
2. Pairing binds to loopback by default; non-loopback requires explicit TLS opt-in.
3. The extension displays and pins node fingerprint, network and genesis hash.
4. A changed endpoint/fingerprint/network disables the node and requires re-pairing.
5. Credentials are scoped; `sign`, seed export and admin scopes cannot be granted.
6. `pair revoke` invalidates the credential and the extension fails closed.
7. Pairing can provision chain RPC, lease/watermark and Omnia endpoints with
   explicit consent, without granting Omnia signing authority.
8. Local-node failure never silently falls back to Axia.
9. Existing manual URL + consent flow remains functional.
10. Negative tests cover replay, expiry, origin mismatch, DNS rebinding, token
    leakage and fingerprint changes.

---

## 11. Open questions

1. **Code in QR:** include the one-time code for UX, or keep the QR code-free and
   require a short typed code?
2. **Credential format:** opaque bearer token bound to a device key, signed
   capability token, or mutual TLS with the device certificate?
3. **Node identity key:** dedicated Ed25519 key vs existing node identity vs TLS
   certificate only?
4. **Remote pairing:** allow it at all in the first release, or loopback-only until
   TLS pinning is audited?
5. **Multiple nodes:** one active linked node, or named profiles with explicit
   selection?
6. **Omnia capabilities:** should `omnia.coordinate` be part of the first pairing
   release or a follow-on after RFC-061's MCP/host policy is complete?
7. **Extension support:** Chromium-only first, or Firefox parity in the same phase?

---

## 12. Out of scope

- Public node discovery or mDNS advertising.
- Granting transaction signing or hosted custody from pairing.
- Axia decommissioning.
- Changing Minima P2P links/peer discovery.
- MCP exposure of pairing or node administration.

---

## 13. References

- RFC-013 — Wallet Self-Hosted Mode
- RFC-014 — Wallet Connect Parity
- RFC-061 — Custody Enforcement Boundaries: Hosted Signing, MCP, and Direct Node Execution
- node RFC-0011 — Node Capability Manifest and MCP
- node RFC-0013 — MCP Profile Surface
