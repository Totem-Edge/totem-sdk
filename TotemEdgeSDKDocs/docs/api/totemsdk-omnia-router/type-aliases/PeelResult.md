[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / PeelResult

# Type Alias: PeelResult

> **PeelResult** = \{ `kind`: `"final"`; \} \| \{ `kind`: `"forward"`; `next`: [`ForwardHop`](../interfaces/ForwardHop.md); `onward?`: `string`; \}

## Union Members

### Type Literal

\{ `kind`: `"final"`; \}

This node is the recipient — no onward hop.

***

### Type Literal

\{ `kind`: `"forward"`; `next`: [`ForwardHop`](../interfaces/ForwardHop.md); `onward?`: `string`; \}

Forward to `next`; `onward` is the remaining envelope for that hop (absent at the last hop).
