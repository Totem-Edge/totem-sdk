# Totem SDK — Custody Policy

**Status:** Active
**Gate:** `scripts/validate-custody.mjs` (CI: `Lint + script hygiene` job)
**Source of truth:** `scripts/workspace-gates.config.json` → `packages[*].custody`,
surfaced into `SDK_MANIFEST.json` entries.

## 1. The test

> A capability is **non-custodial** iff every holder has an on-chain path to
> recover their funds **unilaterally**, after a defined timelock, **without any
> single third party's signature or liveness**. Otherwise it is
> **trust-minimised** (label it) or **custodial** (do not ship).

Three classifications, strictly ordered:

| Classification | Meaning | Ships? |
|---|---|---|
| `non-custodial` | A unilateral, timelocked, on-chain recovery path exists for every holder; no third party can move, freeze, or block recovery. | ✅ |
| `trust-minimised` | A third party can affect **liveness** (censor/delay) but cannot **steal**; every holder still has a recovery path. Must carry a `reason` and a `mitigation`. | ✅ (labelled) |
| `custodial` | A third party's signature or liveness is required to recover funds and no unilateral path exists. | ⛔ hard-fail |

Pure libraries that hold **no on-chain value** (primitives, transports, device
adapters, proof layers) are classified `non-custodial` — there is no value at
risk, so the test is vacuously satisfied. There is no `n/a`: every publishable
package carries a real label.

## 2. The reference shape

`@totemsdk/statechain` is the reference. A cooperative path **and** a unilateral,
timer-escaped owner path, with authorization expressed **in the script**:

```
LET OWNER=STATE(0)
IF @COINAGE GTE RECLAIM_TIMELOCK THEN
  RETURN SIGNEDBY(OWNER)          // unilateral escape — no SE signature
ENDIF
ASSERT MULTISIG(2 OWNER <SE>)     // cooperative path
RETURN TRUE
```

Every value-bearing capability must have this shape: **cooperative path +
unilateral timer-escaped owner path**. A script whose only spend path requires
`MULTISIG(N …)` / `BOTHSIGNED` (i.e. "all parties online") fails the gate.

## 3. Where custody is declared

Each publishable package declares custody in `scripts/workspace-gates.config.json`:

```jsonc
"packages/omnia-vtxo": {
  "status": "publishable",
  "maturity": "rc",
  "custody": {
    "classification": "non-custodial",
    "reason": "owner exit branch after exitTimelock; cooperative update is MULTISIG(2 operator owner)",
    "script": { "file": "packages/omnia-vtxo/src/pool-script.ts", "fn": "buildPoolScript" }
  }
}
```

- `classification` — one of the three above (required).
- `reason` — one line explaining the classification (required).
- `mitigation` — required for `trust-minimised`.
- `script` — **required for value-bearing `non-custodial`** packages: the
  `file` + exported `fn` that builds the locking script. The gate statically
  asserts the built script text contains a timelock escape combined with a
  single-signer/owner return.

`SDK_MANIFEST.json` entries mirror `custody` so the published catalog is
machine-readable (see `scripts/verify-sdk-manifest.mjs`).

## 4. Gate rules (`validate-custody.mjs`)

1. Every publishable package has a `custody.classification` from the enum.
2. `custodial` → **hard fail** (never shippable).
3. `trust-minimised` → must have `reason` + `mitigation`.
4. Value-bearing `non-custodial` (has `script`) → the script source must contain a
   timer-escaped path (`@COINAGE GTE` / `@BLOCK GT`) **and** an authorization
   condition — either a single-signer escape (`SIGNEDBY`) **or** a both-signer
   close (`BOTHSIGNED`, broadcast unilaterally as a pre-signed package).
5. `SDK_MANIFEST.json` `custody` must match the config.

> **Rule 4 is necessary, not sufficient.** It is a grep-level *existence* check: it
> cannot tell a **constrained** unilateral exit (e.g. `VERIFYOUT` to the owner's
> committed share) from an **unconstrained** one (`RETURN SIGNEDBY(OWNER)` paying
> anywhere). A single-signer spend path with no output/`VERIFYOUT`/committed-digest
> constraint lets the signer sweep the output — the "malicious unilateral close"
> class. The **golden fixtures** (`scripts/custody-golden.mjs --check`, CI after
> build) pin the exact built script so a custody-script change is always reviewed,
> but they still don't prove liveness. Real conformance is owned by the **dynamic
> canary** (§6): recover funds while the counterparty is offline **and** prove a
> malicious unilateral close fails.

## 5. Cross-cutting invariants (all packages)

- **Key-at-rest:** keys never leave the owner; storage per crypto-policy §11
  (AES-256-GCM, no plaintext seed); `wallet-adapter` exports no keys;
  `omnia-host`/`omnia-relay` keep the `TreeKey` in-wallet.
- **Authorization is cryptographic, not discretionary:** every value move is a
  WOTS/timelock/script condition — never a server's say-so.
- **Proof, not presence:** funding/MMR/ownership proofs must be *verified*, not
  merely non-null.
- **Exit confinement:** a custodial-capable path (operator-only) must **fail
  closed** once a non-custodial path exists.

## 6. Verification is part of "done"

A `non-custodial` claim must be *proven*, not asserted:

- **Static:** `validate-custody.mjs` asserts the unilateral path exists per script
  (rule 4).
- **Dynamic:** the Canary (RFC-041/042) recovers funds on a real isolated chain
  while the counterparty/operator/SE is **offline and withholding**, and a
  double-spend attempt is **rejected**.
- **Ladder:** a `custody:*` gate + a proof-ladder L3+ requirement; scripts that
  only support "both must sign" fail the custody gate.

## 7. Status board

| Package | Custody | Note |
|---|---|---|
| `@totemsdk/statechain` | non-custodial ✅ | reference — owner reclaim after `RECLAIM_TIMELOCK` |
| `@totemsdk/omnia` | non-custodial ✅ | co-signed close package (both-signed settlement) broadcast unilaterally after the contest delay; no single-signer spend path |
| `@totemsdk/omnia-vtxo` | non-custodial ✅ | per-share constrained exit after `EXITBLOCK` (each holder withdraws only its committed share); cooperative update co-signed |
| `@totemsdk/omnia-factory` | non-custodial ✅ | N-of-N close + per-party escape after the absolute block in `STATE(103)` |
| `@totemsdk/omnia-pool` | non-custodial ✅ | inherits the VTXO pool script |
| `@totemsdk/omnia-splice` | non-custodial ✅ | inherits the channel script |
| `@totemsdk/liquidity-bond` | non-custodial ✅ | data-only (no value held) — disclaimed |
| `@totemsdk/provider-bond` | non-custodial ✅ | data-only (no value held) — disclaimed |

All other packages hold no on-chain value and are `non-custodial`.
