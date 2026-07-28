[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / createLookupPortAdapter

# Function: createLookupPortAdapter()

> **createLookupPortAdapter**(`client`): `EdgeLookupPort`

Wraps a LookupClient as an EdgeLookupPort.

lookup:  queries coins by address, or a single coin by ID when kind === 'coin'.
watch:   registers for real-time coin-update push events.
announce: encodes the caller's WOTS-signed manifest to bytes, then hands off
          to announceApp() or announceAgent() on the client. The client signs
          those bytes with its session Ed25519 keypair — no WOTS key index is
          consumed. Fire-and-forget: the lookup node sends no ACK.

## Parameters

### client

`LookupClient`

## Returns

`EdgeLookupPort`
