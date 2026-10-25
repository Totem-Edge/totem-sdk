[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / OmniaIntegrationConfig

# Interface: OmniaIntegrationConfig

## Properties

### chainProvider?

> `optional` **chainProvider?**: `any`

***

### leaseProvider?

> `optional` **leaseProvider?**: `any`

***

### onChannelAccepted?

> `optional` **onChannelAccepted?**: (`channel`, `peer`) => `void`

#### Parameters

##### channel

[`OmniaChannel`](OmniaChannel.md)

##### peer

[`OmniaPeer`](OmniaPeer.md)

#### Returns

`void`

***

### onFactoryMessage?

> `optional` **onFactoryMessage?**: (`peer`, `msg`) => `void` \| `Promise`\<`void`\>

Factory coordination messages (FACTORY_PROPOSAL/ACCEPT, FACTORY_CLOSE_*).
The host supplies these handlers (it owns the factory SDK + lease bundles);
the transport core stays free of factory dependencies.

#### Parameters

##### peer

[`OmniaPeer`](OmniaPeer.md)

##### msg

[`OmniaMessage`](OmniaMessage.md)

#### Returns

`void` \| `Promise`\<`void`\>

***

### onPeerMessage?

> `optional` **onPeerMessage?**: (`peer`, `msg`) => `void`

Observe every inbound peer message, before lifecycle dispatch.

#### Parameters

##### peer

[`OmniaPeer`](OmniaPeer.md)

##### msg

[`OmniaMessage`](OmniaMessage.md)

#### Returns

`void`

***

### onSettlementProposed?

> `optional` **onSettlementProposed?**: (`payload`, `peer`) => `void`

#### Parameters

##### payload

`unknown`

##### peer

[`OmniaPeer`](OmniaPeer.md)

#### Returns

`void`

***

### onSpliceMessage?

> `optional` **onSpliceMessage?**: (`peer`, `msg`) => `void` \| `Promise`\<`void`\>

Splice coordination messages (SPLICE_PROPOSAL/ACCEPT/FINALIZED).

#### Parameters

##### peer

[`OmniaPeer`](OmniaPeer.md)

##### msg

[`OmniaMessage`](OmniaMessage.md)

#### Returns

`void` \| `Promise`\<`void`\>

***

### onStateUpdated?

> `optional` **onStateUpdated?**: (`channel`, `peer`) => `void`

#### Parameters

##### channel

[`OmniaChannel`](OmniaChannel.md)

##### peer

[`OmniaPeer`](OmniaPeer.md)

#### Returns

`void`

***

### onVcMessage?

> `optional` **onVcMessage?**: (`peer`, `msg`) => `void` \| `Promise`\<`void`\>

Virtual-channel coordination messages (VC_PROPOSAL/ACCEPT/FINALIZED).

#### Parameters

##### peer

[`OmniaPeer`](OmniaPeer.md)

##### msg

[`OmniaMessage`](OmniaMessage.md)

#### Returns

`void` \| `Promise`\<`void`\>

***

### signer?

> `optional` **signer?**: [`ChannelSigner`](ChannelSigner.md)
