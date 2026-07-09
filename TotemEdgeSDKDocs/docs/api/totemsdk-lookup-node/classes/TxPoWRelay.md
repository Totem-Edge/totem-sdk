[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / TxPoWRelay

# Class: TxPoWRelay

## Constructors

### Constructor

> **new TxPoWRelay**(`provider`, `config`, `store?`): `TxPoWRelay`

#### Parameters

##### provider

`ChainStateProvider`

##### config

[`RelayConfig`](../interfaces/RelayConfig.md)

##### store?

[`SqliteStore`](SqliteStore.md)

#### Returns

`TxPoWRelay`

## Methods

### process()

> **process**(`txpowHex`): `Promise`\<`BroadcastResult`\>

#### Parameters

##### txpowHex

`string`

#### Returns

`Promise`\<`BroadcastResult`\>
