[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / RelayOmniaOperationsOptions

# Interface: RelayOmniaOperationsOptions

## Properties

### chainProvider

> **chainProvider**: `ChainStateProvider`

Chain provider used to broadcast the funding / settlement TxPoW.

***

### channels

> **channels**: `Map`\<`string`, [`OmniaChannel`](OmniaChannel.md)\>

***

### leaseProvider

> **leaseProvider**: `WotsLeaseProvider`

RFC-013 WOTS lease provider for signing-index allocation.

***

### localParticipant

> **localParticipant**: `ChannelParticipant`

The wallet's own channel participant (party id + WOTS public-key digest).

***

### signer

> **signer**: `ChannelSigner`

Wallet signer (WOTS) — no raw keys leave the wallet.

***

### swarm

> **swarm**: `OmniaSwarm`
