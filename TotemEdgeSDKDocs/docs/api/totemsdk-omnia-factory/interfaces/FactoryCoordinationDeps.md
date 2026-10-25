[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / FactoryCoordinationDeps

# Interface: FactoryCoordinationDeps

## Properties

### approval?

> `optional` **approval?**: [`FactoryApproval`](../type-aliases/FactoryApproval.md)

***

### bundle

> **bundle**: [`WotsLeaseBundle`](WotsLeaseBundle.md)

This peer's signing bundle.

***

### chainProvider?

> `optional` **chainProvider?**: `ChainStateProvider`

Initiator-only: mine + broadcast the settlement TxPoW.

***

### factories

> **factories**: `FactoryStore`

This peer's factories (its own copies).

***

### onClosed?

> `optional` **onClosed?**: (`payload`, `peer`) => `void`

#### Parameters

##### payload

[`FactorySettlementPayload`](FactorySettlementPayload.md)

##### peer

`OmniaPeer`

#### Returns

`void`

***

### onOpened?

> `optional` **onOpened?**: (`factory`, `peer`) => `void`

#### Parameters

##### factory

[`ChannelFactory`](ChannelFactory.md)

##### peer

`OmniaPeer`

#### Returns

`void`

***

### onVcOpened?

> `optional` **onVcOpened?**: (`factory`, `channel`, `peer`) => `void`

#### Parameters

##### factory

[`ChannelFactory`](ChannelFactory.md)

##### channel

[`OmniaChannel`](OmniaChannel.md)

##### peer

`OmniaPeer`

#### Returns

`void`

***

### ttlMs?

> `optional` **ttlMs?**: `number`

***

### verifySignature?

> `optional` **verifySignature?**: `VerifySignature`
