[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / MinimaScriptProof

# Interface: MinimaScriptProof

Canonical MAST compiler — produces Minima-compatible MMR roots,
script addresses, and ScriptProofs using the core package's
byte-exact MMR primitives.

Algorithm (matching Minima Address.java + MMRSet.java):
  1. Use the EXACT script text (no normalization — Minima commits to
     the script as-is via MiniString encoding)
  2. Compute MMR leaf: sha3(MiniNumber.ZERO || MiniString(script) || MiniNumber.ZERO)
  3. Build MMR tree from all script leaves using canonical parent construction
  4. Compute Mx address from root via Base32 encoding
  5. Generate MMR proofs for each leaf including peak-bagging steps

Peak bagging uses iterative adjacent-pairing (matching Minima Java's
MMRSet.getMMRRoot) rather than right-to-left chaining.

This implementation handles arbitrary leaf counts (not just powers of 2).

## Properties

### address

> **address**: `string`

***

### proofHex

> **proofHex**: `string`

***

### script

> **script**: `string`
