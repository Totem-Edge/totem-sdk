[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / assertFactoryDistributable

# Function: assertFactoryDistributable()

> **assertFactoryDistributable**(`factory`): `void`

Refuse to distribute while the factory still backs open virtual channels: the
distribution covenant pays only the participant shares, so a VC reserve would
be stranded or, worse, paid to the wrong party.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

## Returns

`void`
