[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / FactoryExecutionPort

# Interface: FactoryExecutionPort

Minimal port wrapping live channel factory operations.

## Methods

### closeFactory()

> **closeFactory**(`factory`): `Promise`\<`FactorySettlementPayload`\>

#### Parameters

##### factory

`ChannelFactory`

#### Returns

`Promise`\<`FactorySettlementPayload`\>

***

### closeVirtualChannel()

> **closeVirtualChannel**(`factory`, `channelId`): `Promise`\<`ChannelFactory`\>

#### Parameters

##### factory

`ChannelFactory`

##### channelId

`string`

#### Returns

`Promise`\<`ChannelFactory`\>

***

### createFactory()

> **createFactory**(`params`): `Promise`\<`ChannelFactory`\>

#### Parameters

##### params

`FactoryCreationParams`

#### Returns

`Promise`\<`ChannelFactory`\>

***

### openVirtualChannel()

> **openVirtualChannel**(`factory`, `params`): `Promise`\<\{ `channel`: `OmniaChannel`; `factory`: `ChannelFactory`; \}\>

#### Parameters

##### factory

`ChannelFactory`

##### params

`FactoryVirtualChannelParams`

#### Returns

`Promise`\<\{ `channel`: `OmniaChannel`; `factory`: `ChannelFactory`; \}\>

***

### reallocate()

> **reallocate**(`factory`, `allocation`): `Promise`\<`ChannelFactory`\>

#### Parameters

##### factory

`ChannelFactory`

##### allocation

`Record`\<`string`, `string`\>

#### Returns

`Promise`\<`ChannelFactory`\>
