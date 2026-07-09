# @totemsdk/lookup-protocol

**The wire protocol spec for the P2P lookup network.**

Defines the complete binary message grammar for communication between `@totemsdk/lookup-node` servers and `@totemsdk/lookup-client` consumers. Import this in both server and client code to share typed message definitions, binary framing, and WOTS-signed message authentication.

## Install

```bash
npm install @totemsdk/lookup-protocol
```

## What's inside

### Message families

| Family | Messages |
|--------|----------|
| **Auth** | `HelloMessage`, `AuthChallengeMessage`, `AuthResponseMessage` |
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

### WOTS-signed message authentication

```typescript
import { messageDigest, signMessage, verifyMessageAuth } from '@totemsdk/lookup-protocol';

// Sign a message with a WOTS key
const digest = messageDigest(msg);
const signed = signMessage(msg, wotsPrivateKey, wotsIndex);

// Verify on the receiving end
const ok = verifyMessageAuth(signed);
```

## See also

- [`@totemsdk/lookup-client`](https://www.npmjs.com/package/@totemsdk/lookup-client) — client that sends/receives these messages
- [`@totemsdk/lookup-node`](https://www.npmjs.com/package/@totemsdk/lookup-node) — server that handles these messages
- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — WOTS primitives used for message auth
