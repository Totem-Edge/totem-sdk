[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / collectSigningResponses

# Function: collectSigningResponses()

> **collectSigningResponses**(`requiredRoles`, `responses`, `options?`): [`SigningRoundResult`](../interfaces/SigningRoundResult.md)

## Parameters

### requiredRoles

`string`[]

### responses

[`PolicySigningResponse`](../interfaces/PolicySigningResponse.md)[]

### options?

#### allowOneSignerMultipleRoles?

`boolean`

#### requestId?

`string`

#### roleKeys?

`Record`\<`string`, `string`\>

RFC-018 P1-2: role → authorized signer public-key digest (from the manifest).

#### signatureVerifier?

(`message`, `signatureHex`, `subjectPkd`) => `boolean`

## Returns

[`SigningRoundResult`](../interfaces/SigningRoundResult.md)
