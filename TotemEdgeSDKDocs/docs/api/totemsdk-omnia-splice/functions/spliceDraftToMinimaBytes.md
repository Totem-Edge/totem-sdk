[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / spliceDraftToMinimaBytes

# Function: spliceDraftToMinimaBytes()

> **spliceDraftToMinimaBytes**(`draft`): `Uint8Array`

Convert a SpliceTxDraft to canonical Minima binary TX bytes.

The resulting bytes cover inputs, outputs, and state variables and are
suitable for WOTS signing. Both parties sign the same bytes independently;
the final splice TX assembles both signatures into the witness.

## Parameters

### draft

[`SpliceTxDraft`](../interfaces/SpliceTxDraft.md)

## Returns

`Uint8Array`
