# RFC-068 — Omnia Onion Forwarding and Blinded Receiving Paths

**Status:** Proposed — implementation not started; authenticated onion profile
**Priority:** P1 (privacy and routing)
**Created:** 2026-10-21
**Authors:** Totem SDK Contributors
**Depends on:** RFC-035 (peer coordination), RFC-048 (Omnia primitives), RFC-055 (routing architecture), RFC-064 (off-chain principles)
**Touches:** `omnia-router`, transport and peer-coordination code
**Proposes:** Completion of the existing routing-envelope seam. It does not
authorise a new package, a new transport or a post-quantum confidentiality claim
until this RFC is accepted.

---

## 1. Problem

Omnia already has an opaque `routingEnvelope` and a `RoutingEnvelopeCodec`
interface. The implemented codec is cleartext. The seam is an extension point, not
a confidentiality guarantee.

A machine's payment graph can expose customers, suppliers, facility structure or
operating schedules even when monetary state is off-chain. Onion forwarding
restricts what each intermediary learns. Blinded receiving paths can conceal parts
of the receiving topology.

Confidential forwarding instructions are not traffic-analysis resistance. They do
not hide timing, message sizes, adjacent-peer correlation or on-chain settlement.

---

## 2. Scope

### 2.1 In scope

- Versioned authenticated per-hop payloads.
- A classical onion profile behind the existing codec interface.
- Replay handling, bounded packet size and error confidentiality.
- Receiver hints and capability negotiation.
- Blinded receiving paths where they fit the existing message model.
- Failure packets and retry behaviour.

### 2.2 Out of scope

- Traffic-analysis resistance claims.
- A new transport.
- A post-quantum or hybrid confidentiality claim without a separately reviewed
  construction.
- Trampoline or outsourced route computation.
- A production privacy claim before independent review.
- A new package.

---

## 3. Current baseline

- `packages/omnia-router/src/forward.ts` defines the opaque envelope and the
  cleartext codec.
- `packages/omnia-router/src/index.ts` documents the onion seam as future work.
- WOTS authenticates financial commitments. It does not make an elliptic-curve
  transport or onion key exchange post-quantum confidential.

The current cleartext profile remains valid for known-counterparty and test
deployments, but it MUST NOT be described as private.

---

## 4. Crypto profiles

Capabilities MUST be versioned identifiers, for example:

- `omnia.routing.onion.classical.v1`
- `omnia.routing.blinded.classical.v1`

A candidate classical profile may use X25519 for per-hop key agreement and an
AEAD for payload confidentiality and integrity. The exact construction, nonce
rules, key derivation, domain separation and error encoding require cryptographic
review before implementation.

A post-quantum or hybrid profile is separate:

- it MUST name its KEM/signature and AEAD construction;
- it MUST publish size and runtime budgets;
- it MUST NOT inherit "post-quantum" from the WOTS settlement layer.

Unsupported or unknown profiles MUST fail closed.

---

## 5. Protocol

### 5.1 Route construction

1. The sender obtains a route and the recipients' onion public keys.
2. The sender builds per-hop payloads from the receiver backwards.
3. Each hop receives only its next-hop instruction, amount, expiry and the
   encrypted remainder.
4. The envelope binds the payment/HTLC identity, protocol version and crypto
   profile.
5. The sender sends only the outer payload to the first hop.

### 5.2 Per-hop processing

Each hop MUST:

- verify the envelope version, profile and replay domain;
- decrypt only its own payload;
- validate the instruction against its live channel state;
- forward only the declared next payload;
- return a failure packet that does not reveal the downstream route.

### 5.3 Blinded receiving paths

A blinded path MAY hide the receiver's full route from the sender and
intermediaries. It MUST bind:

- the receiver's identity or a blinded receiver ID;
- path expiry;
- the introduction point;
- the encrypted path material;
- the payment/HTLC identity;
- the crypto profile.

Blinded paths are not a substitute for route revalidation or liquidity checks.

### 5.4 Failure handling

- Failure packets MUST be authenticated or bounded so a malicious peer cannot
  induce unbounded retries or information disclosure.
- A hop that cannot decrypt MUST fail without revealing whether the failure was
  due to a bad payload, an unknown profile or a downstream condition.
- The sender MUST cap retries and route attempts.
- A failure MUST NOT undo an already committed payment.

---

## 6. Invariants

1. A forwarding peer cannot recover the full downstream route from its own view.
2. A payload cannot be replayed in a different payment, profile or epoch.
3. A hop cannot redirect funds by changing the downstream instruction.
4. An unknown or unsupported crypto profile fails closed.
5. Packet size, hop count and processing time are bounded.
6. Failure packets do not disclose more route information than the selected
   profile permits.
7. A blinded path still verifies against live channel state before forwarding.

---

## 7. Failure and adversarial cases

Tests MUST cover:

- a malicious intermediary attempting to recover the route from its payload;
- colluding adjacent peers;
- replayed envelopes and cross-payment replay;
- malformed, truncated and oversized payloads;
- unknown or downgraded crypto profiles;
- failure packets at each hop;
- a blinded path with an expired introduction point;
- route changes after construction;
- retry storms and duplicate deliveries;
- a hop that returns a different amount or expiry than instructed.

---

## 8. Evidence and acceptance

### 8.1 Required evidence

- A real multi-hop forwarding run, not only a unit test with mock peers.
- A documented crypto profile with test vectors.
- A test showing that an intermediary cannot recover the full route from its own
  protocol view.
- Failure-packet tests that do not leak the downstream route.
- Size, CPU and latency measurements for 2, 5 and 10 hops.
- A clear statement that the classical profile is not post-quantum confidential.

### 8.2 Promotion gate

The profile may be called "private forwarding" only within its stated scope. It
may not be called "anonymous", "traffic-analysis resistant" or "post-quantum"
without separate evidence. Production labelling requires RFC-063 gates and
cryptographic review.

### 8.3 Kill criterion

Stop or redesign if:

- the selected construction cannot prevent a forwarding peer from recovering the
  full route;
- failure packets leak the downstream route;
- the overhead makes the profile unusable on the target edge class;
- a PQ claim depends on an unreviewed construction.

---

## 9. Metrics

- payload bytes per hop and total packet size;
- construction and per-hop processing time;
- p50/p95/p99 forwarding latency;
- failed/retried routes;
- CPU and memory on the target edge class;
- route information recoverable by a single peer and by colluding adjacent peers;
- behaviour under loss, reordering and duplicate delivery.

---

## 10. Open questions

1. Which classical AEAD/KEM construction and nonce discipline pass review?
2. Is a blinded path required for the first product, or is per-hop confidentiality
   sufficient?
3. How are onion keys discovered and rotated?
4. What is the maximum hop count and packet size for constrained edge devices?
5. Should a hybrid PQ profile be designed now, or only after the classical profile
   is stable?

---

## 11. Non-goals

- Anonymity or traffic-analysis resistance.
- A new transport.
- A PQ confidentiality claim by association with WOTS.
- Trampoline routing.
- A new package.
