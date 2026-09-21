[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / createContentAccessGatedProvider

# Function: createContentAccessGatedProvider()

> **createContentAccessGatedProvider**(`policy`, `provider`): [`IntelligenceProvider`](../interfaces/IntelligenceProvider.md)

Wrap a provider with workspace-scoped content gating (RFC-007 §5).

The returned provider keeps the host provider's id/capabilities/cancel/close
and forwards only gated RAG operations. Denials are returned as
`POLICY_REJECTED` results — never by touching provider storage.

## Parameters

### policy

[`ContentAccessPolicy`](../interfaces/ContentAccessPolicy.md)

### provider

[`IntelligenceProvider`](../interfaces/IntelligenceProvider.md)

## Returns

[`IntelligenceProvider`](../interfaces/IntelligenceProvider.md)

## Example

```ts
const gated = createContentAccessGatedProvider(
    { entitlements: [{ principal: 'P1', workspaceIds: ['ws-Fleet'] }], freshnessMs: 60_000 },
    createQvacIntelligenceProvider({ sdk }),
  );
```
