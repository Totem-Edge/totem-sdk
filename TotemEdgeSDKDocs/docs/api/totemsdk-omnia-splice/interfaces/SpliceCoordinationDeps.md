[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / SpliceCoordinationDeps

# Interface: SpliceCoordinationDeps

## Properties

### approval?

> `optional` **approval?**: [`SpliceApproval`](../type-aliases/SpliceApproval.md)

Consent gate for signing an acceptance (RFC-014 §6.3).

***

### channels

> **channels**: `ChannelStore`

This peer's known channels (its own quiesced copies).

***

### finalizeOptions?

> `optional` **finalizeOptions?**: [`FinalizeSpliceOptions`](FinalizeSpliceOptions.md)

Extra finalize options (broadcast, mineDifficulty).

***

### leaseProvider

> **leaseProvider**: [`SpliceLeaseProvider`](SpliceLeaseProvider.md)

This peer's signer + WOTS lease provider.

***

### onFinalized?

> `optional` **onFinalized?**: (`channel`, `peer`) => `void`

Called on the proposer when the splice finalizes.

#### Parameters

##### channel

[`SplicedChannel`](../type-aliases/SplicedChannel.md)

##### peer

`OmniaPeer`

#### Returns

`void`

***

### ttlMs?

> `optional` **ttlMs?**: `number`

Acceptor reservation TTL before burn (default 24h).

***

### verifySignature?

> `optional` **verifySignature?**: [`VerifySignature`](../type-aliases/VerifySignature.md)

Signature verifier; defaults to `verifyChannelSignature` (RFC-037).
