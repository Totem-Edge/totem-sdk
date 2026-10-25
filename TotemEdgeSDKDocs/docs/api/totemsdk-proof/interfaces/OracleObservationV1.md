[**@totemsdk/proof**](../index.md)

***

[@totemsdk/proof](../index.md) / OracleObservationV1

# Interface: OracleObservationV1

A single canonical oracle observation (RFC-048 §3.1, verbatim).

## Properties

### contextHash

> **contextHash**: `string`

***

### domain

> **domain**: `"totem:oracle:observation:v1"`

***

### evidenceHash

> **evidenceHash**: `string`

***

### feedId

> **feedId**: `string`

***

### observedAtMs

> **observedAtMs**: `number`

***

### publisherId

> **publisherId**: `string`

***

### scale

> **scale**: `number`

***

### sequence

> **sequence**: `string`

***

### sourceId?

> `optional` **sourceId?**: `string`

Independent failure domain (e.g. an upstream provider); defaults to publisherId.

***

### subjectId

> **subjectId**: `string`

***

### unit

> **unit**: `string`

***

### validUntilMs

> **validUntilMs**: `number`

***

### valueAtoms

> **valueAtoms**: `string`
