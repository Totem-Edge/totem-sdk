import {
  custodyDisclosureId,
  makeHostedCustody,
  type SignRequest,
} from '@totemsdk/omnia';

import {
  MemoryMfaReplayGuard,
  generateTotp,
  mfaOperationHash,
  verifyMfaAssertion,
  verifyTotp,
  type MfaAssertion,
  type MfaChallenge,
} from '../mfa.js';
import { createPolicySignerPort } from '../signer-port.js';

// RFC 6238 SHA-1 test secret ("12345678901234567890") in base32.
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const SIGNER = '0x' + 'bb'.repeat(32);

function hostedCustody() {
  return makeHostedCustody({
    operatorId: 'op-1',
    legalEntity: 'Example Custody Ltd',
    jurisdiction: 'GB',
    disclosureHash: '0x' + 'aa'.repeat(32),
    disclosureVersion: '2026-10-20',
    policySummary: '2-person approval over 10k',
    withdrawalTerms: 'T+1',
  });
}

function hostedAck(custody: ReturnType<typeof hostedCustody>) {
  return {
    disclosureId: custodyDisclosureId(custody),
    disclosureHash: custody.disclosureHash!,
    disclosureVersion: custody.disclosureVersion!,
    subjectId: 'alice',
    acknowledgedAt: Date.now(),
  };
}

function request(custody = hostedCustody(), overrides: Partial<SignRequest> = {}): SignRequest {
  return {
    requestId: 'req-mfa-1',
    domain: 'channel',
    digest: new Uint8Array(32).fill(7),
    context: { summary: 'Open channel', amount: '100' },
    signers: [SIGNER],
    custody,
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

describe('TOTP', () => {
  it('matches RFC 6238 SHA-1 vectors', () => {
    expect(generateTotp(SECRET, { time: 59_000, digits: 8 })).toBe('94287082');
    expect(generateTotp(SECRET, { time: 1_111_111_109_000, digits: 8 })).toBe('07081804');
    expect(generateTotp(SECRET, { time: 59_000 })).toBe('287082');
  });

  it('verifies within the step window and rejects a bad code', () => {
    expect(verifyTotp(SECRET, '287082', { time: 59_000 })).toBe(true);
    expect(verifyTotp(SECRET, '287082', { time: 59_000 + 30_000 })).toBe(true);
    expect(verifyTotp(SECRET, '000000', { time: 59_000 })).toBe(false);
    expect(verifyTotp(SECRET, '287082', { time: 59_000, window: 0 })).toBe(true);
    expect(verifyTotp(SECRET, '287082', { time: 59_000 + 60_000, window: 0 })).toBe(false);
  });
});

describe('operation-bound MFA assertions', () => {
  const now = 1_700_000_000_000;
  const disclosureId = custodyDisclosureId(hostedCustody());
  const operationHash = mfaOperationHash({
    purpose: 'sign',
    domain: 'channel',
    digest: new Uint8Array(32).fill(7),
    disclosureId,
    amount: '100',
  });

  function challenge(overrides: Partial<MfaChallenge> = {}): MfaChallenge {
    return {
      challengeId: 'challenge-1',
      purpose: 'sign',
      operationHash,
      disclosureId,
      expiresAt: now + 60_000,
      ...overrides,
    };
  }

  function assertion(overrides: Partial<MfaAssertion> = {}): MfaAssertion {
    return {
      challengeId: 'challenge-1',
      method: 'totp',
      proof: generateTotp(SECRET, { time: now }),
      issuedAt: now,
      ...overrides,
    };
  }

  it('accepts a valid assertion once', () => {
    const used = new MemoryMfaReplayGuard();
    const options = { secret: SECRET, operationHash, disclosureId, now, used };
    expect(verifyMfaAssertion(challenge(), assertion(), options)).toEqual({ ok: true });
    expect(verifyMfaAssertion(challenge(), assertion(), options)).toMatchObject({
      ok: false,
      reason: /already been used/,
    });
  });

  it('binds the challenge to operation, disclosure, expiry and challenge id', () => {
    const base = { secret: SECRET, operationHash, disclosureId, now };
    expect(verifyMfaAssertion(challenge(), assertion({ challengeId: 'other' }), base)).toMatchObject({ ok: false });
    expect(verifyMfaAssertion(challenge({ operationHash: '0xdead' }), assertion(), base)).toMatchObject({ ok: false });
    expect(verifyMfaAssertion(challenge({ disclosureId: '0xbeef' }), assertion(), base)).toMatchObject({ ok: false });
    expect(verifyMfaAssertion(challenge({ expiresAt: now - 1 }), assertion(), base)).toMatchObject({ ok: false });
    expect(verifyMfaAssertion(challenge(), assertion({ proof: '000000' }), base)).toMatchObject({ ok: false });
    expect(verifyMfaAssertion(challenge(), assertion({ method: 'webauthn' }), base)).toMatchObject({ ok: false });
    expect(verifyMfaAssertion(challenge(), assertion({ issuedAt: now + 60 * 60_000 }), base)).toMatchObject({ ok: false });
  });

  it('derives a stable operation hash from the exact intent', () => {
    const base = { purpose: 'sign' as const, domain: 'channel', digest: new Uint8Array(32).fill(7), disclosureId, amount: '100' };
    expect(mfaOperationHash(base)).toBe(operationHash);
    expect(mfaOperationHash({ ...base, amount: '101' })).not.toBe(operationHash);
    expect(mfaOperationHash({ ...base, domain: 'settlement' })).not.toBe(operationHash);
  });
});

describe('policy signer MFA hook', () => {
  const base = {
    publicKeyDigest: SIGNER,
    sign: jest.fn(async () => new Uint8Array([1])),
  };

  function policy(mfaVerify: jest.Mock, audit: jest.Mock, minAmount?: bigint) {
    const custody = hostedCustody();
    return createPolicySignerPort(base, {
      allowedModes: ['hosted'],
      custody: { acknowledgement: hostedAck(custody), subjectId: 'alice', policyDecision: 'allow' },
      mfa: { verify: mfaVerify, minAmount },
      audit,
    });
  }

  it('requires and audits MFA for hosted signing', async () => {
    const verify = jest.fn(async () => {});
    const audit = jest.fn();
    const custody = hostedCustody();
    const req = request(custody);
    await policy(verify, audit).sign(req);
    expect(verify).toHaveBeenCalledWith(req);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ decision: 'allow', mfaVerified: true }));
  });

  it('fails closed and audits an MFA denial', async () => {
    const verify = jest.fn(async () => {
      throw new Error('bad TOTP');
    });
    const audit = jest.fn();
    await expect(policy(verify, audit).sign(request())).rejects.toThrow(/bad TOTP/);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'deny', mfaVerified: false, reason: 'bad TOTP' }),
    );
  });

  it('honours the minAmount scope', async () => {
    const verify = jest.fn(async () => {});
    const audit = jest.fn();
    await policy(verify, audit, 1000n).sign(request(hostedCustody(), { context: { summary: 'small', amount: '100' } }));
    expect(verify).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ decision: 'allow', mfaVerified: false }));
  });
});
