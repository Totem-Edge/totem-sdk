[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / buildAndHashFactoryScript

# Function: buildAndHashFactoryScript()

> **buildAndHashFactoryScript**(`participants`, `options?`): `object`

Build the factory script and compute its canonical address in one step.
The address is used as the output address of the factory funding TX.

## Parameters

### participants

[`FactoryParticipant`](../interfaces/FactoryParticipant.md)[]

### options?

`FactoryScriptOptions` = `{}`

## Returns

`object`

### address

> **address**: `string`

### script

> **script**: `string`
