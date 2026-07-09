[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / bindPeerIntegration

# Function: bindPeerIntegration()

> **bindPeerIntegration**(`peer`, `store`, `config?`, `__namedParameters?`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

Register a per-peer message handler on an already-connected peer.
Routes CHANNEL_PROPOSAL, STATE_UPDATE, and SETTLEMENT_PROPOSAL messages.

Returns an unsubscribe function.

## Parameters

### peer

[`OmniaPeer`](../interfaces/OmniaPeer.md)

### store

[`ChannelStore`](../type-aliases/ChannelStore.md)

### config?

[`OmniaIntegrationConfig`](../interfaces/OmniaIntegrationConfig.md) = `{}`

### \_\_namedParameters?

`BindPeerOptions` = `{}`

## Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)
