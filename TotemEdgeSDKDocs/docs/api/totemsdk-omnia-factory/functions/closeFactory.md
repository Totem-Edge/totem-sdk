[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / closeFactory

# Function: closeFactory()

> **closeFactory**(`factory`, `leaseProviders`, `chainProvider?`): `Promise`\<[`FactorySettlementPayload`](../interfaces/FactorySettlementPayload.md)\>

Cooperative N-of-N factory close.

Flow:
  1. Fail fast if `factory.fundingCoinId` is not set — settlement TX requires
     a concrete input coin.
  2. Build the settlement OmniaTxDraft (N outputs, one per participant with a
     positive allocation) spending the factory's N-of-N MULTISIG input.
  3. Compute the TX draft digest via `computeTxDraftDigest` from `@totemsdk/omnia`.
  4. Collect N-of-N signatures — all participants sign + verify the TX digest
     via the full WOTS lease cycle (reserve → sign → verify → commit).
  5. Encode the concatenated WOTS signatures as the settlement TX witness.
  6. When `chainProvider` is supplied: mine via `@totemsdk/txpow`'s `mineTxPoW`,
     assemble the full TxPoW blob, and broadcast.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

Active factory with no open virtual channels.

### leaseProviders

`Record`\<`string`, [`WotsLeaseBundle`](../interfaces/WotsLeaseBundle.md)\>

WOTS lease bundles for ALL N factory participants.

### chainProvider?

`ChainStateProvider`

Optional: mine + broadcast the settlement TX.

## Returns

`Promise`\<[`FactorySettlementPayload`](../interfaces/FactorySettlementPayload.md)\>
