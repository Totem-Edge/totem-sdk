[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / OmniaMessageType

# Type Alias: OmniaMessageType

> **OmniaMessageType** = `"CHANNEL_PROPOSAL"` \| `"STATE_UPDATE"` \| `"SETTLEMENT_PROPOSAL"` \| `"ACK"` \| `"ERROR"` \| `"FACTORY_PROPOSAL"` \| `"FACTORY_ACCEPT"` \| `"FACTORY_FUNDING_REQUEST"` \| `"FACTORY_FUNDING_RESPONSE"` \| `"FACTORY_CLOSE_PROPOSAL"` \| `"FACTORY_CLOSE_ACCEPT"` \| `"FACTORY_CLOSE_FINALIZED"` \| `"FACTORY_FINALIZED"` \| `"VC_PROPOSAL"` \| `"VC_ACCEPT"` \| `"VC_FINALIZED"` \| `"SPLICE_PROPOSAL"` \| `"SPLICE_ACCEPT"` \| `"SPLICE_FINALIZED"`

Messaging protocol types for Omnia P2P transport layer.

These types are used by framing.ts, stream.ts, peer.ts, swarm.ts, relay.ts,
and integration.ts. They are exported from omnia's main index.ts for external
consumers (e.g. @totemsdk/omnia-router, @totemsdk/omnia-factory).

IDuplexStream is kept as an internal private type (not exported from index.ts)
for backward compatibility with relay.ts's RelayBackedStream.
