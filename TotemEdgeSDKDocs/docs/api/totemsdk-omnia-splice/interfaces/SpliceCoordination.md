[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / SpliceCoordination

# Interface: SpliceCoordination

## Properties

### handlers

> **handlers**: `CoordinationHandlers`

## Methods

### propose()

> **propose**(`peer`, `coordination`, `channel`, `params`): `Promise`\<[`SpliceProposal`](SpliceProposal.md)\>

#### Parameters

##### peer

`OmniaPeer`

##### coordination

`OmniaCoordination`

##### channel

`OmniaChannel` \| [`QuiescedChannel`](../type-aliases/QuiescedChannel.md)

##### params

[`SpliceProposeParams`](SpliceProposeParams.md)

#### Returns

`Promise`\<[`SpliceProposal`](SpliceProposal.md)\>
