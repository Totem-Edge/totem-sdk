# RFC-039 — Custody Conformance

Status: Landed — policy + gate + the three structural script fixes (omnia, omnia-factory, omnia-vtxo)
Created: 2026-10-15
Authors: Totem SDK Contributors
Depends on: RFC-038 (VTXO operator), RFC-035 (peer coordination), RFC-014 (capability manifest)
Touches: all `@totemsdk/*` packages (classification); `@totemsdk/omnia`, `@totemsdk/omnia-factory`, `@totemsdk/omnia-vtxo`, `@totemsdk/statechain`

## 1. Problem

The Omnia family shipped several fund-holding scripts with **no unilateral exit**:
a party could be stranded by an unresponsive peer/operator. Some packages were
custodial (funds moveable only by an operator's signature) and some bonds were
data-only yet sat in a value-adjacent slot. There was no machine-checked custody
claim, so a custodial capability could ship unlabelled.

## 2. The test

A capability is **non-custodial** iff every holder has an on-chain path to recover
funds **unilaterally**, after a defined timelock, **without any single third
party's signature or liveness**. Otherwise it is **trust-minimised** (label it) or
**custodial** (do not ship). See `docs/CUSTODY-POLICY.md` for the full policy.

**Reference shape** (`@totemsdk/statechain`): cooperative path **and** a
unilateral timer-escaped owner path, authorization in the script:

```
IF @COINAGE GTE <TIMELOCK> THEN RETURN SIGNEDBY(OWNER) ENDIF
ASSERT MULTISIG(2 OWNER <PEER>)
RETURN TRUE
```

## 3. Decisions

### 3.1 Machine-checked custody (landed)

- `scripts/workspace-gates.config.json` → every publishable package carries
  `custody: { classification, reason, mitigation?, script? }`.
- `scripts/validate-custody.mjs` (CI: **Custody conformance gate**):
  1. every publishable package is classified; `custodial` is a **hard fail**;
  2. `trust-minimised` requires `reason` + `mitigation`;
  3. value-bearing `non-custodial` scripts must contain a timelock escape
     (`@COINAGE GTE` / `@BLOCK GT`) **and** a single-signer return (`SIGNEDBY`);
  4. `SDK_MANIFEST.json` custody matches the config.
- `scripts/verify-sdk-manifest.mjs` surfaces `custody` into `SDK_MANIFEST.json`.

### 3.2 omnia — unilateral *broadcast* of the co-signed close (corrected)

`buildEltooScript` **keeps `ASSERT BOTHSIGNED` on both spend paths** (update and
settlement). That is the output constraint: only a transaction both parties signed
— i.e. the agreed state split — can be spent. Unilateral close is achieved by
**broadcasting the co-signed close package**: each state carries a
update + settlement tx pre-signed by *both* parties
(`settlement.ts` `startUnilateralClose`/`finalizeUnilateralClose`); the witness
already contains both signatures, so either party can relay it alone after the
contest delay — no counterparty liveness, and no theft vector.

> **Correction.** An earlier revision replaced the settlement `ASSERT BOTHSIGNED`
> with a single-signer branch (`IF SIGNEDBY(A) … RETURN SIGNEDBY(B)`). That was a
> critical regression: with no `VERIFYOUT`/committed-state constraint, one party
> could broadcast a settlement paying itself everything. It was also unnecessary —
> broadcasting a *both-signed* settlement is already permissionless. Reverted (and
> mirrored in Rust). A single-signer settlement may only be reintroduced together
> with an explicit output constraint (VERIFYOUT to committed shares, or a committed
> state digest).

### 3.3 omnia-factory — per-party timeout escape (landed)

`buildFactoryScript` keeps the N-of-N cooperative path and adds, before it, a
per-party branch after `@COINAGE GTE timeoutBlocks`: party k alone withdraws
`SHARE_k = STATE(200+k)` to its settlement address, **zeroes** `STATE(200+k)`,
keeps the others' balances unchanged (`STATE(j) EQ PREVSTATE(j)`), and returns
the remainder to the factory script. `factoryBalanceStateVariables` seeds the
balances; `buildFundingTx` carries them.

### 3.4 omnia-vtxo — non-custodial pool (landed; RFC-038 V2)

`buildPoolScript` gained the owner escape
(`IF @BLOCK GT EXITBLOCK THEN RETURN SIGNEDBY(OWNER)`); cooperative root updates
are `MULTISIG(2 operator owner)` with `SAMESTATE(102 102)` (the operator cannot
push the owner's clock) and `VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`
(the operator can never pay itself). The exit tx is owner-signed.

> **Ownership model — open.** The escape is unconstrained
> (`RETURN SIGNEDBY(OWNER)` may pay anywhere) and assumes a **single-owner pool**:
> the `OWNER` is the sole beneficiary, so an unconstrained exit is a
> self-withdrawal, not theft. If a pool backs **multiple holders' VTXOs** under
> one `OWNER`, that owner can rug the other holders after `EXITBLOCK`. Shared
> pools therefore require a **per-share, output-constrained** exit
> (`VERIFYOUT` to each holder's committed share). Until that lands, pools must be
> single-owner or shared pools are `trust-minimised`.

### 3.5 Bonds — disclaim (landed)

`@totemsdk/liquidity-bond` and `@totemsdk/provider-bond` are **data-only,
non-custodial**: they hold no on-chain value and lock no funds. Their lock/bond
terms are off-chain records/proofs. Enforcing an on-chain bond is a separate
future capability, not claimed here.

## 4. Cross-cutting invariants

Key-at-rest (keys never leave the owner; `wallet-adapter` exports no keys;
`omnia-host`/`omnia-relay` keep the `TreeKey` in-wallet); cryptographic
authorization (never a server's say-so); proof-not-presence; exit confinement (a
custodial-capable path must fail closed once a non-custodial path exists).

## 5. Verification (in progress)

- **Static:** rule 3 above asserts the unilateral path exists per script.
- **Dynamic:** Canary custody scenarios — recover funds on a real isolated chain
  while the counterparty/operator/SE is **offline and withholding**, plus a
  rejected double-spend — and a proof-ladder L3+ `custody:*` requirement. Tracked
  under RFC-041/042.

## 6. Status board

| Package | Before | After |
|---|---|---|
| `@totemsdk/omnia` | griefable (both must sign) | non-custodial (unilateral close) |
| `@totemsdk/omnia-factory` | griefable (N-of-N only) | non-custodial (per-party escape) |
| `@totemsdk/omnia-vtxo` | custodial (operator-only) | non-custodial (owner exit) |
| `@totemsdk/omnia-pool` | inherited custody | non-custodial (inherits VTXO pool) |
| `@totemsdk/omnia-splice` | co-signed | non-custodial (inherits channel) |
| `@totemsdk/statechain` | non-custodial ✅ | non-custodial (reference) |
| `@totemsdk/liquidity-bond` | data-only ⚠️ | non-custodial (disclaimed) |
| `@totemsdk/provider-bond` | data-only ⚠️ | non-custodial (disclaimed) |

## 7. Sequencing (remaining)

1. Canary custody scenarios (offline-withholding recovery + rejected
   double-spend) and ladder wiring (RFC-041/042).
2. RFC-038 V3/V4 (owner↔operator transport; operator spent-set enforcement).
3. Optional: enforce bonds on-chain (owner reclaim + proof-gated slashing).
