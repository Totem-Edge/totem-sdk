[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / DurableStateChainStore

# Interface: DurableStateChainStore

## Methods

### get()

> **get**(`chainId`): `Promise`\<[`StoredStateChain`](../type-aliases/StoredStateChain.md) \| `undefined`\>

Load a chain (owner signing capability is not persisted; re-attach it).

#### Parameters

##### chainId

`string`

#### Returns

`Promise`\<[`StoredStateChain`](../type-aliases/StoredStateChain.md) \| `undefined`\>

***

### getRecoveryReport()

> **getRecoveryReport**(`chainId`): `Promise`\<[`RecoveryReport`](RecoveryReport.md)\>

Recovery report for one chain (asserts SE-independent recoverability).

#### Parameters

##### chainId

`string`

#### Returns

`Promise`\<[`RecoveryReport`](RecoveryReport.md)\>

***

### getRevision()

> **getRevision**(): `Promise`\<`number`\>

Current registry transition counter (0 before the first write).

#### Returns

`Promise`\<`number`\>

***

### getSnapshot()

> **getSnapshot**(): `Promise`\<[`StateChainRegistryState`](StateChainRegistryState.md)\>

Current persisted registry state.

#### Returns

`Promise`\<[`StateChainRegistryState`](StateChainRegistryState.md)\>

***

### hasState()

> **hasState**(): `Promise`\<`boolean`\>

True once any chain record has been persisted.

#### Returns

`Promise`\<`boolean`\>

***

### list()

> **list**(): `Promise`\<[`StoredStateChain`](../type-aliases/StoredStateChain.md)[]\>

All persisted chains (owner signing capability is not persisted).

#### Returns

`Promise`\<[`StoredStateChain`](../type-aliases/StoredStateChain.md)[]\>

***

### remove()

> **remove**(`chainId`): `Promise`\<`boolean`\>

Remove a chain from the registry.

#### Parameters

##### chainId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### save()

> **save**(`chain`): `Promise`\<`void`\>

Persist a chain (create / transfer / claim state transition).

#### Parameters

##### chain

[`StateChain`](StateChain.md)

#### Returns

`Promise`\<`void`\>

***

### verifyRecoverability()

> **verifyRecoverability**(): `Promise`\<`object`[]\>

Recovery report for every persisted chain.

#### Returns

`Promise`\<`object`[]\>
