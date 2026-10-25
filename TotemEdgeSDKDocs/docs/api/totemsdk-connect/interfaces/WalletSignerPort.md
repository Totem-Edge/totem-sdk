[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / WalletSignerPort

# Interface: WalletSignerPort

Per-method capability declaration (RFC-014 Amendment A).

Port presence is not capability: a port may exist but return UNSUPPORTED for a
method (e.g. the Omnia relay client's advanced topology ops). A port implements
`supports()` to report what it will actually attempt, so the manifest and the
live dispatch describe reality rather than the port's existence. Absent ⇒ the
method is assumed supported (pre-amendment behaviour).

## Extends

- [`SupportProbe`](SupportProbe.md)

## Methods

### broadcastHex()?

> `optional` **broadcastHex**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### broadcastTxPoW()?

> `optional` **broadcastTxPoW**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### connect()?

> `optional` **connect**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### createToken()?

> `optional` **createToken**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### getAccounts()?

> `optional` **getAccounts**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### getCoins()?

> `optional` **getCoins**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### getTxPermissions()?

> `optional` **getTxPermissions**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### getWotsStatus()?

> `optional` **getWotsStatus**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### grantTxPermission()?

> `optional` **grantTxPermission**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### mineTxPoW()?

> `optional` **mineTxPoW**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### proveOwnership()?

> `optional` **proveOwnership**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### revokeTxPermission()?

> `optional` **revokeTxPermission**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### sendComplex()?

> `optional` **sendComplex**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### sendTransaction()?

> `optional` **sendTransaction**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### signData()?

> `optional` **signData**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### signMessage()?

> `optional` **signMessage**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### signTransaction()?

> `optional` **signTransaction**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### supports()?

> `optional` **supports**(`method`): `boolean` \| \{ `reason?`: `string`; `supported`: `boolean`; \}

#### Parameters

##### method

`string`

#### Returns

`boolean` \| \{ `reason?`: `string`; `supported`: `boolean`; \}

#### Inherited from

[`SupportProbe`](SupportProbe.md).[`supports`](SupportProbe.md#supports)

***

### verify()?

> `optional` **verify**(`params`): `Promise`\<`unknown`\>

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>
