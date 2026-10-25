[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / TxContext

# Interface: TxContext

Context supplied to the evaluator describing the spend transaction

## Properties

### allowLegacyMastBranches?

> `optional` **allowLegacyMastBranches?**: `boolean`

RFC-018 KISSVM-MAST-001: opt in to the legacy, unverified `mastBranches`
resolution path. Production MUST use witness ScriptProofs (`scriptProofs`)
bound to a MAST root; leaving this false makes MAST fail closed when no
verified proof is available.

***

### block

> **block**: `number`

Current block height

***

### blockMilli?

> `optional` **blockMilli?**: `number`

Current block timestamp in milliseconds

***

### inputIndex

> **inputIndex**: `number`

Index of the input coin being evaluated

***

### inputs

> **inputs**: [`CoinData`](CoinData.md)[]

All input coins

***

### mastBranches?

> `optional` **mastBranches?**: `Map`\<`string`, `string`\>

MAST branch resolution: maps hashHex (lowercase, 0x-prefixed) → scriptText.
The spender reveals the branch they are executing here.
Key = `'0x' + sha3_256(UPPER(trim(scriptText)))`

RFC-018 KISSVM-MAST-001: this legacy, unverified path is disabled by
default. Set [allowLegacyMastBranches](#allowlegacymastbranches) to opt in (development/tests).

***

### outputs

> **outputs**: [`OutputData`](OutputData.md)[]

All output coins

***

### prevCoins?

> `optional` **prevCoins?**: [`CoinData`](CoinData.md)[]

Previous input coins for SAMECOINS check.
If not provided SAMECOINS returns true (simulation default).

***

### prevState

> **prevState**: `Record`\<`number`, `string`\>

Previous state from the spent coin

***

### simulationMode?

> `optional` **simulationMode?**: `boolean`

When true, SIGNEDBY/CHECKSIG accept signature *presence* without
verifying against a txDigest.  Use ONLY for unit-testing script logic.
Never set in production or in simulateSpend — those paths always compute
a real txDigest and run full WOTS verification.

***

### state

> **state**: `Record`\<`number`, `string`\>

Current state (port → encoded string value)

***

### txDigest?

> `optional` **txDigest?**: `Uint8Array`\<`ArrayBufferLike`\>

32-byte transaction digest for signature verification
