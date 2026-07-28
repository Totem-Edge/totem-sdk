[**@totemsdk/proof**](../index.md)

***

[@totemsdk/proof](../index.md) / SignedProof

# Interface: SignedProof

A proof after WOTS signing.

`signature.message` is optional debug-only metadata — it is NEVER used as
the source of truth during verification. The digest is always recomputed
from the canonical JSON of the unsigned proof fields.

## Extends

- [`UnsignedProof`](UnsignedProof.md)

## Properties

### anchor?

> `optional` **anchor?**: [`AnchorRef`](AnchorRef.md)

***

### evidence?

> `optional` **evidence?**: [`EvidenceRef`](EvidenceRef.md)[]

#### Inherited from

[`UnsignedProof`](UnsignedProof.md).[`evidence`](UnsignedProof.md#evidence)

***

### expiresAt?

> `optional` **expiresAt?**: `number`

#### Inherited from

[`UnsignedProof`](UnsignedProof.md).[`expiresAt`](UnsignedProof.md#expiresat)

***

### issuedAt

> **issuedAt**: `number`

#### Inherited from

[`UnsignedProof`](UnsignedProof.md).[`issuedAt`](UnsignedProof.md#issuedat)

***

### issuer

> **issuer**: `string`

#### Inherited from

[`UnsignedProof`](UnsignedProof.md).[`issuer`](UnsignedProof.md#issuer)

***

### kind

> **kind**: [`ProofKind`](../type-aliases/ProofKind.md)

#### Inherited from

[`UnsignedProof`](UnsignedProof.md).[`kind`](UnsignedProof.md#kind)

***

### links?

> `optional` **links?**: [`ProofLink`](ProofLink.md)[]

#### Inherited from

[`UnsignedProof`](UnsignedProof.md).[`links`](UnsignedProof.md#links)

***

### payload?

> `optional` **payload?**: `Record`\<`string`, `unknown`\>

#### Inherited from

[`UnsignedProof`](UnsignedProof.md).[`payload`](UnsignedProof.md#payload)

***

### proofId

> **proofId**: `string`

#### Inherited from

[`UnsignedProof`](UnsignedProof.md).[`proofId`](UnsignedProof.md#proofid)

***

### rootIdentityProof?

> `optional` **rootIdentityProof?**: `string`

***

### signature

> **signature**: `object`

#### address

> **address**: `string`

#### message?

> `optional` **message?**: `string`

#### publicKey

> **publicKey**: `string`

#### signature

> **signature**: `string`

***

### subject

> **subject**: [`ProofSubject`](ProofSubject.md)

#### Inherited from

[`UnsignedProof`](UnsignedProof.md).[`subject`](UnsignedProof.md#subject)
