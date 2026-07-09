[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / omniaDraftToMinimaBytes

# Function: omniaDraftToMinimaBytes()

> **omniaDraftToMinimaBytes**(`draft`): `Uint8Array`

Convert an `OmniaTxDraft` to canonical Minima binary TX bytes using
`@totemsdk/core`'s `serializeTransaction`.

This replaces JSON-encoded draft bytes in the TxPoW mining/broadcast path,
ensuring settlement transactions are byte-exact Minima protocol messages
rather than an internal representation.

Call site pattern:
```
const txBytes   = omniaDraftToMinimaBytes(draft);
const txBody    = serializeTxBody(txBytes, witnessBytes);
const mined     = await mineTxPoW(txBody, difficulty);
const fullTxPoW = concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01]), txBody);
await chainProvider.broadcastTxPoW(Buffer.from(fullTxPoW).toString('hex'));
```

## Parameters

### draft

[`OmniaTxDraft`](../interfaces/OmniaTxDraft.md)

## Returns

`Uint8Array`
