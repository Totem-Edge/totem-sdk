[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / Dimension

# Type Alias: Dimension

> **Dimension** = `"temperature"` \| `"pressure"` \| `"volumetricFlow"` \| `"mass"` \| `"length"` \| `"ratio"` \| `"time"` \| `"speed"` \| `"dimensionless"`

RFC-011 §4.1 — quantities and units.

Industrial parameters are typed quantities, not bare numbers, so unit errors
(a pressure satisfying a temperature guardrail) are impossible. A definition
declares a canonical `unit`; adapter profiles declare their wire units and the
core converts, recording both.
