[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / DeviceErrorTaxonomy

# Interface: DeviceErrorTaxonomy

## Methods

### classify()

> **classify**(`protocol`, `raw`): [`DeviceErrorClassification`](DeviceErrorClassification.md)

#### Parameters

##### protocol

`string` \| `undefined`

##### raw

`unknown`

#### Returns

[`DeviceErrorClassification`](DeviceErrorClassification.md)

***

### register()

> **register**(`protocol`, `rawCode`, `classification`): `void`

Register/override a classification for a protocol + raw code.

#### Parameters

##### protocol

`string`

##### rawCode

`string`

##### classification

[`DeviceErrorClass`](../type-aliases/DeviceErrorClass.md)

#### Returns

`void`
