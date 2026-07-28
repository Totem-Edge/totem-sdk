[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / RecursiveMastPolicyStore

# Interface: RecursiveMastPolicyStore

## Methods

### deleteBranch()?

> `optional` **deleteBranch**(`policyRoot`, `scriptHash`): `Promise`\<`void`\>

#### Parameters

##### policyRoot

`string`

##### scriptHash

`string`

#### Returns

`Promise`\<`void`\>

***

### deleteManifest()?

> `optional` **deleteManifest**(`policyId`, `version`): `Promise`\<`void`\>

#### Parameters

##### policyId

`string`

##### version

`number`

#### Returns

`Promise`\<`void`\>

***

### getBranch()

> **getBranch**(`policyRoot`, `scriptHash`): `Promise`\<[`MastBranchPackage`](MastBranchPackage.md) \| `null`\>

#### Parameters

##### policyRoot

`string`

##### scriptHash

`string`

#### Returns

`Promise`\<[`MastBranchPackage`](MastBranchPackage.md) \| `null`\>

***

### getBundle()

> **getBundle**(`bundleHash`): `Promise`\<\{ `branches`: [`MastBranchPackage`](MastBranchPackage.md)[]; `manifest`: [`RecursiveMastPolicyManifest`](RecursiveMastPolicyManifest.md); \} \| `null`\>

#### Parameters

##### bundleHash

`string`

#### Returns

`Promise`\<\{ `branches`: [`MastBranchPackage`](MastBranchPackage.md)[]; `manifest`: [`RecursiveMastPolicyManifest`](RecursiveMastPolicyManifest.md); \} \| `null`\>

***

### getManifest()

> **getManifest**(`policyId`, `version?`): `Promise`\<[`RecursiveMastPolicyManifest`](RecursiveMastPolicyManifest.md) \| `null`\>

#### Parameters

##### policyId

`string`

##### version?

`number`

#### Returns

`Promise`\<[`RecursiveMastPolicyManifest`](RecursiveMastPolicyManifest.md) \| `null`\>

***

### hasBranch()?

> `optional` **hasBranch**(`policyRoot`, `scriptHash`): `Promise`\<`boolean`\>

#### Parameters

##### policyRoot

`string`

##### scriptHash

`string`

#### Returns

`Promise`\<`boolean`\>

***

### hasManifest()?

> `optional` **hasManifest**(`policyId`, `version?`): `Promise`\<`boolean`\>

#### Parameters

##### policyId

`string`

##### version?

`number`

#### Returns

`Promise`\<`boolean`\>

***

### listBranches()?

> `optional` **listBranches**(`policyRoot`, `filter?`): `Promise`\<[`MastBranchSummary`](MastBranchSummary.md)[]\>

#### Parameters

##### policyRoot

`string`

##### filter?

[`BranchFilter`](BranchFilter.md)

#### Returns

`Promise`\<[`MastBranchSummary`](MastBranchSummary.md)[]\>

***

### listManifests()?

> `optional` **listManifests**(`policyId`): `Promise`\<`number`[]\>

#### Parameters

##### policyId

`string`

#### Returns

`Promise`\<`number`[]\>

***

### mirrorPolicy()?

> `optional` **mirrorPolicy**(`policyId`, `destination`): `Promise`\<[`MirrorResult`](MirrorResult.md)\>

#### Parameters

##### policyId

`string`

##### destination

`RecursiveMastPolicyStore`

#### Returns

`Promise`\<[`MirrorResult`](MirrorResult.md)\>

***

### putBranch()

> **putBranch**(`branch`): `Promise`\<`string`\>

#### Parameters

##### branch

[`MastBranchPackage`](MastBranchPackage.md)

#### Returns

`Promise`\<`string`\>

***

### putBundle()

> **putBundle**(`manifest`, `branches`): `Promise`\<`string`\>

#### Parameters

##### manifest

[`RecursiveMastPolicyManifest`](RecursiveMastPolicyManifest.md)

##### branches

[`MastBranchPackage`](MastBranchPackage.md)[]

#### Returns

`Promise`\<`string`\>

***

### putManifest()

> **putManifest**(`manifest`): `Promise`\<`string`\>

#### Parameters

##### manifest

[`RecursiveMastPolicyManifest`](RecursiveMastPolicyManifest.md)

#### Returns

`Promise`\<`string`\>
