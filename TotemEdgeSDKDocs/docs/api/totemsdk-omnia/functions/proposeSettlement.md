[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / proposeSettlement

# Function: proposeSettlement()

> **proposeSettlement**(`channel`, `leaseProvider`, `opts?`): `Promise`\<\{ `partialState`: `Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>; `settlementPayload`: [`SettlementPayload`](../interfaces/SettlementPayload.md); \}\>

Builds the cooperative settlement TX (`STATE(100)=TRUE`) and signs it with the
settlement TX digest — critical for on-chain correctness.

Full chain path (when `opts.chainProvider` is provided):
  1. Build settlement draft (STATE(100)=TRUE, per-party outputs).
  2. Sign the settlement TX digest via the WOTS lease.
  3. Serialize draft bytes + witness bytes → `serializeTxBody()` (txpow TxBody).
  4. Mine PoW via `mineTxPoW()` using `TX_POW_MIN_DIFFICULTY`.
  5. Assemble full TxPoW: `minedHeaderBytes || 0x01 || txBody`.
  6. Broadcast via `chainProvider.broadcastTxPoW()`.

Spec: `proposeSettlement(channel, leaseProvider)` — signer and partyAddresses are
optional via the opts argument and fall back to channel fields.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### leaseProvider

`WotsLeaseProvider`

### opts?

`ProposeSettlementOptions`

## Returns

`Promise`\<\{ `partialState`: `Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>; `settlementPayload`: [`SettlementPayload`](../interfaces/SettlementPayload.md); \}\>
