# RFC-006: SDK Intelligence & QVAC Integration

**Status:** Draft
**Created:** 2026-09-12
**Authors:** Totem SDK Contributors
**Reviewers:** [Pending stakeholder assignment]

---

## 1. Summary

The Totem SDK has a complete sovereign *value* stack (payments, channels, bonds) and a complete *identity/authority* stack (WOTS, manifests, agent-policy, governance). What it lacks is a first-class **intelligence** surface: a way for edge runtimes, agents, and dApps to run local, self-hosted inference (LLM completion, embeddings, RAG, transcription, TTS, diffusion, OCR, classification, VLA) behind the **same** governable seams the SDK already provides for value movement.

This RFC introduces two new packages and one edge extension:

| Artifact | Role |
|----------|------|
| `@totemsdk/intelligence` | Provider-neutral contracts — capabilities, operation types, receipts, errors, provider interface. Zero dependency on QVAC or any concrete provider. |
| `@totemsdk/qvac` | QVAC adapter — wraps `@qvac/sdk@^0.19.0` into `IntelligenceProvider` implementations, domain-sliced subpath exports. |
| `@totemsdk/edge` extension | Optional `EdgeIntelligencePort` + capability strings — edge runtimes advertise and dispatch intelligence actions without a hard dependency on QVAC. |

The design follows the established seam: **the AI proposes, Totem validates and authorizes.** QVAC never holds signing keys. Inference *proposals* (what an agent wants to compute) flow through the same policy machinery as payment intents, and inference *receipts* (what was actually consumed) feed `@totemsdk/agent-policy`'s existing `inference-cost-policy` budget enforcement.

## 2. Motivation

### 2.1 Why now

`@totemsdk/agent-policy` ships budget capping (`AmountCapPolicy`), rate limiting (`RateLimitPolicy`), grant-bound run coordination (`GrantBoundAutonomyPolicy`), and run-level spend ceilings — the machinery to *authorize and meter expensive operations*. What it lacks is an **inference-specific metering unit** (tokens/usage) and any runtime to meter. This RFC supplies both: usage-carrying results from the provider surface (`usage { tokensIn, tokensOut, model, durationMs }`) and an inference intent type that plugs into the existing budget/autonomy primitives.

### 2.2 What this unlocks

| Consumer | Today | With this RFC |
|----------|-------|---------------|
| Edge runtime (`@totemsdk/edge`) | No inference surface | `EdgeIntelligencePort.infer()` with capability-gated dispatch |
| Agents (`agent-policy`) | Payment intents only | Inference proposals + budgeted execution + consumption receipts |
| dApps | No model access | Provider-neutral `IntelligenceProvider` with `@totemsdk/qvac` reference adapter |
| MCP tooling | Manual | Intelligence domain registered in `SDK_MANIFEST` + MCP server catalog |

### 2.3 Non-goals

- **No model hosting.** We wrap a provider; we do not ship weights or a worker runtime.
- **No key custody.** QVAC/Totem intelligence providers never sign. All signing stays in the wallet/wots-lease layer.
- **No gate on `@totemsdk/edge`.** The edge port is optional; existing runtimes remain unchanged.
- **No `@totemsdk/edge-qvac` package.** The adapter lives in `@totemsdk/qvac` (with an `/edge` subpath), and the edge port accepts any provider-neutral implementation.

## 3. Current State

### 3.1 QVAC SDK public surface (verified against `@qvac/sdk@0.19.0`)

The `@qvac/sdk` root export surface is **54 callable client operations plus ~180 types** (verified directly against the published `dist/src/index.js` of `@qvac/sdk@0.19.0`). The 54 operations comprise the 53 operation functions re-exported from `./client/api/index.js` plus **`close`** from `./client/index.js` — that is the operation that brings the count to 54 rather than 53. All 54 are public, callable client functions; the snapshot in `@totemsdk/qvac` (`api-snapshot.ts`) counts exactly these and nothing else.

Deliberately **not** counted as operations (they are factories, constants, or class exports): `plugins` (plugin-client factory), auxiliary callables `getLogger` / `profiler` / `attachBackendDiagnostics`, constants (`VLA_DEFAULT_IMAGE_SIZE`, `RAG_ERROR_CODES`, `SDK_CLIENT_ERROR_CODES`, `SDK_SERVER_ERROR_CODES`, `MODEL_TYPES`, plugin ids, TTS/audiogen constants), error classes (`InferenceCancelledError`, `ContextOverflowError`, `RequestRejectedByPolicyError`, …), and helpers (`definePlugin`, `toolSchema`). None of these are wrapped as an operation; `/raw` hands back the genuine SDK object when consumers need any of them.

Domain-sliced catalog (the `client`/`system` rows below are observations of the root export lines, not the only home of each op):

| Totem intelligence domain | QVAC exports |
|---------------------------|--------------|
| **llm** | `completion`, `batchCompletion`, `finetune` (+ `CompletionParams`, `CompletionEvent`, `BatchPrompt`, `Finetune*`) |
| **embed** | `embed` (+ `EmbedStats`) |
| **rag** | `ragChunk`, `ragIngest`, `ragSearch`, `ragSaveEmbeddings`, `ragDeleteEmbeddings`, `ragReindex`, `ragListWorkspaces`, `ragCloseWorkspace`, `ragDeleteWorkspace` (+ `RAG_ERROR_CODES`, `RagSearchResult`, `RagDoc`) |
| **asr** | `transcribe`, `transcribeStream`, `bciTranscribe`, `bciTranscribeStream` (+ `TranscribeStats`, `BciConfig`, `NeuralInput`) |
| **translate** | `translate` |
| **tts** | `textToSpeech`, `textToSpeechStream` (+ `TTS_PACES`, `TTS_COSYVOICE3_*`, `TtsParler*`) |
| **diffusion** | `diffusion`, `upscale` (+ `DiffusionProgressTick`, `DiffusionStreamResponse`, `DiffusionStats`, `Upscale*`) |
| **ocr** | `ocr` (+ `OCRTextBlock`, `OCROptions`) |
| **classify** | `classify` (+ `ClassificationResult`) |
| **audiogen** | `audioGen` (+ `AUDIOGEN_ENGINES`, `AUDIOGEN_TASK_TYPES`, `AudioGen*`) |
| **video** | `video` (+ `VideoProgressTick`, `VideoStreamResponse`, `VideoStats`) |
| **vla** | `vla`, `vlaHparams`, `vlaSetEmbodiment`, `vlaPreprocessImage`, `vlaPadState`, `VLA_DEFAULT_IMAGE_SIZE` (+ `Vla*`) |
| **world** | `worldCreateScene`, `worldStep` (+ `WorldStepResult`, `WorldSceneResult`) |
| **models** | `loadModel`, `unloadModel`, `getModelInfo`, `getLoadedModelInfo`, `deleteCache`, `downloadAsset`, `assessModelFit`, `modelRegistryList`, `modelRegistrySearch`, `modelRegistryGetModel`, `suspend`, `resume`, `state` |
| **system** | `heartbeat`, `getSystemResources`, `loggingStream`, `subscribeServerLogs` (ops); `getLogger`, `attachBackendDiagnostics`, `profiler` (auxiliary callables, not wrapped as ops) |
| **client** | `close` (the 54th op; from `./client/index.js`), `cancel`, `invokePlugin`, `invokePluginStream` (ops); `plugins` (plugin-client factory) |
| **errors** | `SDK_CLIENT_ERROR_CODES`, `SDK_SERVER_ERROR_CODES`, `RequestRejectedByPolicyError`, `InferenceCancelledError`, `ContextOverflowError`, `WorkerCrashError`, … |

Subpath exports: `.` root, `./package`, `./dist/src/worker/index.js`, `./llamacpp-completion/plugin`, `./llamacpp-embedding/plugin`, `./whispercpp-transcription/plugin`, `./bci-whispercpp-transcription/plugin`, `./parakeet-transcription/plugin`, `./nmtcpp-translation/plugin`, `./tts-ggml/plugin`, `./onnx-tts/plugin`, `./ggml-ocr/plugin`, `./sdcpp-generation/plugin`, `./audiogen-ggml/plugin`, `./ggml-vla/plugin`, `./ggml-classification/plugin`, `./plugin-utils`, `./schemas`, `./models`, `./commands`, `./worker-lifecycle`, `./worker-core`, `./plugins`, `./logging`.

### 3.2 Notes on prior assumptions

An earlier working assumption cataloged subpaths `/edge` and `/raw` under `@totemsdk/qvac`. **These do not exist on `@qvac/sdk`** — 0.19.0 exposes the plugin/subpath surface above. `@totemsdk/qvac` defines its **own** subpath layout (`/edge`, `/raw`, per-domain slices) internally.

### 3.3 Existing integration points

- `packages/agent-policy/src/types.ts` — `PaymentIntent` is a closed type union today (`'payment' | 'channel_update' | 'settlement' | 'lookup' | 'receipt'`); no inference intent type exists.
- `packages/agent-policy` — budget/rate/autonomy primitives exist (`AmountCapPolicy`, `RateLimitPolicy`, `GrantBoundAutonomyPolicy`, run ceilings) but consume **value units only** (amount/coins); there is no token/usage metering unit yet.
- `packages/edge/src/capabilities.ts` — already includes `'qvac:payment-intents'` and `'qvac:explanations'`; **no** inference capability strings exist.
- `packages/edge/src/ports.ts` — `EdgeRuntimePorts` has no intelligence port; `EdgeRuntime.executeAction` documents `'payment:*'`, `'lookup:*'`, `'proof:*'` action routing only.
- `packages/edge/src/types.ts` — `EdgeReceipt` has `kind: string`; inference receipts can ride that shape or a dedicated type.
- `SDK_MANIFEST.json` — 58 package entries across 5 domains; no `intelligence` domain.
- `packages/mcp-server/src/tools.ts` — introspection tooling reads package manifests; no `registerWithMcp` flag exists (earlier assumption incorrect — MCP visibility is via manifest + domain).

## 4. Architecture

### 4.1 Layering

```
┌─────────────────────────────────────────────────────────────┐
│  @totemsdk/edge  (EdgeIntelligencePort, capability strings)  │
├─────────────────────────────────────────────────────────────┤
│  @totemsdk/intelligence  (provider-neutral contracts)        │
│    IntelligenceProvider · IntelligenceOperation ·            │
│    IntelligenceReceipt · IntelligenceError / codes          │
├─────────────────────────────────────────────────────────────┤
│  @totemsdk/qvac  (adapter — depends on @qvac/sdk)            │
│    createQvacIntelligenceProvider() · /edge · /raw           │
└─────────────────────────────────────────────────────────────┘
        ▲                                        ▲
        │ provider-neutral                       │ depends on @qvac/sdk
        │ (edge never imports qvac)              │ (intelligence never imports qvac)
```

**Dependency rules (enforced, not aspirational):**
- `@totemsdk/intelligence` — zero deps on `@qvac/*`, zero deps on `@totemsdk/edge` (contracts must be edge-consumable by dependency-safe consumers too).
- `@totemsdk/qvac` — depends on `@totemsdk/intelligence` + `@qvac/sdk`.
- `@totemsdk/edge` — depends on `@totemsdk/intelligence` (types only) via `@totemsdk/intelligence/types`; **never** on `@totemsdk/qvac` or `@qvac/sdk`.

### 4.2 Provider-neutral contracts (`@totemsdk/intelligence`)

#### Capability strings
Mirror the edge `domain:action` convention so capabilities compose:

```
intelligence:llm          intelligence:embed          intelligence:rag
intelligence:asr          intelligence:translate      intelligence:tts
intelligence:diffusion    intelligence:ocr           intelligence:classify
intelligence:audiogen     intelligence:video         intelligence:vla
intelligence:world        intelligence:models        intelligence:system
intelligence:plugins
```

`@totemsdk/edge` re-exports these as literal additions to `EdgeCapability` and maps QVAC domains to `qvac:*` strings only for backward-compat with the existing `qvac:payment-intents` / `qvac:explanations`.

#### `IntelligenceProvider`

```ts
interface IntelligenceProvider {
  readonly id: string;                       // 'qvac'
  readonly displayName: string;              // 'QVAC In-situ Inference'
  readonly version: string;                  // 0.19.0 wrapped
  readonly capabilities: IntelligenceCapability[];   // which domains are live
  invoke<T>(op: IntelligenceOperation<T>): Promise<IntelligenceResult<T>>;
  invokeStream?(op: IntelligenceStreamOperation): AsyncIterable<IntelligenceStreamChunk>;
  cancel(requestId: string): Promise<IntelligenceResult<void>>;
  close(): Promise<void>;
}
```

#### `IntelligenceOperation` (oneof-style)

```ts
interface IntelligenceOperation<T = unknown> {
  readonly requestId?: string;
  readonly domain: IntelligenceDomain;        // 'llm' | 'embed' | ...
  readonly op: string;                        // 'completion' | 'batchCompletion' | 'embed' | 'ragSearch' | ...
  readonly params: Record<string, unknown>;   // domain-typed at adapter boundary
  readonly context?: {
    readonly agentId?: string;
    readonly proposalId?: string;             // ties to agent-policy proposal
    readonly runId?: string;                  // ties to authority run grant
    readonly principal?: string;
    readonly metadata?: Record<string, unknown>;
  };
}
```

#### `IntelligenceResult`

```ts
interface IntelligenceResult<T = unknown> {
  readonly ok: true;
  readonly requestId: string;
  readonly data: T;
  readonly usage?: {                       // consumption — feeds inference-cost-policy
    readonly domain: IntelligenceDomain;
    readonly op: string;
    readonly tokensIn?: number;
    readonly tokensOut?: number;
    readonly model?: string;
    readonly durationMs?: number;
    readonly metadata?: Record<string, number | string>;
  };
}

interface IntelligenceErrorResult {
  readonly ok: false;
  readonly requestId: string;
  readonly code: IntelligenceErrorCode;    // 'NOT_IMPLEMENTED' | 'NOT_FOUND' | ...
  readonly message: string;
  readonly retryable: boolean;
}
```

#### Receipts

```ts
interface IntelligenceReceipt {
  readonly receiptId: string;
  readonly provider: string;               // 'qvac'
  readonly requestId: string;
  readonly proposalId?: string;            // links to AgentProposal
  readonly runId?: string;                 // links to authority run grant
  readonly domain: IntelligenceDomain;
  readonly op: string;
  readonly model?: string;
  readonly usage: { tokensIn: number; tokensOut: number; durationMs: number };
  readonly issuedAt: number;
  readonly signedBy?: string;              // wallet signer address when attested
}
```

Receipt production is **soft** in v1 (adapter records usage; attestation/signing is upstream in the wallet layer). The structure anticipates WOTS-signed inference receipts under the existing `AgentReceipt` family.

#### Errors

`IntelligenceError extends Error` with `code: IntelligenceErrorCode` and `retryable: boolean`. Codes: `NOT_IMPLEMENTED`, `NOT_LOADED`, `NOT_FOUND`, `UNAVAILABLE`, `TIMEOUT`, `CANCELLED`, `INVALID_REQUEST`, `CONTEXT_OVERFLOW`, `POLICY_REJECTED`, `BUDGET_EXCEEDED`, `INTERNAL`.

### 4.3 QVAC adapter (`@totemsdk/qvac`)

**Package layout:**

```
packages/qvac/
  src/index.ts                 — barrel: factory + provider + domain adapters
  src/provider.ts              — createQvacIntelligenceProvider()
  src/edge-adapter.ts          — EdgeIntelligencePort implementation (edge subpath)
  src/domains/llm.ts           — completion/batchCompletion/finetune → ops
  src/domains/embed.ts
  src/domains/rag.ts
  src/domains/asr.ts
  src/domains/translate.ts
  src/domains/tts.ts
  src/domains/diffusion.ts
  src/domains/ocr.ts
  src/domains/classify.ts
  src/domains/audiogen.ts
  src/domains/video.ts
  src/domains/vla.ts
  src/domains/world.ts
  src/domains/models.ts
  src/domains/system.ts
  src/domains/stream.ts           — streaming op support (completionStream, transcribeStream, …)
  src/client-lifecycle.ts         — close(), cancel()
  src/types.ts                    — QvacProviderOptions, domain param/result types
  src/schemas.ts                  — zod schemas over provider-neutral contracts
```

**Subpath exports** (each a slice of the catalog in §3.1):

| Subpath | Exports |
|---------|---------|
| `.` | `createQvacIntelligenceProvider`, provider types, domain adapters, `IntelligenceProvider` type passthrough |
| `/edge` | `createQvacEdgeIntelligencePort` — returns `EdgeIntelligencePort`-compatible object (structural, no edge import needed or imported via `@totemsdk/intelligence/types`) |
| `/raw` | Pass-through of the raw `@qvac/sdk` functions we wrap (for apps that want QVAC directly, no provider abstraction) |
| `/llm`, `/embed`, `/rag`, `/asr`, `/translate`, `/tts`, `/diffusion`, `/ocr`, `/classify`, `/audiogen`, `/video`, `/vla`, `/world`, `/models`, `/system` | Per-domain typed convenience adapters |

**Shipped structure (2026-09-12).** The released layout deviates from the draft in three intentional ways:

1. `provider.ts` is a single generic dispatcher (op→`sdk[op]` resolution behind a `DOMAIN_FROM_OP` map) rather than per-domain op handlers living in `src/domains/*`. The modules that DO ship under `src/domains/` are typed convenience *adapters* layered over the provider (`bindDomain(provider, domain, op)`), not separate dispatch paths. Dispatch, usage extraction, cancellation, and error mapping stay centralized.
2. A `/plugins` subpath ships alongside the others (the draft table omitted it, but `intelligence:plugins` is a first-class capability string).
3. `src/schemas.ts` (zod validation) is **deferred**. Param validation remains shallow (`INVALID_REQUEST` for non-object params); a zod runtime dependency has no consumer yet. Add per-domain zod schemas in a follow-up when a consumer needs input validation. `client-lifecycle.ts` from the draft is folded into the provider's `cancel()` / `close()`.

**Key design decisions:**
1. **Lazy client init.** The provider does not connect to QVAC until the first `invoke`. `createQvacIntelligenceProvider({ connection: { endpoint, workspace }, lazyConnect: true })`.
2. **Capability discovery from SDK.** `capabilities()` reflects which QVAC plugins are available at runtime (`SDK_DEFAULT_PLUGINS`, `getLoadedModelInfo`, `heartbeat`).
3. **Usage extraction.** Each domain adapter maps QVAC stats (`CompletionStats`, `EmbedStats`, `TranscribeStats`, `DiffusionStats`, `AudioGenStats`, …) into contract `usage`, so `inference-cost-policy` stays domain-agnostic.
4. **Streaming surface.** `invokeStream` wraps `transcribeStream`, `textToSpeechStream`, `completion` streaming events, `diffusion` progress ticks into `IntelligenceStreamChunk` (typed `'token' | 'segment' | 'audio' | 'progress' | 'delta' | 'done'`).
5. **`/raw` as escape hatch.** No provider abstraction is perfect; `/raw` guarantees users can reach QVAC's full surface.

### 4.4 Edge extension

**Additions to `@totemsdk/edge`:**
- `EdgeCapability` union gains `'intelligence:llm' … 'intelligence:plugins'` (16 strings) — or a widened `EdgeCapability` (template literal) discussed in §7.
- `EdgeRuntimePorts` gains `intelligence?: EdgeIntelligencePort`.
- `EdgeRuntime.executeAction` documents + routes the two dispatch verbs `intelligence:invoke` and `intelligence:cancel` → `ports.intelligence.invoke()` / `.cancel()`.
- The canonical `EdgeIntelligencePort` interface **and** the provider-neutral `createEdgeIntelligencePort(provider)` composition live in `@totemsdk/intelligence` (`src/types.ts` + `src/port.ts`), so adapters can implement a port without depending on edge. Edge re-exports both from `src/intelligence.ts` / its barrel (see Open Question 3 — resolved: port contract lives in intelligence).

**Action vs capability namespaces (resolved).** Dispatch uses two verbs — `intelligence:invoke` / `intelligence:cancel` — while capabilities advertise *domains* (`intelligence:<domain>`). They are disjoint namespaces; a capability set cannot drive routing directly. `intelligence:invoke` requires `payload.domain` and is **capability-gated at dispatch**: if `intelligence:<domain>` is absent from the runtime's `EdgeCapabilitySet`, the action fails with `CAPABILITY_MISSING` before any port is touched. `intelligence:cancel` is ungated by domain (it addresses an in-flight `requestId`).

```ts
// @totemsdk/intelligence — canonical contract + composition seam
export interface EdgeIntelligencePort {
  readonly providerId: string;
  readonly capabilities: readonly string[];
  invoke(params: {
    requestId?: string;
    domain: string;              // 'llm' | 'embed' | ...
    op: string;                  // 'completion' | ...
    params: Record<string, unknown>;
    context?: Record<string, unknown>;
    signal?: AbortSignal;
  }): Promise<IntelligencePortResult<{ data: unknown; usage?: Record<string, unknown>; receipt?: unknown }>>;
  cancel?(requestId: string): Promise<IntelligencePortResult>;
}

// render any provider-neutral provider into an EdgeIntelligencePort
export function createEdgeIntelligencePort(provider: IntelligenceProvider): EdgeIntelligencePort;
```

### 4.5 agent-policy generalization (backward-compatible)

Existing `PaymentIntent.type` is a closed union. Add **without breaking** current producers/consumers:

```ts
// PaymentIntent.type gains:
| 'inference'   //  → inference intents (llm/embed/rag/...)

// New optional block (discriminated by type === 'inference')
inference?: {
  domain: 'llm' | 'embed' | 'rag' | 'asr' | 'tts' | 'translate' | 'diffusion' |
          'ocr' | 'classify' | 'audiogen' | 'video' | 'vla' | 'world';
  op: string;                     // 'completion' | 'embed' | 'ragSearch' | ...
  model?: string;
  input?: unknown;                // prompt/audio/image reference
  maxTokens?: number;
  budgetTokenId?: string;         // if inference is metered in tokens
  metadata?: Record<string, unknown>;
}
```

`AgentReceipt` gains an optional `inferenceReceipt?: InferenceReceiptLike` (structural, imported as type-only from `@totemsdk/intelligence`). The provider's `usage` output is the metering unit that inference-cost budget/autonomy flow consumes. No changes to `verifyAgentProposal`, `signAgentProposal`, or the protobuf `oneof` are required for v1 (protobuf `AgentProposal` generalization is a follow-up tracked separately).

**Shipped (2026-09-12, TypeScript layer only).** `PaymentIntent.type` now accepts `'inference'` with a discriminated `inference?` block (`InferenceDomain` union of 13 domains), and `AgentReceipt.inferenceReceipt?: InferenceReceiptLike` is defined as `IntelligenceReceipt`. Existing TS producers/consumers are unchanged; the protobuf `oneof intent` generalization remains the RFC-recommended separate follow-up.

## 5. Security & Sovereignty

1. **AI proposes, Totem authorizes.** `@totemsdk/qvac`/`@totemsdk/intelligence` cannot sign. All proposals pass `agent-policy`; all expensive operations should pass `authority` run grants keyed by `runId`.
2. **No remote model forced.** Provider interface works with local QVAC; nothing in the contracts assumes network.
3. **Cost capping.** Every result carries `usage`; agent-policy's budget/autonomy primitives (`AmountCapPolicy`, grant ceilings) or an inference-thin middleware convert `usage` to spend. A provider returning no `usage` is treated as un-metered and should be policy-rejected for sensitive ops.
4. **Cancellation & budgets.** `cancel(requestId)` and `AbortSignal` plumbed through the port so runaway inference is stop-able.
5. **Receipt attestation is explicit.** v1 receipts are unsigned advisories; WOTS-signed receipts are a documented follow-up in the wallet/auth layer.

## 6. Phased Plan

| Phase | Deliverable | Exit criterion |
|-------|-------------|----------------|
| **P0** | Design + API catalog | This RFC; §3.1 table verified against installed SDK |
| **P1** | `@totemsdk/intelligence` scaffold | Contracts compile; zero `@qvac/*` deps; unit tests for each type/error/code |
| **P2** | `@totemsdk/qvac` scaffold | Factory + LLM/embed/RAG adapters; subpath exports resolve; `/raw` passthrough |
| **P3** | QVAC full-domain adapters + streams | All §3.1 domains mapped; streaming ops typed |
| **P4** | Edge port + capabilities | `EdgeIntelligencePort`, capability strings, `executeAction` `'intelligence:*'` routing; edge tests green, edge still builds without qvac installed |
| **P5** | agent-policy inference intents | `type: 'inference'` + `inference?` block + receipt passthrough; existing tests unchanged |
| **P6** | API snapshot + tests | `qvac-api.json` snapshot test catches upstream drift; 16 test categories (§6.1) green |
| **P7** | Manifest/README/verify wiring | `SDK_MANIFEST` `intelligence` domain; README catalog rows; workspace gate includes new packages |

**Status 2026-09-12 — P0–P7 shipped.** P1–P4, P6, P7 complete as drafted (plus the §4.3 / §4.4 deviations recorded above). P5 shipped in the TypeScript layer; the protobuf `oneof intent` generalization stays out of scope per Open Question 4. `@totemsdk/qvac` adds runtime capability discovery (§4.3 decision 2): domains with zero callable ops on the injected/lazily-loaded SDK are dropped from `provider.capabilities` / `discoverCapabilities()`, and un-recommended while the SDK is unresolved.

### 6.1 Test categories (16)

1. Contracts type/literal tests (capabilities, domains, epochs)
2. Error code mapping (QVAC error → `IntelligenceErrorCode`)
3. Provider factory/lazy-init contract
4. Capability discovery (mock SDK plugin availability)
5. LLM adapter (completion op dispatch + usage extraction)
6. Embed adapter
7. RAG adapter (search/ingest/delete lifecycle)
8. ASR adapter (transcribe + stream)
9. TTS adapter (speech + stream)
10. Diffusion/image adapter
11. OCR/classify/audiogen/video/vla/world adapters (dispatch + mapping)
12. Streaming chunk contract (token/segment/progress/done)
13. Cancellation + AbortSignal + timeout
14. Edge port invoke routing + capability gating (`assertCapability('intelligence:llm')`)
15. agent-policy `type: 'inference'` intents pass existing budget policy
16. API snapshot vs `@qvac/sdk` (drift detection)

## 7. Open Questions

1. **Capability string width.** **Resolved:** kept the closed `EdgeCapability` union with the 16 `intelligence:*` literals; no template-literal widening in v1. Revisit widening only if a consumer needs a capability not in the catalog.
2. **QVAC connection model.** **Open for deployment.** `@totemsdk/qvac` supports injected SDK / `sdkLoader` / lazy `require('@qvac/sdk')` in that order, and capability discovery reflects the resolved runtime. Which deployment target (local already-running QVAC vs spawned worker for bare/node contexts) to standardize on is an operations decision, not a contract one — deferred.
3. **`/edge` structural import.** **Resolved:** `EdgeIntelligencePort` and `createEdgeIntelligencePort` live in `@totemsdk/intelligence` (`src/types.ts` / `src/port.ts`). `@totemsdk/qvac/edge` composes its provider through the intelligence factory and imports the port type from `@totemsdk/intelligence` — contracts stay dependency-free, qvac never depends on `@totemsdk/edge`, and edge never depends on qvac.
4. **Protobuf.** **Open, recommended follow-up:** generalize `agent_policy.proto` `oneof intent` to include an `InferenceIntent` in a separate RFC rather than folding into this RFC's blast radius. The TypeScript surface shipped (P5) is independent of the wire format.
5. **Scope of vla/world/audiogen/video adapters.** **Resolved:** shipped as thin dispatching adapters over the generic provider (P3). Typed depth upgrades remain incremental per consumer request.

## 8. References

- RFC-001 — SDK Upgrade
- RFC-004 — Edge SDK v1 Promotion (`packages/edge` port/capability conventions)
- RFC-005 — SDK & Wallet Gap Fixes (contract/approval surface direction)
- `packages/agent-policy/src/index.ts` — `PaymentIntent`, `AgentProposal`, `AgentReceipt`, budget/rate/autonomy primitives
- `packages/agent-policy/src/types.ts` — `PaymentIntent`, `AgentProposal`, `AgentReceipt`
- `packages/edge/src/capabilities.ts`, `packages/edge/src/ports.ts`, `packages/edge/src/types.ts`
- `SDK_MANIFEST.json` — inventory & domain catalog