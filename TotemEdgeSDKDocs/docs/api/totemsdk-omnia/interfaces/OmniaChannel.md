[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / OmniaChannel

# Interface: OmniaChannel

## Properties

### balances

> **balances**: `Record`\<[`partyId`](../type-aliases/partyId.md), `bigint`\>

***

### channelId

> **channelId**: `string`

***

### channelType

> **channelType**: `"direct"` \| `"virtual"`

***

### createdAt

> **createdAt**: `number`

***

### currentSequence

> **currentSequence**: `number`

***

### factoryRef?

> `optional` **factoryRef?**: `string`

***

### fundingAddress

> **fundingAddress**: `string`

SHA3-256 script-hash address for the eltoo script — used as input/output address in update/settlement TXs.

***

### fundingCoinId

> **fundingCoinId**: `string`

***

### fundingScript

> **fundingScript**: `string`

***

### fundingTxId

> **fundingTxId**: `string`

***

### latestCoinId?

> `optional` **latestCoinId?**: `string`

The coin ID of the most recently confirmed on-chain channel output.
Starts as `fundingCoinId`; callers should update this after each mined
update TX is confirmed on-chain so subsequent update/settlement inputs
reference the real spendable coin rather than the funding output.

***

### latestState

> **latestState**: [`SignedChannelState`](SignedChannelState.md) \| `null`

***

### localSigner?

> `optional` **localSigner?**: [`ChannelSigner`](ChannelSigner.md)

Local party signer — stored on the channel so callers can omit the signer param from
public functions (updateState, addHTLC, proposeSettlement, executeIntent, etc.).
Explicit signer params always take precedence over this field.

***

### parties

> **parties**: [`ChannelParticipant`](ChannelParticipant.md)[]

***

### pendingHTLCs

> **pendingHTLCs**: [`HTLCRecord`](HTLCRecord.md)[]

***

### pendingProposal?

> `optional` **pendingProposal?**: `object`

Tracks the most recent in-flight proposal at a given sequence number.
Used for double-sign detection: same sequence + different payload → DoubleSignError.

#### payloadHash

> **payloadHash**: `string`

#### sequence

> **sequence**: `number`

***

### stateLog

> **stateLog**: [`ChannelLogEntry`](ChannelLogEntry.md)[]

***

### status

> **status**: [`ChannelStatus`](../type-aliases/ChannelStatus.md)

***

### tokenId

> **tokenId**: `string`

***

### tokenScale

> **tokenScale**: `number`

Scale factor for coloured coins: `tokenAmount = minimaRawAmount × 10^tokenScale`.
For native Minima (tokenId=0x00) this is always 0.
Balances are stored in scaled token units; TX builders convert to raw Minima.

***

### totalValue

> **totalValue**: `bigint`

***

### updatedAt

> **updatedAt**: `number`
