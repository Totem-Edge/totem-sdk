[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / HttpPolicyStore

# Class: HttpPolicyStore

## Implements

- [`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md)

## Constructors

### Constructor

> **new HttpPolicyStore**(`options`): `HttpPolicyStore`

#### Parameters

##### options

[`HttpStoreOptions`](../interfaces/HttpStoreOptions.md)

#### Returns

`HttpPolicyStore`

## Methods

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

### putBranch()

> **putBranch**(`_branch`): `Promise`\<`string`\>

#### Parameters

##### \_branch

[`MastBranchPackage`](../interfaces/MastBranchPackage.md)

#### Returns

`Promise`\<`string`\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`putBranch`](../interfaces/RecursiveMastPolicyStore.md#putbranch)

***

### putBundle()

> **putBundle**(`_manifest`, `_branches`): `Promise`\<`string`\>

#### Parameters

##### \_manifest

[`RecursiveMastPolicyManifest`](../interfaces/RecursiveMastPolicyManifest.md)

##### \_branches

[`MastBranchPackage`](../interfaces/MastBranchPackage.md)[]

#### Returns

`Promise`\<`string`\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`putBundle`](../interfaces/RecursiveMastPolicyStore.md#putbundle)

***

### putManifest()

> **putManifest**(`_manifest`): `Promise`\<`string`\>

#### Parameters

##### \_manifest

[`RecursiveMastPolicyManifest`](../interfaces/RecursiveMastPolicyManifest.md)

#### Returns

`Promise`\<`string`\>

#### Implementation of

[`RecursiveMastPolicyStore`](../interfaces/RecursiveMastPolicyStore.md).[`putManifest`](../interfaces/RecursiveMastPolicyStore.md#putmanifest)
