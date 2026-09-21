[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / HostApiContext

# Interface: HostApiContext

## Properties

### chainProvider?

> `optional` **chainProvider?**: `ChainStateProvider`

***

### channels

> **channels**: `Map`\<`string`, `OmniaChannel`\>

***

### factories?

> `optional` **factories?**: `Map`\<`string`, `ChannelFactory`\>

***

### factoryBundles?

> `optional` **factoryBundles?**: `Record`\<`string`, `WotsLeaseBundle`\>

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

### operations?

> `optional` **operations?**: [`OperationStoreLike`](../type-aliases/OperationStoreLike.md)

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
