[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / ADVANCED\_UNSUPPORTED

# Variable: ADVANCED\_UNSUPPORTED

> `const` **ADVANCED\_UNSUPPORTED**: `Set`\<`string`\>

The Omnia methods this client does not implement (advanced topology ops /
multi-party coordination). They resolve to an explicit reason so the wallet
manifest stays truthful — including `payMultiHop`, which the base client does
not implement at all (so it must still be reported unsupported, not absent).
