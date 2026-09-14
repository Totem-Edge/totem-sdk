[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / MinimaWorkTemplateProvider

# Interface: MinimaWorkTemplateProvider

Provider abstraction for the current Minima block-candidate template.

The TxPoW package remains transport/node-client agnostic: callers inject a
provider that fetches the current template from a Minima node, Axia, or a
test fixture.

`MinimaWorkRelay` is the preferred long-term relay boundary. The legacy
`broadcastBlockCandidate` callback is retained as a compatibility/fallback
path only — new consumers should use `relay` via `MinimaWorkRelay` and not
build around the lossy `candidate: unknown` shape.

## Methods

### ~~broadcastBlockCandidate()?~~

> `optional` **broadcastBlockCandidate**(`candidate`): `Promise`\<`void`\>

#### Parameters

##### candidate

[`MachineWorkAdmissionProof`](MachineWorkAdmissionProof.md)

#### Returns

`Promise`\<`void`\>

#### Deprecated

Prefer `MinimaWorkRelay.submitBlock` (complete envelope).
Retained for compatibility; only invoked for genuine Minima blocks
(Super-0 … Super-31) when no relay is configured.

***

### getCurrentTemplate()

> **getCurrentTemplate**(): `Promise`\<[`MinimaWorkTemplate`](MinimaWorkTemplate.md)\>

Fetch the current block-candidate template.

#### Returns

`Promise`\<[`MinimaWorkTemplate`](MinimaWorkTemplate.md)\>

***

### getLatestTemplate()?

> `optional` **getLatestTemplate**(): `Promise`\<[`MinimaWorkTemplate`](MinimaWorkTemplate.md)\>

Optional: fetch the latest template for freshness checks. Falls back to getCurrentTemplate.

#### Returns

`Promise`\<[`MinimaWorkTemplate`](MinimaWorkTemplate.md)\>

***

### validateTemplate()?

> `optional` **validateTemplate**(`template`): `Promise`\<`boolean`\>

Optional: validate a template before mining against it.

#### Parameters

##### template

[`MinimaWorkTemplate`](MinimaWorkTemplate.md)

#### Returns

`Promise`\<`boolean`\>
