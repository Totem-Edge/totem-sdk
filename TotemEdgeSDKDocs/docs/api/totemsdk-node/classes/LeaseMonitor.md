[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / LeaseMonitor

# Class: LeaseMonitor

## Constructors

### Constructor

> **new LeaseMonitor**(`leaseStore`, `timer?`, `logger?`, `config?`): `LeaseMonitor`

#### Parameters

##### leaseStore

[`LeaseStore`](LeaseStore.md)

##### timer?

[`TimerAdapter`](../interfaces/TimerAdapter.md)

##### logger?

[`LoggerAdapter`](../interfaces/LoggerAdapter.md)

##### config?

[`LeaseMonitorConfig`](../interfaces/LeaseMonitorConfig.md)

#### Returns

`LeaseMonitor`

## Methods

### checkNow()

> **checkNow**(): `Promise`\<[`LeaseExpiryEvent`](../interfaces/LeaseExpiryEvent.md)[]\>

#### Returns

`Promise`\<[`LeaseExpiryEvent`](../interfaces/LeaseExpiryEvent.md)[]\>

***

### isActive()

> **isActive**(): `boolean`

#### Returns

`boolean`

***

### onExpirySoon()

> **onExpirySoon**(`callback`): () => `void`

#### Parameters

##### callback

[`LeaseExpiryCallback`](../type-aliases/LeaseExpiryCallback.md)

#### Returns

() => `void`

***

### removeAllListeners()

> **removeAllListeners**(): `void`

#### Returns

`void`

***

### start()

> **start**(): `void`

#### Returns

`void`

***

### stop()

> **stop**(): `void`

#### Returns

`void`
