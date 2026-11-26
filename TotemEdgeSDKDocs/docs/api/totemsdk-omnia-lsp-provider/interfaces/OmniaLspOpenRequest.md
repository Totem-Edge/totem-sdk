[**@totemsdk/omnia-lsp-provider**](../index.md)

***

[@totemsdk/omnia-lsp-provider](../index.md) / OmniaLspOpenRequest

# Interface: OmniaLspOpenRequest

## Properties

### consumerAddress

> **consumerAddress**: `string`

***

### consumerPartyId

> **consumerPartyId**: `string`

Consumer Omnia party id (identity id or channel party id).

***

### consumerPublicKeyDigest

> **consumerPublicKeyDigest**: `string`

Consumer channel key digest (32-byte hex).

***

### consumerSettlementAddress?

> `optional` **consumerSettlementAddress?**: `string`

***

### consumerTransportPubkey?

> `optional` **consumerTransportPubkey?**: `string`

***

### direction

> **direction**: `OmniaLspDirection`

***

### jit?

> `optional` **jit?**: `boolean`

***

### lease?

> `optional` **lease?**: `boolean`

***

### localAmount

> **localAmount**: `string`

Consumer side of the initial channel balance, decimal units.

***

### maxOpenFee?

> `optional` **maxOpenFee?**: `string`

Reject when the total open fee exceeds this decimal amount.

***

### maxOpenFeeBps?

> `optional` **maxOpenFeeBps?**: `number`

Legacy ceiling for the percentage component. Also bounds a flat fee by
converting it to the equivalent basis points on the fee basis (OMN-072).

***

### providerId

> **providerId**: `string`

***

### remoteAmount

> **remoteAmount**: `string`

Provider side of the initial channel balance, decimal units.

***

### tokenId

> **tokenId**: `string`
