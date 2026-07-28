[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / MemoryPolicyStore

# Class: MemoryPolicyStore

## Implements

- [`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md)

## Constructors

### Constructor

> **new MemoryPolicyStore**(`options?`): `MemoryPolicyStore`

#### Parameters

##### options?

[`MemoryStoreOptions`](../interfaces/MemoryStoreOptions.md) = `{}`

#### Returns

`MemoryPolicyStore`

## Methods

### deleteBranch()

> **deleteBranch**(`policyRoot`, `scriptHash`): `Promise`\<`void`\>

#### Parameters

##### policyRoot

`string`

##### scriptHash

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`deleteBranch`](../interfaces/RecursiveMastPolicyStore.md#deletebranch)

***

### deleteManifest()

> **deleteManifest**(`policyId`, `version`): `Promise`\<`void`\>

#### Parameters

##### policyId

`string`

##### version

`number`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`deleteManifest`](../interfaces/RecursiveMastPolicyStore.md#deletemanifest)

***

### getBranch()

> **getBranch**(`policyRoot`, `scriptHash`): `Promise`\<[`MastBranchPackage`](../interfaces/MastBranchPackage.md) \| `null`\>

#### Parameters

##### policyRoot

`string`

##### scriptHash

`string`

#### Returns

`Promise`\<[`MastBranchPackage`](../interfaces/MastBranchPackage.md) \| `null`\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`getBranch`](../interfaces/RecursiveMastPolicyStore.md#getbranch)

***

### getBundle()

> **getBundle**(`bundleHash`): `Promise`\<\{ `branches`: [`MastBranchPackage`](../interfaces/MastBranchPackage.md)[]; `manifest`: [`RecursiveMastPolicyManifest`](../interfaces/RecursiveMastPolicyManifest.md); \} \| `null`\>

#### Parameters

##### bundleHash

`string`

#### Returns

`Promise`\<\{ `branches`: [`MastBranchPackage`](../interfaces/MastBranchPackage.md)[]; `manifest`: [`RecursiveMastPolicyManifest`](../interfaces/RecursiveMastPolicyManifest.md); \} \| `null`\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`getBundle`](../interfaces/RecursiveMastPolicyStore.md#getbundle)

***

### getManifest()

> **getManifest**(`policyId`, `version?`): `Promise`\<[`RecursiveMastPolicyManifest`](../interfaces/RecursiveMastPolicyManifest.md) \| `null`\>

#### Parameters

##### policyId

`string`

##### version?

`number`

#### Returns

`Promise`\<[`RecursiveMastPolicyManifest`](../interfaces/RecursiveMastPolicyManifest.md) \| `null`\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`getManifest`](../interfaces/RecursiveMastPolicyStore.md#getmanifest)

***

### hasBranch()

> **hasBranch**(`policyRoot`, `scriptHash`): `Promise`\<`boolean`\>

#### Parameters

##### policyRoot

`string`

##### scriptHash

`string`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`hasBranch`](../interfaces/RecursiveMastPolicyStore.md#hasbranch)

***

### hasManifest()

> **hasManifest**(`policyId`, `version?`): `Promise`\<`boolean`\>

#### Parameters

##### policyId

`string`

##### version?

`number`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`hasManifest`](../interfaces/RecursiveMastPolicyStore.md#hasmanifest)

***

### listBranches()

> **listBranches**(`policyRoot`, `filter?`): `Promise`\<[`MastBranchSummary`](../interfaces/MastBranchSummary.md)[]\>

#### Parameters

##### policyRoot

`string`

##### filter?

[`BranchFilter`](../interfaces/BranchFilter.md)

#### Returns

`Promise`\<[`MastBranchSummary`](../interfaces/MastBranchSummary.md)[]\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`listBranches`](../interfaces/RecursiveMastPolicyStore.md#listbranches)

***

### listManifests()

> **listManifests**(`policyId`): `Promise`\<`number`[]\>

#### Parameters

##### policyId

`string`

#### Returns

`Promise`\<`number`[]\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`listManifests`](../interfaces/RecursiveMastPolicyStore.md#listmanifests)

***

### mirrorPolicy()

> **mirrorPolicy**(`policyId`, `destination`): `Promise`\<[`MirrorResult`](../interfaces/MirrorResult.md)\>

#### Parameters

##### policyId

`string`

##### destination

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md)

#### Returns

`Promise`\<[`MirrorResult`](../interfaces/MirrorResult.md)\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`mirrorPolicy`](../interfaces/RecursiveMastPolicyStore.md#mirrorpolicy)

***

### putBranch()

> **putBranch**(`branch`): `Promise`\<`string`\>

#### Parameters

##### branch

[`MastBranchPackage`](../interfaces/MastBranchPackage.md)

#### Returns

`Promise`\<`string`\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`putBranch`](../interfaces/RecursiveMastPolicyStore.md#putbranch)

***

### putBundle()

> **putBundle**(`manifest`, `branches`): `Promise`\<`string`\>

#### Parameters

##### manifest

[`RecursiveMastPolicyManifest`](../interfaces/RecursiveMastPolicyManifest.md)

##### branches

[`MastBranchPackage`](../interfaces/MastBranchPackage.md)[]

#### Returns

`Promise`\<`string`\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`putBundle`](../interfaces/RecursiveMastPolicyStore.md#putbundle)

***

### putManifest()

> **putManifest**(`manifest`): `Promise`\<`string`\>

#### Parameters

##### manifest

[`RecursiveMastPolicyManifest`](../interfaces/RecursiveMastPolicyManifest.md)

#### Returns

`Promise`\<`string`\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`putManifest`](../interfaces/RecursiveMastPolicyStore.md#putmanifest)
