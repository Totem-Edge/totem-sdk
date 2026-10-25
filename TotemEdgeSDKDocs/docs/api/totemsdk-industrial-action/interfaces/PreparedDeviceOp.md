[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / PreparedDeviceOp

# Interface: PreparedDeviceOp

A fully prepared, commitment-bound device operation.

## Extends

- [`DeviceOpBase`](DeviceOpBase.md)

## Properties

### command?

> `optional` **command?**: `unknown`

Opaque, adapter-specific prepared command.

#### Inherited from

[`DeviceOpBase`](DeviceOpBase.md).[`command`](DeviceOpBase.md#command)

***

### commitmentHash

> **commitmentHash**: `string`

***

### context

> **context**: `Record`\<`string`, `unknown`\>

***

### definitionVersion

> **definitionVersion**: `number`

Definition version the operation was prepared against (RFC-011 §4.5).

***

### kind

> **kind**: `string`

***

### mandateProofId?

> `optional` **mandateProofId?**: `string`

Bound authorizing mandate proof, when supplied (RFC-010 §6.4).

***

### operationId

> **operationId**: `string`

***

### parameters

> **parameters**: `Record`\<`string`, `unknown`\>

***

### proposalId?

> `optional` **proposalId?**: `string`

Industrial proposal id, when supplied.

***

### resourceId?

> `optional` **resourceId?**: `string`

Target resource (RFC-011 formalizes the full `ResourceId`).

#### Inherited from

[`DeviceOpBase`](DeviceOpBase.md).[`resourceId`](DeviceOpBase.md#resourceid)

***

### schemaHash

> **schemaHash**: `string`

Canonical schema hash (RFC-011 §4.5).

***

### semanticDecisionId?

> `optional` **semanticDecisionId?**: `string`

RFC-017: semantic DecisionReceipt.receiptId that motivated this operation.
