[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / SpliceLeaseProvider

# Interface: SpliceLeaseProvider

## Properties

### broadcast?

> `optional` **broadcast?**: (`txHex`) => `Promise`\<\{ `success?`: `boolean`; `txpowid?`: `string`; \}\>

Optional function to broadcast the mined splice TxPoW to the chain.

#### Parameters

##### txHex

`string`

#### Returns

`Promise`\<\{ `success?`: `boolean`; `txpowid?`: `string`; \}\>

***

### signer

> **signer**: `ChannelSigner`

Local party's WOTS signer.

***

### wotsLease

> **wotsLease**: `WotsLeaseProvider`

WOTS lease provider for key slot reservation/commit (required for quiesceChannel).
