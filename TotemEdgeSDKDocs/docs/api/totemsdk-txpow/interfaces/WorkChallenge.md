[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / WorkChallenge

# Interface: WorkChallenge

The receiver controls the admission requirement.

A challenge must be unique enough to prevent useful pre-mining, must expire,
must bind to the intended receiver, and must bind to an application domain.
`target` is an absolute cryptographic target: verification is `hash < target`.

## Properties

### challengeId

> **challengeId**: `string`

Unique challenge identifier (receiver-generated, prevents pre-mining).

***

### domain

> **domain**: `string`

Application domain (e.g. "totem.negotiation.proposal"). Open-ended.

***

### expiresAt

> **expiresAt**: `number`

Epoch milliseconds after which the challenge is invalid.

***

### issuedAt

> **issuedAt**: `number`

Epoch milliseconds when the challenge was issued.

***

### network?

> `optional` **network?**: `string`

Optional network identifier (e.g. "mainnet", "testnet").

***

### nonce

> **nonce**: `string`

Receiver-generated random nonce to prevent pre-mining.

***

### recipient

> **recipient**: `string`

The intended receiver this challenge is bound to.

***

### target

> **target**: `string`

Absolute 32-byte cryptographic target (big-endian 256-bit).

***

### version

> **version**: `number`

Protocol version.
