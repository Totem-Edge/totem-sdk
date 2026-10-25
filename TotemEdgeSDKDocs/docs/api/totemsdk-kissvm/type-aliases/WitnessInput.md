[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / WitnessInput

# Type Alias: WitnessInput

> **WitnessInput** = \{ `pubkeyHex`: `string`; `signature`: `Uint8Array`; \} \| `TreeSignature`

One witness signature entry (RFC-009).

- a flat single-key WOTS signature (`{ pubkeyHex, signature }`), or
- a Minima tree signature (`TreeSignature`) whose root public key is the
  signer identity.
