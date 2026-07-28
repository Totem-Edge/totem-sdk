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

### signer?

> `optional` **signer?**: [`ChannelSigner`](ChannelSigner.md)
