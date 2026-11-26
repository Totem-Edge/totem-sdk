[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / RawNodeConfig

# Interface: RawNodeConfig

@totemsdk/tx-builder/node-transport

Minimal raw command transport for Minima/Hawk nodes.

The typed minima-rpc transport rejects whitespace in parameter values as a
command-injection guard. `txnscript`/script values legitimately contain
spaces, so tx-builder's node assembler needs a transport that preserves them.

## Properties

### password?

> `optional` **password?**: `string`

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

***

### url

> **url**: `string`

Node RPC URL, e.g. `http://127.0.0.1:9005`.

***

### username?

> `optional` **username?**: `string`
