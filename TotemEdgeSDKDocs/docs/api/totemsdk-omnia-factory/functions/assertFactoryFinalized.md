[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / assertFactoryFinalized

# Function: assertFactoryFinalized()

> **assertFactoryFinalized**(`known`, `incoming`, `senderPublicKeyDigest?`): [`ChannelFactory`](../interfaces/ChannelFactory.md)

Validate a peer-supplied `FACTORY_FINALIZED` transition against the locally
accepted factory. The peer may only fill in the funding references and add
valid opening signatures; every term, commitment and existing signature must
be identical. Returns the validated factory to store.

## Parameters

### known

[`ChannelFactory`](../interfaces/ChannelFactory.md)

### incoming

[`ChannelFactory`](../interfaces/ChannelFactory.md)

### senderPublicKeyDigest?

`string`

## Returns

[`ChannelFactory`](../interfaces/ChannelFactory.md)
