# @totemsdk/intelligence

Provider-neutral intelligence contracts — capabilities, operations, receipts,
and errors for local, self-hosted AI inference.

Zero runtime dependencies. Never imports a concrete inference provider.
Concrete providers (e.g. [`@totemsdk/qvac`](../qvac) wrapping `@qvac/sdk`)
implement the contracts defined here.

## Design principle

**The AI proposes, Totem authorizes.** An `IntelligenceProvider` is a compute
surface, never a signing surface. All authorization happens in policy layers
upstream (`@totemsdk/agent-policy`, `@totemsdk/authority`) keyed by
`proposalId` / `runId`.

## Quick start

```ts
import type { IntelligenceProvider, IntelligenceOperation } from '@totemsdk/intelligence';

declare const provider: IntelligenceProvider;

const op: IntelligenceOperation = {
  domain: 'llm',
  op: 'completion',
  params: { model: 'qvac-llm', prompt: 'Summarize the invoice' },
  context: { proposalId: 'proposal-123' },
};

const result = await provider.invoke(op);
if (result.ok) {
  console.log(result.data, result.usage?.tokensOut);
}
```

## Domains

`llm`, `embed`, `rag`, `asr`, `translate`, `tts`, `diffusion`, `ocr`,
`classify`, `audiogen`, `video`, `vla`, `world`, `models`, `system`, `plugins`
— each surfaces as an `intelligence:<domain>` capability string compatible with
`@totemsdk/edge`'s `domain:action` capability convention.

## Errors

`IntelligenceError` carries a stable error code and a `retryable` flag so
consumers can route retries, budgets, and policies without depending on any
concrete provider vocabulary.

## License

MIT — Totem SDK Contributors