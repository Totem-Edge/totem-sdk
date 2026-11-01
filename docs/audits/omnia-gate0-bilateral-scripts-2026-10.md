# Audit — RFC-054 Gate 0: bilateral HTLC and channel script proof, 2026-10

Status: **Gate 0 evidence for both v1 legs on both SDK VMs.** The on-chain HTLC leg
and the Eltoo channel leg are proven with real signatures and cross-checked across
implementations. Real-node inclusion (L3/L4) remains open.

Harnesses: `scripts/omnia-swap-vm.mjs` (`npm run test:swap:vm`) and
`scripts/omnia-channel-vm.mjs` (`npm run test:channel:vm`).

## Why

RFC-054 §10 Gate 0 requires the channel and HTLC scripts used by v1 to be exercised
"in the real VM": honest swap, refund before/after timelock, wrong preimage, wrong
amount/asset and counterparty withholding. RFC-069 §6 invariant 5 states the
requirement that gate exists to test: *"The channel leg MUST NOT be claimable after
its refund path is valid."*

## Method

- The on-chain HTLC script is built by the shipping builder
  (`HTLCHelper.createHTLC` → `buildHTLCScript`), not a copy.
- The channel script is built by the shipping builder (`buildEltooScript`), not a
  copy.
- Every case runs twice: the Rust/WASM KISSVM (`packages/kissvm/rust/pkg-node`) and
  the TypeScript evaluator, with **real** TreeKey signatures over the transaction
  digest. A case passes only when both agree *and* match the expected verdict.
- `@BLOCK` is supplied per case; `STATE(1)` carries the preimage for HTLC claims;
  `@COINAGE` is derived from the input coin's `coinCreatedBlock`.
- The legacy (pre-fix) HTLC template is included as a negative control.

## Results — HTLC leg

15/15 cases agree across both VMs.

| Case | Expected | Result |
|---|---|---|
| claim before timeout, correct preimage | accept | pass |
| claim exactly at timeout | accept | pass |
| claim after timeout | reject | pass |
| after timeout the preimage branch is inert (owner-only refund) | accept (refund) | pass |
| refund after timeout | accept | pass |
| refund at timeout | reject | pass |
| refund with recipient signature | reject | pass |
| claim with owner signature only | reject | pass |
| claim with wrong preimage | reject | pass |
| claim with no preimage | reject | pass |
| claim with tampered digest | reject | pass |
| raw-byte hashlock ≠ UTF-8-text hashlock | true | pass |
| preimage bytes do not satisfy a UTF-8-text hashlock | reject | pass |
| **legacy template accepts a claim after timeout (control)** | accept | pass |
| descriptor script matches `createHTLC` script | true | pass |

## Results — channel leg

16/16 cases agree across both VMs. The script under test is `buildEltooScript`:
`SETTLEMENT` (port 100), `SEQUENCE` (port 101), `MULTISIG(2 A B)` on both paths, and
a relative `@COINAGE GTE 256` contest delay on the settlement path only.

| Case | Expected | Result |
|---|---|---|
| update: both signatures, sequence advances | accept | pass |
| update: single signature | reject | pass |
| update: equal sequence | reject | pass |
| update: replayed stale sequence | reject | pass |
| update: outsider signature does not satisfy `MULTISIG(2)` | reject | pass |
| update: signatures over a tampered digest | reject | pass |
| settlement: both sigs, equal sequence, contest delay met | accept | pass |
| settlement: contest delay one block short | reject | pass |
| settlement: sequence mismatch | reject | pass |
| settlement: single signature | reject | pass |
| settlement: replayed stale settlement | reject | pass |
| settlement flag cannot be used to raise the sequence | reject | pass |
| update flag cannot close on an equal sequence | reject | pass |
| update path ignores the contest delay (relative, resets per update) | accept | pass |
| channel script is node-canonical (idempotent `toNodeScript`) | true | pass |
| channel script contains no `VERIFYOUT` | true | pass |

## Findings

### 1. The shipping HTLC template allowed claim-after-timeout (fixed)

The template was:

```
IF @BLOCK GT <timeout> AND SIGNEDBY(<owner>) THEN RETURN TRUE ENDIF
RETURN (SIGNEDBY(<recipient>) AND SHA3(STATE(1)) EQ <hash>)
```

The claim branch had no upper time bound, so after the timeout the recipient could
still claim while the owner could also refund — the two paths raced. This violates
RFC-069 §6 invariant 5. The control case in the harness demonstrates the old
behaviour (accept at block > timeout).

Fixed in `buildHTLCScript` (core and the extension copy):

```
IF @BLOCK GT <timeout> THEN RETURN SIGNEDBY(<owner>) ENDIF
RETURN (SIGNEDBY(<recipient>) AND SHA3(STATE(1)) EQ <hash>)
```

Semantics: at `@BLOCK <= timeout` only the claim path is reachable; at
`@BLOCK > timeout` only the refund path is. The descriptor builder and the helper
now share one implementation, so they cannot drift.

**Compatibility.** The script text — and therefore the derived address — changes for
new HTLCs. Existing `HTLCRecord`s store their own `htlcAddress`, so in-flight HTLCs
keep working with their original coins; any claim descriptor rebuilt from source for
an old coin would not match. No live swap feature exists, so there is no deployed
HTLC to migrate.

### 2. Rust/WASM lexer rejected `SHA3` as a user identifier (fixed)

The node-canonicality check classified tokens before checking case:

```rust
if !all_lower && !all_upper { return Err("identifier ... not node-canonical") }
```

`SHA3` contains a digit, so it was neither all-lower nor all-upper and was rejected
as a variable name. Every script containing `SHA3` — including every HTLC — could not
be parsed by the Rust/WASM VM, while the TypeScript evaluator and the Minima node
accepted it. The check now classifies keywords/functions first and applies
`^[a-z]+$` only to `TokenKind::Ident`. Unit tests added in `packages/kissvm/rust/src/lexer.rs`.

This is a parity defect, not a script defect: the fix belongs in the evaluator.

### 3. The v1 channel script is sound and is not exposed to the address conflation

All 14 behavioural channel cases agree across both VMs, including the two ways a
channel coin could be abused: closing on an equal/older sequence, and using the
settlement flag to advance the sequence. Both paths require `MULTISIG(2 A B)`, and
the contest delay applies only to settlement.

The script contains **no `VERIFYOUT`**. That matters because the L4 node audit
recorded an unresolved pubkey-vs-address conflation in `VERIFYOUT` scripts. The v1
bilateral channel does not use one, and `buildSettlementTx` takes settlement
addresses from the caller rather than deriving them from a pubkey digest, so RFC-054
v1 is outside that exposure. The affected scripts are the pooled VTXO/factory ones,
which RFC-054 §2 excludes.

## Not covered

- Real Minima node inclusion (L3/L4). The node harness lives outside this repository
  (`hawk-node/tests/test_custody_escape.cpp`); see
  `docs/audits/kissvm-node-validity-l4-2026-10.md`.
- Pooled VTXO/factory scripts and the unresolved `VERIFYOUT` address-vs-pubkey
  conflation recorded in that audit. RFC-054 v1 does not use them.
- Two-leg orchestration: quote binding, funding order, confirmation depth, secret
  generation, recovery. Those are RFC-054 §4–§7, not Gate 0.
- RFC-069 submarine-swap composition (these harnesses prove the shared legs only).

## Reproduction

```bash
# prerequisites: built core/omnia/kissvm dist, kissvm wasm nodejs build
node scripts/omnia-swap-vm.mjs     # HTLC leg
node scripts/omnia-channel-vm.mjs # channel leg
```
