[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / NodeAssemblyCommandClient

# Interface: NodeAssemblyCommandClient

@totemsdk/tx-builder/node-assembler

Optional node-side assembly adapter.

This is the path used by the real mainnet apps:

  txncreate -> txninput(scriptmmr:true) -> txnoutput -> txnstate
    -> txnbasics -> txnsign? -> txnpost -> txndelete

It requires a local/paired Minima node and is **not** the edge path. Keep
`buildTransaction` + `serializeWitness` for zero-DB/edge signing.

## Methods

### command()

> **command**(`name`, `params?`): `Promise`\<`any`\>

Send a command-level RPC call. The client is responsible for transport
encoding (the node command grammar needs spaces preserved in scripts).

#### Parameters

##### name

`string`

##### params?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`any`\>
