[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / QuorumPeer

# Interface: QuorumPeer

Layer 4 — P2P quorum lease coordination.

`peers` is the set of quorum members this device coordinates with. Each
entry is a transport-agnostic RPC handle: the provider sends the same
LEASE_RESERVE / LEASE_COMMIT / LEASE_BURN wire messages used by the
lookup protocol, so any peer that speaks that protocol can participate
(lookup nodes, other devices, or in-memory test peers).

## Properties

### peerId

> **peerId**: `string`

## Methods

### request()

> **request**(`message`, `timeoutMs?`): `Promise`\<\{ `payload`: `Record`\<`string`, `unknown`\>; `type`: `string`; \}\>

#### Parameters

##### message

###### payload

`Record`\<`string`, `unknown`\>

###### type

`"LEASE_RESERVE"` \| `"LEASE_COMMIT"` \| `"LEASE_BURN"` \| `"LEASE_WATERMARK"`

##### timeoutMs?

`number`

#### Returns

`Promise`\<\{ `payload`: `Record`\<`string`, `unknown`\>; `type`: `string`; \}\>
