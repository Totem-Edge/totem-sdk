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
import { buildCapabilityScript } from '../templates/manifest.js';
import { buildLinearRelease, buildCliffRelease } from '../templates/temporal.js';
import { buildFeeAccrualScript, buildWithdrawalScript } from '../templates/liquidity-bond.js';
import { buildRevealScript } from '../templates/industrial-action.js';
import { buildMultiSigTreasuryScript } from '../templates/treasury.js';
import { buildDistributionScript, buildRedemptionScript } from '../templates/rwa-lifecycle.js';
import { buildDelegatedCredentialScript } from '../templates/recovery.js';
import { buildSensorProofScript } from '../templates/sensor-proof.js';
import { buildStandardCompliancePipeline } from '../templates/compliance.js';

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

describe('RFC-016 P4: high-severity families hardened', () => {
  const pkA = 'aa'.repeat(32);

  it('capability script refuses an empty permission set', () => {
    expect(() => buildCapabilityScript({ agentPk: pkA, permissions: [], expiresAt: 2000n })).toThrow(/non-empty|allow-all/i);
  });

  it('vesting commits the schedule and clamps at total', () => {
    const linear = buildLinearRelease({ curve: 'linear', startPort: 1, endPort: 2, totalPort: 3, beneficiaryPort: 4, beneficiary: pkA });
    expect(linear).toContain('ASSERT vestStart EQ PREVSTATE(1)');
    expect(linear).toContain('ASSERT prevClaimed ADD claimable LTE total');
    const cliff = buildCliffRelease({ curve: 'cliff', startPort: 1, endPort: 2, cliffPort: 5, totalPort: 3, beneficiaryPort: 4, beneficiary: pkA });
    expect(cliff).toContain('ASSERT total EQ PREVSTATE(3)');
  });

  it('liquidity/provider payouts bind the output to a recipient, not @ADDRESS/@AMOUNT', () => {
    const fee = buildFeeAccrualScript({ providerPk: pkA, amount: '100', tokenId: '00', unlockBlock: 1n });
    expect(fee).not.toContain('@AMOUNT LTE claimable');
    expect(fee).toContain('VERIFYOUT(@INPUT STATE(3) claimable @TOKENID TRUE)');

    const withdrawal = buildWithdrawalScript({ providerPk: pkA, amount: '100', tokenId: '00', unlockBlock: 1n });
    expect(withdrawal).toContain('VERIFYOUT(@INPUT provider @AMOUNT @TOKENID TRUE)');
    expect(withdrawal).not.toContain('VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)');
  });

  it('reveal no longer requires the preimage to pre-exist', () => {
    const reveal = buildRevealScript({ preimagePort: 1, commitmentPort: 2 });
    expect(reveal).not.toContain('SAMESTATE(1 1)');
    expect(reveal).toContain('ASSERT STATE(2) EQ committed');
  });
});

describe('RFC-016 P4 wave 3: cumulative counters + recipient binding', () => {
  const pkA = 'aa'.repeat(32);
  const pkB = 'bb'.repeat(32);

  it('treasury records the period spend and can bind the recipient', () => {
    const base = { treasuryId: 't', maxSpendPerPeriod: '100', periodBlocks: 10, periodStartPort: 1, spentThisPeriodPort: 2 };
    const bound = buildMultiSigTreasuryScript([pkA, pkB], 2, { ...base, recipientPkd: pkB }).script;
    expect(bound).toContain(`ASSERT VERIFYOUT(@INPUT 0x${pkB} @AMOUNT @TOKENID TRUE)`);
    expect(bound).toContain('ASSERT STATE(2) EQ spent ADD @AMOUNT');
    expect(buildMultiSigTreasuryScript([pkA], 1, base).script).toContain('ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)');
  });

  it('distribution and redemption consume their cumulative counters', () => {
    const dist = buildDistributionScript(pkA, {
      assetId: 'a', distributionId: 'd', distributionType: 'dividend', totalDistribution: '1000',
      shareTokenId: '00', recordDateBlock: 1, distributionPort: 7, perSharePort: 8,
    }).script;
    expect(dist).toContain('ASSERT STATE(7) EQ prevDistributed ADD payout');

    const redeem = buildRedemptionScript(pkA, {
      assetId: 'a', shareTokenId: '00', navPerShare: '1', redemptionFeeBps: 0, minHoldingPeriodBlocks: 0,
      redemptionWindowStart: 1, redemptionWindowEnd: 100, totalRedeemedPort: 9, maxRedeemable: '1000',
    }).script;
    expect(redeem).toContain('ASSERT STATE(9) EQ prevRedeemed ADD @AMOUNT');
  });

  it('delegated credential consumes its usage counter', () => {
    const script = buildDelegatedCredentialScript({
      role: 'operator', issuerPkd: pkA, holderPkd: pkB, scope: 'ops', validFrom: 1, expiresAt: 100, maxUses: 3,
    });
    expect(script).toContain('ASSERT STATE(71) EQ uses ADD 1');
  });
});

describe('RFC-016 P4 wave 4: compliance, healthcare, sensor-proof', () => {
  const pkA = 'aa'.repeat(32);
  const root = 'cc'.repeat(32);

  it('compliance pipeline uses canonical hashes and committed authorities', () => {
    const chain = buildStandardCompliancePipeline(root, root, root, root, 'aa', 'bb', 'cc', 'dd');
    const issuer = chain.links[1].script;
    expect(issuer).toContain('LET issuer = PREVSTATE(2)');
    expect(chain.links[2].script).toContain('NOT CONTAINS(PREVSTATE(4)');
  });

  it('sensor proof MASTs the policy root and uses committed freshness', () => {
    const script = buildSensorProofScript({
      deviceId: 'dev-1', devicePkd: pkA, policyRoot: root, deviceProof: 'aa', maxAgeSeconds: 60,
    });
    expect(script).toContain(`MAST 0x${root}`);
    expect(script).not.toContain(`MAST 0x${pkA}`);
    expect(script).toContain('LET sigTime = PREVSTATE(1)');
  });
});
