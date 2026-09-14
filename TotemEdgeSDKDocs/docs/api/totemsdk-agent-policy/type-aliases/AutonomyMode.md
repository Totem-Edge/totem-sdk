[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / AutonomyMode

# Type Alias: AutonomyMode

> **AutonomyMode** = `"dynamic"` \| `"declared_plan"` \| `"locked_plan"` \| `"single_step"`

Autonomy profile modes:
 - `dynamic`: any step allowed by remaining grant authority.
 - `declared_plan`: steps may vary, but within a committed plan envelope.
 - `locked_plan`: exact DAG, actions and parameter ranges.
 - `single_step`: current behavior (one authorization, no run).
