[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / WalletForwarding

# Interface: WalletForwarding

## Properties

### forwarder

> **forwarder**: [`MultiHopForwarder`](MultiHopForwarder.md)

## Methods

### bindPeer()

> **bindPeer**(`peer`): () => `void`

Register the forwarding instruction handler for one peer.

#### Parameters

##### peer

`OmniaPeer`

#### Returns

() => `void`

***

### close()

> **close**(): `void`

Detach every bound peer.

#### Returns

`void`
