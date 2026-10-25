[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / toWireQuantity

# Function: toWireQuantity()

> **toWireQuantity**(`quantity`, `address`, `units?`): [`Quantity`](../interfaces/Quantity.md)

Convert a definition's canonical quantity to a resource address's wire unit
(RFC-011 §4.1/§4.2). Returns the quantity unchanged when the address declares
no unit.

## Parameters

### quantity

[`Quantity`](../interfaces/Quantity.md)

### address

[`ResourceAddress`](../interfaces/ResourceAddress.md)

### units?

[`UnitRegistry`](../interfaces/UnitRegistry.md) = `...`

## Returns

[`Quantity`](../interfaces/Quantity.md)
