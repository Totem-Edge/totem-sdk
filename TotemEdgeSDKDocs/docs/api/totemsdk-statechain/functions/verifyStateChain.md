[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / verifyStateChain

# Function: verifyStateChain()

> **verifyStateChain**(`chain`): [`VerifyResult`](../interfaces/VerifyResult.md)

Verify the full transfer history of a statechain (RFC-009, Minima-faithful).

For each TransferRecord, verifies:
 1. Chain continuity: party IDs and root public keys are linked hop-by-hop.
 2. Digest provenance: sha3_256(txBodyHex) === signedDigest.
    Prevents a malicious record from pairing valid signatures over one digest
    with unrelated `txHex`. Binds all signatures to the actual TX data.
 3. SE signature: verifies the leased-leaf envelope over `signedDigest`
    against the SE root's `OwnershipProof` (or the root identity for `root`).
 4. Old-owner signature: verifies the root-bound Minima `TreeSignature` over
    `signedDigest` against `fromPublicKeyDigest`. Proves the old owner — not
    just the SE — authorised this state transition.

Then validates that `currentOwner` matches the last transfer recipient.

## Parameters

### chain

[`StateChain`](../interfaces/StateChain.md)

## Returns

[`VerifyResult`](../interfaces/VerifyResult.md)
