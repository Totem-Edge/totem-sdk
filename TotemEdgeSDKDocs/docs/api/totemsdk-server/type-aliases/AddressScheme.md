[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / AddressScheme

# Type Alias: AddressScheme

> **AddressScheme** = `"per-address"` \| `"unified"`

Deterministic address derivation (CAN-005).

Minima's `newaddress` is non-deterministic, and not every node build honours a
`modifier:` argument, so an address taken from the node can differ across
containers/restarts and break cross-container resolution. These helpers derive
the address **from the seed** instead, using the same schemes the node uses, so
the result is reproducible and (for the matching scheme) node-spendable.

- `deriveDeterministicAddress` — Minima `Wallet.createNewKey()` parity:
  `privseed = hash(baseSeed, index)` → `TreeKey(privseed, 64, 3)` → pubkey → Mx.
- `deriveUnifiedAddress` — RFC-037 hierarchical child key.

`verifyDeterministicAddress` asserts an address a node handed back matches the
seed-derived one — the fail-loud check that replaces a silent fallback.
