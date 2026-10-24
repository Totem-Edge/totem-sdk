/**
 * RFC-058 P1 — custody modes, sign requests and domain-separated payloads.
 */

import {
  makeSelfCustody,
  makeHostedCustody,
  validateCustodyContext,
  assertSignRequest,
  signRequestPayload,
  custodyDisclosureId,
  checkCustodyAcknowledgement,
  assertCustodyAcknowledgement,
  assertCustodyAllowsSigning,
  type CustodyAcknowledgement,
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

  it('builds an explicit hosted context and applies safe defaults', () => {
    const custody = makeHostedCustody({
      operatorId: 'op-1',
      legalEntity: 'Example Custody Ltd',
      jurisdiction: 'GB',
      disclosureHash: '0x' + 'aa'.repeat(32),
      disclosureVersion: '2026-10-20',
      policySummary: '2-person approval over 10k',
      withdrawalTerms: 'T+1, limits apply',
    });
    expect(custody.mode).toBe('hosted');
    expect(custody.keyManagement).toBe('host');
    expect(custody.canMoveFunds).toBe(false);
    expect(custody.canFreeze).toBe(false);
    expect(() => makeHostedCustody({
      operatorId: 'op-1',
      legalEntity: '',
      jurisdiction: 'GB',
      disclosureHash: '0xaa',
      disclosureVersion: '1',
      policySummary: 'x',
      withdrawalTerms: 'x',
    })).toThrow(/legalEntity/);
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

  it('signs raw bytes for chain requests and domain-separates intent requests', () => {
    const digest = new Uint8Array(32).fill(3);
    const chainReq = request({ kind: 'chain', digest });
    expect(Array.from(signRequestPayload(chainReq))).toEqual(Array.from(digest));
    const intentReq = request({ kind: 'intent', digest });
    expect(Array.from(signRequestPayload(intentReq))).not.toEqual(Array.from(digest));
  });

  it('rejects an unknown sign request kind', () => {
    expect(() => assertSignRequest(request({ kind: 'nope' as never }))).toThrow(/kind/);
  });

  it('binds the payload digest', () => {
    const a = signRequestPayload(request({ digest: new Uint8Array(32).fill(1) }));
    const b = signRequestPayload(request({ digest: new Uint8Array(32).fill(2) }));
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

function acknowledgement(
  custody: CustodyContext,
  overrides: Partial<CustodyAcknowledgement> = {},
): CustodyAcknowledgement {
  return {
    disclosureId: custodyDisclosureId(custody),
    disclosureHash: custody.disclosureHash ?? '',
    disclosureVersion: custody.disclosureVersion ?? '',
    subjectId: 'alice',
    acknowledgedAt: Date.now(),
    ...overrides,
  };
}

describe('custody acknowledgements', () => {
  it('derives a stable id from the material terms', () => {
    const a = hosted();
    const b = hosted({ disclosureHash: '0x' + 'bb'.repeat(32), disclosureVersion: '2026-11-01' });
    expect(custodyDisclosureId(a)).toBe(custodyDisclosureId(hosted()));
    expect(custodyDisclosureId(a)).not.toBe(custodyDisclosureId(b));
  });

  it('checks the exact disclosure, subject and freshness', () => {
    const custody = hosted();
    const ack = acknowledgement(custody);
    expect(checkCustodyAcknowledgement(ack, custody)).toEqual({ ok: true });
    expect(checkCustodyAcknowledgement(undefined, custody)).toMatchObject({ ok: false });
    expect(checkCustodyAcknowledgement({ ...ack, disclosureId: '0xdead' }, custody)).toMatchObject({ ok: false });
    expect(checkCustodyAcknowledgement({ ...ack, disclosureHash: '0xbeef' }, custody)).toMatchObject({ ok: false });
    expect(checkCustodyAcknowledgement({ ...ack, disclosureVersion: 'old' }, custody)).toMatchObject({ ok: false });
    expect(checkCustodyAcknowledgement({ ...ack, subjectId: 'bob' }, custody, { subjectId: 'alice' })).toMatchObject({ ok: false });
    expect(checkCustodyAcknowledgement({ ...ack, expiresAt: Date.now() - 1 }, custody)).toMatchObject({ ok: false });
    expect(checkCustodyAcknowledgement({ ...ack, acknowledgedAt: Date.now() + 60 * 60_000 }, custody)).toMatchObject({ ok: false });
    expect(() => assertCustodyAcknowledgement({ ...ack, disclosureId: '0xdead' }, custody)).toThrow(/disclosureId/);
  });

  it('allows self-custody without an acknowledgement', () => {
    expect(() => assertCustodyAllowsSigning(request())).not.toThrow();
  });

  it('fails closed for hosted custody without an ack or policy decision', () => {
    const custody = hosted();
    expect(() => assertCustodyAllowsSigning(request({ custody }))).toThrow(/acknowledgement/);
    const ack = acknowledgement(custody);
    expect(() => assertCustodyAllowsSigning(request({ custody }), { acknowledgement: ack })).toThrow(/policy decision/);
    expect(() =>
      assertCustodyAllowsSigning(request({ custody }), {
        acknowledgement: ack,
        subjectId: 'alice',
        policyDecision: 'allow',
      }),
    ).not.toThrow();
    expect(() =>
      assertCustodyAllowsSigning(request({ custody }), {
        acknowledgement: ack,
        subjectId: 'alice',
        policyDecision: 'deny',
      }),
    ).toThrow(/policy decision/);
  });

  it('requires an acknowledgement for trust-minimised custody', () => {
    const custody: CustodyContext = {
      mode: 'trust-minimised',
      reason: 'operator can delay',
      mitigation: 'timelocked exit',
      disclosureHash: '0x' + 'cc'.repeat(32),
      disclosureVersion: '1',
    };
    expect(() => assertCustodyAllowsSigning(request({ custody }))).toThrow(/acknowledgement/);
    expect(() =>
      assertCustodyAllowsSigning(request({ custody }), { acknowledgement: acknowledgement(custody) }),
    ).not.toThrow();
  });
});
