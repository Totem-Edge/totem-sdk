[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / LeaseCoordinator

# Class: LeaseCoordinator

## Constructors

### Constructor

> **new LeaseCoordinator**(`nodeId`, `config`): `LeaseCoordinator`

#### Parameters

##### nodeId

`string`

##### config

[`LeaseConfig`](../interfaces/LeaseConfig.md)

#### Returns

`LeaseCoordinator`

## Methods

### handleBurn()

> **handleBurn**(`msg`, `sendFn`, `controllerPublicKeyHex?`): `Promise`\<`void`\>

#### Parameters

##### msg

`LeaseBurnMessage`

##### sendFn

`SendFn`

##### controllerPublicKeyHex?

`string`

#### Returns

`Promise`\<`void`\>

***

### handleCommit()

> **handleCommit**(`msg`, `sendFn`, `controllerPublicKeyHex?`): `Promise`\<`void`\>

#### Parameters

##### msg

`LeaseCommitMessage`

##### sendFn

`SendFn`

##### controllerPublicKeyHex?

`string`

#### Returns

`Promise`\<`void`\>

***

### handleReserve()

> **handleReserve**(`msg`, `sendFn`, `controllerPublicKeyHex?`): `Promise`\<`void`\>

#### Parameters

##### msg

`LeaseReserveMessage`

##### sendFn

`SendFn`

##### controllerPublicKeyHex?

`string`

#### Returns

`Promise`\<`void`\>

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### registerTreeOwner()

> **registerTreeOwner**(`treeId`, `controllerPublicKeyHex`): `void`

Register a tree as owned by a specific authenticated controller.
Called on first LEASE_RESERVE for a tree, or externally during setup.

#### Parameters

##### treeId

`string`

##### controllerPublicKeyHex

`string`

#### Returns

`void`
