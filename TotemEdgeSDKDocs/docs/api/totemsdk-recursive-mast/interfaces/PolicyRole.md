[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / PolicyRole

# Interface: PolicyRole

## Properties

### currentRoot

> **currentRoot**: `string`

Current root for this role's subtree.

***

### description

> **description**: `string`

Human-readable description.

***

### discoveryEndpoint?

> `optional` **discoveryEndpoint?**: `string`

How to discover the current signer for this role.

***

### federated

> **federated**: `boolean`

Whether this role is managed by an independent policy subtree.

***

### persistent

> **persistent**: `boolean`

Whether this role persists across policy epochs.

***

### role

> **role**: `string`

Role identifier (e.g. "oem-release-authority", "vehicle-owner").
