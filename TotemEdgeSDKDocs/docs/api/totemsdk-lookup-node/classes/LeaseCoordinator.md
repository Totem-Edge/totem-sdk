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

> **handleBurn**(`msg`, `sendFn`): `Promise`\<`void`\>

#### Parameters

##### msg

`LeaseBurnMessage`

##### sendFn

`SendFn`

#### Returns

`Promise`\<`void`\>

***

### handleCommit()

> **handleCommit**(`msg`, `sendFn`): `Promise`\<`void`\>

#### Parameters

##### msg

`LeaseCommitMessage`

##### sendFn

`SendFn`

#### Returns

`Promise`\<`void`\>

***

### handleReserve()

> **handleReserve**(`msg`, `sendFn`): `Promise`\<`void`\>

#### Parameters

##### msg

`LeaseReserveMessage`

##### sendFn

`SendFn`

#### Returns

`Promise`\<`void`\>

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
