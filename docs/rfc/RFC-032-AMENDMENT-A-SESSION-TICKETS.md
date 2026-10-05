# RFC-032 Amendment A — Lookup Session Tickets (P5 Plan)

**Status:** Landed (TypeScript) — T0–T3 complete, T4 partial (node identity watermark persisted; ticket table is in-memory), T5 covered by unit + E2E tests. Go mirrors not updated.
**Created:** 2026-10-02 · **Amends:** RFC-032
**Touches:** `@totemsdk/lookup-protocol`, `@totemsdk/lookup-client`, `@totemsdk/lookup-node`
**Depends on:** RFC-032 (lookup-stack post-quantum identity)

> RFC-032 shipped a **hard switch** to per-message WOTS authentication. Every
> authenticated message consumes **one TreeKey use**. A TreeKey has 262,144 uses,
> so a chatty client (subscriptions, polling, reconnects) burns uses quickly. This
> amendment specifies **session tickets**: establish trust once with WOTS, then
> carry a short-lived, node-signed ticket for subsequent messages — preserving
> post-quantum identity while amortising one-time-key consumption.

---

## A.1 Problem

- **Cost per message.** `lookup-client`'s `Authenticator.stamp` signs every
  outgoing non-liveness message; each signature is one TreeKey use
  (`packages/lookup-client/src/auth.ts`, `identity.ts`). A client polling
  `GET_COINS` once/second exhausts ~86k uses/day.
- **Reconnect churn.** Each reconnection re-registers subscriptions and resumes
  signing; there is no cheaper re-establishment.
- **No server session concept.** The node authenticates every message from the
  envelope alone. There is no "this connection was already proven" fast path.

## A.2 Goals

1. Reduce steady-state WOTS use to **one signature per session**, not per message.
2. Keep the identity that is authenticated the **root/child TreeKey identity**
   (RFC-032), never a separate key.
3. Preserve replay resistance and expiry for both the WOTS proof and the ticket.
4. Keep the node stateless w.r.t. client watermarks (RFC-032 §9 Q1): the ticket
   is node-signed, so the node needs no per-client key-index state.
5. Degrade safely: a node may require WOTS-per-message for high-value operations.

## A.3 Non-goals

- Replacing WOTS for identity establishment.
- A general macaroon/authorization system; tickets authenticate, they do not
  authorize (authority stays in the Edge/policy layer).
- Cross-node ticket portability (tickets are node-scoped).

## A.4 Design

### A.4.1 Flow

```
Client                                                     Node
  │  SESSION_OPEN { identity, nonce, expiresAt, proof? }     │
  │      (one WOTS signature over authDigest)                │
  │ ───────────────────────────────────────────────────────▶ │ verify WOTS + replay-guard
  │                                                          │ mint ticket (node WOTS)
  │  SESSION_TICKET { ticketId, expiresAt, maxRequests,      │
  │                   subject: rootPublicKey, nodeId, sig }  │
  │ ◀─────────────────────────────────────────────────────── │
  │  GET_COINS { ticketId, seq }            (no per-msg WOTS)│
  │ ───────────────────────────────────────────────────────▶ │ verify ticket + seq
  │  ...                                                     │
  │  (ticket expires or maxRequests reached → SESSION_OPEN)  │
```

### A.4.2 New messages (`lookup-protocol` v2 additive)

```ts
export interface SessionOpenMessage extends BaseMessage {
  type: 'SESSION_OPEN';
  // Reuses the existing `auth` envelope for the one WOTS proof.
  payload: { ttlMs?: number };
}

export interface SessionTicketMessage extends BaseMessage {
  type: 'SESSION_TICKET';
  payload: {
    ticketId: string;
    subject: string;        // rootPublicKey the ticket is bound to
    nodeId: string;
    issuedAt: number;
    expiresAt: number;
    maxRequests: number;
    /** Node WOTS signature over canonicalJson(payload minus signature). */
    signature: string;
  };
}

export interface SessionCloseMessage extends BaseMessage {
  type: 'SESSION_CLOSE';
  payload: { ticketId: string };
}
```

Authenticated requests gain an optional ticket reference:

```ts
interface BaseMessage {
  // …
  auth?: WotsAuthEnvelope;          // full WOTS proof (establishment / high-value)
  ticket?: { ticketId: string; seq: number };  // amortised path
}
```

### A.4.3 Ticket verification (node)

A request is accepted when **either**:

- it carries a valid `auth` envelope (existing RFC-032 path), **or**
- it carries a valid `ticket`:
  1. ticket signature verifies against the node's own WOTS identity,
  2. `subject` matches a session that presented a valid WOTS `SESSION_OPEN`
     (or the ticket is self-contained and its `subject` is accepted as the
     authenticated principal),
  3. `expiresAt` not passed and `seq ≤ maxRequests`,
  4. `seq` is strictly greater than the last seen for that ticket (replay).

The node stores tickets in a bounded, expiring table (in-memory for a single
process; the existing SQLite `SqliteStore`/`kv_store` for durability across
restart). No client key-index state is needed.

### A.4.4 Ticket minting (node identity)

Reuse the RFC-032 node WOTS/TreeKey identity already used for lease
certificates (`lookup-node/src/lease.ts`). One node signature per ticket. Node
identity must be stable across restarts for tickets to survive (persist its
watermark; see RFC-032 §9 Q1).

### A.4.5 Client behaviour

- On connect, `Authenticator` performs **one** `SESSION_OPEN`; caches the ticket.
- Subsequent messages use `ticket: { ticketId, seq }`; `seq` is a monotonic
  counter local to the client (the ticket's anti-replay value).
- On `SESSION_TICKET` expiry, `maxRequests` exhaustion, reconnect, or a node
  `TICKET_REQUIRED`/`SESSION_EXPIRED` error, re-open with one WOTS signature.
- High-value operations may be configured to always use `auth` (WOTS-per-message).

### A.4.6 Failure modes

| Case | Behaviour |
|---|---|
| Ticket expired | Node returns `SESSION_EXPIRED`; client re-opens (1 WOTS use). |
| Ticket replayed | `seq` monotonicity ⇒ `AUTH_REPLAY`; no identity accepted. |
| Forged ticket | Node WOTS signature fails ⇒ reject. |
| Node restarted, ticket table lost | `SESSION_EXPIRED`/`UNKNOWN_TICKET`; client re-opens. |
| Node identity watermark lost | **Unsafe** — must persist, else the node could reuse a leaf. Fails closed if it cannot load its watermark. |
| Client watermark lost | Same as RFC-032: `restoreWatermarkState` is forward-only; lost state must not rewind. |

## A.5 Security considerations

- Tickets are **not** an authority token. RFC-017/Edge policy still governs
  consequential actions; a ticket only proves "this connection is the identity
  that completed SESSION_OPEN".
- Ticket signature uses the **node's** WOTS identity; a compromised node can
  forge tickets, but that node already holds the client's proof. Scope tickets to
  a short TTL to bound exposure.
- `maxRequests` + TTL bound the value of a stolen ticket. Consider binding a
  ticket to a transport-level peer id (e.g. Hyperswarm connection) so a ticket
  cannot be lifted to another connection.
- WOTS-per-message remains available and should be mandatory for
  `LEASE_*`, `BROADCAST_TXPOW`, and `TRUST_RECORD`.

## A.6 Compatibility

- Additive to `lookup-protocol` v2: new message types + optional `ticket` field.
  Nodes/clients that do not implement tickets keep using per-message `auth`.
- No change to the RFC-032 `auth` envelope or digest.

## A.7 Implementation plan

| Phase | Work | Gate |
|---|---|---|
| **T0** | `lookup-protocol`: `SessionOpen/Ticket/Close`, `ticket?` on `BaseMessage`, ticket canonical digest. | Unit: encode/decode; ticket digest vectors. |
| **T1** | `lookup-node`: ticket table (bounded/expiring), `SESSION_OPEN` → mint, ticket verify path, `seq` replay; node-WOTS minting. | Unit: mint/verify/expire/replay/forged. |
| **T2** | `lookup-client`: one `SESSION_OPEN` on connect; ticket cache; `seq`; re-open on expiry; `auth`-mandatory allowlist. | Unit: one WOTS use per session; re-open on expiry. |
| **T3** | Policy: per-message-type requirement (`auth` required vs ticket-allowed). | Unit: `LEASE_*`/`BROADCAST_TXPOW` reject ticket-only. |
| **T4** | Durability: persist node ticket table (SQLite `kv_store`) and node identity watermark; restart behaviour. | Unit: restart preserves tickets; lost identity fails closed. |
| **T5** | Adversarial + E2E: ticket replay, cross-connection lift, watermark reuse, expiry storm, downgrade to WOTS. | Adversarial green; E2E over v2. |

## A.7a Implementation status (TypeScript)

Shipped (tests green: protocol 21, client 29, node 60):

- **T0** `lookup-protocol`: `SESSION_OPEN`/`SESSION_TICKET`/`SESSION_CLOSE` messages, `SessionTicket` + `SessionTicketRef`, `ticket?` on `BaseMessage`, `sessionTicketDigest` (domain-separated); `authDigest` strips `ticket`.
- **T1** `lookup-node`: `NodeIdentity` (WOTS/TreeKey, signs+verifies tickets), `SessionTicketStore` (lifetime, `maxRequests`, per-ticket `seq` monotonicity, revocation, subject binding); `SESSION_OPEN` verifies the envelope, guard-claims the nonce, mints a node-signed ticket.
- **T2** `lookup-client`: `Authenticator` holds a ticket, stamps `ticket: { ticketId, seq }` for non-high-value messages, full WOTS otherwise; `LookupClient({ useSessionTickets: true })` opens one session on connect and re-opens on `SESSION_EXPIRED`/`AUTH_REPLAY`.
- **T3** Per-type policy: `authRequiredTypes` (default `LEASE_*`, `BROADCAST_TXPOW`, `TRUST_RECORD`, `*_ANNOUNCE`, `POLICY_ANNOUNCE`) must carry a full envelope; ticket-only is rejected (`AUTH_REQUIRED`). Mirrored on the client.
- **T4** The node identity's WOTS use counter is persisted to SQLite after each ticket signature and restored forward-only in `start()` (`nodeIdentityUses` override); lost/rewound state fails closed. The ticket table itself is in-memory (bounded/expiring) — durability of live tickets across restart is deferred.
- **T5** Tests: ticket store (budget/expiry/replay/revocation/subject), `NodeIdentity` sign/verify + forged/tampered/different-node rejection, and a node E2E (real WOTS `SESSION_OPEN` → ticket → ticket-authenticated `GET_COINS`, auth-required rejection, replay rejection), plus client amortisation (one `SESSION_OPEN`, monotonic `seq`) and default per-message WOTS.

Not done:
- **Go mirrors** (`lookup-*/go`) still lack WOTS and do not implement tickets.
- Live-ticket durability across restart (T4 remainder).

## A.8 Open questions

- **Q1** Ticket scoping: self-contained (identity in ticket) vs node session table?
  Self-contained is stateless but needs the ticket to encode `subject`; a table
  allows revocation. Proposal: self-contained + short TTL + optional revocation set.
- **Q2** Bind tickets to transport peer identity, or accept ticket-only? Binding is
  safer against theft but complicates reconnect.
- **Q3** Default `maxRequests`/TTL. Proposal: 60s TTL, 1000 requests.
- **Q4** Should `SESSION_OPEN` require the `rootIdentityProof` (address binding),
  or just the WOTS signature? Address binding is only needed when the node cares
  about the Minima address, not for transport auth.
- **Q5** Node identity persistence: reuse `wots-lease` watermark persistence or a
  dedicated node-identity store?

## A.9 References

- `docs/rfc/RFC-032-LOOKUP-STACK-POST-QUANTUM-IDENTITY.md` — §5.3 (replay), §5.4 (tickets), §9 Q1
- `packages/lookup-client/src/{auth,identity}.ts` — `Authenticator`, `LookupIdentity`
- `packages/lookup-node/src/{auth-verify,session,lease}.ts` — verifier, replay guard, node WOTS identity
- `packages/wots-lease` — watermark persistence primitives
