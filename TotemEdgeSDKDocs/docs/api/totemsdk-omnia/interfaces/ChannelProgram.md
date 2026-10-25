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

> **buildScript**(`parties`, `options?`): `string`

Build the channel script. `contestDelayBlocks` is only honoured by programs
that embed an eltoo-style contest delay (the default eltoo program); other
programs may ignore it.

#### Parameters

##### parties

[`ChannelParticipant`](ChannelParticipant.md)[]

##### options?

###### contestDelayBlocks?

`number`

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
