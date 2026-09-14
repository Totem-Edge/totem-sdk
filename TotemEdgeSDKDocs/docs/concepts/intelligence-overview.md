---
id: intelligence-overview
title: Local Edge AI Overview
sidebar_label: Local Edge AI (QVAC)
description: How Totem runs on-device AI inference — provider-neutral intelligence contracts, the QVAC adapter, capability-gated dispatch, and usage receipts — without ever letting inference machinery touch keys.
---

# Local Edge AI (QVAC)

Totem is being extended so devices run their **own** AI inference — models on
the edge, not cloud APIs. Two new packages make this safe to wire into the
mining, payment, and policy core:

| Package | Role |
|---------|------|
| **`@totemsdk/intelligence`** | Provider-neutral contracts — capabilities, operations, usage receipts, error codes, and the `EdgeIntelligencePort` |
| **`@totemsdk/qvac`** | QVAC adapter — wraps `@qvac/sdk` into those contracts, with runtime capability discovery and per-domain adapters |

## Trust model: the AI proposes, Totem authorizes

An `IntelligenceProvider` is a **compute surface, never a signing surface**.

- Inference runs locally/self-hosted inside the device's own process.
- The inference layer cannot sign transactions and never holds keys.
- Every inference is keyed by a `proposalId` / `runId` so policy layers
  upstream (`@totemsdk/agent-policy`, `@totemsdk/authority`) can authorize,
  meter, and budget it the same way they authorize a payment.

## What the contracts provide

- **Domains** — `llm`, `embed`, `rag`, `asr`, `translate`, `tts`, `diffusion`,
  `ocr`, `classify`, `audiogen`, `video`, `vla`, `world`, `models`, `system`,
  `plugins`. Each surfaces as an `intelligence:<domain>` capability string,
  compatible with `@totemsdk/edge`'s `domain:action` convention.
- **Operations** — a stable `domain` + `op` + `params` shape so consumers never
  depend on a concrete provider's vocabulary.
- **Usage receipts** — `usage` output per invocation (tokens, duration) is the
  metering unit that `@totemsdk/agent-policy` inference-cost flows consume.
- **Errors** — `IntelligenceError` carries a stable error code and a
  `retryable` flag for retries and budgets.

## QVAC adapter

`@totemsdk/qvac` consumes `@qvac/sdk` through a structural interface. The SDK
can be injected, loaded via `sdkLoader`, or lazily required.

```ts
import * as qvac from '@qvac/sdk';
import { createQvacIntelligenceProvider } from '@totemsdk/qvac';

const provider = createQvacIntelligenceProvider({ sdk: qvac });

const result = await provider.invoke({
  domain: 'llm',
  op: 'completion',
  params: { model: 'qvac-llm', prompt: 'Summarize this invoice' },
});
if (result.ok) console.log(result.data, result.usage?.tokensOut);
```

**Capability discovery.** `provider.capabilities` reflects which domains are
actually callable on the resolved SDK — a runtime without the RAG plugin stops
advertising `intelligence:rag`.

## Edge integration

Routes `intelligence:invoke` / `intelligence:cancel` actions to the
`EdgeIntelligencePort`:

```ts
import { createQvacEdgeIntelligencePort } from '@totemsdk/qvac/edge';
import { edgeRuntime } from '@totemsdk/edge';

const port = createQvacEdgeIntelligencePort({ sdk: qvac });
edgeRuntime.ports.intelligence = port;
```

Dispatch is **capability-gated**: `intelligence:invoke` fails with
`CAPABILITY_MISSING` before touching the port if `intelligence:<domain>` is not
in the runtime's `EdgeCapabilitySet`.

## Learning more

- [`@totemsdk/intelligence`](../api/totemsdk-intelligence/index.md) — contract reference
- [`@totemsdk/qvac`](../api/totemsdk-qvac/index.md) — adapter reference
- [Agent Policy Overview](agent-policy-overview.md) — how proposals like
  `inference` intents get evaluated and signed