[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / createSigningRequest

# Function: createSigningRequest()

> **createSigningRequest**(`config`, `requesterSignFn`): `Promise`\<[`PolicySigningRequest`](../interfaces/PolicySigningRequest.md)\>

Create a canonical signing request.

## Parameters

### config

[`CreateSigningRequestConfig`](../interfaces/CreateSigningRequestConfig.md)

### requesterSignFn

(`data`) => `Uint8Array`\<`ArrayBufferLike`\> \| `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

## Returns

`Promise`\<[`PolicySigningRequest`](../interfaces/PolicySigningRequest.md)\>
