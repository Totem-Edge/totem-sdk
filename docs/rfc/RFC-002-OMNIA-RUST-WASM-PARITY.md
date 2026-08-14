# RFC-002: Omnia Rust/WASM Parity With TypeScript

**Status:** Draft  
**Created:** 2026-08-13  
**Authors:** Totem SDK Contributors  
**Reviewers:** [Pending stakeholder assignment]

---

## 1. Summary

This RFC defines the work required to bring `packages/omnia/rust` and the generated WASM bindings into parity with the current TypeScript implementation of `@totemsdk/omnia`.

The TypeScript Omnia layer now supports programmable channel transitions, program-owned state variables, counter and meter programs, close-package persistence, unilateral-close recovery state, and durable channel snapshots. The Rust/WASM layer currently exposes deterministic helpers for eltoo scripts, capacity checks, commitments, balance validation, and HTLC verification, but it does not yet model or validate the new programmable/recovery channel surface.

The objective is not to replace the TypeScript host/runtime layer. The objective is to make Rust/WASM a deterministic parity engine for the data model, canonical serialization, validation, and recovery logic that must remain stable across platforms.

## 2. Motivation

Omnia now has two implementation layers with different responsibilities:

- TypeScript owns channel orchestration, host JSON-RPC APIs, storage integration, signer wiring, peer messaging, and developer-facing SDK ergonomics.
- Rust/WASM owns deterministic validation and serialization helpers that can be used across JavaScript runtimes and other consumers.

The TypeScript layer has advanced faster than Rust/WASM. This creates drift risk in the most sensitive parts of Omnia:

- Channel JSON produced by TypeScript may not deserialize in Rust because required fields differ.
- Program transition digests may not be independently reproducible in Rust.
- Recovery snapshots may not be validated consistently across runtimes.
- Generated WASM package outputs may be rebuilt without intentional source parity.
- CI can pass TypeScript tests while Rust/WASM remains semantically stale.

This RFC makes parity explicit, testable, and reviewable.

## 3. Current State

### 3.1 TypeScript Surface

The current TypeScript Omnia exports include programmable and recovery functionality from:

| Module | Relevant Surface |
| --- | --- |
| `src/types.ts` | `OmniaChannel`, `SignedChannelState`, `SignedClosePackage`, `ClosePackageArtifact`, `UnilateralCloseState`, `ProgramTransition`, `ChannelProgram`, `StateValue` |
| `src/program.ts` | `DefaultEltooPaymentProgram`, `CounterProgram`, `MeterProgram`, program registry, program update digests |
| `src/transition.ts` | transition canonicalization and serialization |
| `src/state-vars.ts` | program state ports and state-value helpers |
| `src/persistence.ts` | channel snapshots, serialization, deserialization, recovery, validation |
| `src/close-package.ts` | close-package build, merge, and verification |
| `src/channel.ts` | `applyProgramTransition`, update lifecycle, pending proposal guards |
| `src/counter.ts` | counter transition helpers |
| `src/meter.ts` | meter transition helpers |

### 3.2 Rust/WASM Surface

The current Rust Omnia package contains:

| Rust Module | Current Role |
| --- | --- |
| `rust/src/types.rs` | channel, participant, HTLC, signed state, validation result, capacity result |
| `rust/src/script.rs` | eltoo script construction and normalization |
| `rust/src/capacity.rs` | WOTS capacity helpers |
| `rust/src/commitment.rs` | state commitment and transaction draft digest helpers |
| `rust/src/validation.rs` | balance conservation, state validation, HTLC preimage checks |
| `rust/src/wasm.rs` | wasm-bindgen exports for existing helpers |

Known gaps:

- `OmniaChannel` lacks `programId`, `programVersion`, `pendingProposal`, `latestCoinId`, and `unilateralClose`.
- `SignedChannelState` lacks `closePackage` and `programTransition`.
- Rust has no `ProgramTransition` model.
- Rust has no default/counter/meter program model.
- Rust has no channel snapshot/recovery model.
- Rust has no close-package model.
- Rust has no parity tests comparing TypeScript and WASM outputs for new Omnia behavior.

## 4. Goals

1. Define Rust structs that deserialize the same durable Omnia JSON as TypeScript.
2. Implement canonical program transition serialization in Rust with byte-for-byte parity against TypeScript.
3. Implement deterministic program state-variable construction for default, counter, and meter programs.
4. Implement validation parity for program metadata, transitions, state variables, balance conservation, close-package presence, sequence sanity, and recovery snapshots.
5. Expose WASM APIs for deterministic parity functions that TypeScript and host consumers can call.
6. Add cross-language test vectors so future TypeScript changes cannot silently drift from Rust/WASM.
7. Regenerate and commit WASM outputs only after source parity is complete and tests pass.

## 5. Non-Goals

1. Do not move network IO, host JSON-RPC, SQLite persistence, or peer messaging into Rust.
2. Do not move signer implementations or WOTS lease providers into Rust in this RFC.
3. Do not introduce a second independent channel orchestration engine in Rust.
4. Do not add backward-compatibility behavior unless it is required for persisted channel snapshots or explicitly retained TypeScript behavior.
5. Do not regenerate WASM outputs for unrelated packages.

## 6. Source Of Truth

TypeScript is the behavioral source of truth for this parity effort.

Rust/WASM must match TypeScript for deterministic outputs:

- JSON field names.
- Canonical transition serialization.
- State-variable shape and ordering.
- Program IDs and versions.
- Recovery validation outcomes.
- Commitment/digest inputs where both layers support the operation.

Rust/WASM may be stricter only when this RFC explicitly says so or when TypeScript is updated in the same PR to match.

## 7. Required Data Model Parity

### 7.1 Channel Types

Update `rust/src/types.rs` so `OmniaChannel` includes:

| TypeScript Field | Rust Field | Required | Notes |
| --- | --- | --- | --- |
| `programId` | `program_id` | Yes | Required in new channel JSON. Legacy recovery may default separately. |
| `programVersion` | `program_version` | Yes | Required in new channel JSON. Legacy recovery may default separately. |
| `pendingProposal` | `pending_proposal` | No | Durable double-sign guard. |
| `latestCoinId` | `latest_coin_id` | No | Latest confirmed channel output. |
| `unilateralClose` | `unilateral_close` | No | Durable close recovery state. |

Add `PendingProposal`:

| Field | Type | Notes |
| --- | --- | --- |
| `sequence` | `u32` | Must match TypeScript sequence semantics. |
| `payloadHash` | `String` | Hex string. |

Add `UnilateralCloseState`:

| Field | Type | Notes |
| --- | --- | --- |
| `channelId` | `String` | JSON `channelId`. |
| `sequence` | `u32` | Latest unilateral close sequence. |
| `updateTxHex` | `String` | Serialized update transaction. |
| `settlementTxHex` | `String` | Serialized settlement transaction. |
| `contestStartBlock` | `u64` | Block height. |
| `contestDeadlineBlock` | `u64` | Block height. |
| `status` | enum/string | `update_broadcast` or `settlement_broadcast`. |
| `updateTxpowId` | `Option<String>` | Optional chain artifact. |
| `settlementTxpowId` | `Option<String>` | Optional chain artifact. |

### 7.2 Signed State Types

Update `SignedChannelState` with:

| TypeScript Field | Rust Field | Required | Notes |
| --- | --- | --- | --- |
| `closePackage` | `close_package` | No | Complete close package for recoverable close. |
| `programTransition` | `program_transition` | No | Transition that produced this state. |

Add `ClosePackageArtifact`:

| Field | Type | Notes |
| --- | --- | --- |
| `txHex` | `String` | Serialized transaction. |
| `txDigest` | `String` | Hex digest. |
| `signatures` | `HashMap<String, String>` | Hex or durable string form matching snapshot rules. |
| `signingIndices` | `HashMap<String, SigningIndices>` | Party keyed. |

Add `SignedClosePackage`:

| Field | Type | Notes |
| --- | --- | --- |
| `version` | `u32` | Must be `1`. |
| `channelId` | `String` | Channel id. |
| `sequence` | `u32` | Close package sequence. |
| `stateCommitmentV2` | `String` | Commitment hex. |
| `update` | `ClosePackageArtifact` | Update artifact. |
| `settlement` | `ClosePackageArtifact` | Settlement artifact. |

### 7.3 Program Transition Types

Add `ProgramTransition`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `action` | `String` | Yes | User-facing action name. |
| `inputs` | `serde_json::Value` | No | Object-like structured inputs. |
| `witness` | `serde_json::Value` | No | Deterministic data only. |
| `metadata` | `serde_json::Value` | No | Durable metadata only. |

Rules:

- Do not add `actionId`.
- Preserve the user-approved field names: `action`, `inputs`, `witness`, `metadata`.
- Reject non-object `inputs`, `witness`, or `metadata` if TypeScript rejects them.
- Canonicalization must sort object keys exactly as TypeScript does.

### 7.4 Snapshot Types

Add `OmniaChannelSnapshot` and `ChannelRecoveryResult` matching `src/persistence.ts`.

The snapshot model must preserve:

- `bigint` values using the same JSON representation as TypeScript.
- `Uint8Array` signatures using the same durable representation as TypeScript.
- `latestState`.
- `closePackage`.
- `unilateralClose`.
- `pendingProposal`.
- `programId` and `programVersion`.

The snapshot model must omit:

- `localSigner`.
- Function values.
- Runtime-only host resources.

## 8. Required Logic Parity

### 8.1 Transition Canonicalization

Implement `rust/src/transition.rs` with:

| Function | Behavior |
| --- | --- |
| `canonicalize_program_transition` | Return a canonical JSON value/string with stable field ordering. |
| `serialize_program_transition` | Return deterministic bytes/string matching TypeScript output. |
| `validate_program_transition_shape` | Validate field names and object shapes. |

Acceptance criteria:

- TypeScript and Rust produce identical canonical strings for the same transition.
- Field order is stable: `action`, `inputs`, `witness`, `metadata` where present.
- Nested object keys sort consistently.
- Numeric values that represent token/channel amounts follow TypeScript snapshot rules.

### 8.2 State Variable Helpers

Implement `rust/src/state_vars.rs` with:

| Constant/Function | TypeScript Equivalent |
| --- | --- |
| `PROGRAM_STATE_PORT_MIN` | `PROGRAM_STATE_PORT_MIN` |
| `assert_program_state_port` | `assertProgramStatePort` |
| `get_state_value` | `getStateValue` |
| `get_state_bigint` | `getStateBigInt` |
| `program_number_state` | `programNumberState` |

Acceptance criteria:

- Rust rejects reserved/non-program ports the same way TypeScript does.
- Rust reads number state values from strings/numbers the same way TypeScript does.
- Rust emits `StateValue` objects with JSON field names and types matching TypeScript.

### 8.3 Program Registry And Built-In Programs

Implement `rust/src/program.rs` for built-in deterministic behavior:

| Program | ID | Version | Required Behavior |
| --- | --- | --- | --- |
| Default eltoo payment | `eltoo-payment` | `1` | Empty program-owned state variables. |
| Counter | `counter` | `1` | `increment`, `decrement`, `set`; reject unsupported actions. |
| Meter | `meter` | `1` | Reading, usage delta, unit price, payment state variables. |

Required constants:

| Constant | Purpose |
| --- | --- |
| `ELTOO_PAYMENT_PROGRAM_ID` | Default program id. |
| `COUNTER_PROGRAM_ID` | Counter program id. |
| `COUNTER_STATE_PORT` | Current counter value. |
| `COUNTER_ACTION_PORT` | Counter action marker. |
| `COUNTER_OPERAND_PORT` | Counter operand. |
| `METER_PROGRAM_ID` | Meter program id. |
| `METER_READING_PORT` | Latest meter reading. |
| `METER_USAGE_DELTA_PORT` | Usage delta. |
| `METER_UNIT_PRICE_PORT` | Unit price. |
| `METER_PAYMENT_PORT` | Payment amount. |

Acceptance criteria:

- Counter and meter output state variables match TypeScript exactly for fixture cases.
- Unsupported program IDs are rejected by validation unless TypeScript treats them as registry-resolvable externally.
- Unsupported actions produce the same valid/error outcome as TypeScript.

### 8.4 Recovery And Snapshot Validation

Implement `rust/src/persistence.rs` with:

| Function | TypeScript Equivalent |
| --- | --- |
| `snapshot_channel` | `snapshotChannel` |
| `serialize_channel_snapshot` | `serializeChannelSnapshot` |
| `deserialize_channel_snapshot` | `deserializeChannelSnapshot` |
| `recover_channel_snapshot` | `recoverChannelSnapshot` |
| `recover_channel` | `recoverChannel` |

Required validations:

- Program id exists.
- Program version exists and is a positive integer.
- Participant list is non-empty and each participant has required fields.
- Balances are non-negative integer values.
- Balance sum plus pending HTLC accounting conserves `totalValue` according to TypeScript rules.
- `currentSequence` is sane relative to `latestState.sequence` when present.
- `latestState.channelId`-derived context is consistent where applicable.
- Close package `channelId` and `sequence` match the associated state/channel where TypeScript requires it.
- Legacy raw channel recovery defaults program metadata only where TypeScript currently does so.

Acceptance criteria:

- Rust can recover every snapshot emitted by TypeScript tests.
- Rust rejects every invalid snapshot fixture that TypeScript rejects.
- Snapshot serialization is stable enough for fixture comparison.

### 8.5 Close Package Validation

Add Rust validation helpers for close-package shape and consistency.

Required behavior:

- Validate `version === 1`.
- Validate non-empty `txHex` and `txDigest` fields.
- Validate update and settlement artifacts exist.
- Validate signature maps are present and keyed by known party IDs when TypeScript requires it.
- Validate signing indices are structurally valid.

Non-goal:

- Do not port full signer/WOTS verification unless a later RFC explicitly expands Rust ownership.

## 9. WASM Export Plan

Add wasm-bindgen exports in `rust/src/wasm.rs`.

| WASM Export | Purpose |
| --- | --- |
| `canonicalize_program_transition_wasm` | Return canonical transition JSON/string. |
| `serialize_program_transition_wasm` | Return deterministic transition bytes or string. |
| `validate_program_transition_wasm` | Return validation result for transition shape. |
| `build_counter_state_variables_wasm` | Build counter state variables for previous state and transition. |
| `validate_counter_transition_wasm` | Validate counter transition against previous/next state. |
| `build_meter_state_variables_wasm` | Build meter state variables for previous state and transition. |
| `validate_meter_transition_wasm` | Validate meter transition against previous/next state. |
| `snapshot_channel_wasm` | Produce durable channel snapshot. |
| `serialize_channel_snapshot_wasm` | Serialize durable snapshot. |
| `deserialize_channel_snapshot_wasm` | Deserialize durable snapshot. |
| `recover_channel_snapshot_wasm` | Validate and recover snapshot. |
| `recover_channel_wasm` | Recover raw serialized channel/snapshot. |
| `validate_complete_channel_state_wasm` | Expanded validation including program metadata and optional close package. |

Export rules:

- Return structured validation results instead of throwing for expected invalid user data.
- Throw only for malformed JS/WASM boundary input that cannot be parsed.
- Keep JSON field names identical to TypeScript.
- Avoid exposing internal helper functions until tests demonstrate an external need.

## 10. Test Plan

### 10.1 Rust Unit Tests

Add Rust tests for:

- Program transition canonicalization.
- State variable port validation.
- Counter state variable construction.
- Counter transition validation.
- Meter state variable construction.
- Meter transition validation.
- Snapshot serialization and deserialization.
- Recovery validation success and failure cases.
- Close package shape validation.

### 10.2 TypeScript/WASM Parity Tests

Add TypeScript tests in `packages/omnia/src/__tests__` that compare TS output to WASM output.

Required fixture cases:

| Fixture | Required Comparison |
| --- | --- |
| Default payment channel | Snapshot and recovery validation parity. |
| Counter increment | Canonical transition and state variables match. |
| Counter decrement | Canonical transition and state variables match. |
| Counter set | Canonical transition and state variables match. |
| Meter first reading | State variables match. |
| Meter second reading | Usage delta and payment match. |
| Signed latest state | Snapshot preserves signatures and signing indices. |
| Close package | Snapshot preserves close package fields. |
| Unilateral close | Snapshot preserves close state. |
| Pending proposal | Snapshot preserves double-sign guard. |
| Invalid balance conservation | TS and WASM reject. |
| Invalid program metadata | TS and WASM reject. |
| Legacy raw channel JSON | TS and WASM default/recover the same way. |

### 10.3 Golden Fixtures

Create a fixture directory:

`packages/omnia/src/__tests__/fixtures/parity/`

Fixture files:

| File | Contents |
| --- | --- |
| `default-channel.snapshot.json` | Durable default channel snapshot. |
| `counter-increment.transition.json` | Counter increment transition. |
| `counter-state.expected.json` | Expected state variables. |
| `meter-reading.transition.json` | Meter transition. |
| `meter-state.expected.json` | Expected state variables. |
| `recoverable-close.snapshot.json` | Snapshot with latest state and close package. |
| `unilateral-close.snapshot.json` | Snapshot with unilateral close state. |
| `invalid-balance.snapshot.json` | Recovery rejection fixture. |
| `legacy-channel.json` | Legacy recovery fixture. |

Rules:

- Fixtures must be small and human-reviewable.
- Do not snapshot entire generated WASM output.
- Use explicit expected JSON for deterministic APIs.

## 11. CI And Verification

Required local verification before merge:

```bash
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm --dir packages/omnia exec tsc --noEmit
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm --dir packages/omnia exec jest --runInBand
cargo test --all-targets --all-features --manifest-path packages/omnia/rust/Cargo.toml
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false node scripts/verify-workspace.mjs --test
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false node scripts/verify-workspace.mjs --typecheck
```

Recommended CI guardrail:

- Add a targeted `omnia` Rust/WASM parity test command if workspace runtime becomes too slow.
- Ensure the targeted command builds WASM before running TS/WASM parity tests.
- Fail CI if Rust source changes but generated `packages/omnia/rust/pkg` or `pkg-node` artifacts are stale, if those artifacts remain committed in git.

## 12. Generated Artifact Policy

The repository currently publishes generated WASM outputs through package `files` entries and has tracked generated outputs for some packages.

Policy for this RFC:

1. Commit Rust source changes first with tests where possible.
2. Regenerate `packages/omnia/rust/pkg` and `packages/omnia/rust/pkg-node` after Rust source and WASM exports are final.
3. Commit generated Omnia artifacts only if the repo's current package policy requires them in git.
4. Do not commit generated outputs for unrelated packages.
5. Do not commit locally regenerated `packages/core-wasm/pkg` binaries unless the source change or release process requires it.
6. If generated artifact policy is unclear, resolve it before the final parity PR.

Observed repository policy as of this RFC implementation:

- `packages/omnia/rust/pkg` and `packages/omnia/rust/pkg-node` contain nested `.gitignore` files and are generated during build/test workflows, not committed.
- `packages/core-wasm/pkg` and `packages/core-wasm/pkg-node` are tracked package artifacts and must be regenerated when core WASM exports change.

Open decision:

| Decision | Options | Default Recommendation |
| --- | --- | --- |
| Commit generated Omnia WASM outputs? | Yes, keep current package convention; No, generate during publish | Keep current convention unless repository policy changes globally. |

## 13. Implementation Sequence

### PR 1: Rust Data Model Parity

Checklist:

- [x] Add missing `OmniaChannel` fields.
- [x] Add `PendingProposal`.
- [x] Add `UnilateralCloseState`.
- [x] Add `ProgramTransition`.
- [x] Add `ClosePackageArtifact`.
- [x] Add `SignedClosePackage`.
- [x] Add `closePackage` and `programTransition` to `SignedChannelState`.
- [x] Add serde rename attributes matching TypeScript JSON.
- [x] Add Rust deserialize tests for current TypeScript channel JSON.
- [x] Run `cargo test --all-targets --all-features --manifest-path packages/omnia/rust/Cargo.toml`.

Exit criteria:

- Rust can deserialize current TypeScript Omnia channel/state JSON fixtures without losing durable fields.
- Existing WASM exports continue to work.

### PR 2: Transition And State Variable Parity

Checklist:

- [x] Add `rust/src/transition.rs`.
- [x] Add `rust/src/state_vars.rs`.
- [x] Implement canonical transition serialization.
- [x] Implement program state port helpers.
- [x] Add WASM exports for transition canonicalization and state var helpers.
- [x] Add TS/WASM parity tests for transition fixtures.
- [x] Add Rust unit tests for malformed transition inputs.

Exit criteria:

- TS and WASM produce identical canonical transition output for all fixtures.
- TS and WASM agree on accepted/rejected transition shapes.

### PR 3: Built-In Program Parity

Checklist:

- [x] Add `rust/src/program.rs`.
- [x] Add default eltoo payment metadata.
- [x] Add counter constants and state logic.
- [x] Add meter constants and state logic.
- [x] Add counter validation.
- [x] Add meter validation.
- [x] Add WASM exports for counter and meter helpers.
- [ ] Add cross-language parity fixtures.

Exit criteria:

- Counter/meter state variables match TypeScript exactly.
- Counter/meter validation outcomes match TypeScript exactly.

### PR 4: Snapshot And Recovery Parity

Checklist:

- [x] Add `rust/src/persistence.rs`.
- [x] Implement snapshot creation.
- [x] Implement snapshot serialization.
- [x] Implement snapshot deserialization.
- [x] Implement recovery validation.
- [x] Implement legacy raw channel recovery if still supported by TypeScript.
- [x] Add WASM exports for snapshot and recovery functions.
- [ ] Add TS/WASM parity tests for all recovery fixtures.

Exit criteria:

- Rust accepts all valid TypeScript snapshots.
- Rust rejects all invalid TypeScript recovery fixtures with matching validation categories.
- Durable fields survive round trip.

### PR 5: Close Package Validation And CI Guardrails

Checklist:

- [x] Add close-package shape validation helpers.
- [x] Integrate close-package checks into complete state/recovery validation.
- [ ] Add parity tests for signed close package snapshots.
- [ ] Add targeted CI parity command if needed.
- [x] Document generated artifact expectations.

Exit criteria:

- Close-package durability and validation are covered by Rust and TS/WASM tests.
- CI prevents future parity drift in program transitions and recovery snapshots.

### PR 6: Generated WASM Artifact Update

Checklist:

- [ ] Run `npm run build` in `packages/omnia`.
- [ ] Review generated `packages/omnia/rust/pkg` and `pkg-node` diff.
- [ ] Confirm no unrelated package artifacts are staged.
- [ ] Run package tests and typecheck after generation.
- [ ] Commit generated artifacts separately if they are expected in git.

Exit criteria:

- Published package contents include WASM bindings for the new parity APIs.
- Generated artifact diff is limited to Omnia.

## 14. Acceptance Criteria For Complete Parity

Complete parity is reached when all of the following are true:

- [ ] Rust `OmniaChannel` can deserialize current TypeScript channels without dropping durable fields.
- [ ] Rust `SignedChannelState` can deserialize current TypeScript signed states without dropping durable fields.
- [ ] Rust/WASM canonical transition output matches TypeScript for all golden fixtures.
- [ ] Rust/WASM counter program output matches TypeScript for all golden fixtures.
- [ ] Rust/WASM meter program output matches TypeScript for all golden fixtures.
- [ ] Rust/WASM snapshot serialization and recovery validation match TypeScript for all golden fixtures.
- [ ] Rust/WASM close-package shape validation covers durable recovery cases.
- [ ] Existing TypeScript Omnia tests pass.
- [ ] Existing Rust Omnia tests pass.
- [ ] Workspace typecheck and unit-test gates pass.
- [ ] Generated Omnia WASM outputs are intentionally updated or intentionally excluded by documented policy.

## 15. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Canonical serialization mismatch | Invalid signatures or non-reproducible digests | Golden fixtures generated and verified both directions. |
| Bigint representation mismatch | Snapshot recovery drift | Use string-backed durable representation and fixture tests. |
| WASM export surface grows too broad | Hard-to-maintain API | Export deterministic public helpers only. |
| Generated artifact noise | Large unrelated commits | Commit Omnia artifacts separately and exclude unrelated generated outputs. |
| TypeScript keeps moving during parity work | Rework | Keep RFC checklist current and add CI guardrails early. |

## 16. Open Questions

1. Should generated Omnia WASM outputs remain committed in git, or should publish/build produce them from Rust source?
2. Should Rust validation return exact TypeScript error strings or stable error codes with human-readable messages?
3. Should Rust support externally registered programs, or only built-in deterministic programs for now?
4. Should close-package signature verification remain TypeScript-only, or should Rust eventually verify WOTS signatures as a separate RFC?
5. Should legacy raw channel recovery remain permanent support or be marked for removal after a migration window?

## 17. Decision Record

Pending decisions:

| Decision | Owner | Status |
| --- | --- | --- |
| Generated artifact policy | Maintainers | Resolved for this RFC: Omnia WASM outputs are generated/ignored; core-wasm package outputs are tracked. |
| Error code vs exact string parity | Omnia maintainers | Pending |
| Built-in-only vs external program validation | Omnia maintainers | Pending |
| Legacy recovery support window | Omnia maintainers | Pending |

## 18. Appendix: Initial Gap Checklist

This checklist captures the known gaps observed before implementation starts.

- [ ] `rust/src/types.rs` does not define `programId` or `programVersion` on `OmniaChannel`.
- [ ] `rust/src/types.rs` does not define `pendingProposal`.
- [ ] `rust/src/types.rs` does not define `latestCoinId`.
- [ ] `rust/src/types.rs` does not define `unilateralClose`.
- [ ] `rust/src/types.rs` does not define `programTransition` on `SignedChannelState`.
- [ ] `rust/src/types.rs` does not define `closePackage` on `SignedChannelState`.
- [ ] `rust/src` has no `transition.rs` equivalent to `src/transition.ts`.
- [ ] `rust/src` has no `state_vars.rs` equivalent to `src/state-vars.ts`.
- [ ] `rust/src` has no `program.rs` equivalent to built-in program logic in `src/program.ts`.
- [ ] `rust/src` has no `persistence.rs` equivalent to `src/persistence.ts`.
- [ ] `rust/src/wasm.rs` exposes no programmable transition helpers.
- [ ] `rust/src/wasm.rs` exposes no snapshot/recovery helpers.
- [ ] TypeScript tests do not currently compare new program/recovery behavior against WASM.
