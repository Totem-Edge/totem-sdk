[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / STATECHAIN\_RECORD\_VERSION

# Variable: STATECHAIN\_RECORD\_VERSION

> `const` **STATECHAIN\_RECORD\_VERSION**: `1` = `1`

On-disk registry format version (independent of on-chain protocol version).
Bumping this means old snapshots must be explicitly refused (RFC-007 §4.2) —
valuable state (signing history, `reclaimTx` recovery material) is never
silently reinitialised.
