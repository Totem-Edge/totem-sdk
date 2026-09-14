[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / createEdgeIntelligencePort

# Function: createEdgeIntelligencePort()

> **createEdgeIntelligencePort**(`provider`): [`EdgeIntelligencePort`](../interfaces/EdgeIntelligencePort.md)

Bind a provider-neutral [IntelligenceProvider](../interfaces/IntelligenceProvider.md) to an
[EdgeIntelligencePort](../interfaces/EdgeIntelligencePort.md).

The port exposes the provider's `intelligence:*` capability strings and
translates provider-neutral operations/results into the port result shape.

## Parameters

### provider

[`IntelligenceProvider`](../interfaces/IntelligenceProvider.md)

## Returns

[`EdgeIntelligencePort`](../interfaces/EdgeIntelligencePort.md)

## Example

```ts
import { createEdgeIntelligencePort } from '@totemsdk/intelligence';
  import { createQvacIntelligenceProvider } from '@totemsdk/qvac';

  const port = createEdgeIntelligencePort(
    createQvacIntelligenceProvider({ sdk }),
  );
```
