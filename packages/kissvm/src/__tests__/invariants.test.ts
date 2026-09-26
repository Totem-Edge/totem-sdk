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
