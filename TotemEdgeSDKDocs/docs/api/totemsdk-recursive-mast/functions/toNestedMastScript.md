[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / toNestedMastScript

# Function: toNestedMastScript()

> **toNestedMastScript**(`chain`): `string`

Generate the full nested MAST KISSVM script for a proof chain.

Each level uses `MAST 0x<root>` to auto-load the next script from the
transaction witness. The VM looks up the witness ScriptProof whose
calculated address equals the given root, parses it, and executes it
in the same contract context.

VM limits: 64 stack depth, 1,024 instructions shared across all frames.

## Parameters

### chain

[`ProofChain`](../interfaces/ProofChain.md)

## Returns

`string`

KISSVM script with nested MAST expressions.
