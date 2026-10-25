[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / FactoryExecutionPort

# Interface: FactoryExecutionPort

Minimal port wrapping live channel factory operations.

## Methods

### closeFactory()

> **closeFactory**(`factory`, `leaseProviders`, `chainProvider?`): `Promise`\<`FactorySettlementPayload`\>

#### Parameters

##### factory

`ChannelFactory`

##### leaseProviders

`Record`\<`string`, `WotsLeaseBundle`\>

##### chainProvider?

`ChainStateProvider`

#### Returns

`Promise`\<`FactorySettlementPayload`\>

***

### closeVirtualChannel()

> **closeVirtualChannel**(`factory`, `channel`, `leaseProviders`): `Promise`\<`ChannelFactory`\>

#### Parameters

##### factory

`ChannelFactory`

##### channel

`OmniaChannel`

##### leaseProviders

`Record`\<`string`, `WotsLeaseBundle`\>

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

> **reallocate**(`factory`, `fromPartyId`, `toPartyId`, `amount`, `leaseProviders`): `Promise`\<`ChannelFactory`\>

#### Parameters

##### factory

`ChannelFactory`

##### fromPartyId

`string`

##### toPartyId

`string`

##### amount

`bigint`

##### leaseProviders

`Record`\<`string`, `WotsLeaseBundle`\>

#### Returns

`Promise`\<`ChannelFactory`\>
