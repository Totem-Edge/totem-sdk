[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / createEdgeDecisionPort

# Function: createEdgeDecisionPort()

> **createEdgeDecisionPort**(`runtime`, `options?`): [`EdgeDecisionPort`](../interfaces/EdgeDecisionPort.md)

Bind a decision runtime to an edge-compatible port.

## Parameters

### runtime

[`DecisionRuntime`](../interfaces/DecisionRuntime.md)

### options?

[`CreateEdgeDecisionPortOptions`](../interfaces/CreateEdgeDecisionPortOptions.md) = `{}`

## Returns

[`EdgeDecisionPort`](../interfaces/EdgeDecisionPort.md)

## Example

```ts
import { createDecisionRuntime, createEdgeDecisionPort } from '@totemsdk/decision';
  const port = createEdgeDecisionPort(createDecisionRuntime({ routes: [...] }));
```
