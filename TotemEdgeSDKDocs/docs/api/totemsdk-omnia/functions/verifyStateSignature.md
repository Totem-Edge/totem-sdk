[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / verifyStateSignature

# Function: verifyStateSignature()

> **verifyStateSignature**(`channel`, `state`, `partyId`, `publicKeyDigest`): `boolean`

Verify a channel state signature using off-chain WOTS verification.

Recomputes `computeStateCommitment(state.sequence, state.balances, state.pendingHTLCs)` —
the same digest signed by `signState` — and uses `wotsVerifyDigest` to reconstruct the
WOTS public key from the signature and compare its SHA3-256 hash against the party's
stored `publicKeyDigest`.

Because the commitment covers the full off-chain state (sequence + balance split +
pending HTLCs), any tampering with these fields after signing will cause verification
to fail, preserving the integrity of dispute evidence.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### state

[`SignedChannelState`](../interfaces/SignedChannelState.md)

### partyId

`string`

### publicKeyDigest

`string`

## Returns

`boolean`
