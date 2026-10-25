[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / FACTORY\_PARTY\_ROOT\_PORT

# Variable: FACTORY\_PARTY\_ROOT\_PORT

> `const` **FACTORY\_PARTY\_ROOT\_PORT**: `111` = `111`

State port carrying the committed party-set root (STATE(111)) — the MMR root
of the participant public-key digests (RFC-048 §12.4/§12.5). It is pinned on
every spend (`SAMESTATE`), so the participant set is cryptographically fixed
and immutable, independent of the per-party enumeration. This is the factory's
adoption of the VTXO committed-set root and the anchor for future per-leaf
(proof-based) scaling.
