[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / TotemSendTransactionResponse

# Interface: TotemSendTransactionResponse

## Properties

### artifactId?

> `optional` **artifactId?**: `string`

***

### digestHex?

> `optional` **digestHex?**: `string`

***

### error?

> `optional` **error?**: `string`

***

### errorCode?

> `optional` **errorCode?**: [`TotemTransactionErrorCode`](../type-aliases/TotemTransactionErrorCode.md)

***

### status?

> `optional` **status?**: `"pending"` \| `"submitted"` \| `"confirmed"` \| `"rejected"`

***

### success

> **success**: `boolean`

***

### txpowid?

> `optional` **txpowid?**: `string`

***

### verification?

> `optional` **verification?**: `object`

#### totemideaNotes?

> `optional` **totemideaNotes?**: `string`[]

#### totemideaValid?

> `optional` **totemideaValid?**: `boolean`

#### totemideaWarnings?

> `optional` **totemideaWarnings?**: `string`[]
