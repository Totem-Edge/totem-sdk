[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / SpliceExecutionPort

# Interface: SpliceExecutionPort

Minimal port wrapping live splice operations.

## Methods

### acceptSplice()

> **acceptSplice**(`channel`, `proposal`, `leaseProvider`): `Promise`\<`SpliceAcceptance`\>

#### Parameters

##### channel

`OmniaChannel` \| `QuiescedChannel`

##### proposal

`SpliceProposal`

##### leaseProvider

`SpliceLeaseProvider`

#### Returns

`Promise`\<`SpliceAcceptance`\>

***

### finalizeSplice()

> **finalizeSplice**(`channel`, `proposal`, `acceptance`, `options?`): `Promise`\<`SplicedChannel`\>

#### Parameters

##### channel

`OmniaChannel` \| `QuiescedChannel`

##### proposal

`SpliceProposal`

##### acceptance

`SpliceAcceptance`

##### options?

`FinalizeSpliceOptions`

#### Returns

`Promise`\<`SplicedChannel`\>

***

### proposeSpliceOut()

> **proposeSpliceOut**(`channel`, `withdrawAmount`, `withdrawAddress`, `leaseProvider`): `Promise`\<`SpliceProposal`\>

#### Parameters

##### channel

`QuiescedChannel`

##### withdrawAmount

`bigint`

##### withdrawAddress

`string`

##### leaseProvider

`SpliceLeaseProvider`

#### Returns

`Promise`\<`SpliceProposal`\>

***

### quiesceChannel()

> **quiesceChannel**(`channel`, `leaseProvider`): `Promise`\<`QuiescedChannel`\>

#### Parameters

##### channel

`OmniaChannel`

##### leaseProvider

`SpliceLeaseProvider`

#### Returns

`Promise`\<`QuiescedChannel`\>
