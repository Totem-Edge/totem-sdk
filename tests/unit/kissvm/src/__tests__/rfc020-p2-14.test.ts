/**
 * RFC-020 P2-14 residual: previously-unused security parameters are now wired.
 */

import { buildBondLockupScript, buildHeartbeatScript, buildBondStateMachineScript } from '../templates/provider-bond.js';
import { buildThresholdRecoveryScript, buildInstitutionalHierarchy } from '../templates/recovery.js';

const pkA = 'aa'.repeat(32);
const pkB = 'bb'.repeat(32);

const bondCfg = {
  providerPk: pkA,
  amount: '100',
  tokenId: '00',
  expiresAtBlock: 2000n,
  cliffBlock: 500n,
  bondPort: 1,
  expiryPort: 2,
  heartbeatPort: 3,
  slaPort: 4,
  governancePk: pkB,
  maxHeartbeatBlocks: 100n,
  unbondingDurationBlocks: 100n,
  releaseRequestPort: 7,
  claimedPort: 8,
  challengeDeadlineBlock: 3000n,
  probeSignerPk: pkA,
  probeSignerPort: 6,
};

describe('RFC-020 P2-14: provider-bond unused params wired', () => {
  it('lockup binds the bond token', () => {
    expect(buildBondLockupScript(bondCfg)).toContain('ASSERT @TOKENID EQ 0x00');
  });

  it('heartbeat commits the probe-signer key', () => {
    expect(buildHeartbeatScript(bondCfg)).toContain(`ASSERT STATE(6) EQ 0x${pkA}`);
  });

  it('state machine commits the SLA anchor', () => {
    expect(buildBondStateMachineScript(bondCfg)).toContain('ASSERT STATE(4) EQ PREVSTATE(4)');
  });
});

describe('RFC-020 P2-14: recovery unused params wired', () => {
  it('commits the public-notice endpoint when supplied', () => {
    const script = buildThresholdRecoveryScript({
      institutionalRoot: pkA,
      custodians: [pkA, pkB],
      threshold: 2,
      delayBlocks: 10,
      recoveryId: 'rec-1',
      noticeEndpoint: 'https://example.test/notice',
    });
    expect(script).toContain('ASSERT STATE(53) EQ [https://example.test/notice]');
  });

  it('rejects a governanceCustodians that disagrees with governancePks', () => {
    expect(() =>
      buildInstitutionalHierarchy({
        identityId: 'id-1',
        name: 'Org',
        governanceCustodians: 5,
        governanceThreshold: 2,
        governancePks: [pkA, pkB],
        operationalControllerPkd: pkA,
        recoveryDelayBlocks: 10,
        recoveryCustodians: [pkA],
        recoveryThreshold: 1,
        epoch: 0,
      }),
    ).toThrow(/governanceCustodians/);
  });
});
