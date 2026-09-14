[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / MinimaWorkRelay

# Interface: MinimaWorkRelay

Relay boundary for a complete Minima TxPoW envelope.

Keeps Minima networking outside core mining logic. A future
@totemsdk/minima-rpc or chain-provider adapter may implement this port.
Duplicate relay attempts must be safe/idempotent at the integration boundary.

## Methods

### submitBlock()

> **submitBlock**(`envelope`): `Promise`\<`void`\>

Submit a complete Minima TxPoW envelope for block relay.

#### Parameters

##### envelope

`Uint8Array`

#### Returns

`Promise`\<`void`\>
