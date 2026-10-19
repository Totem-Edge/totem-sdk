# RFC-052 — MASH Multi-IO Committed Mode: Composable Committed State for Omnia & Eefi

Status: Draft for architectural review — proposed, not merged for implementation
Created: 2026-10-19
Authors: Totem SDK Contributors
Depends on: RFC-048 (Omnia Primitive Completeness), RFC-049 (MASH × Omnia × Eefi), RFC-050 (Eefi Product Architecture), RFC-051 (AI-Proposed Committed Facts)
Touches (proposed): node-side MSHS-2 in `hawk-node` (`mshs2_modes.hpp`, `mshs2_signing.hpp`, `mshs2_script.hpp`); consumed by `@totemsdk/kissvm`, `@totemsdk/omnia*`, `@totemsdk/authority`, `@totemsdk/identity`

> **Scope.** A node-side design proposal for a **multi-input/multi-output committed MSHS-2 mode**,
> so committed state can compose with Omnia channel/factory/settlement scripts and with P-EXIT.
> Architecture only; **no implementation is authorised** by this RFC. It answers RFC-049 §11 Q7.

---

## 0. Executive decision

MSHS-2's committed-owner-v1 mode is powerful but **quarantined to 1-in/1-out**: its locking script
asserts `@TOTIN EQ 1` / `@TOTOUT EQ 1`, so a committed coin can never share a transaction with a
wallet-mode coin or fund a channel (RFC-049 §5.5). That makes committed state a **standalone**
primitive and blocks the natural Eefi shapes — a channel whose coin carries committed state, or a
P-EXIT covenant on a state-carrying coin.

This RFC proposes a **multi-IO committed mode**: relax the input/output count, identify the
**successor output** by the address that re-embeds the next state root, allow recovery branches, and
keep the committed-state invariant. The MASH verifier already computes its authorization message over
**all** inputs/outputs, so the cryptography is unchanged; the constraint is purely the two assertions
and the signer precondition.

---

## 1. Problem — where 1-in/1-out blocks Eefi/Omnia

| Need | Blocked because |
|---|---|
| Channel coin whose address commits the channel's state root | channel open/fund is multi-IO; committed branch asserts 1-in/1-out |
| MASH-aware **factory** (Model B) coin carrying committed party/balance state | factory settlement is multi-output; committed branch asserts 1-in/1-out |
| **P-EXIT** on a committed-state coin | P-EXIT needs a recovery branch; committed mode forbids `extraBranches` |
| One transaction that both advances committed state **and** moves value | committed mode must preserve the amount and be 1-in/1-out |

Consequence today: committed state is used **alone** (identity/credential coin, state-root anchor,
committed-facts carrier), never *inside* an Omnia/Eefi execution transaction.

---

## 2. The exact constraint (grounded)

`mshs2_modes.hpp` — the committed branch appends:

```
ASSERT @TOTIN EQ 1 ASSERT @TOTOUT EQ 1
ASSERT SHA3(STATE(0)) EQ stateroot
LET nextroot = SHA3(STATE(1))
LET nextscript = [LET stateroot=] + STRING(nextroot) + SUBSTR(80 LEN(@SCRIPT) @SCRIPT)
ASSERT VERIFYOUT(0 ADDRESS(nextscript) @AMOUNT @TOKENID FALSE) RETURN TRUE
```

`mshs2_signing.hpp` additionally requires `inputs.size() == 1 && outputs.size() == 1 && extraBranches.empty()`.
Meanwhile `mshs2BranchScript` **already** builds its message `M` over every input (`GETINID`) and
output (`GETOUTADDR/AMT/TOK/KEEPSTATE`) — i.e. the verifier is inherently multi-IO. So the limitation
is the **two count assertions + the signer precondition + the single-successor `VERIFYOUT(0 …)`**, not
the cryptography.

---

## 3. Proposal — multi-IO committed mode

### 3.1 Relax the count assertions

Replace `ASSERT @TOTIN EQ 1 ASSERT @TOTOUT EQ 1` with `ASSERT @TOTIN GT 0 ASSERT @TOTOUT GT 0`. The
authorization message `M` (already multi-IO) then binds the whole transaction.

### 3.2 Identify the successor output

Today the successor is output 0, paying the successor address, amount-preserving. Generalise: the
successor is the **unique output whose address re-embeds the next state root**,
`ADDRESS([LET stateroot=] + STRING(nextroot) + …)`. The branch scans outputs (a bounded `WHILE`
counter, as `mshs2BranchScript` already does) and asserts **exactly one** such output exists. Other
outputs are ordinary (value movement, change, payouts).

### 3.3 Value semantics

Relax "preserve the input amount" to: **the successor output carries the committed state; value may
move across the other inputs/outputs**, subject to the token-conservation rules the Omnia script
already enforces. The committed state is bound to the successor address, not to a fixed amount.

### 3.4 Recovery branches (P-EXIT compatibility)

Allow `extraBranches` (a MAST policy may include recovery / exercise / timelock branches, per
RFC-050 §3). The **committed-state branch** still enforces state continuity; the other branches are
ordinary covenant paths. This is what lets a committed-state coin host a P-EXIT covenant.

### 3.5 Instruction budget

The committed branch = wallet verifier (~795 at 1-in/1-out) + the successor scan. The scan adds a
bounded `WHILE` over outputs (~5–8 ops per output, as `mshs2WalletOps` already models with the
`37·(outputs−1)` term). A multi-IO committed mode MUST stay under the KISSVM limit (1024); the
**composite port-allocation gate** (RFC-049 §5.3) already checks `MASH envelope + script ops ≤ 1024`,
so the budget is a **merge gate**, not an assumption.

### 3.6 Backward compatibility

Keep committed-owner-v1 as-is. Multi-IO committed is either a **new profile/mode**
(`committed-owner-v2` / `multi-io`) or a **flag-gated relaxation** of v1. Existing 1-in/1-out
addresses remain valid and unchanged.

---

## 4. Invariants (MUST)

- **State continuity.** The successor output's address commits `SHA3(STATE(1))`; `STATE(0)` reveals
  the spent preimage and `SHA3(STATE(0))` equals the coin's committed `stateroot`.
- **Exactly one successor.** Exactly one output re-embeds the next root; no spend may drop or fork
  the committed state.
- **Authorization unchanged.** The MASH verifier (bundle 230–255, message `M` over all inputs/outputs)
  is unmodified; reuse-safety and the root counter are unchanged.
- **No consensus change.** Ordinary KISSVM + MAST; no new opcodes.
- **Port partition.** Committed-state carrier ports {0,1} and MSHS 230–255 stay disjoint from the
  composite's other participants (RFC-049 §5.5, `check-composite-ports`).

---

## 5. What it unlocks

- **RFC-049 Q7 answered:** committed state becomes composable — a channel/factory/P-EXIT coin can
  carry a committed state root, and a single transaction can both advance committed state and move
  value.
- **Eefi products (RFC-050):** committed-state coins can host **P-EXIT** (recovery branch allowed),
  and Model-B **MASH-aware factory** coins can carry committed party/balance state (the O(1)
  distribution escape already fits the budget — RFC-049 §5.3).
- **RFC-051:** committed facts can be carried on coins that are *also* execution coins, not only
  standalone carriers.

---

## 6. Alternatives considered

1. **Two-coin linking** (committed state coin + wallet execution coin, bound by a digest). Works
   today, but requires two transactions and a cross-coin binding; strictly weaker than one composable
   coin. Remains the fallback until multi-IO lands.
2. **Committed state as a MAST branch** inside a multi-IO Omnia script (rather than the outer
   script). Attractive, but the branch's `@TOTIN/@TOTOUT EQ 1` still blocks; it needs the same
   relaxation. Likely the **implementation shape** once 3.1–3.4 exist.
3. **Leave it 1-in/1-out.** Rejected: it permanently quarantines committed state from Omnia/Eefi.

---

## 7. Open questions

1. New mode id (`committed-owner-v2` / `multi-io`) vs a flag on v1 — and how addresses are
   discriminated (`LET stateroot=` prefix is already the committed marker; multi-IO needs its own).
2. Successor identification: scan-for-successor (bounded `WHILE`) vs a **fixed successor index**
   (cheaper, less flexible). Which keeps the op budget safest?
3. Value semantics: is "successor carries state, value may move" sufficient, or must the committed
   coin be amount-preserving **and** composable (then value moves on other coins)?
4. Recovery-branch interaction: a recovery branch that does **not** re-embed the next root breaks
   state continuity — is that acceptable (it's a terminal branch), and how is it labelled?
5. Op budget: exact worst-case for the scan at the KISSVM limit; the composite gate must pass.
6. Root/counter: multi-IO committed spends draw the same shared counter (RFC-049 §5.5) — any change?

---

## 8. Non-goals / deferrals

No new cryptography, no new signature scheme, no consensus change. This RFC does not authorise
implementation; it defines the node-side change (relax counts, identify successor, allow recovery
branches, budget) and the invariants a multi-IO committed mode must satisfy.

---

**Bottom line.** Committed state is a **state primitive** today because of two count assertions and a
single-successor `VERIFYOUT`. Relaxing those (while keeping the committed-state invariant) turns it
into a **composable** primitive — the unlock for committed-state channels, factories and P-EXIT in
Eefi, and the concrete answer to RFC-049 Q7.
