[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / MSHS\_PORT\_FLOOR

# Variable: MSHS\_PORT\_FLOOR

> `const` **MSHS\_PORT\_FLOOR**: `230` = `230`

Lowest port reserved for MSHS-2 (MASH); Omnia ports MUST stay below this.
 The node installs the MASH authorization bundle at ports **230–255**
 (`bundleBase = 256 − (4 + k) = 230`): the header R / ROOTS_BLOB /
 SECRETS_BLOB / TREE_SIG at 230–233 and PROOF at 234–255. A composite
 MASH + Omnia coin must therefore keep Omnia ports ≤ 229.
