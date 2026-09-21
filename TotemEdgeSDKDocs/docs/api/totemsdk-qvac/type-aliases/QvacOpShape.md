[**@totemsdk/qvac**](../index.md)

***

[@totemsdk/qvac](../index.md) / QvacOpShape

# Type Alias: QvacOpShape

> **QvacOpShape** = \{ `kind`: `"record"`; \} \| \{ `argKeys`: readonly `string`[]; `kind`: `"positional"`; \} \| \{ `kind`: `"callback"`; `paramKey`: `string`; \}

How a QVAC operation must be invoked on the SDK surface, because the
upstream `@qvac/sdk@0.19.0` surface is not uniformly record-param:

 - `record`      — the default: `sdk[op](params, opts?)`.
 - `positional`  — exotic helpers that take positional args:
                   `sdk[op](...argKeys.map(k => params[k]), opts?)`.
                   e.g. `vlaPreprocessImage(pixels, width, height, options?)`
                   and `vlaPadState(state, targetDim?)`.
 - `callback`    — event-subscription helpers that take a handler function
                   and return a teardown:
                   `sdk[op](params[paramKey])` → data becomes
                   `{ unsubscribe }`. e.g. `subscribeServerLogs(handler)`.

The mapped op-shape catalog lives in [QVAC\_OP\_SHAPES](../variables/QVAC_OP_SHAPES.md) and is mirrored
by the per-op `shape` field in `api-snapshot.ts`.
