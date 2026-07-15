# Totem Wallet — Privacy & Data Practices

This document describes what data the Totem browser extension and Axia backend collect, why, how long it's retained, and what protections are in place.

---

## 1. What the extension collects

The Totem wallet extension operates primarily on the client side. It does not embed any third-party analytics, telemetry SDKs, or tracking libraries (no Sentry, Google Analytics, Amplitude, etc.).

### Data sent to the Axia API

| Data | How it's sent | Purpose |
|---|---|---|
| **RPC method name** | In the request body | Route the call to the correct Minima node |
| **IP address** | Hashed (SHA-256) server-side before storage | Rate limiting and abuse prevention |
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
- Your actual root public key (only the SHA3-256 hash reaches the server)
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
| ip_hash | SHA-256 of IP address | Pseudonymous |
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

- **project_requests.user_identity_hash** (pseudonymous quota tracking) and **wots_leases.root_pubkey** (cryptographic safety state) are never joined, correlated, or queried together. They live in separate code modules with separate data access patterns.

- The identity hash is a one-way SHA3-256 hash of your root public key. The server cannot reverse it to learn your actual key. It can count how many requests came from the same wallet, but cannot determine which wallet that is without already knowing the key.

- Even if both tables were compromised, correlating them would require brute-forcing SHA3-256, which is computationally infeasible.

This separation is enforced at the code level with explicit boundary comments preventing future developers from accidentally introducing cross-correlation queries.

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
| Root public key sent to server | Never (SHA3-256 hash only) |
| API usage log retention | 30 days, then purged |
| WOTS lease data retention | Permanent (signature safety) |
| Cross-correlation of quota and lease data | Architecturally prohibited |
| Data sold or shared with third parties | No |
