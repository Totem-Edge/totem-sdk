[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / EdgeDispatchPort

# Interface: EdgeDispatchPort

Injected execution dispatch seam.

This is a **host-supplied** port. A consent wallet supplies a plain dispatch
adapter over its SDK/chain clients (consent-gated by the approval port). A
host that runs an autonomous runtime (an agent or industrial edge device) may
supply a governed edge dispatch instead. The browser wallets never construct a
mandate-bound governed runtime themselves (RFC-014 §6.4).

## Methods

### executeAction()

> **executeAction**(`input`): `Promise`\<\{ `data?`: `unknown`; `error?`: `string`; `errorCode?`: `string`; `ok`: `boolean`; \}\>

#### Parameters

##### input

###### action

`string`

###### context?

`Record`\<`string`, `unknown`\>

###### payload?

`Record`\<`string`, `unknown`\>

###### subject

`string`

#### Returns

`Promise`\<\{ `data?`: `unknown`; `error?`: `string`; `errorCode?`: `string`; `ok`: `boolean`; \}\>
