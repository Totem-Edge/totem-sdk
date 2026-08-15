# @totemsdk/omnia

**Eltoo payment channels — the heart of Totem's payment network.**

An eltoo-based (not Lightning's punishment model) payment channel state machine. Eltoo uses sequential update numbers so you never need to store revocation secrets, making channels dramatically simpler and safer.

Omnia ships with a **programmable channel surface**: state variables written to dedicated ports, enforced on-chain by KISSVM scripts injected into the eltoo script, and mirrored 1:1 by a Rust/WASM parity engine that TypeScript uses for independent verification.

## Install

```bash
npm install @totemsdk/omnia
```

## What's inside

### Core types (all exported as TypeScript `type`)

| Type | Description |
|------|-------------|
| `OmniaChannel` | The channel state object |
| `SignedChannelState` | A channel state with attached WOTS signatures |
| `HTLCRecord` | A Hash Time-Locked Contract attached to a channel update |
| `ChannelParticipant` | A party in the channel with their key material |
| `CreateChannelParams` | Parameters for opening a channel |
| `ChannelProposal` | An incoming channel open proposal |
| `SettlementPayload` | Data for a cooperative close |
| `DisputePayload` | Data for a unilateral close / dispute |
| `ChannelSigner` | Interface — plug in any signing backend |
| `KissvmEvaluator` | Interface — plug in custom channel conditions |
| `UpdateStateResult` | Result of `updateState()` |
| `StateValue` | A typed state variable (`number` \| `bool` \| `hex` \| `string`) bound to a program port |
| `ChannelProgram` | A built-in or custom channel program (id, version, script, state builder, validator) |

### Channel lifecycle functions

```
createChannel → acceptChannel → activateChannel
updateState (repeat) → attachCounterpartySignature
proposeSettlement → markChannelClosing → markChannelClosed
buildDisputePayload (unilateral close)
```

### HTLC functions

| Function | What it does |
|----------|-------------|
| `addHTLC(channel, params)` | Add a Hash Time-Locked Contract to a state update |
| `fulfillHTLC(channel, htlcId, preimage)` | Fulfill an HTLC by revealing the preimage |
| `timeoutHTLC(channel, htlcId)` | Reclaim funds from an expired HTLC |

### Transaction builders

| Function | What it does |
|----------|-------------|
| `buildFundingTx(params)` | Build the on-chain funding transaction |
| `buildUpdateTx(state, params)` | Build an eltoo update transaction |
| `buildSettlementTx(state, params)` | Build the cooperative settlement transaction |

### Built-in channel programs

Omnia ships **8 built-in programs** (RFC-003). Each defines a KISSVM script injected into the eltoo script, a state-variable builder, and a transition validator — all mirrored in Rust/WASM:

| Program | `id` | Ports | State |
|---------|------|-------|-------|
| `DefaultEltooPaymentProgram` | `eltoo-payment` | — | Plain payment channel (no extra state) |
| `CounterProgram` | `counter` | 120–122 | Counter, action, operand |
| `MeterProgram` | `meter` | 130–133 | Reading, usage delta, unit price, payment |
| `HTLCPaymentProgram` | `htlc-payment` | 140–143 | Hashlock, locked amount, timeout block, claimed |
| `VaultProgram` | `vault` | 150–152 | Locked value, release sequence, swept |
| `TreasuryProgram` | `treasury` | 160–164 | Membership snapshot hash, vote tally hash, spend cap, spent, outcome proof id |
| `MembershipProgram` | `membership` | 170–172 | Member root, dividend pool, payout sequence |
| `AssetProgram` | `asset` | 180–183 | Token id, holder A/B balances, total |

Program state ports start at `PROGRAM_STATE_PORT_MIN = 120`; ports below 120 are reserved for eltoo core state (`STATE_SETTLEMENT_PORT`, `STATE_SEQUENCE_PORT`, `STATE_COMMITMENT_V2_PORT`, …).

#### Built-in program helpers

| Function | What it does |
|----------|-------------|
| `applyProgramTransition(channel, params)` | Sign a non-payment program transition |
| `incrementCounter(channel, by)` | Built-in CounterProgram increment transition |
| `decrementCounter(channel, by)` | Built-in CounterProgram decrement transition |
| `setCounter(channel, value)` | Built-in CounterProgram set transition |
| `recordMeterReading(channel, reading, unitPrice)` | Built-in MeterProgram usage/payment transition |
| `registerChannelProgram(program)` | Register a custom `ChannelProgram` for resolution |
| `resolveChannelProgram(program)` | Resolve a program id/version to its implementation (defaults to `eltoo-payment`) |
| `sendProgramTransitionStateUpdate(peer, channel, signedState, nonce)` | Send a signed program transition over Omnia messaging |

#### State-variable helpers

| Function | What it does |
|----------|-------------|
| `programNumberState(port, value)` | Build a `number` state variable (port ≥ 120) |
| `programBoolState(port, value)` | Build a `bool` state variable |
| `programHexState(port, value)` | Build a `hex` state variable (validated) |
| `programStringState(port, value)` | Build a `string` state variable |
| `getStateValue(state, port)` | Read a raw `StateValue` from a signed state |
| `getStateBigInt(state, port, fallback)` | Read a numeric state value as `bigint` |
| `getStateBool(state, port, fallback)` | Read a boolean state value |
| `getStateHex(state, port, fallback)` | Read a hex state value |
| `getStateString(state, port, fallback)` | Read a string state value |

#### How a program is enforced

Program transitions write typed state variables to program ports. The program's `buildScript()` injects KISSVM assertions between the eltoo `ASSERT BOTHSIGNED` / `ASSERT SEQUENCE GT PREVSEQUENCE` anchor and the rest of the eltoo script. For example `HTLCPaymentProgram` injects:

```
LET PREIMAGEHASH=SHA3(STATE(140))
LET LOCKED=STATE(141)
...
IF CLAIMED THEN
    ASSERT SEQUENCE EQ PREVSEQUENCE
    ...
    RETURN TRUE
ENDIF
```

So the on-chain script itself enforces the program invariants, exactly as computed off-chain by `buildStateVariables()` and `validateTransition()`. Custom programs do the same: implement `buildScript()`, `buildStateVariables()`, and `validateTransition()`, then `registerChannelProgram()`.

### Rust/WASM parity (RFC-002)

The channel data model, transition canonicalization, state-variable helpers, built-in program registry, snapshot/recovery validation, and close-package validation are **duplicated in Rust and exposed over WASM** — and parity between TypeScript and Rust/WASM is enforced by golden fixtures and `npm run test:parity`. This gives integrators an independent, byte-compatible implementation of the same state machine.

### Persistence and recovery

| Function | What it does |
|----------|-------------|
| `snapshotChannel(channel)` | Produce a serializable channel snapshot |
| `serializeChannelSnapshot(snapshot)` | Serialize a snapshot to bytes |
| `deserializeChannelSnapshot(bytes)` | Deserialize a snapshot |
| `recoverChannelSnapshot(snapshot)` | Validate and rebuild the channel state from a snapshot |
| `recoverChannel(snapshot)` | High-level channel recovery helper |

### KISSVM validation

| Function | What it does |
|----------|-------------|
| `validateChannelStateWithKissvm(state, options)` | Independently evaluate a channel state against its script/conditions using the KISSVM evaluator |

### Error types

`ChannelCapacityError` · `DoubleSignError` · `BalanceConservationError` · `SequenceError` · `SigningIndexMonotonicityError` · `ChannelStatusError`

## Usage

### Open a channel

```typescript
import { createChannel, acceptChannel, activateChannel } from '@totemsdk/omnia';
import type { CreateChannelParams } from '@totemsdk/omnia';

const params: CreateChannelParams = {
  localParty:   { partyId: 'alice', publicKeyDigest: '0x...' },
  remoteParty:  { partyId: 'bob',   publicKeyDigest: '0x...' },
  localAmount:  100n,
  remoteAmount: 0n,
  tokenId:      '0x00',
};

// Local side creates the proposal
const { channel: localChannel, proposal } = await createChannel(params, provider);

// Remote side accepts the proposal
const remoteChannel = acceptChannel(proposal, provider);

// After the funding transaction confirms on-chain, both sides activate
const activeChannel = activateChannel(localChannel);
```

### Update channel state (make a payment)

```typescript
import { updateState, attachCounterpartySignature } from '@totemsdk/omnia';
import type { UpdateDelta } from '@totemsdk/omnia';

// Local side proposes a state update
const delta: UpdateDelta = {
  newBalances: {
    'alice': 90n,
    'bob':   10n,
  },
};
const result = await updateState(channel, delta, leaseProvider, signer);

// Exchange the signed state with the remote peer, then attach their signature
const updated = attachCounterpartySignature(channel, result.state, remoteSignature);
```

### Add an HTLC (for routing / atomic swaps)

```typescript
import { addHTLC, fulfillHTLC } from '@totemsdk/omnia';
import type { AddHTLCParams } from '@totemsdk/omnia';

const htlcParams: AddHTLCParams = {
  amount: 10n,
  hashlock: sha3_256(preimage),   // hex string of the hash
  expiryBlock: currentBlock + 144,
  recipientPublicKeyDigest: '0x...',
};

const { channel: withHtlc, htlcId } = await addHTLC(channel, htlcParams, leaseProvider, signer);

// Fulfill on receipt of the preimage
const { channel: settled } = await fulfillHTLC(withHtlc, htlcId, preimage, leaseProvider, signer);
```

### Programmable CounterProgram state

```typescript
import {
  COUNTER_PROGRAM_ID,
  attachCounterpartySignature,
  createChannel,
  getStateBigInt,
  incrementCounter,
  sendProgramTransitionStateUpdate,
} from '@totemsdk/omnia';

const { channel, proposal } = await createChannel({
  localParty: alice,
  remoteParty: bob,
  localAmount: 100n,
  remoteAmount: 0n,
  fundingCoinId: '0x...',
  fundingWitnessBytes,
  program: { id: COUNTER_PROGRAM_ID, version: 1 },
}, provider);

const { channel: proposedChannel, signedState } = await incrementCounter(
  channel,
  5n,
  leaseProvider,
  signer,
);

await sendProgramTransitionStateUpdate(peer, channel, signedState, 1);

// When the ACK arrives, merge the counterparty signature and close package.
const { signedState: fullState } = attachCounterpartySignature(
  proposedChannel,
  signedState,
  'bob',
  ack.counterpartyPartialState.signatures.bob,
  ack.counterpartyPartialState.signingIndices.bob,
  ack.counterpartyClosePackage,
);

const counter = getStateBigInt(fullState, 120);
```

### Programmable MeterProgram state

`MeterProgram` treats the first party as payer and second party as payee. A reading transition records a monotonic meter reading and transfers `(reading - previousReading) * unitPrice` from payer to payee.

```typescript
import { METER_PROGRAM_ID, recordMeterReading } from '@totemsdk/omnia';

const { channel } = await createChannel({
  localParty: consumer,
  remoteParty: provider,
  localAmount: 1000n,
  remoteAmount: 0n,
  fundingCoinId: '0x...',
  fundingWitnessBytes,
  program: { id: METER_PROGRAM_ID, version: 1 },
}, provider);

const { signedState } = await recordMeterReading(channel, 110n, 2n, leaseProvider, signer);
```

### Co-sign verification boundary

Lease-backed messaging receivers use `verifyStateForCoSign()` before adding their local signature. It accepts a one-party proposal only if that party's update signature, close-package artifacts, sequence, balance conservation, `STATE(102)` commitment, and program validation hooks pass.

After the receiver signs and both partial close packages are merged, use `verifyState()` on the complete state. `verifyState()` is intentionally stricter: it requires every channel party to have signed both the update and paired close-package artifacts.

### Cooperative close

```typescript
import { proposeSettlement, markChannelClosing, markChannelClosed } from '@totemsdk/omnia';

// Propose settlement — both sides call this and exchange partialState
const { settlementPayload, partialState } = await proposeSettlement(
  channel,
  leaseProvider,
  { signer, partyAddresses: { alice: 'MxAAA...', bob: 'MxBBB...' } },
);

// Once both signatures are collected and the settlement tx is broadcast:
const closing = markChannelClosing(channel);
const closed  = markChannelClosed(closing);
```

## Channel lifecycle statuses

```
opening → active → closing_mutual | closing_unilateral | disputing → closed | spliced
```

## Parity testing

```bash
npm run test:parity
```

Runs `build:wasm` then the parity fixture suites: `parity-fixtures`, `omnia-parity-recovery`, and `omnia-wasm-parity`. The Rust implementation lives in `packages/omnia/rust/`.

## See also

- [`@totemsdk/omnia-factory`](https://www.npmjs.com/package/@totemsdk/omnia-factory) — factory channels for reduced on-chain footprint
- [`@totemsdk/omnia-router`](https://www.npmjs.com/package/@totemsdk/omnia-router) — multi-hop routing over channel networks
- [`@totemsdk/omnia-splice`](https://www.npmjs.com/package/@totemsdk/omnia-splice) — resize channels without closing them
- [`@totemsdk/stream-transport`](https://www.npmjs.com/package/@totemsdk/stream-transport) — Omnia messaging transport (framing, swarm, relay, pubsub)
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — key safety for channel signing
- [`@totemsdk/agent-policy`](https://www.npmjs.com/package/@totemsdk/agent-policy) — AI agent spending policies (`PaymentIntent`, `AgentPolicy`)
- [`@totemsdk/kissvm`](https://www.npmjs.com/package/@totemsdk/kissvm) — the KISSVM script language and evaluator

## References

- [`docs/rfc/RFC-002-OMNIA-RUST-WASM-PARITY.md`](../../docs/rfc/RFC-002-OMNIA-RUST-WASM-PARITY.md) — Rust/WASM parity engine
- [`docs/rfc/RFC-003-OMNIA-BUILT-IN-PROGRAMS.md`](../../docs/rfc/RFC-003-OMNIA-BUILT-IN-PROGRAMS.md) — built-in channel programs