/**
 * @totemsdk/edge — intelligence port routing tests.
 */

import {
  createCapabilitySet,
  createEdgeRuntime,
  createEdgeIntelligencePort,
  hasCapability,
  hasIntelligenceCapability,
  isIntelligenceCapability,
  EDGE_INTELLIGENCE_CAPABILITIES,
} from '../index.js';
import type {
  EdgeCapability,
  EdgeCapabilitySet,
  EdgeIntelligencePort,
  EdgeRuntimePorts,
} from '../index.js';
import type { IntelligenceProvider, IntelligenceOperation, IntelligenceOutcome, IntelligenceErrorCode } from '@totemsdk/intelligence';

function fakeIntelligencePort(opts?: {
  failWith?: string;
  noCancel?: boolean;
}): EdgeIntelligencePort {
  const port: EdgeIntelligencePort = {
    providerId: 'test-probe',
    capabilities: ['intelligence:llm', 'intelligence:rag'],
    async invoke(params) {
      if (opts?.failWith) {
        return { ok: false, errorCode: opts.failWith, error: `err: ${opts.failWith}` };
      }
      return {
        ok: true,
        data: { data: { query: params.op, domain: params.domain }, usage: { tokensIn: 1, tokensOut: 2 } },
      };
    },
  };
  if (!opts?.noCancel) {
    port.cancel = async () => ({ ok: true });
    port.close = async () => {};
  }
  return port;
}

describe('edge intelligence capabilities', () => {
  it('advertises the intelligence domain capability strings', () => {
    expect(EDGE_INTELLIGENCE_CAPABILITIES).toContain('intelligence:llm');
    expect(EDGE_INTELLIGENCE_CAPABILITIES).toContain('intelligence:asr');
    expect(EDGE_INTELLIGENCE_CAPABILITIES).toHaveLength(16);
  });

  it('labels capability strings as intelligence', () => {
    expect(isIntelligenceCapability('intelligence:models')).toBe(true);
    expect(isIntelligenceCapability('payment:send')).toBe(false);
  });

  it('checks intelligence domains on a capability set', () => {
    const caps: EdgeCapability[] = ['intelligence:llm', 'wallet:self-custody'];
    const set = createCapabilitySet(caps);
    expect(hasIntelligenceCapability(set, 'llm')).toBe(true);
    expect(hasIntelligenceCapability(set, 'asr')).toBe(false);
    expect(hasCapability(set, 'intelligence:llm')).toBe(true);
  });
});

describe('edge runtime intelligence routing', () => {
  const capabilities: EdgeCapabilitySet = createCapabilitySet([
    'intelligence:llm',
    'intelligence:models',
    'wallet:self-custody',
  ]);

  it('routes intelligence:invoke to the port', async () => {
    const port = fakeIntelligencePort();
    const runtime = createEdgeRuntime({ deviceId: 'dev-1', capabilities, ports: { intelligence: port } });

    const result = await runtime.executeAction({
      action: 'intelligence:invoke',
      subject: 'llm',
      payload: { domain: 'llm', op: 'completion', params: { prompt: 'hello' } },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ data: { query: 'completion', domain: 'llm' } });
    }
  });

  it('returns PORT_MISSING when no intelligence port is configured', async () => {
    const runtime = createEdgeRuntime({ deviceId: 'dev-2', capabilities, ports: {} });
    const result = await runtime.executeAction({
      action: 'intelligence:invoke',
      subject: 'llm',
      payload: { domain: 'llm', op: 'completion' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('PORT_MISSING');
  });

  it('returns CAPABILITY_MISSING when the domain capability is not granted', async () => {
    const port = fakeIntelligencePort();
    const runtime = createEdgeRuntime({
      deviceId: 'dev-cap-missing',
      capabilities: createCapabilitySet(['intelligence:llm', 'wallet:self-custody']),
      ports: { intelligence: port },
    });
    const result = await runtime.executeAction({
      action: 'intelligence:invoke',
      subject: 'asr',
      payload: { domain: 'asr', op: 'transcribe' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('CAPABILITY_MISSING');
      expect(result.error).toContain('intelligence:asr');
    }
  });

  it('surfaces port-level failures with their error code', async () => {
    const port = fakeIntelligencePort({ failWith: 'POLICY_REJECTED' });
    const runtime = createEdgeRuntime({ deviceId: 'dev-3', capabilities, ports: { intelligence: port } });
    const result = await runtime.executeAction({
      action: 'intelligence:invoke',
      subject: 'llm',
      payload: { domain: 'llm', op: 'completion' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('POLICY_REJECTED');
      expect(result.error).toContain('POLICY_REJECTED');
    }
  });

  it('routes intelligence:cancel to the port cancel', async () => {
    const port = fakeIntelligencePort();
    const runtime = createEdgeRuntime({ deviceId: 'dev-4', capabilities, ports: { intelligence: port } });
    const result = await runtime.executeAction({
      action: 'intelligence:cancel',
      subject: 'llm',
      payload: { requestId: 'req-9' },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects unknown intelligence actions', async () => {
    const port = fakeIntelligencePort();
    const runtime = createEdgeRuntime({ deviceId: 'dev-5', capabilities, ports: { intelligence: port } });
    const result = await runtime.executeAction({
      action: 'intelligence:list-models',
      subject: 'llm',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('UNKNOWN_ACTION');
  });

  it('runs policy gating before intelligence dispatch', async () => {
    const port = fakeIntelligencePort();
    const runtime = createEdgeRuntime({
      deviceId: 'dev-6',
      capabilities,
      ports: {
        intelligence: port,
        policy: {
          async check() {
            return {
              ok: true,
              data: { allowed: false, reason: 'budget exceeded' },
            };
          },
        },
      },
    });
    const result = await runtime.executeAction({
      action: 'intelligence:invoke',
      subject: 'llm',
      payload: { domain: 'llm', op: 'completion' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('POLICY_REJECTED');
      expect(result.policyResult?.allowed).toBe(false);
    }
  });
});

describe('edge runtime port wiring types', () => {
  it('accepts an intelligence port in EdgeRuntimePorts (structural)', () => {
    const ports: EdgeRuntimePorts = {
      intelligence: fakeIntelligencePort(),
    };
    expect(ports.intelligence?.providerId).toBe('test-probe');
    expect(ports.intelligence?.capabilities).toContain('intelligence:llm');
  });
});

// ─── createEdgeIntelligencePort — real provider-neutral hosting ──────────────

function fakeProvider(opts?: { failWithCode?: IntelligenceErrorCode }): IntelligenceProvider {
  const provider: IntelligenceProvider = {
    id: 'test-provider',
    displayName: 'Test Inference Provider',
    version: '1.0.0',
    capabilities: ['intelligence:llm', 'intelligence:models'],
    isReady: true,
    async invoke<T>(op: IntelligenceOperation<T>): Promise<IntelligenceOutcome<T>> {
      if (opts?.failWithCode) {
        return { ok: false, requestId: 'r-1', code: opts.failWithCode, message: `msg: ${opts.failWithCode}`, retryable: false } as IntelligenceOutcome<T>;
      }
      const data = {
        text: `hi from ${op.domain}/${op.op}`,
        echoed: op.params,
      } as unknown as T;
      return {
        ok: true,
        requestId: op.requestId ?? 'r-1',
        data,
        usage: { domain: op.domain as never, op: op.op, tokensIn: 7, tokensOut: 3 },
      } as IntelligenceOutcome<T>;
    },
    async *invokeStream(): AsyncIterable<never> {
      throw new Error('no stream in test');
    },
    async cancel() {
      return { ok: true, requestId: 'r-1', data: undefined };
    },
    async close() {},
  };
  return provider;
}

describe('createEdgeIntelligencePort', () => {
  const capabilities = createCapabilitySet(['intelligence:llm', 'wallet:self-custody']);

  it('binds a provider-neutral IntelligenceProvider into an EdgeIntelligencePort', async () => {
    const port: EdgeIntelligencePort = createEdgeIntelligencePort(fakeProvider());
    expect(port.providerId).toBe('test-provider');
    expect(port.capabilities).toContain('intelligence:llm');

    const runtime = createEdgeRuntime({ deviceId: 'dev-host', capabilities, ports: { intelligence: port } });
    const result = await runtime.executeAction({
      action: 'intelligence:invoke',
      subject: 'llm',
      payload: { domain: 'llm', op: 'completion', params: { prompt: 'hi' } },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ data: { text: 'hi from llm/completion', echoed: { prompt: 'hi' } } });
    }
  });

  it('translates soft-fail outcomes into edge error codes', async () => {
    const port = createEdgeIntelligencePort(fakeProvider({ failWithCode: 'INTERNAL' }));
    const runtime = createEdgeRuntime({ deviceId: 'dev-fail', capabilities, ports: { intelligence: port } });
    const result = await runtime.executeAction({
      action: 'intelligence:invoke',
      subject: 'llm',
      payload: { domain: 'llm', op: 'completion' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('INTERNAL');
      expect(result.error).toBe('msg: INTERNAL');
    }
  });

  it('forwards cancellation to the provider', async () => {
    const port = createEdgeIntelligencePort(fakeProvider());
    const result = await port.cancel?.('r-9');
    expect(result?.ok).toBe(true);
  });

  it('works end-to-end through the runtime with policy gating intact', async () => {
    const port = createEdgeIntelligencePort(fakeProvider());
    const runtime = createEdgeRuntime({
      deviceId: 'dev-gov',
      capabilities,
      ports: {
        intelligence: port,
        policy: {
          async check() {
            return { ok: true, data: { allowed: false, reason: 'no budget' } };
          },
        },
      },
    });
    const result = await runtime.executeAction({
      action: 'intelligence:invoke',
      subject: 'llm',
      payload: { domain: 'llm', op: 'completion' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.policyResult?.allowed).toBe(false);
      expect(result.errorCode).toBe('POLICY_REJECTED');
    }
  });
});