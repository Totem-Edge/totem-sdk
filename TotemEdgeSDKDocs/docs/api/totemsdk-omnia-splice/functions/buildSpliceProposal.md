[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / buildSpliceProposal

# Function: buildSpliceProposal()

> **buildSpliceProposal**(`channel`, `params`, `proposerPublicKeyDigest`): [`UnsignedSpliceProposal`](../interfaces/UnsignedSpliceProposal.md)

Build the deterministic splice draft/digest without signing. Used by the
wallet/coordinator flow: the caller signs `digest` and attaches the
signature before finalization.

## Parameters

### channel

`OmniaChannel` \| [`QuiescedChannel`](../type-aliases/QuiescedChannel.md)

### params

[`SpliceParams`](../interfaces/SpliceParams.md)

### proposerPublicKeyDigest

`string`

## Returns

[`UnsignedSpliceProposal`](../interfaces/UnsignedSpliceProposal.md)
