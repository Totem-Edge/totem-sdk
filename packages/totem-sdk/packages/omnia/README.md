# @totemsdk/omnia

**Eltoo payment channels — the heart of Totem's payment network.**

An eltoo-based (not Lightning's punishment model) payment channel state machine. Eltoo uses sequential update numbers so you never need to store revocation secrets, making channels dramatically simpler and safer.

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

## See also

- [`@totemsdk/omnia-factory`](https://www.npmjs.com/package/@totemsdk/omnia-factory) — factory channels for reduced on-chain footprint
- [`@totemsdk/omnia-router`](https://www.npmjs.com/package/@totemsdk/omnia-router) — multi-hop routing over channel networks
- [`@totemsdk/omnia-splice`](https://www.npmjs.com/package/@totemsdk/omnia-splice) — resize channels without closing them
- [`@totemsdk/omnia`](https://www.npmjs.com/package/@totemsdk/omnia) — Omnia messaging layer (framing, swarm, relay, pubsub)
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — key safety for channel signing
- [`@totemsdk/agent-policy`](https://www.npmjs.com/package/@totemsdk/agent-policy) — AI agent spending policies (`PaymentIntent`, `AgentPolicy`)
