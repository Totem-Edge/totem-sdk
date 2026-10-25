[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / TrustIndex

# Class: TrustIndex

## Constructors

### Constructor

> **new TrustIndex**(`store`, `config?`): `TrustIndex`

#### Parameters

##### store

[`SqliteStore`](SqliteStore.md)

SQLite backing store

##### config?

[`TrustIndexConfig`](../interfaces/TrustIndexConfig.md)

Trust index configuration. When `requireVerifiedSignature` is
  true (default), `config.verifyReviewerSignature` must be provided and must
  approve the record, otherwise the record is rejected (fail closed).

#### Returns

`TrustIndex`

## Methods

### query()

> **query**(`msg`, `sendFn`): `void`

#### Parameters

##### msg

`TrustQueryMessage`

##### sendFn

`SendFn`

#### Returns

`void`

***

### record()

> **record**(`msg`, `authenticatedPublicKey?`): `Promise`\<`boolean`\>

Persist a reviewer's trust record.

#### Parameters

##### msg

`TrustRecordMessage`

TRUST_RECORD message

##### authenticatedPublicKey?

`string`

Public key bound to the authenticated session,
  used to bind `reviewerAddress` to the connection that submitted the record.

#### Returns

`Promise`\<`boolean`\>

true when the record was accepted and persisted, false otherwise.
