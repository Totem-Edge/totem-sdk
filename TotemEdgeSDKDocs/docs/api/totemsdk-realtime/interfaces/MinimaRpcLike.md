[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / MinimaRpcLike

# Interface: MinimaRpcLike

Duck-typed subset of MinimaRpcClient that MinimaRpcBackend needs.
A real @totemsdk/minima-rpc `MinimaRpcClient` satisfies this automatically.

## Methods

### balance()

> **balance**(`params?`): `Promise`\<`MinimaBalance`[]\>

#### Parameters

##### params?

###### address?

`string`

###### megammr?

`boolean`

###### tokendetails?

`boolean`

#### Returns

`Promise`\<`MinimaBalance`[]\>
