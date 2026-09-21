[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / SpliceExecutionPort

# Interface: SpliceExecutionPort

Minimal port wrapping live splice operations.

## Methods

### acceptSplice()

> **acceptSplice**(`proposal`): `Promise`\<`SpliceAcceptance`\>

#### Parameters

##### proposal

`SpliceProposal`

#### Returns

`Promise`\<`SpliceAcceptance`\>

***

### finalizeSplice()

> **finalizeSplice**(`acceptance`): `Promise`\<`SplicedChannel`\>

#### Parameters

##### acceptance

`SpliceAcceptance`

#### Returns

`Promise`\<`SplicedChannel`\>

***

### proposeSpliceOut()

> **proposeSpliceOut**(`params`): `Promise`\<`SpliceProposal`\>

#### Parameters

##### params

`SpliceParams`

#### Returns

`Promise`\<`SpliceProposal`\>

***

### quiesceChannel()

> **quiesceChannel**(`channel`): `Promise`\<`QuiescedChannel`\>

#### Parameters

##### channel

`OmniaChannel`

#### Returns

`Promise`\<`QuiescedChannel`\>
