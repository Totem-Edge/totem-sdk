[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / ExchangeHelper

# Class: ExchangeHelper

Exchange Contract Helper

Creates DEX-style exchange contracts using VERIFYOUT.

## Constructors

### Constructor

> **new ExchangeHelper**(): `ExchangeHelper`

#### Returns

`ExchangeHelper`

## Methods

### buildOfferState()

> `static` **buildOfferState**(`ownerPublicKey`, `desiredAddress`, `desiredAmount`, `desiredTokenId`): [`StateValue`](../interfaces/StateValue.md)[]

Build state variables for an exchange offer.

#### Parameters

##### ownerPublicKey

`string`

##### desiredAddress

`string`

##### desiredAmount

`string`

##### desiredTokenId

`string`

#### Returns

[`StateValue`](../interfaces/StateValue.md)[]

***

### buildTakeOfferDescriptor()

> `static` **buildTakeOfferDescriptor**(`address`, `ownerPublicKey`, `desiredAddress`, `desiredAmount`, `desiredTokenId`): [`ScriptDescriptor`](../interfaces/ScriptDescriptor.md)

Build ScriptDescriptor for taking an exchange offer.

#### Parameters

##### address

`string`

##### ownerPublicKey

`string`

##### desiredAddress

`string`

##### desiredAmount

`string`

##### desiredTokenId

`string`

#### Returns

[`ScriptDescriptor`](../interfaces/ScriptDescriptor.md)

***

### createOffer()

> `static` **createOffer**(`ownerPublicKey`, `desiredAddress`, `desiredAmount`, `desiredTokenId`): `object`

Create an exchange offer script.

Owner can cancel, or anyone can take the offer by providing
the specified output.

#### Parameters

##### ownerPublicKey

`string`

##### desiredAddress

`string`

##### desiredAmount

`string`

##### desiredTokenId

`string`

#### Returns

`object`

##### address

> **address**: `string`

##### script

> **script**: `string`

***

### validateExchange()

> `static` **validateExchange**(`outputs`, `expectedAddress`, `expectedAmount`, `expectedTokenId`, `inputIndex`): `object`

Validate VERIFYOUT for an exchange transaction.

#### Parameters

##### outputs

`object`[]

##### expectedAddress

`string`

##### expectedAmount

`string`

##### expectedTokenId

`string`

##### inputIndex

`number`

#### Returns

`object`

##### error?

> `optional` **error?**: `string`

##### valid

> **valid**: `boolean`
