[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / OmniaIntegrationConfig

# Interface: OmniaIntegrationConfig

## Properties

### chainProvider?

> `optional` **chainProvider?**: `any`

Optional chain provider for on-chain funding TX validation (CHANNEL_PROPOSAL).

***

### leaseProvider?

> `optional` **leaseProvider?**: `any`

WOTS lease provider required by `signState` (STATE_UPDATE) and
`proposeSettlement` (SETTLEMENT_PROPOSAL).
When absent those calls are skipped and only the callback is invoked.

***

### onChannelAccepted?

> `optional` **onChannelAccepted?**: (`channel`, `peer`) => `void`

Called when a new channel is accepted.

#### Parameters

##### channel

`OmniaChannel`

##### peer

[`OmniaPeer`](OmniaPeer.md)

#### Returns

`void`

***

### onSettlementProposed?

> `optional` **onSettlementProposed?**: (`payload`, `peer`) => `void`

Called when a SETTLEMENT_PROPOSAL is received.
Receives the decoded settlement payload from the message (or the full
proposeSettlement result if leaseProvider was set).

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

Called after STATE_UPDATE is verified (and signed, if leaseProvider set).

#### Parameters

##### channel

`OmniaChannel`

##### peer

[`OmniaPeer`](OmniaPeer.md)

#### Returns

`void`

***

### signer?

> `optional` **signer?**: `ChannelSigner`

Signer override — falls back to `channel.localSigner` when not provided.
