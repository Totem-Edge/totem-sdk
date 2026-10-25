[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / SeedWatermarkOptions

# Interface: SeedWatermarkOptions

## Properties

### allowRegression?

> `readonly` `optional` **allowRegression?**: `boolean`

Permit a seed whose cursor is behind the current local cursor. Defaults to
`false` — regression re-exposes used leaves, so seeding fails closed.
