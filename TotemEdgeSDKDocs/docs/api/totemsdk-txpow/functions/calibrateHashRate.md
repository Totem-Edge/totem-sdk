[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / calibrateHashRate

# Function: calibrateHashRate()

> **calibrateHashRate**(): `Promise`\<`number`\>

Run 100K trial SHA3-256 hashes and return the measured hash rate (hashes/sec).

Call once per session and cache the result — the cost is ~50ms on a
typical desktop and ~300ms on a mid-range mobile.

## Returns

`Promise`\<`number`\>
