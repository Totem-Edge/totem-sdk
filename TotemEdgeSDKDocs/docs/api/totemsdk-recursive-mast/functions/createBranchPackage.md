[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / createBranchPackage

# Function: createBranchPackage()

> **createBranchPackage**(`config`): `Promise`\<[`MastBranchPackage`](../interfaces/MastBranchPackage.md)\>

## Parameters

### config

#### action

`string`

#### childRoots?

`string`[]

#### evidenceRequirements?

`string`[]

#### expiresAt?

`number`

#### policyEpoch

`number`

#### policyId

`string`

#### policyRoot

`string`

#### policyVersion

`number`

#### proof

`Uint8Array`

#### publisherIdentityId

`string`

#### role?

`string`

#### script

`string`

#### signFn

(`data`) => `Uint8Array`\<`ArrayBufferLike`\> \| `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### validFrom

`number`

## Returns

`Promise`\<[`MastBranchPackage`](../interfaces/MastBranchPackage.md)\>
