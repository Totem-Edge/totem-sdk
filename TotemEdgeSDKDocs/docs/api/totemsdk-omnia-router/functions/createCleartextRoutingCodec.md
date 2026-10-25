[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / createCleartextRoutingCodec

# Function: createCleartextRoutingCodec()

> **createCleartextRoutingCodec**(): [`RoutingEnvelopeCodec`](../interfaces/RoutingEnvelopeCodec.md)

Cleartext routing codec: the envelope is the JSON of the remaining hops.
No confidentiality — a forwarder sees the path. Suitable for the RFC-035
"known counterparties" scope; swap for an onion codec when path privacy is
required.

## Returns

[`RoutingEnvelopeCodec`](../interfaces/RoutingEnvelopeCodec.md)
