[**@totemsdk/se-server**](../index.md)

***

[@totemsdk/se-server](../index.md) / SeServer

# Interface: SeServer

## Properties

### app

> **app**: `Express`

***

### pool

> **pool**: `Pool`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### listen()

> **listen**(`port?`): `Promise`\<`Server`\<*typeof* `IncomingMessage`, *typeof* `ServerResponse`\>\>

#### Parameters

##### port?

`number`

#### Returns

`Promise`\<`Server`\<*typeof* `IncomingMessage`, *typeof* `ServerResponse`\>\>
