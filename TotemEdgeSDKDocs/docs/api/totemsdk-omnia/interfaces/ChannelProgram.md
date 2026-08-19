[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / ChannelProgram

# Interface: ChannelProgram

## Properties

### id

> **id**: `string`

***

### version

> **version**: `number`

## Methods

### buildScript()

> **buildScript**(`parties`): `string`

#### Parameters

##### parties

[`ChannelParticipant`](ChannelParticipant.md)[]

#### Returns

`string`

***

### buildStateVariables()

> **buildStateVariables**(`input`): [`StateValue`](StateValue.md)[]

#### Parameters

##### input

[`ChannelProgramBuildStateInput`](ChannelProgramBuildStateInput.md)

#### Returns

[`StateValue`](StateValue.md)[]

***

### validateTransition()?

> `optional` **validateTransition**(`input`): [`ChannelProgramValidationResult`](ChannelProgramValidationResult.md)

#### Parameters

##### input

[`ChannelProgramValidateTransitionInput`](ChannelProgramValidateTransitionInput.md)

#### Returns

[`ChannelProgramValidationResult`](ChannelProgramValidationResult.md)
