# RFC-003: Omnia Built-In Channel Programs

**Status:** Draft
**Created:** 2026-08-14
**Authors:** Totem SDK Contributors
**Reviewers:** [Pending stakeholder assignment]

---

## 1. Summary

This RFC specifies the next set of built-in Omnia channel programs — protocol-native and governance-oriented state machines that parallel the existing `DefaultEltooPaymentProgram`, `CounterProgram`, and `MeterProgram` (`packages/omnia/src/program.ts`). The goal is to expand the deterministic built-in registry (RFC-002 decision record, pending item "Built-in-only vs external program validation") with programs that cover the atomic-payment, settlement, treasury, membership, and tokenized-asset surfaces described in the Omnia Blue Paper and the Totem Governance Green Paper, without resorting to host-registered external programs.

As with RFC-002, each built-in program is implemented in both TypeScript (`src/program.ts`) and Rust (`rust/src/program.rs`), exposed through WASM (`rust/src/wasm.rs`), and locked down with golden fixtures and TS/WASM parity tests.

## 2. Motivation

RFC-002 established that Rust/WASM validates only *built-in deterministic programs* because host-registered programs carry executable JS behavior that cannot be frozen into a deterministic WASM binary. Counter and meter proved the mechanism and surfaced the demand for more useful, composable programs.

The vision documents describe concrete channel behaviors that map naturally onto the program port model:

- **Omnia Blue Paper §2.3 / §11** — atomic multi-hop payments, hashlock claims, tokenized off-chain assets (`tokenId`, MxUSD, VTXOs).
- **Omnia Blue Paper §7** — statechain locking scripts using `@COINAGE GTE 256` timelocks; §10 flash-loan/liquidity.
- **Totem Governance Green Paper §4 / §7.3** — `treasury_spend`, `member_add` / `member_remove`, execution delays "for challenges", DAO and solar-cooperative treasury flows.

Today only `eltoo-payment`, `counter` (ports 120–122), and `meter` (ports 130–133) exist. Expanding built-ins keeps Rust/WASM parity meaningful as these surfaces become real channel contracts.

## 3. Current State

### 3.1 TypeScript Program Surface

`packages/omnia/src/program.ts` defines:

| Program | ID | Version | Program State Ports |
| --- | --- | --- | --- |
| Default eltoo payment | `eltoo-payment` | 1 | (none — pure 2-party) |
| Counter | `counter` | 1 | 120, 121, 122 |
| Meter | `meter` | 1 | 130, 131, 132, 133 |

The `ChannelProgram` interface (`src/types.ts:272`) requires `id`, `version`, `buildScript(parties)`, `buildStateVariables(input)`, and optional `validateTransition(input)`. Built-in programs produce their script by string-injecting into `buildEltooScript` at the anchor `'ASSERT BOTHSIGNED\nASSERT SEQUENCE GT PREVSEQUENCE'`.

### 3.2 Rust/WASM Surface

`packages/omnia/rust/src/program.rs` mirrors counter/meter (`build_counter_state_variables`, `build_meter_state_variables`, `validate_counter_transition`, `validate_meter_transition`), exported via `rust/src/wasm.rs` (`build_*_state_variables_wasm`, `validate_*_transition_wasm`). Golden fixtures live in `src/__tests__/fixtures/parity/`; parity tests in `omnia-wasm-parity.test.ts`, `omnia-parity-recovery.test.ts`, and the regeneration verifier `parity-fixtures-regeneration.test.ts`. CI guardrail: `.github/workflows/ci.yml` job `omnia-parity` builds WASM then runs `test:parity`.

### 3.3 State Value Types

`StateValue` (`src/types.ts:44`) supports `bool`, `number`, `hex`, `string`. Only `programNumberState` (`src/state-vars.ts:28`) exists today; hex/string/bool helpers must be added (see §9).

## 4. Goals

1. Add five built-in programs (see §6) covering atomic hashlock claims, delayed settlement, governed treasury spending, membership/dividend accounting, and tokenized-asset conservation.
2. Keep each program deterministic and self-contained: `buildScript`, `buildStateVariables`, `validateTransition` only, mirroring counter/meter shape.
3. Maintain exact TS ↔ Rust/WASM parity for every program under golden fixtures and CI.
4. Assign non-colliding program port ranges (see §7.1) and document them.
5. Extend the WASM export surface with `build_*_state_variables_wasm` / `validate_*_transition_wasm` per program.

## 5. Non-Goals

- **Not** host-registered / external programs (RFC-002 decision remains built-in-only; revisit only via a separate RFC if the export surface grows).
- **Not** flash loans and routing-fee/factory programs — those live in `@totemsdk/tx-builder`, `omnia-router`, `omnia-factory`.
- **Not** WOTS signature *verification* inside a program — signature verification remains host/TypeScript-side (RFC-002 §16 Q4).
- **Not** changing the core 2-party eltoo lifecycle; programs extend state variables and validation only.

## 6. Proposed Built-In Programs

### 6.1 HTLC Payment Program (`htlc-payment`)

- **Source:** Blue Paper §2.3, §11.1 — atomic multi-hop and cross-token swaps; dual HTLCs under one hashlock.
- **Behavior:** Channel state tracks a hashlock and a locked amount. A transition reveals a preimage; validation requires the preimage hash to match the current hashlock (commitment), enabling the locked amount to move (or settle back) subject to timeout block.

#### Ports

| Port | Name | Type | Meaning |
| --- | --- | --- | --- |
| 140 | `HASHLOCK` | `hex` | Current hashlock commitment (preimage digest). |
| 141 | `LOCKED_AMOUNT` | `number` | Amount locked by the active HTLC. |
| 142 | `TIMEOUT_BLOCK` | `number` | Absolute block height at which the lock expires. |
| 143 | `CLAIMED` | `bool` | 1 once preimage revealed / claim executed in this branch. |

#### Transition

- `action: 'add'` — establish a new lock (`hashlock`, `amount`, `timeoutBlock`); `LOCKED_AMOUNT` moves into the lock.
- `action: 'claim'` — reveal `preimage`; validation hashes it with the canonical digest and requires match with `HASHLOCK`, then releases `LOCKED_AMOUNT` to the claimant and sets `CLAIMED`.
- `action: 'timeout'` — allow refund only when the current block height `>= TIMEOUT_BLOCK` (`@BLOCK` semantics via transaction context, see §7.2).

#### Script Injection (sketch)

```
LET PREIMAGEHASH=SHA3(STATE(140))
LET CLAIMED=STATE(143)
...
IF CLAIMED THEN ASSERT PREIMAGEHASH EQ STATE(140) ENDIF
```

#### Build/Voice Notes

- Uses a new `programHexState` / `programBoolState` helper (§9).
- Requires a canonical preimage-digest helper shared by TS and Rust (SHA3-256 via `@totemsdk/core` and `sha3` crate — already a Rust dependency).

### 6.2 Vault / Timelock Program (`vault`)

- **Source:** Blue Paper §7 statechain locking script (`@COINAGE GTE 256`), Green Paper §7.3 "execution delay (time for challenges)".
- **Behavior:** A portion of channel value is segregated behind a `releaseAt` sequence; before release it can only be re-locked (extend), after release it can be swept. Mirrors the coin-age timelock primitive in channel form.

#### Ports

| Port | Name | Type | Meaning |
| --- | --- | --- | --- |
| 150 | `LOCKED_VALUE` | `number` | Value held in the vault. |
| 151 | `RELEASE_SEQUENCE` | `number` | Channel sequence at which the vault unlocks. |
| 152 | `SWEPT` | `bool` | 1 once released into the channel balances. |

#### Transition

- `action: 'lock'` — move an amount into the vault and set/extend `RELEASE_SEQUENCE`.
- `action: 'extend'` — push `RELEASE_SEQUENCE` forward (only before release).
- `action: 'release'` — validate `currentSequence >= RELEASE_SEQUENCE`; sweep `LOCKED_VALUE` back into balances and set `SWEPT`.

#### Script Injection (sketch)

```
LET LOCKEDVALUE=STATE(150)
...
IF SEQUENCE LT RELEASE_SEQUENCE THEN ASSERT LOCKEDVALUE EQ PREVSTATE(150) ENDIF
```

#### Build/Voice Notes

- Uses the existing `state.number` port type; simplest program, exercises the sequence-gating path already latent in the eltoo script.

### 6.3 Treasury Program (`treasury`)

- **Source:** Green Paper §4.2 `treasury_spend`, §7.3 solar-cooperative. The governance → authority → mandate bridge (`createGovernedMandate`) already binds a passed proposal to an executor; the treasury program makes the resulting spend machine-enforceable inside the channel.
- **Behavior:** A governed spend requires approval evidence — a passed-proposal reference (`outcomeProofId`), a membership snapshot hash, and a vote tally hash — plus a spend cap. Validation verifies the constraint hashes and caps, then releases funds.

#### Ports

| Port | Name | Type | Meaning |
| --- | --- | --- | --- |
| 160 | `MEMBERSHIP_SNAPSHOT_HASH` | `hex` | Root of the member registry this spend is against. |
| 161 | `VOTE_TALLY_HASH` | `hex` | Root of the tally proving quorum + threshold. |
| 162 | `SPEND_CAP` | `number` | Max cumulative spend allowed per membership snapshot. |
| 163 | `SPENT` | `number` | Cumulative spend so far under the current snapshot. |
| 164 | `OUTCOME_PROOF_ID` | `hex` | Reference to the governance outcome proof. |

#### Transition

- `action: 'spend'` — validate `outcomeProofId` anchor consistency, `signedAmount`, `SPENT + amount <= SPEND_CAP`; release funds and increment `SPENT`.
- `action: 'rotate_snapshot'` — replace `MEMBERSHIP_SNAPSHOT_HASH`, reset `SPENT`, new `SPEND_CAP` (requires approval evidence per §4.3 bridge).
- `action: 'reconcile'` — correct `SPENT` on proof of on-chain settlement (audit path).

#### Script Injection (sketch)

```
LET SPENT=STATE(163)
ASSERT SPENT ADD 5 LTE SPEND_CAP
```

(generic; concrete per action in implementation)

#### Build/Voice Notes

- Evidence types are *hashes/references*, not signatures — validation is deterministic. This is the key program backing DAO / Network-Society treasury flows and composes with `@totemsdk/governance` outcome proofs.
- Requires `hex` state helpers; the membership root format should reuse `@totemsdk/proof` hashing conventions.

### 6.4 Membership / Dividend Program (`membership`)

- **Source:** Green Paper `member_add` / `member_remove` (§4.2), §11.4 statechains-as-bearer-instruments; enables per-member balances and weighted dividends inside a channel.
- **Behavior:** The channel tracks a member registry root and per-member weight/balance ports; transitions add/remove members and distribute dividends; validation enforces non-negative per-member balances and total conservation.

#### Ports

| Port | Name | Type | Meaning |
| --- | --- | --- | --- |
| 170 | `MEMBER_ROOT` | `hex` | Merkle root over member IDs + weights. |
| 171 | `DIVIDEND_POOL` | `number` | Value reserved for member distribution. |
| 172 | `PAYOUT_SEQUENCE` | `number` | Dividends payable once per payout window. |

#### Transition

- `action: 'member_add'` / `member_remove` — mutate `MEMBER_ROOT` with a Merkle proof (validated via supplied leaf proof or full member list hash).
- `action: 'mint_dividend'` — move value into `DIVIDEND_POOL`.
- `action: 'pay_dividend'` — once per `PAYOUT_SEQUENCE`, distribute `DIVIDEND_POOL` pro-rata to member weights and empty the pool.

#### Build/Voice Notes

- Requires Merkle-root helpers (reuse `@totemsdk/proof` / `recursive-mast` conventions) and `programHexState`. Member proofs are validated deterministically against `MEMBER_ROOT` — no host callbacks.

### 6.5 Tokenized-Asset Program (`asset`)

- **Source:** Blue Paper §11 — `tokenId` on channels, MxUSD flows, VTXOs as tokenized off-chain assets, cross-token swaps (§11.1).
- **Behavior:** Generalizes balance conservation to a named asset inside a single channel: per-party asset balances on ports, total conservation, and optional per-transition settlement flag. Complements the channel `tokenId` field rather than replacing it.
- **Note:** The core channel already carries `tokenId`/`tokenScale` and enforces `totalValue` conservation; this program adds *per-holder* asset accounting and is most useful where a single channel multiplexes multiple assets (swap/atomicity path). Keep scope minimal to avoid duplicating core conservation.

#### Ports

| Port | Name | Type | Meaning |
| --- | --- | --- | --- |
| 180 | `ASSET_TOKEN_ID` | `hex` | Token id this program accounts. |
| 181 | `HOLDER_A_BALANCE` | `number` | Party A asset balance. |
| 182 | `HOLDER_B_BALANCE` | `number` | Party B asset balance. |
| 183 | `TOTAL_ASSET` | `number` | Fixed total for conservation check. |

#### Transition

- `action: 'transfer'` — move asset between holders; validation enforces `HOLDER_A_BALANCE + HOLDER_B_BALANCE == TOTAL_ASSET` (conservation) and non-negative balances.

#### Build/Voice Notes

- Minimal, deterministic; directly testable against the existing conservation logic. Extendable to N holders, but v1 stays 2-party like the core channel.

### 6.6 Explicitly Deferred (see Non-Goals)

- Flash loan (`FlashCashHelper` in `@totemsdk/core` / `tx-builder`).
- Router fee metrics, factory virtual-channel economics, VTXO pool accounting.

## 7. Data Model And Script Requirements

### 7.1 Port Allocation

Reserved today: core eltoo 100–101; counter 120–122; meter 130–133. `PROGRAM_STATE_PORT_MIN = 120` (`src/state-vars.ts:3`).

| Program | Port Block |
| --- | --- |
| `htlc-payment` | 140–143 |
| `vault` | 150–152 |
| `treasury` | 160–164 |
| `membership` | 170–172 |
| `asset` | 180–183 |

Blocks are separated by 10 for growth. These remain below the WOTS/signer port range and do not collide with existing allocations.

### 7.2 Transition Context Restrictions

Programs must remain deterministic. Therefore:

- Hashlocks use explicit preimage digest computation (SHA3-256) from transition inputs — never a host random oracle.
- Time/release checks use channel sequence (`SEQUENCE`/`PREVSEQUENCE`) and/or integer block-height ports passed as transition inputs, not wall-clock `Date.now()` (mirrors RFC-002 §11 final WASM time fix).
- Public-key/signature checks are excluded; WOTS verification stays host-side.

## 8. Rust And WASM Parity Plan

For each program, implement in `packages/omnia/rust/src/`:

- `program.rs`: constants (`*_PROGRAM_ID`, port consts), `build_<p>_state_variables(...) -> Result<Vec<StateValue>, String>`, `validate_<p>_transition(...) -> ValidationResult`, plus Rust unit tests for valid and malformed inputs.
- `state_vars.rs`: add `program_hex_state`, `program_bool_state`, `program_string_state` mirroring `program_number_state` and matching TS `programHexState` et al.
- `wasm.rs`: `build_<p>_state_variables_wasm`, `validate_<p>_transition_wasm` following the counter/meter export pattern (§3.2).

Rust clippy must stay clean (`-D warnings` enforced in CI since PR #115).

## 9. TypeScript State-Value Helpers

Add to `src/state-vars.ts`:

- `programHexState(port: number, value: string): StateValue` — `type: 'hex'`.
- `programBoolState(port: number, value: boolean): StateValue` — `type: 'bool'`.
- `programStringState(port: number, value: string): StateValue` — `type: 'string'`.

All must call `assertProgramStatePort`. These are prerequisites for `htlc-payment`, `treasury`, `membership`.

## 10. Test Plan

### 10.1 Rust Unit Tests

- Happy-path construction for every action per program.
- Malformed inputs (missing ports, negative amounts, wrong action strings, conservation violations) return `ValidationResult { valid: false, reason: Some(...) }`.
- Cross-program port isolation (no cross-talk between port blocks).

### 10.2 TypeScript/WASM Parity Tests

Extend `omnia-wasm-parity.test.ts` (or a new `omnia-program-parity.test.ts`) so that for every program and fixture:

- TS `buildStateVariables` output deep-equals WASM `build_*_state_variables_wasm` output (normalized per §RFC-002 helpers).
- TS `validateTransition` and WASM `validate_*_transition_wasm` agree on `{ valid, error }` for accepted and rejected inputs.

### 10.3 Golden Fixtures

For each program add to `src/__tests__/fixtures/parity/`:

- `htlc-add.transition.json`, `htlc-claim.transition.json`, `htlc-claim.expected.json`
- `vault-lock.transition.json`, `vault-release.transition.json`, `vault-state.expected.json`
- `treasury-spend.transition.json`, `treasury-spend.expected.json`, `treasury-snapshot.json`
- `membership-add.transition.json`, `membership-dividend.expected.json`
- `asset-transfer.transition.json`, `asset-conservation.expected.json`

Wire them into `parity-fixtures-regeneration.test.ts` so `REGENERATE=1` regenerates and CI verifies freshness.

### 10.4 CI Guardrail

Reuse the existing `omnia-parity` job (`test:parity` script builds WASM then runs jest with the parity filters). No new job required unless runtime grows.

## 11. Implementation Sequence

Each program ships as its own PR following the RFC-002 pattern (TS → Rust → WASM → fixtures → parity → CI green):

### Program 1: `htlc-payment`
### Program 2: `vault`
### Program 3: `treasury`
### Program 4: `membership`
### Program 5: `asset`

A prerequisite small PR adds the TS hex/bool/string state helpers and their Rust mirrors if not already present.

Suggested order: `vault` (simplest, proves hex/bool/sequence helpers) → `htlc-payment` (uses hashing + bool) → `asset` (conservation, reuses existing logic) → `treasury` (governance bridge, highest value) → `membership` (Merkle roots, most complex).

## 12. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Port collisions | Invalid scripts | Centralized §7.1 allocation table + Rust/TS const tests. |
| Time/hashlock nondeterminism | Parity drift | Sequence/block-height ports only; explicit SHA3 preimage digest shared by TS+Rust. |
| Treasury/membership scope creep | Hard-to-maintain programs | Confirm only hash/reference evidence in v1; signature verification stays host-side. |
| Consumed by post-RFC parity work | Rework | Follow the documented per-program PR checklist early. |

## 13. Open Questions For Review

1. Should `asset` extend to N holders in v1, or stay 2-party (recommended)?
2. Should `treasury` reuse the exact `createGovernedMandate` constraint hashes (membership snapshot + vote tally + outcome proof), or a simplified anchor?
3. Should `membership` validate Merkle proofs inline, or accept a full member-list hash for v1 (recommended)?

## 14. Decision Record

Pending decisions (mirror RFC-002 §17):

| Decision | Owner | Status |
| --- | --- | --- |
| Adopt RFC-003 built-in program list | Omnia maintainers | Pending |
| State helpers (hex/bool/string) naming | Omnia maintainers | Pending |
| Treasury evidence format | Omnia maintainers | Pending |