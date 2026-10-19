# State-Port Registry

Status: **normative for the MSHS boundary; declarative for Omnia bands.** Machine-checked by
[`scripts/check-state-ports.mjs`](../scripts/check-state-ports.mjs) against
[`scripts/state-port-registry.json`](../scripts/state-port-registry.json) (`npm run validate:ports`).

Sources: RFC-048 §12, RFC-049 §5, node RFC-0001 (MSHS-2 port reservation).

---

## 1. Why this exists

Minima state variables are addressed by **ports**, and ports are **bytes (0–255)** — a scarce,
fixed namespace. MSHS-2 (MASH) authorization reserves the **top band**, and a Direct-Mode script
MUST NOT put that band inside any `SAMESTATE` range. Omnia's variable-length bands (per-party
shares) grow with the number of participants, so where they start decides how many parties fit
before colliding with MSHS. This registry makes the allocation explicit and gated so a composite
(MASH + Omnia + MAST) transaction can be checked, not guessed.

## 2. Ports are per-coin namespaces

Two scripts on **different coins** may reuse the same port numbers — a port is a slot on *that*
coin. Bands therefore may overlap **across coin classes** (e.g. `omnia-programs` and `omnia-share`
overlap), and this is not a collision. What is never allowed is a band crossing the MSHS boundary,
or a `SAMESTATE` range spanning it.

## 3. Bands

| Band | Range | Owner | Notes |
|---|---|---|---|
| `legacy` | 0–99 | legacy scripts, `statechain` | general/legacy state ports |
| `omnia-control` | 100–119 | `omnia*` | channel/factory control — `100` SETTLEMENT, `101` SEQUENCE, `102` COMMITMENT, `103` escape |
| `omnia-programs` | 120–183 | `omnia` (`program.ts`) | COUNTER 120–122, METER 130–133, HTLC 140–144, VAULT 150–152, TREASURY 160–164, MEMBERSHIP 170–172, ASSET 180–183 |
| `omnia-share` | 128–229 | `omnia-factory`, `omnia-vtxo` | per-party share band, **base 128** (max 102 parties) |
| **MSHS-2** | **230–255** | **node (MASH / MSHS-2)** | reserved — header `R/ROOTS_BLOB/SECRETS_BLOB/TREE_SIG` at 230–233, `PROOF` at 234–255; **no `SAMESTATE` range may span this band** |

## 4. Rules

- **R-MASH-1** — MASH state lives only in the MSHS band (≥ 230); no other package may allocate there.
- **R-MASH-2** — Omnia variable-length bands (party shares) MUST be allocated below the MSHS floor (base 128).
- **R-MASH-3** — no `SAMESTATE` range may span the MSHS band.
- **R-MASH-4** — a composite (MASH + Omnia + MAST) transaction MUST publish a port-allocation table and pass an instruction-budget check.
- **R-MASH-5** — Omnia scripts MUST NOT embed the full MASH verifier in the update path.

## 5. Package → bands

| Package | Coin class | Declared bands | Share base |
|---|---|---|---|
| `statechain` | statechain | `legacy` | — |
| `omnia` | channel | `omnia-control`, `omnia-programs` | — |
| `omnia-factory` | factory | `omnia-control`, `omnia-share` | `FACTORY_BALANCE_PORT_BASE = 128` |
| `omnia-vtxo` | vtxo | `omnia-control`, `omnia-share` | `POOL_SHARE_PORT_BASE = 128` |

## 6. What the gate enforces

1. **Registry integrity** — bands within 0–255, none crossing the MSHS floor, MSHS band exactly `[230, 255]`, unique ids, package references valid.
2. **In-band scripts** — every `STATE(...)`/`PREVSTATE(...)` port emitted by a gated package falls inside the bands declared for that package (and ≤ 255).
3. **No MSHS-spanning `SAMESTATE`** (R-MASH-3).
4. **Declared share bases** match the package constants.
5. **Builders refuse out-of-band ports** (party count capped so share ports stay below the floor).

## 7. Adding a band

1. Add the band to `scripts/state-port-registry.json` (range, owner, notes) — below the MSHS floor.
2. Register the owning package (or coin class) under `packages`/`shareBases`.
3. Run `npm run validate:ports`; the gate fails if any emitted port is outside the declared bands.

Phase 0 open item: confirm the **exact** MSHS-2 range endpoints from the node and, if a composite
script is added, publish its port-allocation table (R-MASH-4).
