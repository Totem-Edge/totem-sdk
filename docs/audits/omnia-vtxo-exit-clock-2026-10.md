# Omnia VTXO exit-clock audit (October 2026)

Status: verified against current `main`; fix applied

## Finding

The October 2026 external assessment flagged two P0 issues in the VTXO pool script:

1. **Share-state contradiction** — `LET SHARE = STATE(200)` combined with
   `ASSERT STATE(200) EQ 0` in the same branch.
2. **Exit-clock ordering** — `SAMESTATE(102 102)` appeared *after* the
   holder-exit branch. A successful exit returns before the guard, so an exit
   spend could mutate `STATE(102)` in the successor pool coin (moving the exit
   clock and allowing early exits or locking other holders).

## Current state

- Share reads and payouts already use `PREVSTATE(base+k)`; the successor sets
  `STATE(base+k) EQ 0`. Issue 1 is fixed.
- The exit deadline already uses `PREVSTATE(102)`, but the `SAMESTATE(102 102)`
  guard was still after the exit branch. Issue 2 was present.

## Fix

`packages/omnia-vtxo/src/pool-script.ts` now binds the exit clock **before** the
branch:

```
ASSERT SAMESTATE(102 102)
LET epoch=STATE(101)
LET exitblock=PREVSTATE(102)
IF @BLOCK GT exitblock THEN ... ENDIF
```

The factory script already placed `SAMESTATE(103 103)` before its escape
branch, so no change was needed there.

## Verification

- `scripts/custody-exec.mjs` (TypeScript VM):
  - honest full/partial exits execute;
  - successor must zero the share;
  - **exit-block mutation rejected**;
  - pre-expiry exit rejected;
  - overlarge payout rejected.
- `scripts/custody-exec-vm.mjs` (Rust/WASM + TS, real TreeKey signatures):
  - the same cases, including **multi-holder share preservation** and rejection
    when another holder's share is zeroed;
  - cooperative update that mutates the exit clock rejected.
- `scripts/custody-golden.mjs --check` (fixture regenerated intentionally).

## Remaining

- A fully isolated Minima-node L4 run (real chain inclusion) remains the bar
  before pooled capital with third-party funds.
- Broader state-continuity review (root/epoch mutation on exit, not only the
  exit clock) is recommended before pooled/VTXO liquidity.
- The full pooled-capital gate is **RFC-050 §7.1** (L4 exit proof, state
  continuity, settlement-aware accounting, adversarial routing).
