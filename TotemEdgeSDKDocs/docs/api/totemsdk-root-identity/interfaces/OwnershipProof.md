[**@totemsdk/root-identity**](../index.md)

***

[@totemsdk/root-identity](../index.md) / OwnershipProof

# Interface: OwnershipProof

Ownership proof demonstrating that a root key controls a set of child addresses.

The root key signs a canonical JSON message that includes all child public keys
and a timestamp, allowing third parties to verify the claim without any
interaction with the blockchain.

Verification steps:
1. Rebuild the canonical message from `rootAddress`, `childPublicKeys`, and `timestamp`.
2. Verify `rootProof.signature` over that message with `rootProof.publicKey`.
3. For each `(childPublicKeys[i], childAddresses[i])` pair confirm the address
   is correctly derived from the public key.

## Properties

### childAddresses

> **childAddresses**: `string`[]

***

### childPublicKeys

> **childPublicKeys**: `string`[]

***

### rootAddress

> **rootAddress**: `string`

***

### rootProof

> **rootProof**: [`WotsProof`](WotsProof.md)

***

### rootPublicKey

> **rootPublicKey**: `string`

***

### timestamp

> **timestamp**: `string`
