[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / reconstructTxPoWEnvelope

# Function: reconstructTxPoWEnvelope()

> **reconstructTxPoWEnvelope**(`proofTemplate`, `headerBytes`, `prng`): `object`

Reconstruct the complete Minima TxPoW envelope for a proof.

Rebuilds the empty block TxBody deterministically, recomputes the body hash,
and reassembles header | 0x01 | body. Used by verification to confirm the
proof corresponds to a complete, Minima-serializable candidate.

## Parameters

### proofTemplate

[`MinimaWorkTemplate`](../interfaces/MinimaWorkTemplate.md)

The template the proof was mined against.

### headerBytes

`Uint8Array`

The mined TxHeader bytes.

### prng

`Uint8Array`

The PRNG used when the proof was mined (32 bytes).

## Returns

`object`

### bodyHash

> **bodyHash**: `string`

### envelope

> **envelope**: `Uint8Array`
