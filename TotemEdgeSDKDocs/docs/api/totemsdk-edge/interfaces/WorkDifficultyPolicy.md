[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / WorkDifficultyPolicy

# Interface: WorkDifficultyPolicy

Progressive counteroffer work difficulty policy.

Bounds difficulty growth through local policy — never hard-coded exponential
semantics in the protocol.

## Properties

### baseTarget

> **baseTarget**: `string`

Base difficulty target (hex) for round 0.

***

### maxTarget

> **maxTarget**: `string`

Maximum allowed difficulty (hex) — a harder target than this is refused.

***

### roundTargets?

> `optional` **roundTargets?**: `string`[]

Optional per-round difficulty targets. When provided, the target for a
given round is looked up here (clamped to the last entry). When omitted,
the base target is used for every round.
