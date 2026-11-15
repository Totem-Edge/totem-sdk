# Edge mesh threat model (RFC-063 P1)

Scope: `@totemsdk/edge-mesh` — fragmentation, reassembly, store-and-forward and
the length-prefixed bridge framer. This package is a **parsing and relaying
layer**. It carries bytes another party controls, over a radio link other people
can hear and jam.

## Assets

| Asset | Why it matters |
|---|---|
| Relay queue | Bounded memory; overflow drops other people's frames |
| Pending reassembly table | Unbounded growth is a remote OOM |
| Dedupe cache | Loops and replays amplify traffic |
| Hop counter | Without a budget, a frame circulates forever |
| Downstream node | A relay hands bytes to a node that trusts the bridge |

## Adversaries

1. **Passive radio eavesdropper** — reads everything; nothing here is encrypted.
2. **Malicious peer** — sends arbitrary bytes, replays, forges header fields.
3. **Flooder** — maximizes queue/table pressure with valid-looking packets.
4. **On-path attacker** — modifies, reorders or truncates fragments.

Sybil and routing attacks are **out of scope here**: this layer has no identity,
no routing table and no per-hop accounting. Those belong to the layer that
chooses `MeshLink`s.

## Threats and mitigations

| ID | Threat | Mitigation | Residual |
|---|---|---|---|
| T1 | Malformed header (magic, version, `seq >= total`, short packet) | `decodeHeader` refuses; `Reassembler` reports the reason via `onReject` | None beyond the drop itself |
| T2 | Bit flips / corruption | CRC-16/CCITT on each fragment | **CRC is not authentication.** 1 in 65 536 random corruptions pass; an attacker can forge a valid CRC trivially |
| T3 | Fragment flood (many `msgId`s) | `MAX_PENDING_MESSAGES` = 32, evict smallest id | Attacker can churn the table and starve honest traffic |
| T4 | Oversized frame (`total` forged to 65 535) | `MAX_FRAME_BYTES` = 1 MiB per message; slot dropped and reason reported | Up to 1 MiB per in-flight message × 32 slots |
| T5 | Replay / duplicate | `StoreAndForward.seenUntil` with `frameHash` (FNV-64) + TTL | FNV is **not collision-resistant**; a chosen collision bypasses dedupe |
| T6 | Queue exhaustion | Byte-bounded queue, drop-oldest | An attacker with valid frames can evict honest ones |
| T7 | Length-prefix bomb on the bridge | `MAX_STREAM_FRAME` = 8 MiB; `InvalidStreamFrameError`; buffer reset | One 8 MiB allocation before rejection |
| T8 | Hop exhaustion / loop | `maxHops` budget in `StoreAndForward`; hops carried in the header and incremented by the relay | No incentive or authentication: a peer can reset the counter when re-fragmenting |
| T9 | Injection into the node | None at this layer | **The payload must be authenticated above this layer** (TxPoW proof-of-work, Omnia signatures, or an application signature) |
| T10 | Traffic analysis | None | Metadata is exposed by design |

## What this layer does not provide

- **Confidentiality.** Anything carried is readable by anyone in range.
- **Authenticity.** A frame is not attributable to a peer. CRC detects accidents,
  not adversaries.
- **Replay resistance across relays.** Dedupe is per-process and TTL-bounded.
- **Fairness.** A flooder can fill the queue and the pending table.

Anything carrying value or authority must be signed and verified above this
layer. For block and TxPoW propagation the payload already carries
proof-of-work; for Omnia messages the channel signature is the authority.

## Requirements this places on callers

1. Verify the payload's own signature before acting on it.
2. Treat `hops` as a hint, not a trust signal.
3. Size the queue for the bearer: BLE and LoRa have very different duty cycles.
4. Count rejects (`onReject`) — a rising `crc`/`bad-magic` rate is a broken or
   hostile peer, not a quiet link.

## Evidence

- Unit: `tests/unit/edge-mesh/src/__tests__/fuzz.test.ts` (10 000+ hostile
  buffers, forged `total`, bit flips, duplicates, random stream chunking).
- Integration: `tests/qualification/edge-mesh/integration.test.mjs`
  (conformance vectors, two-relay path with dedupe and hop budget, independent
  CRC cross-check).
