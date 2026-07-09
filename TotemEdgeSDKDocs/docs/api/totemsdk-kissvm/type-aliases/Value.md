[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / Value

# Type Alias: Value

> **Value** = `bigint` \| `string` \| `boolean` \| `Uint8Array`

KISSVM v1 public value type.
  bigint    — integer/fixed-point numeric values (scaled ×10⁸ internally)
  string    — hex literals (0x…), text strings [...]
  boolean   — TRUE / FALSE
  Uint8Array — raw byte arrays (hash digests, raw data)

NOTE: `number` (IEEE-754 float) is intentionally excluded from the public
type to prevent callers from relying on non-deterministic float arithmetic.
