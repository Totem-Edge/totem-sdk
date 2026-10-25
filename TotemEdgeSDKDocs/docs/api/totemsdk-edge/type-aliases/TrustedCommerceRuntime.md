[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / TrustedCommerceRuntime

# Type Alias: TrustedCommerceRuntime

> **TrustedCommerceRuntime** = [`EdgeCommerceRuntime`](../interfaces/EdgeCommerceRuntime.md)

RFC-019: `createEdge()` returns a **trusted-host** commerce runtime. It holds
the raw buyer, payment port, authority port and seller — privileged host
authority that MUST NOT be handed to an autonomous agent. Agents reach
commerce only through `createAgentEdgeRuntime().executeAction('purchase:*')`.

This alias exists so trusted-host call sites can name the distinction
explicitly (`TrustedCommerceRuntime`) instead of the neutral
`EdgeCommerceRuntime`.
