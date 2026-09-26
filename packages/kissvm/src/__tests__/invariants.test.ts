import {
  assertNonEmpty,
  authorizeFixed,
  authorizeMultisig,
  assertStateUnchanged,
  assertMonotonic,
  payExact,
  branch,
  auditScriptInvariants,
  satisfiesInvariants,
} from '../invariants.js';
import { buildStatechainScript } from '../templates/statechain.js';
import { buildActionAuthorizationScript } from '../templates/authority.js';
import { buildPaymentIntentScript } from '../templates/agent-policy.js';
import { buildProofDelegationScript } from '../templates/proof.js';
import { buildHeartbeatScript } from '../templates/provider-bond.js';
import { buildAttestedTxPoWMetaScript } from '../templates/txpow.js';

describe('RFC-016 invariant helpers', () => {
  it('authorizes against a fixed key or a previously-committed authority', () => {
    expect(authorizeFixed({ key: 'ab'.repeat(32) })).toBe(`ASSERT SIGNEDBY(0x${'ab'.repeat(32)})`);
    expect(authorizeFixed({ prevStatePort: 3 })).toBe('ASSERT SIGNEDBY(PREVSTATE(3))');
    expect(authorizeMultisig(2, ['aa', 'bb'])).toBe('ASSERT MULTISIG(2 0xaa 0xbb)');
  });

  it('builds state and economic constraints', () => {
    expect(assertStateUnchanged(2)).toBe('ASSERT STATE(2) EQ PREVSTATE(2)');
    expect(assertMonotonic(4)).toBe('ASSERT STATE(4) GT PREVSTATE(4)');
    expect(payExact('cc', '1000', '@TOKENID')).toBe('ASSERT VERIFYOUT(@INPUT 0xcc 1000 @TOKENID TRUE)');
  });

  it('builds an exhaustive fail-closed branch', () => {
    const script = branch('STATE(1)', [
      { when: '1', then: ['  RETURN TRUE'] },
      { when: '2', then: ['  ASSERT SIGNEDBY(0xff)'] },
    ]);
    expect(script).toContain('IF STATE(1) EQ 1 THEN');
    expect(script).toContain('ELSEIF STATE(1) EQ 2 THEN');
    expect(script).toContain('ELSE');
    expect(script).toContain('RETURN FALSE');
  });

  it('fails construction on empty input (no allow-all)', () => {
    expect(() => assertNonEmpty([], 'layers')).toThrow(/empty|allow-all/i);
  });
});

describe('RFC-016 invariant detector catches the audited anti-patterns', () => {
  it('flags statechain-style authority substitution (SIGNEDBY on mutable STATE)', () => {
    const script = [
      'LET OWNER = STATE(0)',
      'IF @COINAGE GTE 256 THEN',
      '  RETURN SIGNEDBY(OWNER)',
      'ENDIF',
      'ASSERT MULTISIG(2 OWNER 0xse)',
      'RETURN TRUE',
    ].join('\n');
    const violations = auditScriptInvariants({ name: 'statechain.reclaim', script, expectsAuthorization: true });
    expect(violations.map((v) => v.invariant)).toContain('I1');
  });

  it('flags an action-authorization script with no signer', () => {
    const script = [
      'LET nonce = STATE(0)',
      'ASSERT PREVSTATE(0) NEQ nonce',
      'ASSERT STATE(1) EQ 0xaction',
      'RETURN TRUE',
    ].join('\n');
    const violations = auditScriptInvariants({ name: 'authority.action', script, expectsAuthorization: true });
    expect(violations.map((v) => v.invariant)).toContain('I1');
  });

  it('flags a payment-intent script with no output binding', () => {
    const script = ['LET amount = STATE(20)', 'ASSERT amount LTE 100', 'ASSERT STATE(21) EQ 0xr', 'RETURN TRUE'].join('\n');
    const violations = auditScriptInvariants({
      name: 'agent-policy.paymentIntent',
      script,
      expectsAuthorization: true,
      expectsPayment: true,
    });
    expect(violations.map((v) => v.invariant)).toEqual(expect.arrayContaining(['I1', 'I2']));
  });

  it('flags fail-open conditional authorization', () => {
    const script = [
      'IF STATE(1) EQ 1 THEN',
      '  ASSERT SIGNEDBY(0xaa)',
      'ENDIF',
      'IF STATE(2) EQ 1 THEN',
      '  ASSERT SIGNEDBY(0xbb)',
      'ENDIF',
      'ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)',
      'RETURN TRUE',
    ].join('\n');
    const violations = auditScriptInvariants({ name: 'energy.rec', script, expectsPayment: true });
    expect(violations.map((v) => v.invariant)).toContain('I4');
  });

  it('accepts a script built from the canonical helpers', () => {
    const script = [
      authorizeFixed({ prevStatePort: 0 }),
      assertStateUnchanged(1),
      assertMonotonic(2),
      payExact('recipientPk', 'amountState', '@TOKENID'),
      branch('STATE(3)', [{ when: '1', then: ['  RETURN TRUE'] }]),
      'RETURN TRUE',
    ].join('\n');
    expect(auditScriptInvariants({ name: 'corrected', script, expectsAuthorization: true, expectsPayment: true })).toEqual([]);
    expect(satisfiesInvariants({ name: 'corrected', script, expectsAuthorization: true, expectsPayment: true })).toBe(true);
  });
});

describe('RFC-016 P1: repaired stable templates satisfy the invariants', () => {
  const pkA = 'aa'.repeat(32);
  const pkB = 'bb'.repeat(32);

  it('statechain reclaim anchors authority to PREVSTATE', () => {
    const script = buildStatechainScript({ sePk: pkB, reclaimTimelock: 256n });
    expect(satisfiesInvariants({ name: 'statechain', script, expectsAuthorization: true })).toBe(true);
  });

  it('action authorization requires the fixed authority and a monotonic nonce', () => {
    const script = buildActionAuthorizationScript({ authorityPk: pkA, actionHash: 'ab'.repeat(32), windowEnd: 1500n, noncePort: 5, actionPort: 6, windowEndPort: 7 });
    expect(satisfiesInvariants({ name: 'authority.action', script, expectsAuthorization: true })).toBe(true);
  });

  it('payment intent binds the output and requires the fixed authority', () => {
    const script = buildPaymentIntentScript({ authorityPk: pkA, riskLimit: '100', allowedRecipient: pkB, expiresAt: 2000n });
    expect(satisfiesInvariants({ name: 'agent-policy.paymentIntent', script, expectsAuthorization: true, expectsPayment: true })).toBe(true);
  });

  it('proof delegation requires the committed delegator and root authority', () => {
    const script = buildProofDelegationScript({ authorityPk: pkA, delegatePk: pkB, expiresAt: 2000n, anchorBlock: 1n, proofKind: 'delegation', confirmedAtPort: 1 });
    expect(satisfiesInvariants({ name: 'proof.delegation', script, expectsAuthorization: true })).toBe(true);
  });

  it('provider-bond heartbeat requires the configured probe signer', () => {
    const script = buildHeartbeatScript({
      providerPk: pkA, amount: '100', tokenId: '00', expiresAtBlock: 2000n, cliffBlock: 500n,
      bondPort: 1, expiryPort: 2, heartbeatPort: 3, slaPort: 4, governancePk: pkB,
      maxHeartbeatBlocks: 100n, unbondingDurationBlocks: 100n, releaseRequestPort: 7,
      claimedPort: 8, challengeDeadlineBlock: 3000n, probeSignerPk: pkA,
    });
    expect(satisfiesInvariants({ name: 'provider-bond.heartbeat', script, expectsAuthorization: true })).toBe(true);
  });

  it('TxPoW metadata constraint requires the fixed attestor', () => {
    const script = buildAttestedTxPoWMetaScript({ attestorPk: pkA, maxTxPoWSize: 1000n, maxKISSVMOps: 500n, minTxPoWWork: 10n, magicPort: 1, opsPort: 2, workPort: 3 });
    expect(satisfiesInvariants({ name: 'txpow.attested', script, expectsAuthorization: true })).toBe(true);
  });
});
