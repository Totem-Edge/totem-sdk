[**@axia/totem-dex**](../index.md)

***

[@axia/totem-dex](../index.md) / AxiaDex

# Class: AxiaDex

## Constructors

### Constructor

> **new AxiaDex**(`cfg`): `AxiaDex`

#### Parameters

##### cfg

[`DexConfig`](../type-aliases/DexConfig.md)

#### Returns

`AxiaDex`

## Properties

### cfg

> **cfg**: [`DexConfig`](../type-aliases/DexConfig.md)

## Methods

### base()

> **base**(): `string`

#### Returns

`string`

***

### listPools()

> **listPools**(): `Promise`\<`any`\>

#### Returns

`Promise`\<`any`\>

***

### proj()

> **proj**(): `string`

Base path including project scope: /v1/{projectId}

#### Returns

`string`

***

### quote()

> **quote**(`req`): `Promise`\<[`QuoteResp`](../type-aliases/QuoteResp.md)\>

#### Parameters

##### req

[`QuoteReq`](../type-aliases/QuoteReq.md)

#### Returns

`Promise`\<[`QuoteResp`](../type-aliases/QuoteResp.md)\>

***

### rfqSwap()

> **rfqSwap**(`req`, `pick?`): `Promise`\<\{ `best`: `any`; `rfq`: `any`; \}\>

rfqSwap:
  1) Ask Axia RFQ aggregator for offers
  2) Pick best offer (or custom predicate)
  3) Caller signs intent (use signIntent()) and then coordinates with chosen solver/build path (out of scope here)

#### Parameters

##### req

###### amountIn

`number`

###### deadlineMs?

`number`

###### maxRelayFee?

`number`

###### poolId

`string`

###### recipient

`string`

###### tokenIn

`string`

###### windowMs?

`number`

##### pick?

(`offers`) => `any`

#### Returns

`Promise`\<\{ `best`: `any`; `rfq`: `any`; \}\>

***

### signIntent()

> **signIntent**(`payload`): `Promise`\<\{ `payload`: `any`; `publickey`: `string`; `signature`: `string`; \}\>

#### Parameters

##### payload

`any`

#### Returns

`Promise`\<\{ `payload`: `any`; `publickey`: `string`; `signature`: `string`; \}\>

***

### submitTx()

> **submitTx**(`dataHex`): `Promise`\<\{ `txpowid`: `string`; \}\>

#### Parameters

##### dataHex

`string`

#### Returns

`Promise`\<\{ `txpowid`: `string`; \}\>

***

### txStatus()

> **txStatus**(`txpowid`): `Promise`\<`any`\>

#### Parameters

##### txpowid

`string`

#### Returns

`Promise`\<`any`\>

***

### ws()

> **ws**(): `string`

#### Returns

`string`

***

### wsSubscribe()

> **wsSubscribe**(`topic`, `handler`): () => `void`

#### Parameters

##### topic

`string`

##### handler

(`msg`) => `void`

#### Returns

() => `void`
