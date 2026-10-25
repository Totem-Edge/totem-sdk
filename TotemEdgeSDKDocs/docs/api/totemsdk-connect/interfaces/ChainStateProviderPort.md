[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / ChainStateProviderPort

# Interface: ChainStateProviderPort

Per-method capability declaration (RFC-014 Amendment A).

Port presence is not capability: a port may exist but return UNSUPPORTED for a
method (e.g. the Omnia relay client's advanced topology ops). A port implements
`supports()` to report what it will actually attempt, so the manifest and the
live dispatch describe reality rather than the port's existence. Absent ⇒ the
method is assumed supported (pre-amendment behaviour).

## Extends

- [`SupportProbe`](SupportProbe.md)

## Methods

### broadcastTxPoW()?

> `optional` **broadcastTxPoW**(`txpowHex`): `Promise`\<`unknown`\>

#### Parameters

##### txpowHex

`string`

#### Returns

`Promise`\<`unknown`\>

***

### getCoin()?

> `optional` **getCoin**(`coinId`): `Promise`\<`unknown`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`unknown`\>

***

### getCoins()?

> `optional` **getCoins**(`query`): `Promise`\<`unknown`\>

#### Parameters

##### query

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### getProof()?

> `optional` **getProof**(`coinId`): `Promise`\<`unknown`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`unknown`\>

***

### getTip()?

> `optional` **getTip**(): `Promise`\<`unknown`\>

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
