[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / PROTOCOL\_VERSION

# Variable: PROTOCOL\_VERSION

> `const` **PROTOCOL\_VERSION**: `2` = `2`

RFC-032: lookup-protocol v2 is post-quantum. Authentication uses WOTS
(hash-based, quantum-resistant) instead of Ed25519. There is no separate
AUTH_CHALLENGE/AUTH_RESPONSE handshake; each authenticated message carries a
self-contained `auth` envelope (identity + nonce + expiry + WOTS signature).
This is a hard switch — v1 and v2 peers do not interoperate.
