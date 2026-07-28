[**@totemsdk/wallet-adapter**](../index.md)

***

[@totemsdk/wallet-adapter](../index.md) / AdapterProvider

# Interface: AdapterProvider

## Properties

### isTotem

> **isTotem**: `true`

## Methods

### on()

> **on**(`event`, `callback`): `void`

#### Parameters

##### event

`string`

##### callback

(...`args`) => `void`

#### Returns

`void`

***

### removeListener()

> **removeListener**(`event`, `callback`): `void`

#### Parameters

##### event

`string`

##### callback

(...`args`) => `void`

#### Returns

`void`

***

### request()

> **request**(`args`): `Promise`\<`unknown`\>

#### Parameters

##### args

###### method

`string`

###### params?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>
