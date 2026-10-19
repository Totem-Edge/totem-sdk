# Composite Port-Allocation Table

Status: **normative for declared composites.** Machine-checked by
[`scripts/check-composite-ports.mjs`](../scripts/check-composite-ports.mjs) against
[`scripts/state-port-registry.json`](../scripts/state-port-registry.json) (`npm run validate:composite-ports`).

Sources: RFC-049 §5 (R-MASH-1/3/4/5), RFC-048 §12, node RFC-0001 (MSHS-2).

---

## 1. Why

A **composite** transaction carries several scripts on **one coin** — MASH (MSHS‑2 authorization)
plus Omnia (channel / factory / VTXO) plus, optionally, a MAST policy template. Because ports are
**per‑coin namespaces**, two scripts on the *same* coin must use **disjoint** ports; and only MASH
may use the reserved MSHS band. R‑MASH‑4 requires such a composite to **publish a port‑allocation
table and pass an instruction‑budget check**. This is that table and check.

## 2. Allocation table

| Composite | Coin class | Participant | Bands (ports) | Budget |
|---|---|---|---|---|
| `mash+omnia-channel` | channel | mash | `mshs` (230–255) | |
| | | omnia | `omnia-control` (100–119), `omnia-programs` (120–183) | **ok** (795 + ~75 = 870 ≤ 1024) |
| `mash+omnia-factory` | factory | mash | `mshs` (230–255) | |
| | | omnia-factory | `omnia-control` (100–119), `omnia-share` (128–229) | **over** (795 + ~247 = 1042 > 1024) |
| `mash+omnia-vtxo` | vtxo | mash | `mshs` (230–255) | |
| | | omnia-vtxo | `omnia-control` (100–119), `omnia-share` (128–229) | **ok** (795 + ~143 = 938 ≤ 1024) |

Port ranges per participant are the union of its declared bands (see
[`STATE-PORT-REGISTRY.md`](STATE-PORT-REGISTRY.md)). Within a composite they are pairwise disjoint.

## 3. Rules

- **Disjointness.** On one coin, no two participants' port ranges may overlap.
- **MSHS reservation (R‑MASH‑1).** Only `mash` uses 230–255; no other participant allocates there.
- **No `SAMESTATE` span (R‑MASH‑3).** No `SAMESTATE` range may span the MSHS band (checked by
  `check-state-ports`).
- **Instruction budget (R‑MASH‑4/5).** `MASH envelope + Omnia op bound ≤ 1024`. The MASH wallet
  envelope is `795 + 12·(inputs−1) + 37·(outputs−1)` (`mshs2_modes.hpp`, depth‑15). The Omnia op
  bound is a **path‑independent upper bound** (AST node count).

## 4. The factory budget finding

`mash+omnia-factory` is **over budget** (conservative bound 1042 > 1024): the MASH envelope alone is
795, leaving ~229 ops, and the factory script's upper bound is ~247. This is why **R‑MASH‑5** says the
MASH verifier belongs at the boundaries as a MAST dispatch, not inlined. Consequences:

- **Model A** (MASH governs the factory's funding/settlement *boundaries*, existing Omnia script
  unchanged) is unaffected — MASH and the factory script are on different coins.
- **Model B** (MASH‑aware factory, same coin) is **not currently feasible**: the composite needs a
  trimmed factory script (or a per‑branch budget) before it can be claimed. The registry records this
  explicitly (`instructionBudget: "over"`), so the gate asserts the limitation rather than hiding it.

## 5. Adding a composite

1. Add the composite to `scripts/state-port-registry.json` (`coinClass`, `participants` → band ids,
   and the expected `instructionBudget`).
2. Run `npm run validate:composite-ports`; the gate asserts disjointness, MSHS reservation, and that
   the budget outcome matches the declared expectation.
