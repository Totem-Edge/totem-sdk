[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / FactoryCoordination

# Interface: FactoryCoordination

## Properties

### handlers

> **handlers**: `CoordinationHandlers`

## Methods

### closeFactory()

> **closeFactory**(`peer`, `coordination`, `factory`): `Promise`\<`void`\>

Send a FACTORY_CLOSE_PROPOSAL and gather N-of-N settlement signatures.

#### Parameters

##### peer

`OmniaPeer`

##### coordination

`OmniaCoordination`

##### factory

[`ChannelFactory`](ChannelFactory.md)

#### Returns

`Promise`\<`void`\>

***

### openFactory()

> **openFactory**(`peer`, `coordination`, `factory`): `Promise`\<`void`\>

Send a FACTORY_PROPOSAL for an 'opening' factory.

#### Parameters

##### peer

`OmniaPeer`

##### coordination

`OmniaCoordination`

##### factory

[`ChannelFactory`](ChannelFactory.md)

#### Returns

`Promise`\<`void`\>

***

### openVirtualChannel()

> **openVirtualChannel**(`peer`, `coordination`, `factory`, `parties`, `amounts`): `Promise`\<`void`\>

Send a VC_PROPOSAL and gather N-of-N virtual-channel-open signatures.

#### Parameters

##### peer

`OmniaPeer`

##### coordination

`OmniaCoordination`

##### factory

[`ChannelFactory`](ChannelFactory.md)

##### parties

\[`string`, `string`\]

##### amounts

`Record`\<`string`, `bigint`\>

#### Returns

`Promise`\<`void`\>
