[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / MachineWorkAction

# Interface: MachineWorkAction

The application action, represented in a generic domain-separated form.

Only a commitment to this action enters the TxPoW header — never the
application payload itself. The application remains off-chain.

## Properties

### actionId

> **actionId**: `string`

Unique action identifier.

***

### context?

> `optional` **context?**: `Record`\<`string`, `string`\>

Optional domain-specific context (canonicalized into the commitment).

***

### domain

> **domain**: `string`

Application domain (e.g. "totem.compute.reserve"). Open-ended.

***

### payloadHash

> **payloadHash**: `string`

SHA3-256 hex commitment to the application payload (off-chain).

***

### recipient

> **recipient**: `string`

The intended recipient.

***

### sender

> **sender**: `string`

The sender performing the work.

***

### version

> **version**: `number`

Protocol version.
