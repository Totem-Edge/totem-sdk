[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / PolicyAction

# Interface: PolicyAction

## Properties

### action

> **action**: `string`

Action identifier (e.g. "firmware.install", "maintenance.restart").

***

### description

> **description**: `string`

Human-readable description.

***

### executionRoot

> **executionRoot**: `string`

The MAST root that executes this action.

***

### expirySeconds

> **expirySeconds**: `number`

Maximum validity of a signing request in seconds.

***

### inputs

> **inputs**: `Record`\<`string`, `string`\>

Required input fields and their types.

***

### optionalRoles?

> `optional` **optionalRoles?**: `string`[]

Roles that MAY sign (e.g. fleet-operator, insurer).

***

### requestEndpoint

> **requestEndpoint**: `string`

Where to send signing requests for this action.

***

### requiredRoles

> **requiredRoles**: `string`[]

Roles that MUST sign.
