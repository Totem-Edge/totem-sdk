[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / OmniaPoolAllocationContext

# Interface: OmniaPoolAllocationContext

## Properties

### factory?

> `optional` **factory?**: [`FactoryExecutionPort`](FactoryExecutionPort.md)

Execute channel factory operations.

***

### leaseProvider?

> `optional` **leaseProvider?**: `WotsLeaseProvider`

WOTS lease provider used for per-signing key reservations.

***

### loadChannel?

> `optional` **loadChannel?**: (`channelId`) => `Promise`\<`OmniaChannel`\>

Materialize a live Omnia channel from its id. Default impl reads a stored
channel snapshot via `recoverChannel(deserializeChannelSnapshot(snapshot))` —
see `createChannelLoader`. The allocation/withdrawal path calls
`loadChannel(position.omniaChannelId)` instead of requiring the caller to
inject the live object.

#### Parameters

##### channelId

`string`

#### Returns

`Promise`\<`OmniaChannel`\>

***

### omnia?

> `optional` **omnia?**: [`OmniaExecutionPort`](OmniaExecutionPort.md)

Execute direct Omnia channel operations.

***

### router?

> `optional` **router?**: [`RouterExecutionPort`](RouterExecutionPort.md)

Execute router channel graph operations.

***

### saveChannelSnapshot?

> `optional` **saveChannelSnapshot?**: (`channel`) => `void` \| `Promise`\<`void`\>

Persist a channel snapshot after create/update/close so it can be reloaded later.

#### Parameters

##### channel

`OmniaChannel`

#### Returns

`void` \| `Promise`\<`void`\>

***

### signer?

> `optional` **signer?**: [`PoolSigner`](PoolSigner.md)

Lease-backed signer aligned with Omnia's `ChannelSigner` (WOTS + signing indices).

***

### splice?

> `optional` **splice?**: [`SpliceExecutionPort`](SpliceExecutionPort.md)

Execute splice operations.

***

### vtxo?

> `optional` **vtxo?**: [`VtxoExecutionPort`](VtxoExecutionPort.md)

Execute VTXO pool operations.
