[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / UNGRANTABLE\_ACTIONS

# Variable: UNGRANTABLE\_ACTIONS

> `const` **UNGRANTABLE\_ACTIONS**: readonly `string`[]

Activities the agent must never invoke directly. Key-lease operations remain
internal consequences of an authorized signing action, not agent-callable
actions. Identity-root rotation is routed through a dedicated governance flow.
