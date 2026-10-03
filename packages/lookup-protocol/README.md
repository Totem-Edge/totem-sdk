# @totemsdk/lookup-protocol

**The wire protocol spec for the P2P lookup network.**

Defines the complete binary message grammar for communication between `@totemsdk/lookup-node` servers and `@totemsdk/lookup-client` consumers. Import this in both server and client code to share typed message definitions, binary framing, and WOTS-signed message authentication.

## Install

```bash
npm install @totemsdk/lookup-protocol
```

## What's inside

### Message families

> **RFC-032 (v2):** authentication is post-quantum. There is no `AUTH_CHALLENGE`/
> `AUTH_RESPONSE` handshake; authenticated messages carry a WOTS `auth` envelope
> (`WotsAuthEnvelope`). This is a hard switch — v1 and v2 peers do not interoperate.

| Family | Messages |
|--------|----------|
| **Liveness** | `HelloMessage`, `PingMessage`, `PongMessage` |
| **Chain queries** | `GetCoinsMessage`, `GetCoinMessage`, `GetProofMessage`, `GetTipMessage`, `GetTokenMessage` |
| **Real-time** | `CoinUpdateMessage`, `WatchRegisterMessage`, `WatchRemoveMessage` |
| **Relay** | `BroadcastTxPoWMessage` |
| **Lease coordination** | `LeaseReserveMessage`, `LeaseCommitMessage`, `LeaseBurnMessage`, `LeaseWatermarkMessage` |
| **App/Agent discovery** | `AppAnnounceMessage`, `AppQueryMessage`, `AgentAnnounceMessage`, `AgentQueryMessage` |
| **Trust** | `TrustRecordMessage`, `TrustQueryMessage` |

### Binary framing

```typescript
import { encodeMessage, decodeMessage, peekFrameLength } from '@totemsdk/lookup-protocol';

// Encode any typed message to a binary frame
const frame = encodeMessage({ type: 'GET_COINS', address: 'Mx...' });

// Peek length before reading full frame (for streaming parsers)
const len = peekFrameLength(buffer);

// Decode binary frame back to a typed message object
const msg = decodeMessage(frame);
```

### WOTS-signed message authentication (RFC-032)

Authentication is hash-based WOTS — quantum-resistant. A signed message carries
an `auth` envelope (`WotsAuthEnvelope`: `rootPublicKey`, `signature`, `nonce`,
`expiresAt`, optional `rootIdentityProof`/`address`). The signature covers
`sha3_256(canonicalJson({type,id,payload}) ‖ nonce ‖ expiresAt)`.

```typescript
import { authDigest, signMessage, verifyMessageAuth } from '@totemsdk/lookup-protocol';

// Sign (async): `sign` is a WOTS signer, `rootPublicKey` is the hex PKdigest.
const signed = await signMessage(msg, wotsSign, rootPublicKey, {
  nonce,        // monotonic anti-replay value (the TreeKey use index)
  expiresAt,    // absolute expiry (epoch ms)
});

// Verify on the receiving end (async): `verify` is a WOTS verifier.
const ok = await verifyMessageAuth(signed, wotsVerify);
```

The lookup-node additionally enforces per-identity nonce monotonicity (replay
rejection) — verification alone is not sufficient because WOTS signatures are
static.

## Post-quantum note

v2 uses WOTS/TreeKey (hash-based) signatures throughout. Ed25519 has been
removed from the lookup stack. See `docs/rfc/RFC-032-LOOKUP-STACK-POST-QUANTUM-IDENTITY.md`.

## See also

- [`@totemsdk/lookup-client`](https://www.npmjs.com/package/@totemsdk/lookup-client) — client that sends/receives these messages
- [`@totemsdk/lookup-node`](https://www.npmjs.com/package/@totemsdk/lookup-node) — server that handles these messages
- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — WOTS primitives used for message auth
