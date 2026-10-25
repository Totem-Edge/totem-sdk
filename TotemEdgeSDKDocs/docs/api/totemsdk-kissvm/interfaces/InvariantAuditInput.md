[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / InvariantAuditInput

# Interface: InvariantAuditInput

## Properties

### expectsAuthorization?

> `readonly` `optional` **expectsAuthorization?**: `boolean`

I1 applies.

***

### expectsPayment?

> `readonly` `optional` **expectsPayment?**: `boolean`

I2 applies (payment/escrow/etc.).

***

### immutablePorts?

> `readonly` `optional` **immutablePorts?**: readonly `number`[]

I3 applies: ports whose value constrains the spend (lock/rate/recipient/
timing) and must therefore be committed (carried unchanged from PREVSTATE).

***

### name

> `readonly` **name**: `string`

***

### permissionless?

> `readonly` `optional` **permissionless?**: `boolean`

The template is intentionally permissionless; I1 is then satisfied by an
explicit `RETURN TRUE`-style permissionless marker rather than a signer.

***

### script

> `readonly` **script**: `string`
