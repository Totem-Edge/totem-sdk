[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / WalletCoordinationOptions

# Interface: WalletCoordinationOptions

## Properties

### approval?

> `optional` **approval?**: [`WalletApproval`](../type-aliases/WalletApproval.md)

Consent gate for every signature-producing accept.

***

### chainProvider?

> `optional` **chainProvider?**: `ChainStateProvider`

Inititator-only: mine + broadcast settlement TxPoW.

***

### channels

> **channels**: `Map`\<`string`, [`OmniaChannel`](OmniaChannel.md) \| [`QuiescedChannel`](../type-aliases/QuiescedChannel.md)\>

This wallet's known channels (incl. quiesced).

***

### custody?

> `optional` **custody?**: `CustodyContext`

RFC-058 custody metadata attached to every approval request.

***

### factories

> **factories**: `Map`\<`string`, [`ChannelFactory`](ChannelFactory.md)\>

This wallet's known factories (opening/active).

***

### leaseProvider

> **leaseProvider**: `WotsLeaseProvider`

***

### onFactoryClosed?

> `optional` **onFactoryClosed?**: (`payload`, `peer`) => `void`

#### Parameters

##### payload

`FactorySettlementPayload`

##### peer

`OmniaPeer`

#### Returns

`void`

***

### onFactoryOpened?

> `optional` **onFactoryOpened?**: (`factory`, `peer`) => `void`

#### Parameters

##### factory

[`ChannelFactory`](ChannelFactory.md)

##### peer

`OmniaPeer`

#### Returns

`void`

***

### onSpliceFinalized?

> `optional` **onSpliceFinalized?**: (`channel`, `peer`) => `void`

#### Parameters

##### channel

[`SplicedChannel`](../type-aliases/SplicedChannel.md)

##### peer

`OmniaPeer`

#### Returns

`void`

***

### onVirtualChannelOpened?

> `optional` **onVirtualChannelOpened?**: (`factory`, `channel`, `peer`) => `void`

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

### policy?

> `optional` **policy?**: `CoordinationPolicy`

***

### signer

> **signer**: `ChannelSigner`

***

### spliceFinalizeOptions?

> `optional` **spliceFinalizeOptions?**: `FinalizeSpliceOptions`

Splice finalize options (broadcast / mineDifficulty).

***

### store

> **store**: `CoordinationStore`

Durable proposal/acceptance store (RFC-007 storage adapter).

***

### verifySignature?

> `optional` **verifySignature?**: (`signature`, `digest`, `publicKeyDigest`) => `boolean`

Signature verifier; defaults to `verifyChannelSignature` (RFC-037).

#### Parameters

##### signature

`Uint8Array`

##### digest

`Uint8Array`

##### publicKeyDigest

`string`

#### Returns

`boolean`
