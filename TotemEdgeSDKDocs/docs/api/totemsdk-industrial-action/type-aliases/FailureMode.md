[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / FailureMode

# Type Alias: FailureMode

> **FailureMode** = `"fail-safe"` \| `"fail-silent"` \| `"fail-closed"` \| `"fail-operational"` \| `"abort"`

How an action behaves when an attempt does not confirm (RFC-011 §4.11).
Mandatory for `write`-effect actions; `read` defaults to `fail-silent`.
