[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / createOmniaIntegration

# Function: createOmniaIntegration()

> **createOmniaIntegration**(`swarm`, `store`, `config?`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

Wire an OmniaSwarm to @totemsdk/omnia function calls for the full channel lifecycle.

- Calls `swarm.listenForChannels` to receive inbound CHANNEL_PROPOSAL messages.
- On each accepted proposal, automatically calls `bindPeerIntegration` on the peer
  so subsequent STATE_UPDATE and SETTLEMENT_PROPOSAL messages are routed too.

Idempotent per peer: even if a peer retransmits CHANNEL_PROPOSAL multiple times,
`bindPeerIntegration` is called at most once per peer so handlers never duplicate.

Returns an unsubscribe function that removes the channel listener.

## Parameters

### swarm

[`OmniaSwarm`](../interfaces/OmniaSwarm.md)

### store

[`ChannelStore`](../type-aliases/ChannelStore.md)

### config?

[`OmniaIntegrationConfig`](../interfaces/OmniaIntegrationConfig.md) = `{}`

## Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)
