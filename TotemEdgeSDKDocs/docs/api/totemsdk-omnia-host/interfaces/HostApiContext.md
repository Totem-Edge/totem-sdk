[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / HostApiContext

# Interface: HostApiContext

## Properties

### chainProvider?

> `optional` **chainProvider?**: `ChainStateProvider`

***

### channelPeers?

> `optional` **channelPeers?**: `Map`\<`string`, `OmniaPeer`\>

Last authenticated peer seen for each channel; reply over it directly.

***

### channels

> **channels**: `Map`\<`string`, `OmniaChannel`\>

***

### coordinator?

> `optional` **coordinator?**: `boolean`

True when the host has no signer and exposes prepare/submit only.

***

### custodyMode?

> `optional` **custodyMode?**: `CustodyMode`

Deployment custody mode (RFC-058); defaults to self.

***

### factories?

> `optional` **factories?**: `Map`\<`string`, `ChannelFactory`\>

***

### factoryBundles?

> `optional` **factoryBundles?**: `Record`\<`string`, `WotsLeaseBundle`\>

***

### fundingSigner?

> `optional` **fundingSigner?**: (`digest`) => `Uint8Array`\<`ArrayBufferLike`\> \| `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Signs the funding-transaction digest with the funding coin's key, so
openChannel can assemble the funding witness without the caller reproducing
the funding draft. Configured from the node's `sign` command.

#### Parameters

##### digest

`Uint8Array`

#### Returns

`Uint8Array`\<`ArrayBufferLike`\> \| `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### identity?

> `optional` **identity?**: `object`

Opt-in host identity (address, publicKeyDigest, optional delegation).

#### address

> **address**: `string`

#### delegation?

> `optional` **delegation?**: `unknown`

#### identityId?

> `optional` **identityId?**: `string`

#### publicKeyDigest

> **publicKeyDigest**: `string`

***

### leaseProvider?

> `optional` **leaseProvider?**: `WotsLeaseProvider`

***

### localParticipant?

> `optional` **localParticipant?**: `ChannelParticipant`

***

### manifest?

> `optional` **manifest?**: `unknown`

Boot-time signed EdgeServiceManifest.

***

### observe?

> `optional` **observe?**: [`ObservationEmitter`](../classes/ObservationEmitter.md)

Durable observation emitter (optional; behind OMNIA_OBSERVE).

***

### operations?

> `optional` **operations?**: [`OperationStoreLike`](../type-aliases/OperationStoreLike.md)

***

### p2pHubUrl?

> `optional` **p2pHubUrl?**: `string`

RFC-062 loopback P2P hub endpoint, when enabled.

***

### poolPositions?

> `optional` **poolPositions?**: `Map`\<`string`, \{ `allocation?`: `LiquidityAllocation`; `intent?`: `WithdrawalIntent`; `position`: `LiquidityPosition`; `registry`: `LiquidityBondRegistryState`; \}\>

***

### pools?

> `optional` **pools?**: `Map`\<`string`, \{ `manifest`: `LiquidityPoolManifest`; `registry`: `LiquidityBondRegistryState`; \}\>

Liquidity pools and their live registry state.

***

### preparedFactory?

> `optional` **preparedFactory?**: `Map`\<`string`, `PreparedFactoryEntry`\>

Coordinator-mode factory openings awaiting the creator signature.

***

### preparedOpen?

> `optional` **preparedOpen?**: `Map`\<`string`, `PreparedOpenEntry`\>

Coordinator-mode channel openings awaiting the funding signature.

***

### preparedPay?

> `optional` **preparedPay?**: `Map`\<`string`, `PreparedPayEntry`\>

Coordinator-mode prepared channel updates awaiting wallet signatures.

***

### preparedSettle?

> `optional` **preparedSettle?**: `Map`\<`string`, `PreparedSettleEntry`\>

Coordinator-mode cooperative settlements awaiting the local signature.

***

### preparedSplice?

> `optional` **preparedSplice?**: `Map`\<`string`, `PreparedSpliceEntry`\>

Coordinator-mode splices awaiting wallet signatures.

***

### preparedVtxoReceipts?

> `optional` **preparedVtxoReceipts?**: `Map`\<`string`, `PreparedVtxoReceiptEntry`\>

***

### readOnly?

> `optional` **readOnly?**: `boolean`

When true, only read-only methods are registered (no signer material).

***

### refreshRouting?

> `optional` **refreshRouting?**: () => `void`

#### Returns

`void`

***

### routing

> **routing**: [`RoutingProvider`](RoutingProvider.md)

***

### signer?

> `optional` **signer?**: `ChannelSigner`

***

### signerPort?

> `optional` **signerPort?**: `SignerPort`

RFC-058 signer port; when absent the local signer path is used.

***

### spliceAcceptances?

> `optional` **spliceAcceptances?**: `Map`\<`string`, `SpliceAcceptance`\>

***

### spliceLeaseProvider?

> `optional` **spliceLeaseProvider?**: `SpliceLeaseProvider`

***

### spliceProposals?

> `optional` **spliceProposals?**: `Map`\<`string`, `SpliceProposal`\>

***

### swarm?

> `optional` **swarm?**: `OmniaSwarm`

***

### transportPubkey?

> `optional` **transportPubkey?**: `string`

Native transport identity, published in the signed manifest.

***

### vtxoPools?

> `optional` **vtxoPools?**: `Map`\<`string`, `OmniaVtxoPool`\>

VTXO pools, live claims and unsigned/signed receipts.

***

### vtxoReceipts?

> `optional` **vtxoReceipts?**: `Map`\<`string`, `VtxoOperatorReceipt`\>

***

### vtxos?

> `optional` **vtxos?**: `Map`\<`string`, `OmniaVtxo`\>
