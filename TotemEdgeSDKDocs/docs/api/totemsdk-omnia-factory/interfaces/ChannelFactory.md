[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / ChannelFactory

# Interface: ChannelFactory

## Properties

### allocations

> **allocations**: `Record`\<`string`, `bigint`\>

Current committed allocations: sum must equal `totalValue − sum(vc.totalValue)`.

***

### currentSequence

> **currentSequence**: `number`

Monotonically increasing. Incremented on every committed state transition.

***

### factoryId

> **factoryId**: `string`

***

### fundingAddress

> **fundingAddress**: `string`

Script address (SHA3-256 of normalised script).

***

### fundingCoinId?

> `optional` **fundingCoinId?**: `string`

CoinID of the factory's shared UTXO — required for settlement and dispute.

***

### fundingScript

> **fundingScript**: `string`

N-of-N MULTISIG KISSVM script for the factory's on-chain UTXO.

***

### fundingTxId?

> `optional` **fundingTxId?**: `string`

TxPoW ID of the factory funding TX (hex) — set after createFactory mines the TX.

***

### participants

> **participants**: [`FactoryParticipant`](FactoryParticipant.md)[]

***

### pendingCommitment?

> `optional` **pendingCommitment?**: `string`

Hex-encoded commitment (TX draft digest or state hash) that all participants
must sign during the current opening or signing round.
Set by `createFactory`; cleared when the factory becomes 'active'.

***

### pendingSignatures

> **pendingSignatures**: `Record`\<`string`, [`FactorySignature`](../type-aliases/FactorySignature.md)\>

Partial signatures collected so far for the pending commitment.
Keyed by `partyId`.  Cleared when all N parties have signed.

***

### stateLog

> **stateLog**: [`FactoryLogEntry`](FactoryLogEntry.md)[]

***

### status

> **status**: [`FactoryStatus`](../type-aliases/FactoryStatus.md)

***

### tokenId

> **tokenId**: `string`

***

### tokenScale

> **tokenScale**: `number`

Token scale exponent, matching Minima's `Token.mTokenScale`:
`tokenAmount = minimaRawAmount × 10^scale`. Native Minima (tokenId `0x00`)
has scale 0. Coloured coins use `MINIMA_MAX_DECIMAL_PLACES − scale`
(44 − scale) decimal places. All factory amounts are held in scaled token
units; TX builders convert to raw Minima via `toRawMinima()`.

***

### totalValue

> **totalValue**: `bigint`

***

### virtualChannels

> **virtualChannels**: [`OmniaChannel`](OmniaChannel.md)[]

Currently open virtual channels backed by this factory's shared UTXO.
