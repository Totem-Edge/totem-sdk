[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / IntelligenceDomainOrString

# Type Alias: IntelligenceDomainOrString

> **IntelligenceDomainOrString** = [`IntelligenceDomain`](IntelligenceDomain.md) \| `string` & `object`

Domain discriminator for operations and usages.

`IntelligenceDomain` is the canonical closed set; `(string & {})` lets
providers advertise extension domains while IDE autocomplete still surfaces
the canonical literals first.
