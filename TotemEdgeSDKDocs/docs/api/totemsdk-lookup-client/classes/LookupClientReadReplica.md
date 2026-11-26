[**@totemsdk/lookup-client**](../index.md)

***

[@totemsdk/lookup-client](../index.md) / LookupClientReadReplica

# Class: LookupClientReadReplica

## Constructors

### Constructor

> **new LookupClientReadReplica**(`client`, `replica`, `options?`): `LookupClientReadReplica`

#### Parameters

##### client

[`LookupClient`](LookupClient.md)

##### replica

`LookupReplicaSource`

##### options?

[`LookupReadReplicaOptions`](../interfaces/LookupReadReplicaOptions.md) = `{}`

#### Returns

`LookupClientReadReplica`

## Methods

### getCoins()

> **getCoins**(`query`): `Promise`\<`ReplicatedRead`\<`Coin`[]\>\>

#### Parameters

##### query

`CoinsQuery`

#### Returns

`Promise`\<`ReplicatedRead`\<`Coin`[]\>\>

***

### getTip()

> **getTip**(): `Promise`\<`ReplicatedRead`\<`ChainTip`\>\>

#### Returns

`Promise`\<`ReplicatedRead`\<`ChainTip`\>\>
