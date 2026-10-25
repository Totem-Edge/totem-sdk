[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / ScriptDisclosure

# Interface: ScriptDisclosure

## Properties

### mmrProof

> **mmrProof**: `string`

MMR proof that this script is in the policy root.

***

### policyRoot

> **policyRoot**: `string`

The policy root (canonical MMR root) this script is a leaf of. Required for
canonical MAST witness materialization (RFC-016): without it the proof
cannot be verified against a root, so it is mandatory and never defaulted.

***

### script

> **script**: `string`

The KISS VM script text.

***

### scriptHash

> **scriptHash**: `string`

The script hash.
