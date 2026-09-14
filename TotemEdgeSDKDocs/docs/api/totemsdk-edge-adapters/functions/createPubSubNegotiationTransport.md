[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / createPubSubNegotiationTransport

# Function: createPubSubNegotiationTransport()

> **createPubSubNegotiationTransport**(`config`): `NegotiationTransport`

Create a NegotiationTransport over a pub/sub transport.

Each negotiation uses a topic derived from its negotiationId. The sender
address is carried in the envelope (a `sender` field on the message), so
the ingress pipeline can authenticate it.

## Parameters

### config

[`PubSubNegotiationTransportConfig`](../interfaces/PubSubNegotiationTransportConfig.md)

## Returns

`NegotiationTransport`
