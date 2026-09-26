/**
 * @module @totemsdk/decision/intelligence
 *
 * Intelligence fallback adapter. Decision **consumes** Intelligence; it does not
 * masquerade as it (RFC-012 §31.3). Generative fallback rules apply (§31.4):
 * only valid candidate IDs are offered, output is parsed strictly, unknown
 * candidates are rejected by the runtime, and confidence may be absent.
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import type { DecisionCapability } from '../constants.js';
import type { DecisionErrorCode } from '../errors.js';
import type {
  DecisionProvider,
  DecisionProviderOutcome,
  DecisionProviderRequest,
} from '../types.js';

/** Map intelligence error codes onto the decision error vocabulary. */
function toDecisionErrorCode(code: string): DecisionErrorCode {
  switch (code) {
    case 'UNAVAILABLE':
    case 'TIMEOUT':
    case 'CANCELLED':
    case 'NOT_IMPLEMENTED':
    case 'INVALID_REQUEST':
    case 'INTERNAL':
      return code;
    default:
      return 'PROVIDER_ERROR';
  }
}

export interface IntelligenceDecisionProviderOptions {
  /** Provider-neutral intelligence surface (e.g. QVAC, a remote LLM gateway). */
  readonly intelligence: IntelligenceProvider;
  readonly model?: string;
  /** Override prompt construction. */
  readonly buildPrompt?: (request: DecisionProviderRequest) => string;
  /** Override strict parsing of the model text into a decision result. */
  readonly parse?: (
    text: string,
    request: DecisionProviderRequest,
  ) => unknown;
  /** Extra inference parameters passed through to the intelligence provider. */
  readonly parameters?: Record<string, unknown>;
  readonly id?: string;
  readonly displayName?: string;
  readonly version?: string;
  readonly capabilities?: readonly DecisionCapability[];
  readonly isReady?: boolean;
}

/** Build the strict JSON prompt for a decision request. */
export function buildIntelligenceDecisionPrompt(
  request: DecisionProviderRequest,
): string {
  const lines: string[] = [
    'You are a bounded decision function. Return STRICT JSON only — no prose, no markdown.',
    'You MUST choose only from the offered candidate IDs. Never invent IDs.',
  ];
  if (request.kind === 'action') {
    lines.push(`Goal: ${request.goal ?? '(none)'}`);
    lines.push(`State: ${JSON.stringify(request.state)}`);
    lines.push('Operations (choose exactly one operation; choose a target only from that operation\'s targets):');
    lines.push(JSON.stringify(request.operations.map((op) => ({
      id: op.id,
      targets: (op.targets ?? []).map((t) => t.id),
    }))));
    lines.push('Respond as {"answer":{"operation":"<id>","target":"<id or omitted>"}}');
  } else {
    lines.push(`State: ${JSON.stringify(request.state)}`);
    lines.push('Questions:');
    lines.push(JSON.stringify(request.questions.map((q) => {
      if (q.type === 'probability') {
        return { id: q.id, type: 'probability', proposition: q.proposition };
      }
      if (q.type === 'score') {
        return { id: q.id, type: 'score', rubric: q.rubric.map((c) => c.id), order: 'increasing' };
      }
      return { id: q.id, type: 'choice', criteria: q.criteria.map((c) => c.id) };
    })));
    lines.push('Respond as {"answers":[{"questionId":"<id>","type":"choice|score|probability","selected":"<id>","probabilityTrue":<0..1>}]}');
  }
  return lines.join('\n');
}

function extractText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['text', 'content', 'response', 'output', 'completion']) {
      if (typeof obj[key] === 'string') return obj[key] as string;
    }
  }
  return JSON.stringify(data);
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Intelligence response contained no JSON object.');
  }
  return candidate.slice(start, end + 1);
}

/** Default strict parser: JSON only, no fabricated structure. */
export function parseIntelligenceDecision(
  text: string,
  request: DecisionProviderRequest,
): unknown {
  const parsed = JSON.parse(extractJson(text)) as Record<string, unknown>;
  if (request.kind === 'action') {
    if (parsed.answer && typeof parsed.answer === 'object') return { kind: 'action', answer: parsed.answer };
    if ('operation' in parsed) return { kind: 'action', answer: parsed };
    throw new Error('Action response is missing an operation.');
  }
  if (Array.isArray(parsed.answers)) return { kind: 'questions', answers: parsed.answers };
  throw new Error('Questions response is missing answers[].');
}

/**
 * Create a decision provider that uses an {@link IntelligenceProvider} as a
 * generative fallback. Output is untrusted and re-validated by the runtime.
 */
export function createIntelligenceDecisionProvider(
  options: IntelligenceDecisionProviderOptions,
): DecisionProvider {
  const provider: DecisionProvider = {
    id: options.id ?? 'intelligence',
    displayName: options.displayName ?? 'Intelligence (fallback)',
    version: options.version ?? options.intelligence.version,
    capabilities: options.capabilities ?? ['decision:choice', 'decision:score', 'decision:probability', 'decision:action'],
    isReady: options.isReady ?? options.intelligence.isReady,

    async decide(request: DecisionProviderRequest): Promise<DecisionProviderOutcome> {
      const prompt = (options.buildPrompt ?? buildIntelligenceDecisionPrompt)(request);
      const result = await options.intelligence.invoke({
        requestId: request.requestId,
        domain: 'llm',
        op: 'completion',
        params: {
          ...(options.model ? { model: options.model } : {}),
          prompt,
          responseFormat: 'json',
          ...(options.parameters ?? {}),
        },
        ...(request.signal ? { signal: request.signal } : {}),
      });

      if (!result.ok) {
        return {
          ok: false,
          requestId: request.requestId,
          code: toDecisionErrorCode(result.code),
          message: result.message,
          retryable: result.retryable,
        };
      }

      let decision: unknown;
      try {
        const text = extractText(result.data);
        decision = (options.parse ?? parseIntelligenceDecision)(text, request);
      } catch (err) {
        return {
          ok: false,
          requestId: request.requestId,
          code: 'INVALID_OUTPUT',
          message: err instanceof Error ? err.message : String(err),
          retryable: false,
        };
      }

      return {
        ok: true,
        requestId: request.requestId,
        decision: decision as never,
        ...(result.usage
          ? {
              usage: {
                ...(result.usage.durationMs !== undefined ? { durationMs: result.usage.durationMs } : {}),
              },
            }
          : {}),
        ...(result.upstreamRequestId ? { upstreamRequestId: result.upstreamRequestId } : {}),
        provenance: {
          providerId: options.intelligence.id,
          providerVersion: options.intelligence.version,
          ...(options.model ? { model: { id: options.model, provenance: 'declared' as const } } : {}),
          source: 'provider-reported' as const,
        },
      };
    },
  };

  return provider;
}
