[**@totemsdk/lookup-client**](../index.md)

***

[@totemsdk/lookup-client](../index.md) / IdentitySlot

# Type Alias: IdentitySlot

> **IdentitySlot** = `"root"` \| `number`

Which key of the root identity signs lookup messages.
 - `'root'`  — the root identity key (off-chain attestation; never a spend key).
 - number    — child address index (0–63).
