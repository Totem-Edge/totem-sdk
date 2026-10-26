# Totem Wallet — Privacy & Data Practices

This document describes what data the Totem browser extension and Axia backend collect, why, how long it's retained, and what protections are in place.

---

## 1. What the extension collects

The Totem wallet extension operates primarily on the client side. It does not embed any third-party analytics, telemetry SDKs, or tracking libraries (no Sentry, Google Analytics, Amplitude, etc.).

### Data sent to the Axia API

| Data | How it's sent | Purpose |
|---|---|---|
| **RPC method name** | In the request body | Route the call to the correct Minima node |
| **IP address** | Keyed HMAC-SHA-256 server-side before storage (secret key; never a public salt) | Rate limiting and abuse prevention |
| **User-Agent** | Hashed (SHA-256) server-side before storage | Abuse pattern detection |
| **Identity hash** | `x-user-identity-hash` header — SHA3-256 of your root public key, computed client-side | Per-wallet quota tracking so you can see your own usage |
| **Project API key** | `x-api-key` header | Authenticate your project and enforce its rate limits |

### Data that stays on your device

- Seed phrase and private keys (encrypted in extension local storage)
- WOTS TreeKeys and signing indices
- Address book and labels
- UI preferences and settings

### Data never collected

- Raw IP addresses (hashed before storage, original discarded)
- Raw User-Agent strings (hashed before storage, original discarded)
- Your root public key as a quota identifier (the quota header carries only the SHA3-256 hash). The root public key is sent to the WOTS lease/watermark service for signature-safety state (`wots_leases.root_pubkey`) — see §3 for why that limits unlinkability.
- Browsing history or visited URLs
- Clipboard contents
- Interaction with other extensions

---

## 2. Server-side data storage

### project_requests table (API usage logs)

Stores one row per API call for rate limiting and quota enforcement.

| Column | Content | Sensitive? |
|---|---|---|
| project_id | Which project made the call | No |
| method | RPC method name (e.g., `getbalance`) | No |
| status_code | HTTP response code | No |
| duration_ms | How long the call took | No |
| bytes_in / bytes_out | Request/response size | No |
| ip_hash | HMAC-SHA-256 of IP address with a server-held secret | Pseudonymous; the key is rotated and old values expire with the 14-day retention |
| user_agent_hash | SHA-256 of User-Agent | Pseudonymous |
| user_identity_hash | SHA3-256 of root public key | Pseudonymous |

**Retention:** 30 days. Automatically purged by the background cleanup worker.

### wots_leases table (WOTS signature tracking)

Stores which signature indices have been used to prevent catastrophic key reuse.

| Column | Content | Why it's stored |
|---|---|---|
| root_pubkey | Your WOTS root public key | Identifies which key tree the lease belongs to |
| addressIndex, l1, l2 | Signature index coordinates | Tracks exactly which one-time signature was consumed |
| status | LEASED / USED / EXPIRED / CANCELLED | Prevents double-signing |

**Retention:** Permanent. This is a safety requirement, not a choice.

WOTS (Winternitz One-Time Signature) keys are destroyed by use — signing with the same index twice leaks the private key. If this data were purged and your wallet lost its local state, the server would have no way to prevent you from accidentally reusing an index, which would compromise your funds. This data exists to protect you.

### endpoint_health_history table (node health monitoring)

Stores health check results for the Minima node infrastructure.

**Retention:** 14 days. No user-identifying data.

---

## 3. Data isolation guarantees

The server enforces strict architectural boundaries between data domains:

- **project_requests.user_identity_hash** (pseudonymous quota tracking) and **wots_leases.root_pubkey** (cryptographic safety state) are not joined in normal queries. They live in separate code modules with separate data access patterns. This is **defence in depth, not cryptographic unlinkability.**

- The identity hash is a deterministic SHA3-256 of the root public key. It is not a keyed commitment: anyone who can see the root public key can compute the same hash. If both tables are compromised, an attacker can hash each stored `root_pubkey` and compare it with `user_identity_hash` — **no SHA3 reversal or brute force is required.** The hash hides the key only from someone who does not already have a candidate key.

- The same limitation applies to public keys announced on-chain, in manifests, or over P2P: they can be matched against the identity hash without breaking SHA3.

- For true unlinkability the identity header would need to be a keyed, rotating value (for example HMAC-SHA-256 with a separate server secret and an explicit rotation/retention policy), or the server must not store the root public key alongside it. That is a protocol change, not a code-comment guarantee; until then, treat quota identity as pseudonymous, not anonymous.

This separation is enforced at the code level with explicit boundary comments preventing accidental cross-correlation queries, but those comments are not a cryptographic guarantee.

---

## 4. WebSocket connections

### Balance updates

The wallet subscribes to real-time balance updates via WebSocket. The connection sends your wallet addresses to filter relevant updates. Authentication uses a session-scoped token that expires with the connection.

### Announcements

The announcement WebSocket uses topic-based subscriptions only. No wallet-identifying information is sent or required.

---

## 5. What you can do

- **Lock your wallet** to immediately stop sending the identity hash header. The server will still process your RPC calls but cannot attribute them to a specific wallet.
- **View your quota** in Settings to see exactly what usage data the server has associated with your identity hash.
- **Use a different project API key** to start fresh quota tracking under a new project context.

---

## 6. Summary

| Practice | Status |
|---|---|
| Third-party analytics in extension | None |
| Raw IP / User-Agent storage | Never (hashed before storage) |
| Root public key sent to server | Only to the WOTS lease/watermark service (signature safety); never in quota RPCs (quota uses the SHA3-256 hash) |
| API usage log retention | 30 days, then purged |
| WOTS lease data retention | Permanent (signature safety) |
| Cross-correlation of quota and lease data | Prevented in normal queries; **not** a cryptographic guarantee — a party holding both tables can hash `root_pubkey` (see §3) |
| Data sold or shared with third parties | No |
