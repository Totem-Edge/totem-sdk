[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / OracleCommitment

# Interface: OracleCommitment

## Properties

### feedHash

> **feedHash**: `string`

Feed/schema commitment (hex) — e.g. sha3 of `feedId|unit|scale`.

***

### observedAtBlock

> **observedAtBlock**: `bigint`

Earliest block the observation is valid (block-based freshness).

***

### validUntilBlock

> **validUntilBlock**: `bigint`

Block after which the observation is stale.

***

### valueAtoms

> **valueAtoms**: `bigint`

Canonical signed integer value (atoms).
