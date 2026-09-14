# @totemsdk/qvac

QVAC intelligence adapter — wraps `@qvac/sdk` into
[`@totemsdk/intelligence`](../intelligence)'s provider-neutral contracts.

**Design:** the AI proposes, Totem authorizes. This adapter is a compute
surface only — it cannot sign and never holds keys.

## Install

```sh
pnpm add @totemsdk/qvac @qvac/sdk
```

`@qvac/sdk` is an optional peer — the adapter consumes it through a
structural `QvacSdkLike` interface, so your app stays buildable even before
the QVAC runtime is present.

## Quick start

```ts
import * as qvac from '@qvac/sdk';
import { createQvacIntelligenceProvider } from '@totemsdk/qvac';

const provider = createQvacIntelligenceProvider({ sdk: qvac });

const result = await provider.invoke({
  domain: 'llm',
  op: 'completion',
  params: { model: 'qvac-llm', prompt: 'Summarize this invoice' },
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
const result = await completion({ model: 'qvac-llm', prompt: 'Summarize this invoice' });

const { ragSearch } = ragAdapter(provider);
const hits = await ragSearch({ query: 'invoice 42', topK: 5 });
```

## Subpaths

| Subpath | Purpose |
|---------|---------|
| `.` | `createQvacIntelligenceProvider` + provider types + domain adapters |
| `/edge` | `createQvacEdgeIntelligencePort` (port shape) |
| `/raw` | raw QVAC SDK surface types (escape hatch) |
| `/llm`, `/embed`, `/rag`, `/asr`, `/translate`, `/tts`, `/diffusion`, `/ocr`, `/classify`, `/audiogen`, `/video`, `/vla`, `/world`, `/models`, `/system`, `/plugins` | Typed per-domain adapter modules |

## License

MIT — Totem SDK Contributors