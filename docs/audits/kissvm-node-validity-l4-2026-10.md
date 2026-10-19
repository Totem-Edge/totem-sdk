# Audit — SDK KISSVM scripts vs the real node KISSVM (L4 direction), 2026-10

Status: **findings + harness.** Proof-ladder **L4 direction** (real Minima VM), not yet an isolated
chain. Harness: `hawk-node/tests/test_custody_escape.cpp` (the node's real `Contract`, injected
signatures, `setGlobals` for `@BLOCK`). Builds and runs the SDK's VTXO **pool owner-exit** branch.

## Why

RFC-048 §3.1 warns: *"Confirm KISSVM signature format and witness semantics with the actual Minima VM
before advertising unilateral enforceability."* The SDK's scripts are exercised only by the SDK's own
TS and Rust evaluators. This run puts the same branch through the **node's C++ KISSVM**.

## Findings

### 1. The SDK's generated scripts are **not node-parseable** (tokenizer rejects them)

The node tokenizer (`org/minima/kissvm/tokens/script_tokenizer.cpp`) enforces:

| Rule | Node | SDK emits |
|---|---|---|
| variable names | `isVariable = ^[a-z]+$` (lowercase letters only, **no digits/underscore**) | `EPOCH`, `SHARE0`, `SETTLEMENT`, `MATURITY`, … |
| hex literals | `isHex = ^0x[0-9a-fA-F]+$` (**lowercase `0x`**) | `0X…` (uppercase X, via `pkHex`/`kissHex`) |
| arithmetic | operators `+` `-` (word ops are boolean only: `GT/LT/EQ/GTE/LTE/NEQ/…`) | `ADD`, `SUB` |

The node throws `Incorrect Token found @ …` on the first violation (`LET EPOCH=…` →
`… @ 9 EPOCH`). Consequences: **no SDK script parses on the node** as generated. This is not a
crypto gap — the branch logic is fine — it is a **syntax/representation** gap.

### 2. Address ↔ pubkey conflation

The node's `VERIFYOUT` compares the **output coin's address data**
(`address.isEqual(cc->getAddress())`, `functions/txn/output/v_e_r_i_f_y_o_u_t.cpp`), while `SIGNEDBY`
compares a **WOTS pubkey**. The SDK's escape/close scripts use the **same value** (a WOTS pubkey
digest) for both, and `omnia-vtxo/exit-tx.ts` sets the payout output `address` to that pubkey digest.
The harness confirms it:

- output address = the holder **pubkey digest** → escape passes;
- output address = the **Mx address** derived from the holder's script → `VERIFYOUT` **fails**.

So the SDK's scripts assume the output "address" is the raw pubkey digest — a non-standard address
form. Either the scripts must `VERIFYOUT` the holder's **address** (script-derived), or the raw-pubkey
address must be shown to be valid/standard.

### 3. With node-valid syntax + raw-pubkey addresses, the escape **passes** (3/3)

Rewriting the same branch with lowercase variable names, `0x`, and `-` arithmetic, and using the
pubkey digest as the payout address, the node's `Contract` accepts it (and correctly rejects the
Mx-address and non-zeroing-successor variants). **The branch logic is sound; the gap is syntax and
address representation.**

## Impact

- The SDK's on-chain scripts have **not** been validated against the real node; claims of unilateral
  on-chain enforceability are **unproven** (exactly the RFC-048 §3.1 caveat).
- The SDK evaluators (TS + Rust) accept a syntax/address model the node rejects, so their "pass" is
  not evidence of node validity.

## Follow-ups (tracked)

1. **Script syntax.** Make the KISSVM script builders (or a normalizer in `@totemsdk/kissvm`) emit
   **node-valid syntax**: lowercase `[a-z]+` variable names (rename `EPOCH`→`epoch`, `SHARE0`→`share`,
   etc. — avoid digits), lowercase `0x`, and `-`/`+` arithmetic (retire `SUB`/`ADD`). Or add a
   `normalizeForNode(script)` pass and a gate that round-trips every generated script through the node
   tokenizer.
2. **Address model.** Resolve the pubkey↔address conflation: use the holder's **address** in
   `VERIFYOUT` (and keep the pubkey only in `SIGNEDBY`), or confirm raw-pubkey addresses are valid.
3. **Gate.** Wire the node harness (`test_custody_escape`) into CI as the **L4 syntax/VM check**, and
   extend it to the factory/vtxo/eltoo scripts.
