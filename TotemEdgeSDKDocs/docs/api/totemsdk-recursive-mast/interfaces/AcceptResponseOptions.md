[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / AcceptResponseOptions

# Interface: AcceptResponseOptions

## Properties

### allowOneSignerMultipleRoles?

> `optional` **allowOneSignerMultipleRoles?**: `boolean`

Allow a single signer to fill more than one role (default false).

***

### roleKeys?

> `optional` **roleKeys?**: `Record`\<`string`, `string`\>

RFC-018 P1-2: role → authorized signer public-key digest (from the manifest).

***

### signatureVerifier?

> `optional` **signatureVerifier?**: (`message`, `signatureHex`, `subjectPkd`) => `boolean`

Override the default WOTS verifier.

#### Parameters

##### message

`Uint8Array`

##### signatureHex

`string`

##### subjectPkd

`string`

#### Returns

`boolean`
