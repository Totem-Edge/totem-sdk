/**
 * RFC-058 P1 — custody modes, sign requests and domain-separated payloads.
 */

import {
  makeSelfCustody,
  validateCustodyContext,
  assertSignRequest,
  signRequestPayload,
  type CustodyContext,
  type SignRequest,
} from '../custody.js';

function hosted(overrides: Partial<CustodyContext> = {}): CustodyContext {
  return {
    mode: 'hosted',
    operatorId: 'op-1',
    legalEntity: 'Example Custody Ltd',
    jurisdiction: 'GB',
    keyManagement: 'hsm',
    canMoveFunds: true,
    canFreeze: true,
    operatorDiscretion: false,
    withdrawalTerms: 'T+1, limits apply',
    receiptTransferability: 'restricted',
    disclosureHash: '0x' + 'aa'.repeat(32),
    disclosureVersion: '2026-10-20',
    policySummary: '2-person approval over 10k',
    ...overrides,
  };
}

function request(overrides: Partial<SignRequest> = {}): SignRequest {
  return {
    requestId: 'req-1',
    domain: 'channel',
    digest: new Uint8Array(32).fill(7),
    context: { summary: 'Open channel 100 MIN' },
    signers: ['alice'],
    custody: makeSelfCustody(),
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

describe('custody modes', () => {
  it('accepts the self-custody default', () => {
    expect(() => validateCustodyContext(makeSelfCustody())).not.toThrow();
    expect(makeSelfCustody().canMoveFunds).toBe(false);
    expect(makeSelfCustody().receiptTransferability).toBe('none');
  });

  it('refuses self-custody that grants operator powers', () => {
    expect(() => validateCustodyContext(makeSelfCustody({ canMoveFunds: true }))).toThrow(/cannot grant/);
    expect(() => validateCustodyContext(makeSelfCustody({ keyManagement: 'hsm' }))).toThrow(/wallet/);
  });

  it('requires a complete hosted disclosure', () => {
    expect(() => validateCustodyContext(hosted())).not.toThrow();
    for (const key of ['operatorId', 'legalEntity', 'jurisdiction', 'disclosureHash', 'disclosureVersion', 'policySummary', 'withdrawalTerms'] as const) {
      expect(() => validateCustodyContext(hosted({ [key]: undefined }))).toThrow(new RegExp(key));
    }
    expect(() => validateCustodyContext(hosted({ keyManagement: 'wallet' }))).toThrow(/wallet-only/);
    expect(() => validateCustodyContext(hosted({ canFreeze: undefined }))).toThrow(/canFreeze/);
  });

  it('requires reason and mitigation for trust-minimised custody', () => {
    expect(() => validateCustodyContext({ mode: 'trust-minimised' })).toThrow(/reason/);
    expect(() => validateCustodyContext({ mode: 'trust-minimised', reason: 'operator can delay' })).toThrow(/mitigation/);
    expect(() => validateCustodyContext({ mode: 'trust-minimised', reason: 'operator can delay', mitigation: 'timelocked exit' })).not.toThrow();
  });
});

describe('sign requests', () => {
  it('validates the request envelope', () => {
    expect(() => assertSignRequest(request())).not.toThrow();
    expect(() => assertSignRequest(request({ requestId: '' }))).toThrow(/requestId/);
    expect(() => assertSignRequest(request({ digest: new Uint8Array(31) }))).toThrow(/32 bytes/);
    expect(() => assertSignRequest(request({ signers: [] }))).toThrow(/signer/);
    expect(() => assertSignRequest(request({ context: { summary: '' } }))).toThrow(/summary/);
    expect(() => assertSignRequest(request({ expiresAt: Date.now() - 1 }))).toThrow(/expired/);
  });

  it('domain-separates by domain and disclosure hash', () => {
    const base = signRequestPayload(request());
    const otherDomain = signRequestPayload(request({ domain: 'factory' }));
    const hostedReq = request({ custody: hosted() });
    const hostedPayload = signRequestPayload(hostedReq);
    const changedDisclosure = signRequestPayload(
      request({ custody: hosted({ disclosureHash: '0x' + 'bb'.repeat(32) }) }),
    );

    expect(base).toHaveLength(32);
    expect(Array.from(base)).not.toEqual(Array.from(otherDomain));
    expect(Array.from(hostedPayload)).not.toEqual(Array.from(changedDisclosure));
    expect(Array.from(signRequestPayload(request()))).toEqual(Array.from(base));
  });

  it('binds the payload digest', () => {
    const a = signRequestPayload(request({ digest: new Uint8Array(32).fill(1) }));
    const b = signRequestPayload(request({ digest: new Uint8Array(32).fill(2) }));
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});
