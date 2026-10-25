[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / MmrMembershipCovenantConfig

# Interface: MmrMembershipCovenantConfig

MMR membership covenant (RFC-048 §12.4) — prove, on-chain, that a runtime leaf
is included in a committed MMR root, using the canonical `PROOF` opcode.

This is the per-leaf primitive behind **committed-set-root scaling**: rather
than emitting one escape branch per party (an O(N) script), the spender commits
its leaf and MMR proof to state and the script verifies inclusion against the
committed root. The leaf is the signer's own WOTS public-key digest (`0x…`), so
`SIGNEDBY(leaf)` binds the identity and `VERIFYOUT(0 leaf …)` pays exactly it.

Runtime typing (matches a Minima node): the `data` operand is a HEX leaf when
its evaluated value starts with `0x` (hashed from raw bytes) and a SCRIPT leaf
otherwise. Here the leaf is supplied via `STATE(leafPort)` as `0x<pubkey>`, so
it types as HEX and matches an `MMRTree.fromPublicKeys(...)` root.

## Properties

### addressPort?

> `optional` **addressPort?**: `number`

Optional state port carrying the payout **address data** (the node's VERIFYOUT
compares address data, not the pubkey). When set, the payout goes to
`STATE(addressPort)`; otherwise it falls back to the leaf (compat).

***

### leafPort

> **leafPort**: `number`

State port where the spender commits the leaf data (`0x<pubkey>`).

***

### leafSum?

> `optional` **leafSum?**: `bigint`

Leaf sum value (fixed). Default 0. Ignored when `leafSumPort` is set.

***

### leafSumPort?

> `optional` **leafSumPort?**: `number`

State port where the spender commits the leaf sum (e.g. a committed balance).
When set, overrides `leafSum`.

***

### pay?

> `optional` **pay?**: `boolean`

Pay the whole balance to the leaf identity (default `true`).

***

### proofPort

> **proofPort**: `number`

State port where the spender commits the serialized MMR proof (`0x…`).

***

### requireSignature?

> `optional` **requireSignature?**: `boolean`

Require the signer's key to equal the leaf (default `true`).

***

### rootPort

> **rootPort**: `number`

State port holding the committed MMR root (pinned immutable via `SAMESTATE`).

***

### rootSum?

> `optional` **rootSum?**: `bigint`

Root sum value (fixed). Default 0. Ignored when `rootSumPort` is set.

***

### rootSumPort?

> `optional` **rootSumPort?**: `number`

State port where the spender commits the root sum (e.g. total committed).
When set, overrides `rootSum`.

***

### tokenId?

> `optional` **tokenId?**: `string`

Asset id (hex). Defaults to `0x00` (MINIMA).
