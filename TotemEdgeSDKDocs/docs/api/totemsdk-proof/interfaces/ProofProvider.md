[**@totemsdk/proof**](../index.md)

***

[@totemsdk/proof](../index.md) / ProofProvider

# Interface: ProofProvider

## Properties

### capabilities

> `readonly` **capabilities**: [`ProofProviderCapability`](../type-aliases/ProofProviderCapability.md)[]

## Methods

### anchorProof()?

> `optional` **anchorProof**(`signedProof`): `Promise`\<[`ProofOperationResult`](ProofOperationResult.md)\>

#### Parameters

##### signedProof

[`SignedProof`](SignedProof.md)

#### Returns

`Promise`\<[`ProofOperationResult`](ProofOperationResult.md)\>

***

### checkHash()?

> `optional` **checkHash**(`params`): `Promise`\<[`ProofOperationResult`](ProofOperationResult.md)\>

#### Parameters

##### params

###### hash

`string`

#### Returns

`Promise`\<[`ProofOperationResult`](ProofOperationResult.md)\>

***

### checkProof()?

> `optional` **checkProof**(`signedProof`): `Promise`\<[`ProofOperationResult`](ProofOperationResult.md)\>

#### Parameters

##### signedProof

[`SignedProof`](SignedProof.md)

#### Returns

`Promise`\<[`ProofOperationResult`](ProofOperationResult.md)\>

***

### stampHash()?

> `optional` **stampHash**(`params`): `Promise`\<[`ProofOperationResult`](ProofOperationResult.md)\>

#### Parameters

##### params

###### hash

`string`

#### Returns

`Promise`\<[`ProofOperationResult`](ProofOperationResult.md)\>

***

### verifyHash()?

> `optional` **verifyHash**(`params`): `Promise`\<[`ProofVerifyResult`](ProofVerifyResult.md)\>

#### Parameters

##### params

###### hash

`string`

###### reportRequired?

`boolean`

#### Returns

`Promise`\<[`ProofVerifyResult`](ProofVerifyResult.md)\>

***

### verifyProof()?

> `optional` **verifyProof**(`signedProof`, `options?`): `Promise`\<[`ProofVerifyResult`](ProofVerifyResult.md)\>

#### Parameters

##### signedProof

[`SignedProof`](SignedProof.md)

##### options?

###### skipLocalVerification?

`boolean`

#### Returns

`Promise`\<[`ProofVerifyResult`](ProofVerifyResult.md)\>
