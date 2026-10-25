[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / POOL\_SHARE\_PORT\_BASE

# Variable: POOL\_SHARE\_PORT\_BASE

> `const` **POOL\_SHARE\_PORT\_BASE**: `128` = `128`

State port base for per-holder shares: holder k ⇒ `base + k`. Kept below the
MSHS-2 floor so Omnia ports never collide with MASH (ports are bytes, 0–255).
See RFC-048 §12 / RFC-049 §5.
