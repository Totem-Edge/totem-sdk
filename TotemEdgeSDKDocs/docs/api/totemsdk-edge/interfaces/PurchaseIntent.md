[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / PurchaseIntent

# Interface: PurchaseIntent\<Resource, Constraints\>

A generic demand-side intent.

`Resource` is an open-ended string (e.g. "compute", "storage", "bandwidth",
"energy", "sensor-data", "api", "robot-action"). `Constraints` is a typed
extensible payload — not an unrestricted giant Record.

## Type Parameters

### Resource

`Resource` *extends* `string` = `string`

### Constraints

`Constraints` = `unknown`

## Properties

### constraints?

> `optional` **constraints?**: `Constraints`

***

### expiresAt?

> `optional` **expiresAt?**: `number`

***

### id

> **id**: `string`

***

### maxSpend?

> `optional` **maxSpend?**: `object`

#### amount

> **amount**: `string`

#### tokenId?

> `optional` **tokenId?**: `string`

***

### negotiate?

> `optional` **negotiate?**: `boolean`

***

### preferredPaymentMethods?

> `optional` **preferredPaymentMethods?**: `string`[]

***

### provider?

> `optional` **provider?**: `string`

***

### quantity?

> `optional` **quantity?**: `object`

#### amount

> **amount**: `string`

#### unit

> **unit**: `string`

***

### resource

> **resource**: `Resource`
