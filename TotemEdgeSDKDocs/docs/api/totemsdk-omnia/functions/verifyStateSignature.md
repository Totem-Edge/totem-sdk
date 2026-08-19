[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / verifyStateSignature

# Function: verifyStateSignature()

> **verifyStateSignature**(`channel`, `state`, `partyId`, `publicKeyDigest`): `boolean`

Verify a channel state signature using off-chain WOTS verification.

 * Rebuilds the canonical Minima update transaction digest and uses
 * `wotsVerifyDigest` to compare it against the party's stored public key digest.

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
