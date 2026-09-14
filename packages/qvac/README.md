# @totemsdk/qvac

QVAC intelligence adapter — wraps `@qvac/sdk` into
[`@totemsdk/intelligence`](../intelligence)'s provider-neutral contracts.

**Design:** the AI proposes, Totem authorizes. This adapter is a compute
surface only — it cannot sign and never holds keys.

## Install

```sh
pnpm add @totemsdk/qvac @qvac/sdk
```

`@qvac/sdk` is consumed at runtime only: the adapter has **no manifest peer on
the heavy native SDK**. Its type surface is vendored from the real
`@qvac/sdk@0.19.0` declarations and made ambient at build time, so the package
typechecks against genuine upstream signatures (real `CompletionParams`,
stream/run/session shapes, adapter param types) without dragging the QVAC
native binaries into the install. A CI drift audit
(`validate:qvac-drift`) reinstalls the real SDK and verifies the wrapped op
surface still exists upstream; when the SDK is absent, the provider builds and
advertises domains structurally and resolves lazily.

## Quick start

```ts
import * as qvac from '@qvac/sdk';
import { createQvacIntelligenceProvider } from '@totemsdk/qvac';

const provider = createQvacIntelligenceProvider({ sdk: qvac });

const result = await provider.invoke({
  domain: 'llm',
  op: 'completion',
  params: { modelId: 'qvac-llm', history: [{ role: 'user', content: 'Summarize this invoice' }] },
});
```

## Edge port

```ts
import { createQvacEdgeIntelligencePort } from '@totemsdk/qvac/edge';
import { edgeRuntime } from '@totemsdk/edge';

const port = createQvacEdgeIntelligencePort({ sdk: qvac });
edgeRuntime.ports.intelligence = port as never;
```

`@totemsdk/qvac/edge` returns a structural object matching
`EdgeIntelligencePort` without importing `@totemsdk/edge`, so `@totemsdk/edge`
stays QVAC-free.

## Capability discovery

While the SDK is unresolved the provider advertises the full canonical domain
set. Once an SDK is injected, loaded via `sdkLoader`, or lazily required,
`provider.capabilities` reflects which domains actually have at least one
callable operation on the SDK — a runtime without the RAG plugin stops
advertising `intelligence:rag`.

```ts
const provider = createQvacIntelligenceProvider({ sdk: qvac });
provider.capabilities; // e.g. ['intelligence:llm', 'intelligence:rag', …]
provider.discoverCapabilities(); // same, explicit re-derivation
```

## Domain adapters

Each canonical domain ships as a typed convenience adapter bound to a concrete
provider. They are thin: dispatch, usage extraction, cancellation, and error
mapping all stay in the shared provider.

```ts
import { createQvacIntelligenceProvider, llmAdapter, ragAdapter } from '@totemsdk/qvac';

const provider = createQvacIntelligenceProvider({ sdk: qvac });

const completion = llmAdapter(provider).completion;
const result = await completion({ modelId: 'qvac-llm', history: [{ role: 'user', content: 'Summarize this invoice' }] });

const { ragSearch } = ragAdapter(provider);
const hits = await ragSearch({ embeddingModelId: 'qvac-embed', text: 'invoice 42', topK: 5 });
```

## Security & trust

This adapter is a **compute surface, never a signing surface**:

- inference executes in-process against `@qvac/sdk`; no key material is injected
  or derivable
- every invocation is tied to a `proposalId` / `runId` so `@totemsdk/agent-policy`
  and `@totemsdk/authority` gate and meter inference like any other proposal
- `intelligence:<domain>` capability strings let `@totemsdk/edge` deny domains
  at dispatch (`CAPABILITY_MISSING`) before the port runs

## Shapes & upstream parity

The provider dispatches each op according to the real SDK's invocation shape
(`QVAC_OP_SHAPES`): most ops take a params record, but `vlaPreprocessImage`
and `vlaPadState` are positional and `subscribeServerLogs` is a callback that
resolves to `{ unsubscribe }`. Adapter signatures mirror the real
`@qvac/sdk` declarations, including streamable run/session surfaces
(`completion` → token/progress/done, `textToSpeech` → audio samples +
done, `transcribeStream` → segments, `loggingStream` → server log deltas,
etc.), which `invokeStream` maps onto `IntelligenceStreamChunk`s.

Cancellation reaches upstream too: `provider.cancel(requestId)` targets the
local run and, when the SDK decorated the pending promise with a
`requestId`, best-effort forwards `sdk.cancel({ requestId })`.

For direct, type-exact access to the injected SDK, `@totemsdk/qvac/raw`
exposes `createQvacRawClient({ sdk })` (pass-through) and the raw surface
types.

## Subpaths

| Subpath | Purpose |
|---------|---------|
| `.` | `createQvacIntelligenceProvider` + provider types + domain adapters |
| `/edge` | `createQvacEdgeIntelligencePort` (port shape) |
| `/raw` | raw QVAC SDK surface — `createQvacRawClient` pass-through + types |
| `/llm`, `/embed`, `/rag`, `/asr`, `/translate`, `/tts`, `/diffusion`, `/ocr`, `/classify`, `/audiogen`, `/video`, `/vla`, `/world`, `/models`, `/system`, `/plugins` | Typed per-domain adapter modules |

## License

MIT — Totem SDK Contributors