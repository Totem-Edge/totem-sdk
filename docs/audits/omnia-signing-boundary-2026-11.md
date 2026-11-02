# Audit — Omnia signing boundary and eltoo script integrity, 2026-11

Status: **All 25 findings addressed (stages 1–5).** The settlement co-signing
oracle, the untrusted settlement inputs, the settlement address model, the
channel-open binding, the Rust script builder, state authentication, chain truth,
HTLC semantics, encoding/accounting and the Rust mirror are fixed. The Rust mirror
now verifies states independently: canonical transaction serialisation, the signed
digest, state commitment v2, close packages and every party's WOTS signature.

Method: adversarial read of `packages/omnia/src` (channel, settlement, close-package,
sign, transactions, htlc, script, addresses) and the Rust mirror in
`packages/omnia/rust/src`, cross-checked against the two VM harnesses.

## 1. Fixed — fund-loss class

### 1.1 Settlement co-signing oracle

`signSettlementRequest` deserialized the counterparty's `settlementTxHex` and signed
it, with no check that the draft belonged to the channel, matched the sequence, paid
the agreed addresses or matched `digestHex`. A peer could obtain the victim's half of
`MULTISIG(2 A B)` over a settlement paying the whole channel to itself, then
broadcast it alone. Reachable from an untrusted peer via `integration.ts`.

Now (`packages/omnia/src/settlement.ts`): the draft is always rebuilt locally from
channel state and the channel's agreed addresses; the supplied transaction, digest
and sequence must match it byte-for-byte before anything is signed. Only the local
draft is ever signed.

### 1.2 Untrusted settlement inputs in `proposeSettlement`

`partyAddresses`, `settlementTxHex`, `localSignature` and `counterpartySignatures`
were trusted verbatim. Now:

- addresses must equal the channel's agreed addresses;
- a supplied transaction must equal the locally built draft;
- a supplied local signature must verify against the local digest and the signer's
  key;
- every counterparty signature must verify against its party and the local digest
  before it can enter the broadcast witness.

### 1.3 Settlement address model

`defaultSettlementAddresses` used the raw `publicKeyDigest` as a payout address. That
is a `SIGNEDBY` identity, not a spendable address: a unilateral close would have paid
funds to an unspendable destination. Both close packages and cooperative settlement
now use `canonicalSettlementAddress` (`packages/omnia/src/addresses.ts`):
`party.settlementAddress` when recorded in the channel, otherwise
`wotsAddressData(publicKeyDigest)`. A peer-supplied address may only confirm that
value, never replace it.

### 1.4 Channel open binding

`acceptChannel` now rejects a counterparty contest delay below
`ELTOO_CONTEST_DELAY_BLOCKS` unless the caller explicitly opts in
(`{ allowShortContestDelay: true }`), and binds the channel to the funding coin:

- the on-chain coin's address must equal the eltoo script address;
- a supplied `fundingAddress` must equal the eltoo script address.

### 1.5 Eltoo script builder

`buildEltooScript` (`packages/omnia/src/script.ts`) now rejects:

- a non-array `parties` argument and malformed party objects (domain errors, not
  `TypeError`);
- duplicate `publicKeyDigest` values — `MULTISIG(2 A A)` is satisfiable by a single
  signature (verified on both VMs), so a duplicate silently collapsed 2-of-2 to
  1-of-1;
- unsafe `contestDelayBlocks`, while accepting `number | bigint` (block heights are
  `bigint` elsewhere in the SDK).

### 1.6 Rust script builder parity

`packages/omnia/rust/src/script.rs` previously interpolated `publicKeyDigest` with no
validation (newline/opcode injection), hardcoded the 256-block delay, did not reject
duplicate keys and emitted non-node-canonical text (uppercase variables, `0X`
prefixes), so it could not match the TS funding script. It now validates 64-hex
digests, rejects duplicates, takes the delay as a parameter and emits the exact
canonical text the TS builder produces, with unit tests for parity and injection.

### 1.7 Rust mirror validators fail closed

`validate_complete_channel_state_wasm` returned `{ valid: true }` while never
verifying signatures, the port-102 commitment, program rules or the close package;
`verify_state_wasm` verified a different digest than the TS signer signs and invoked
its JS callback with the wrong arity. Both are not exposed as passing validators
anymore: they return `{ valid: false, errors: ["… not implemented … use the
TypeScript validator"] }`. The TS validator is authoritative until parity lands.

### 1.8 State authentication

The signed payload is the canonical update transaction, but the `SignedChannelState`
carries its own copies of `stateVariables` and `transactionHex` that were never
compared against it. A validly signed state could therefore be re-labelled with
arbitrary state variables and arbitrary transaction bytes while its signature still
verified — and those bytes feed dispute evidence and the KISSVM input.

Fixed:

- `verifyStateSignature` now rebuilds the update transaction and requires the
  carried `stateVariables` and `transactionHex` to match it before verifying.
- `attachCounterpartySignature` validates the whole merged state with the co-sign
  rules (sequence, conservation, port-102 commitment, program hooks, partial close
  package, every present signature including the local one) instead of checking only
  the counterparty signature. A stale state is rejected.
- `signState` enforces the sequence/double-sign watermark itself, so the peer
  co-sign path gets the same protection as `updateState`; capacity refusal is an
  error rather than an unchecked path.
- The watermark is **sealed** on the first produced signature
  (`sealUpdateGuard`). `releaseUpdateGuard` is a no-op afterwards, so a flow that
  fails after signing cannot free the sequence for a different payload.

The guards live in `packages/omnia/src/guards.ts` to keep `sign.ts` free of an
import cycle with `channel.ts`.

**Test-suite hole closed.** The main omnia unit suite mocks `@totemsdk/core` so
`verifyTreeSignature` always returns `true`; every signature assertion in it was
vacuous. `tests/unit/omnia/src/__tests__/state-signatures.real.test.ts` runs the same
path with real TreeKeys and no core mock: a valid signature verifies, and re-labelled
`stateVariables`, mangled `transactionHex`, tampered balances and the wrong signing
key all fail.

### 1.9 Chain truth and lifecycle

- **Confirmation depth.** `acceptChannel` used `coin.mmrentry` (an MMR leaf index)
  as a block height and defaulted missing values to `0`, so an unconfirmed coin
  looked deeply confirmed. It now uses the coin's `created` block
  (`chain-truth.ts`), and a missing/invalid/future-dated height is treated as
  **unconfirmed**, not as height 0. A test locks in both failure modes.
- **On-chain sequence tracking.** `onChainSequence` and `latestCoinId` were never
  maintained after funding, so a cooperative close after a mined update referenced
  sequence 0 and the funding coin. `confirmUpdateBroadcast` now records them —
  reading the sequence and the port-102 commitment from the coin itself, after
  checking its address and confirmation depth. A caller cannot move them by
  supplying a transaction.
- **Unilateral close finalisation.** `finalizeUnilateralClose` mixed signatures from
  `latestState` with bytes from `unilateralClose`. It now requires the two sequences
  to match (stale close packages are rejected with an explicit "replace it first"),
  re-verifies the close package, and broadcasts the *verified* settlement bytes.
- **Contest window.** The deadline used the module constant instead of the
  channel's own `contestDelayBlocks`. It now uses the channel value, and finalisation
  additionally requires the update output coin to be recorded
  (`recordUnilateralUpdateCoin`, which restarts the clock from the coin's real
  inclusion height). Finalisation refuses to run until it is recorded — the update
  transaction carries the eltoo placeholder input, so its output coin id cannot be
  derived locally.
- **Replacement rebroadcasts.** `replaceUnilateralCloseState` updated local metadata
  without rebroadcasting, leaving the old update on chain and the old deadline in
  place. It is now async, takes a chain provider, verifies the newer close package,
  broadcasts its update, records the new `updateCoinId` and restarts the contest
  window.

### 1.10 HTLC semantics

- `addHTLC` now binds the HTLC to the channel: the counterparty key must be the
  channel counterparty, `direction` must be `offered`/`received`, the hashlock must
  be a 32-byte hex string (normalised to lowercase `0x`), the timeout must be a
  positive bigint, and the amount must be a whole number of raw units at the
  channel's token scale.
- `fulfillHTLC` requires a `ChainStateProvider` and refuses a fulfil once the tip is
  past the HTLC timeout — the on-chain claim branch is only valid at or before it.
  The preimage must be 32-byte hex.
- The HTLC claim descriptor now stores the preimage as a `hex` state value. A
  `string` value commits the ASCII form, which can never match
  `SHA3(preimageBytes)`.
- `buildHtlcFulfillmentReceipt` no longer mints an unauthenticated self-hash: the
  receipt binds the channel, the fulfilled HTLC record, the state sequence and the
  port-102 commitment, and `verifyHtlcFulfillmentReceipt` re-derives it from the
  signed state and verifies the recipient's signature.

### 1.11 Encoding and accounting

- State commitments sort with UTF-16 code-unit order instead of `localeCompare`
  (ICU-dependent), so peers on different runtimes agree.
- `getStateBool` parses `true`/`false`/`1`/`0`/booleans/numbers explicitly and falls
  back for unknown representations; `Boolean("false") === true` is gone.
- `buildSettlementTx` requires the balance map to match the participant set exactly
  and rejects negative balances; a missing party previously produced no output and
  burned that share. `verifyState` / `validateStateForCoSign` apply the same shape
  check.
- Capacity is keyed on WOTS leaves (two per state: update + pre-signed settlement)
  rather than on the sequence number, and the receipt no longer clamps to
  `TOTAL - 1`, so a channel can actually report `critical`.
- Close-package and settlement witnesses are ordered by the channel's `MULTISIG`
  key order, not object insertion order.
- `attachCounterpartySignature` keeps a counterparty close package even when the
  local partial state has none.

### 1.12 Rust mirror parity

The mirror no longer needs to fail closed. It now implements:

- **Canonical Minima serialisation** (`serialize.rs`): byte-for-byte port of
  `omniaDraftToCanonicalMinimaBytes`, including `writeMiniNumber`, MiniData hashes,
  the MMR entry, state-value encoding and the output coin-id rule.
- **Signed digest**: `compute_tx_digest_wasm` hashes the replayed bytes, and a
  cross-language test asserts equality with `computeOmniaTxDigest`.
- **Signature verification** (`signature.rs`): port of
  `deserializeTreeSignature`/`parseMMRProofFromHex`, verifying through
  `totemsdk_core_wasm::treekey::verify_tree_signature`.
- **State + close-package verification** (`validation.rs`):
  `verify_state_checks` enforces sequence, strict conservation, commitment-v2, the
  signed transaction bytes and their state variables, the close package (both
  artifacts' digests, state variables, output conservation and per-party
  signatures) and signing-index monotonicity. `validate_complete_channel_state_wasm`
  and `verify_state_wasm` are re-enabled over the serialized JSON form.
- **Public API**: `verifyStateWithRustMirror(channel, state)` (with
  `configureRustMirror` for injection) fails closed when the wasm build is absent
  and otherwise returns the mirror's verdict.

`tests/unit/omnia/src/__tests__/rust-parity.test.ts` proves commitment and
serializer/digest equality; `state-signatures.real.test.ts` proves the mirror accepts
a fully signed state and rejects tampered balances, tampered transaction bytes and a
forged signature.

**Known boundary:** the mirror consumes the serialized decimal-string form (bigints
as decimal strings, signatures as hex) — the same form persistence uses. Program-hook
validation (`validateTransition`) remains TypeScript-side; the mirror checks every
state invariant that does not need the program registry.

## 2. Invariants now enforced

- No Omnia function signs bytes supplied by a peer.
- A settlement output can only pay the address recorded in the channel (or derived
  from the party's channel key).
- The two eltoo spend paths require two distinct keys.
- A channel is bound to a funding coin under its own script.
- A counterparty cannot choose a contest window shorter than the floor.
- The Rust script builder cannot emit a different script than the TypeScript builder.
- The carried `stateVariables` / `transactionHex` cannot diverge from the signed
  payload.
- Every signing entry point — including the co-sign path — shares the
  sequence/double-sign guards, and a produced signature seals the sequence.
- A coin without a usable creation height is unconfirmed, never "confirmed at
  height 0".
- `onChainSequence` / `latestCoinId` can only be advanced by a coin that carries
  the latest signed state's sequence and commitment.
- A unilateral close cannot be finalised with a settlement that does not belong to
  the state being closed, or before the update output has aged the channel's own
  contest delay.
- An HTLC pays the channel counterparty and cannot be fulfilled after its timeout.
- A fulfilment receipt is only valid against a signed state carrying the recipient's
  signature.
- Commitments are independent of the runtime's ICU/locale.
- Rust and TypeScript compute the same state commitment v2, the same canonical
  transaction bytes and the same signed digest.
- The Rust mirror independently verifies every party signature and the close package.

## 3. Verification

| Check | Result |
|---|---|
| `jest --config tests/jest/omnia.cjs` | 281 passed across 16 suites (state-auth, chain-truth, HTLC, real-WOTS and Rust-parity suites) |
| `cargo test` (omnia mirror) | 34 passed (script, serializer, signature and validation tests) |
| `node scripts/omnia-swap-vm.mjs` | 15/15 |
| `node scripts/omnia-channel-vm.mjs` | 16/16 |
| eslint on changed files | 0 errors |

## 4. Open findings (not fixed)

These are real and remain. They are grouped because the first three need one
coordinated state-model change, not individual guards.

### State authentication — fixed in stage 2

The first four findings (unauthenticated `stateVariables`/`transactionHex`,
unvalidated `attachCounterpartySignature`, the co-sign watermark bypass and the
releasable double-sign guard) are fixed; see §1.8. The findings below keep their
original numbers.

### Chain truth and lifecycle — fixed in stage 3

Findings 5–9 (confirmation depth from `mmrentry`, unmaintained
`onChainSequence`/`latestCoinId`, mixed-source finalisation, stale contest deadline
and non-rebroadcasting replacement) are fixed; see §1.9. The findings below keep
their original numbers.

### HTLC semantics and encoding/accounting — fixed in stage 4

Findings 10–20 are fixed; see §1.10 and §1.11. The findings below keep their original
numbers.

### Rust mirror — fixed in stage 5

Findings 21–25 are fixed; see §1.12. The validator entry points are re-enabled.

## 5. Remaining boundary

No findings from this audit remain open. Two explicit boundaries are part of the
design rather than defects:

- **Program hooks.** `validateTransition` runs in TypeScript; the mirror verifies
  every state invariant that does not require the program registry. A state whose
  program transition is invalid is rejected by the TypeScript layer.
- **Wire form.** The mirror consumes serialized decimal strings and hex signatures.
  Passing native JS bigints across the wasm boundary is not part of the contract.

## 6. Reproduction

```bash
node_modules/.bin/jest --config tests/jest/omnia.cjs
(cd packages/omnia/rust && cargo test)
node scripts/omnia-swap-vm.mjs
node scripts/omnia-channel-vm.mjs
```
