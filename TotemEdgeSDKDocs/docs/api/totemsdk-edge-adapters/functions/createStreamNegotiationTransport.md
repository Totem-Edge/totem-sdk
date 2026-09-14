[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / createStreamNegotiationTransport

# Function: createStreamNegotiationTransport()

> **createStreamNegotiationTransport**(`config`): `NegotiationTransport`

Create a NegotiationTransport over a raw byte stream.

Messages are framed as `[4-byte BE length][JSON bytes]`. The stream is
assumed to be a single authenticated peer connection, so the sender address
is fixed by the caller.

## Parameters

### config

[`StreamNegotiationTransportConfig`](../interfaces/StreamNegotiationTransportConfig.md)

## Returns

`NegotiationTransport`
