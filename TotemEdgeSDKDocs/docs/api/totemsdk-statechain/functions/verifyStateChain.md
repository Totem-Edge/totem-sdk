[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / verifyStateChain

# Function: verifyStateChain()

> **verifyStateChain**(`chain`, `opts?`): [`VerifyResult`](../interfaces/VerifyResult.md)

Verify the full transfer history of a statechain.

For each TransferRecord, verifies:
 1. Chain continuity: party IDs and PKDs are linked hop-by-hop.
 2. Transfer key lineage: derivePKdigest(transferKey, 0) === fromPublicKeyDigest.
 3. Digest provenance: sha3_256(txBodyHex) === signedDigest.
    Prevents a malicious record from pairing valid signatures over one digest
    with unrelated `txHex`. Binds all signatures to the actual TX data.
 4. SE blind signature: verifies `blindedSignature` over `signedDigest`.
 5. Old-owner signature: verifies `ownerSignature` over `signedDigest`.
    Proves the old owner — not just the SE — authorised this state transition.

Then validates that `currentOwner` matches the last transfer recipient.

## Parameters

### chain

[`StateChain`](../interfaces/StateChain.md)

### opts?

[`VerifyOptions`](../interfaces/VerifyOptions.md)

## Returns

[`VerifyResult`](../interfaces/VerifyResult.md)
