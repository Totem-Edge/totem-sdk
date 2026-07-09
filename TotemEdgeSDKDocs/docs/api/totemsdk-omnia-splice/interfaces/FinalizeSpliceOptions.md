[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / FinalizeSpliceOptions

# Interface: FinalizeSpliceOptions

Options for `finalizeSplice`.

## Properties

### acceptorLeaseProvider?

> `optional` **acceptorLeaseProvider?**: `WotsLeaseProvider`

Acceptor's WOTS lease provider. Same commit/burn
                                   semantics as `proposerLeaseProvider`.

***

### broadcast?

> `optional` **broadcast?**: (`txHex`) => `Promise`\<\{ `success?`: `boolean`; `txpowid?`: `string`; \}\>

Broadcast the mined TxPoW hex to the network.
                                   `finalizeSplice` throws if `broadcast` returns
                                   `{ success: false }` without a `txpowid`.

#### Parameters

##### txHex

`string`

#### Returns

`Promise`\<\{ `success?`: `boolean`; `txpowid?`: `string`; \}\>

***

### mineDifficulty?

> `optional` **mineDifficulty?**: `Uint8Array`\<`ArrayBufferLike`\>

Override PoW difficulty (pass `MAX_HASH` in tests).

***

### proposerLeaseProvider?

> `optional` **proposerLeaseProvider?**: `WotsLeaseProvider`

Proposer's WOTS lease provider. If supplied,
                                   `finalizeSplice` will call `commitKeyUse` on the
                                   proposer's reservation after a confirmed splice TX,
                                   or `burnReservation` if finalization fails after
                                   security checks pass. Prevents one-time-key reuse.

***

### verifySignature?

> `optional` **verifySignature?**: (`signature`, `digest`, `publicKeyDigest`) => `boolean`

Custom signature verifier called for both the
                                   proposer and acceptor signatures before state
                                   transition. Defaults to `wotsVerifyDigest`.
                                   **Override in test environments** that use mock
                                   signers (mock signatures are not real WOTS sigs
                                   and will not pass the default verifier).

                                   ```ts
                                   // Example test helper:
                                   verifySignature: (sig, digest, pkd) => {
                                     const expected = sha3_256(concatBytes(fromHex(pkd), digest));
                                     return expected.length === sig.length
                                       && expected.every((b, i) => b === sig[i]);
                                   }
                                   ```

#### Parameters

##### signature

`Uint8Array`

##### digest

`Uint8Array`

##### publicKeyDigest

`string`

#### Returns

`boolean`
