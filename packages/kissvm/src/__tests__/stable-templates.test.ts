/**
 * Stable template tests — every template exported from the package root
 * must have at least one positive and one negative evaluation here.
 *
 * These tests use simulationMode (no real WOTS verification) so they focus
 * on the script logic: state transitions, timelocks, and invariants.
 */

import { evaluateScript } from '../index';
import type { ScriptWitness, TxContext, CoinData, OutputData } from '../index';
import { sha3_256, hexToBytes, bytesToHex } from '@totemsdk/core';
import {
  buildEltooChannelScript,
  buildEltooFundingScript,
  buildEltooSettlementScript,
  buildFactoryFundingScript,
} from '../templates/eltoo';
import {
  buildStatechainScript,
  buildStatechainOwnerRotationScript,
} from '../templates/statechain';
import {
  buildLeaseCertificateScript,
  buildWatermarkTrackingScript,
  buildLeaseStateMachineScript,
  LEASE_STATUS,
} from '../templates/wots-lease';
import {
  buildLinearRelease,
  buildCliffRelease,
  buildDeadlineScript,
  buildWindowScript,
  buildRateLimitScript,
  buildDecayScript,
  buildTemporalScript,
  computeRelease,
} from '../templates/temporal';
import {
  buildTxPoWValidationScript,
  buildMagicConstantsScript,
} from '../templates/txpow';
import {
  buildIdentityVerificationScript,
  buildDelegationProofScript,
  buildRotationScript,
  buildRevocationScript,
} from '../templates/identity';
import {
  buildManifestBindingScript,
  buildCapabilityScript,
  buildManifestExpiryScript,
} from '../templates/manifest';
import {
  buildMandateEnforcementScript,
  buildActionAuthorizationScript,
  buildUsageTrackingScript,
} from '../templates/authority';
import {
  buildPaymentIntentScript,
  buildAgentProposalScript,
  buildPolicyEnforcementScript,
} from '../templates/agent-policy';
import {
  buildLeaseMessageScript,
  buildCoinUpdateScript,
  buildTrustMessageScript,
} from '../templates/lookup-protocol';
import {
  buildProofAnchorScript,
  buildCapabilityProofScript,
  buildRevocationProofScript,
  buildProofDelegationScript,
} from '../templates/proof';
import {
  buildCommitScript,
  buildRevealScript,
  buildActionStateMachineScript,
  buildEscrowEnforcementScript,
  IA_STATUS,
} from '../templates/industrial-action';
import {
  buildLiquidityLockScript,
  buildFeeAccrualScript,
  buildWithdrawalScript,
  buildPositionStateMachineScript,
  POSITION_STATUS,
} from '../templates/liquidity-bond';
import {
  buildBondLockupScript,
  buildHeartbeatScript,
  buildBondReleaseScript,
  buildBondStateMachineScript,
  buildChallengeScript,
  BOND_STATUS,
} from '../templates/provider-bond';

const pkAA = 'aa'.repeat(32);
const pkBB = 'bb'.repeat(32);

function mockSig(label: string): Uint8Array {
  const s = new Uint8Array(1088);
  for (let i = 0; i < 1088; i++) s[i] = label.charCodeAt(i % label.length) & 0xff;
  return s;
}

function coin(amount = 100, created?: number): CoinData {
  return { amount, tokenId: '0x00', coinId: '0xabc', address: '0xAA', coinCreatedBlock: created };
}

function outputTo(addr: string, amt: number, keepState = false): OutputData {
  return { address: addr, amount: amt, tokenId: '0x00', keepState };
}

function ctx(overrides: Partial<TxContext> = {}): TxContext {
  return {
    block: 1000,
    inputIndex: 0,
    inputs: [coin()],
    outputs: [outputTo('0xAA', 100, true)],
    state: {},
    prevState: {},
    simulationMode: true,
    ...overrides,
  };
}

function s(entries: Record<number, string | number>): Record<number, string> {
  const r: Record<number, string> = {};
  for (const [k, v] of Object.entries(entries)) {
    r[Number(k)] = typeof v === 'number' ? String(v) : v;
  }
  return r;
}

function run(script: string, tx: TxContext, sigs: Record<string, string> = {}) {
  const witness: ScriptWitness = {
    signatures: new Map(Object.entries(sigs).map(([pk, label]) => [pk, mockSig(label)])),
  };
  return evaluateScript(script, witness, tx);
}

/** Hex-encode a UTF-8 string (no 0x prefix). */
const hx = (str: string) => bytesToHex(new TextEncoder().encode(str));
/** SHA3-256 of hex-decoded bytes, hex-encoded (no 0x prefix). */
const sha3Hex = (hex: string) => bytesToHex(sha3_256(hexToBytes(hex)));

describe('stable template: eltoo', () => {
  const cfg = { partyPks: [pkAA, pkBB] };

  it('update path passes when sequence advances and both parties sign', () => {
    const script = buildEltooChannelScript(cfg);
    const result = run(script, ctx({
      state: s({ 100: 0, 101: 2 }),
      prevState: s({ 101: 1 }),
    }), { [pkAA]: 'a', [pkBB]: 'b' });
    expect(result.success).toBe(true);
  });

  it('update path fails when the sequence does not advance', () => {
    const script = buildEltooChannelScript(cfg);
    const result = run(script, ctx({
      state: s({ 100: 0, 101: 1 }),
      prevState: s({ 101: 1 }),
    }), { [pkAA]: 'a', [pkBB]: 'b' });
    expect(result.success).toBe(false);
  });

  it('settlement path requires frozen sequence and coinage', () => {
    const script = buildEltooChannelScript(cfg);
    const ok = run(script, ctx({
      block: 1000,
      inputs: [coin(100, 700)],
      state: s({ 100: 1, 101: 1 }),
      prevState: s({ 101: 1 }),
    }), { [pkAA]: 'a', [pkBB]: 'b' });
    expect(ok.success).toBe(true);

    const tooEarly = run(script, ctx({
      block: 1000,
      inputs: [coin(100, 900)],
      state: s({ 100: 1, 101: 1 }),
      prevState: s({ 101: 1 }),
    }), { [pkAA]: 'a', [pkBB]: 'b' });
    expect(tooEarly.success).toBe(false);
  });

  it('funding script requires both signatures', () => {
    const script = buildEltooFundingScript(cfg);
    expect(run(script, ctx(), { [pkAA]: 'a', [pkBB]: 'b' }).success).toBe(true);
    expect(run(script, ctx(), { [pkAA]: 'a' }).success).toBe(false);
  });

  it('settlement script enforces settlement flag and coinage', () => {
    const script = buildEltooSettlementScript(cfg);
    const ok = run(script, ctx({
      inputs: [coin(100, 700)],
      state: s({ 100: 1, 101: 1 }),
      prevState: s({ 101: 1 }),
    }), { [pkAA]: 'a', [pkBB]: 'b' });
    expect(ok.success).toBe(true);

    const notSettling = run(script, ctx({
      inputs: [coin(100, 700)],
      state: s({ 100: 0, 101: 1 }),
      prevState: s({ 101: 1 }),
    }), { [pkAA]: 'a', [pkBB]: 'b' });
    expect(notSettling.success).toBe(false);
  });

  it('factory funding script requires all participant signatures', () => {
    const script = buildFactoryFundingScript({ participantPks: [pkAA, pkBB, 'cc'.repeat(32)] });
    expect(run(script, ctx(), { [pkAA]: 'a', [pkBB]: 'b', ['cc'.repeat(32)]: 'c' }).success).toBe(true);
    expect(run(script, ctx(), { [pkAA]: 'a' }).success).toBe(false);
  });
});

describe('stable template: statechain', () => {
  const cfg = { sePk: pkBB, reclaimTimelock: 256n };

  it('owner+SE multisig passes before the timelock', () => {
    const script = buildStatechainScript(cfg);
    const result = run(script, ctx({
      inputs: [coin(100, 900)],
      state: s({ 0: pkAA }),
    }), { [pkAA]: 'owner', [pkBB]: 'se' });
    expect(result.success).toBe(true);
  });

  it('owner alone can reclaim after the timelock', () => {
    const script = buildStatechainScript(cfg);
    const result = run(script, ctx({
      inputs: [coin(100, 100)],
      state: s({ 0: pkAA }),
    }), { [pkAA]: 'owner' });
    expect(result.success).toBe(true);
  });

  it('owner alone cannot spend before the timelock', () => {
    const script = buildStatechainScript(cfg);
    const result = run(script, ctx({
      inputs: [coin(100, 900)],
      state: s({ 0: pkAA }),
    }), { [pkAA]: 'owner' });
    expect(result.success).toBe(false);
  });

  it('owner rotation requires the previous owner signature', () => {
    const script = buildStatechainOwnerRotationScript(cfg);
    const ok = run(script, ctx({
      state: s({ 0: pkBB }),
      prevState: s({ 0: pkAA }),
    }), { [pkAA]: 'prev', [pkBB]: 'se' });
    expect(ok.success).toBe(true);

    const noPrevSig = run(script, ctx({
      state: s({ 0: pkBB }),
      prevState: s({ 0: pkAA }),
    }), { [pkBB]: 'se' });
    expect(noPrevSig.success).toBe(false);
  });
});

describe('stable template: wots-lease', () => {
  const baseCfg = {
    treeId: hx('tree-1'),
    deviceId: hx('device-0'),
    branchId: hx('branch-1'),
    indices: '0',
    purpose: hx('channel-update'),
    payloadHash: 'ab'.repeat(32),
    issuedAt: 0n,
    signature: '',
    expiresAt: 2000n,
    authorityPk: pkAA,
    statePort: 10,
    watermarkPort: 20,
  };

  const certState = s({
    10: '0x' + hx('tree-1'),
    11: '0x' + hx('device-0'),
    12: '0x' + hx('branch-1'),
    13: '0x' + hx('channel-update'),
    14: '0x' + 'ab'.repeat(32),
    15: '0',
  });

  it('lease certificate passes with authority signature and matching state', () => {
    const script = buildLeaseCertificateScript(baseCfg);
    const result = run(script, ctx({ block: 1000, state: certState, prevState: certState }), { [pkAA]: 'authority' });
    expect(result.success).toBe(true);
  });

  it('lease certificate fails when the payload hash is tampered', () => {
    const script = buildLeaseCertificateScript(baseCfg);
    const tampered = { ...certState, 14: '0x' + 'cd'.repeat(32) };
    const result = run(script, ctx({ block: 1000, state: tampered, prevState: tampered }), { [pkAA]: 'authority' });
    expect(result.success).toBe(false);
  });

  it('lease certificate fails after expiry', () => {
    const script = buildLeaseCertificateScript({ ...baseCfg, expiresAt: 500n });
    const result = run(script, ctx({ block: 1000, state: certState, prevState: certState }), { [pkAA]: 'authority' });
    expect(result.success).toBe(false);
  });

  it('watermark tracking enforces monotonic cursor and min interval', () => {
    const script = buildWatermarkTrackingScript({ ...baseCfg, issuedAt: 10n });
    const ok = run(script, ctx({
      block: 1000,
      state: s({ 20: 5, 21: 990, 22: 0 }),
      prevState: s({ 20: 4, 21: 990, 22: 0 }),
    }));
    expect(ok.success).toBe(true);

    const regressed = run(script, ctx({
      block: 1000,
      state: s({ 20: 3, 21: 990, 22: 0 }),
      prevState: s({ 20: 4, 21: 990, 22: 0 }),
    }));
    expect(regressed.success).toBe(false);
  });

  it('lease state machine enforces the lifecycle', () => {
    const script = buildLeaseStateMachineScript(baseCfg);
    const ok = run(script, ctx({
      block: 1000,
      state: s({ 0: LEASE_STATUS.ACTIVE }),
      prevState: s({ 0: LEASE_STATUS.PENDING }),
    }));
    expect(ok.success).toBe(true);

    const bad = run(script, ctx({
      block: 1000,
      state: s({ 0: LEASE_STATUS.FINALIZED }),
      prevState: s({ 0: LEASE_STATUS.PENDING }),
    }));
    expect(bad.success).toBe(false);
  });
});

describe('stable template: temporal', () => {
  it('linear release pays the vested amount and fails before start', () => {
    const cfg = {
      curve: 'linear' as const,
      startPort: 1,
      endPort: 2,
      totalPort: 3,
      beneficiaryPort: 4,
      beneficiary: pkAA,
    };
    const script = buildLinearRelease(cfg);
    const ok = run(script, ctx({
      block: 1100,
      state: s({ 1: 1000, 2: 2000, 3: 100 }),
      prevState: s({ 4: 0 }),
      outputs: [outputTo('0x' + pkAA, 10, true)],
    }), { [pkAA]: 'beneficiary' });
    expect(ok.success).toBe(true);

    const beforeStart = run(script, ctx({
      block: 999,
      state: s({ 1: 1000, 2: 2000, 3: 100 }),
      prevState: s({ 4: 0 }),
      outputs: [outputTo('0x' + pkAA, 10, true)],
    }), { [pkAA]: 'beneficiary' });
    expect(beforeStart.success).toBe(false);
  });

  it('cliff release fails before the cliff block', () => {
    const cfg = {
      curve: 'cliff' as const,
      startPort: 1,
      endPort: 2,
      cliffPort: 5,
      totalPort: 3,
      beneficiaryPort: 4,
      beneficiary: pkAA,
    };
    const script = buildCliffRelease(cfg);
    const beforeCliff = run(script, ctx({
      block: 1000,
      state: s({ 1: 900, 2: 2000, 5: 1100, 3: 90 }),
      prevState: s({ 4: 0 }),
      outputs: [outputTo('0x' + pkAA, 10, true)],
    }), { [pkAA]: 'beneficiary' });
    expect(beforeCliff.success).toBe(false);

    const afterCliff = run(script, ctx({
      block: 1200,
      state: s({ 1: 900, 2: 2000, 5: 1100, 3: 90 }),
      prevState: s({ 4: 0 }),
      outputs: [outputTo('0x' + pkAA, 10, true)],
    }), { [pkAA]: 'beneficiary' });
    expect(afterCliff.success).toBe(true);
  });

  it('deadline script fails after the deadline', () => {
    const script = buildDeadlineScript({
      curve: 'deadline',
      startPort: 1,
      deadlineBlock: 900n,
      beneficiaryPort: 3,
      beneficiary: pkAA,
    });
    const after = run(script, ctx({ block: 1000, state: s({ 1: 800 }) }), { [pkAA]: 'b' });
    expect(after.success).toBe(false);
    const before = run(script, ctx({ block: 800, state: s({ 1: 800 }) }), { [pkAA]: 'b' });
    expect(before.success).toBe(true);
  });

  it('window script enforces the window bounds', () => {
    const script = buildWindowScript({
      curve: 'window',
      startPort: 1,
      windowStartBlock: 800n,
      windowEndBlock: 1200n,
      beneficiaryPort: 3,
      beneficiary: pkAA,
    });
    expect(run(script, ctx({ block: 1000, state: s({ 1: 800 }) })).success).toBe(true);
    expect(run(script, ctx({ block: 500, state: s({ 1: 800 }) })).success).toBe(false);
    expect(run(script, ctx({ block: 1300, state: s({ 1: 800 }) })).success).toBe(false);
  });

  it('rate limit script enforces the per-period cap', () => {
    const script = buildRateLimitScript({
      curve: 'rate-limit',
      startPort: 1,
      maxPerPeriod: 50n,
      beneficiaryPort: 3,
    });
    const ok = run(script, ctx({ state: s({ 1: 900 }), prevState: s({ 3: 10 }) }));
    expect(ok.success).toBe(true);

    const over = run(script, ctx({ state: s({ 1: 900 }), prevState: s({ 3: 60 }) }));
    expect(over.success).toBe(false);
  });

  it('decay script computes the decayed value', () => {
    const script = buildDecayScript({
      curve: 'decay',
      startPort: 1,
      totalPort: 2,
      decayConstant: 10n,
    });
    const ok = run(script, ctx({ block: 1000, state: s({ 1: 900, 2: 100 }) }));
    expect(ok.success).toBe(true);
  });

  it('buildTemporalScript dispatches on the curve', () => {
    const linear = buildTemporalScript({ curve: 'linear', startPort: 1, endPort: 2, totalPort: 3, beneficiaryPort: 4, beneficiary: pkAA });
    expect(linear).toContain('RETURN TRUE');
    const window = buildTemporalScript({ curve: 'window', startPort: 1, windowStartBlock: 1n, windowEndBlock: 2n, beneficiaryPort: 3, beneficiary: pkAA });
    expect(window).toContain('@BLOCK GTE 1');
  });

  it('computeRelease returns the expected curve amounts', () => {
    const linearState = new Map<number, bigint>([[1, 1000n], [2, 2000n], [3, 100n], [4, 0n]]);
    expect(computeRelease({ curve: 'linear', startPort: 1, endPort: 2, totalPort: 3, beneficiaryPort: 4 }, 1100n, linearState)).toBe(10n);
    const cliffState = new Map<number, bigint>([[1, 900n], [2, 2000n], [5, 1100n], [3, 100n], [4, 0n]]);
    expect(computeRelease({ curve: 'cliff', startPort: 1, endPort: 2, cliffPort: 5, totalPort: 3, beneficiaryPort: 4 }, 1000n, cliffState)).toBe(0n);
    expect(computeRelease({ curve: 'deadline', startPort: 1, deadlineBlock: 900n, beneficiaryPort: 3 }, 1000n, new Map())).toBe(0n);
    expect(computeRelease({ curve: 'window', startPort: 1, windowStartBlock: 800n, windowEndBlock: 1200n, beneficiaryPort: 3 }, 1000n, new Map())).toBe(1n);
    expect(computeRelease({ curve: 'rate-limit', startPort: 1, maxPerPeriod: 50n, beneficiaryPort: 3 }, 1000n, new Map([[3, 10n]]))).toBe(1n);
  });
});

describe('stable template: txpow', () => {
  const cfg = {
    maxTxPoWSize: 1000n,
    maxKISSVMOps: 500n,
    minTxPoWWork: 10n,
    magicPort: 1,
    opsPort: 2,
    workPort: 3,
  };

  it('validation passes within limits and fails beyond them', () => {
    const script = buildTxPoWValidationScript(cfg);
    expect(run(script, ctx({ state: s({ 1: 100, 2: 10, 3: 10 }) })).success).toBe(true);
    expect(run(script, ctx({ state: s({ 1: 2000, 2: 10, 3: 10 }) })).success).toBe(false);
    expect(run(script, ctx({ state: s({ 1: 100, 2: 600, 3: 10 }) })).success).toBe(false);
    expect(run(script, ctx({ state: s({ 1: 100, 2: 10, 3: 5 }) })).success).toBe(false);
  });

  it('magic constants script requires exact committed values', () => {
    const script = buildMagicConstantsScript(cfg);
    expect(run(script, ctx({ state: s({ 1: 1000, 2: 500, 3: 10 }) })).success).toBe(true);
    expect(run(script, ctx({ state: s({ 1: 999, 2: 500, 3: 10 }) })).success).toBe(false);
  });
});

describe('stable template: identity', () => {
  it('identity verification passes with matching claim hash', () => {
    const claimData = '0x' + 'ab'.repeat(32);
    const script = buildIdentityVerificationScript({
      identityPk: pkAA,
      claimHash: sha3Hex('ab'.repeat(32)),
    });
    const ok = run(script, ctx({ state: s({ 2: claimData }) }), { [pkAA]: 'identity' });
    expect(ok.success).toBe(true);
  });

  it('identity verification fails with a tampered claim', () => {
    const script = buildIdentityVerificationScript({
      identityPk: pkAA,
      claimHash: sha3Hex('ab'.repeat(32)),
    });
    const bad = run(script, ctx({ state: s({ 2: '0x' + 'cd'.repeat(32) }) }), { [pkAA]: 'identity' });
    expect(bad.success).toBe(false);
  });

  it('delegation proof requires the delegate to match', () => {
    const script = buildDelegationProofScript({ delegatorPk: pkAA, delegatePk: pkBB });
    const ok = run(script, ctx({
      state: s({ 0: '0x' + pkAA, 1: '0x' + pkBB }),
      prevState: s({ 0: '0x' + pkAA, 1: '0x' + pkBB }),
    }));
    expect(ok.success).toBe(true);

    const wrongDelegate = run(script, ctx({
      state: s({ 0: '0x' + pkAA, 1: '0x' + pkAA }),
      prevState: s({ 0: '0x' + pkAA, 1: '0x' + pkAA }),
    }));
    expect(wrongDelegate.success).toBe(false);
  });

  it('rotation requires both old and new key signatures', () => {
    const script = buildRotationScript({ oldPk: pkAA, newPk: pkBB, rotationDelayBlocks: 10n });
    const ok = run(script, ctx({
      block: 1000,
      state: s({ 0: '0x' + pkBB, 1: 900, 2: 0, 3: 0 }),
      prevState: s({ 0: '0x' + pkAA, 1: 900, 2: 0, 3: 0 }),
    }), { [pkAA]: 'old', [pkBB]: 'new' });
    expect(ok.success).toBe(true);

    const onlyNew = run(script, ctx({
      block: 1000,
      state: s({ 0: '0x' + pkBB, 1: 900, 2: 0, 3: 0 }),
      prevState: s({ 0: '0x' + pkAA, 1: 900, 2: 0, 3: 0 }),
    }), { [pkBB]: 'new' });
    expect(onlyNew.success).toBe(false);
  });

  it('revocation requires the authority signature and epoch', () => {
    const script = buildRevocationScript({ authorityPk: pkAA, revocationEpoch: 1 });
    const ok = run(script, ctx({
      state: s({ 0: 1, 1: 0, 2: 0, 3: 0 }),
      prevState: s({ 1: 0, 2: 0, 3: 0 }),
    }), { [pkAA]: 'authority' });
    expect(ok.success).toBe(true);

    const wrongEpoch = run(script, ctx({
      state: s({ 0: 2, 1: 0, 2: 0, 3: 0 }),
      prevState: s({ 1: 0, 2: 0, 3: 0 }),
    }), { [pkAA]: 'authority' });
    expect(wrongEpoch.success).toBe(false);
  });
});

describe('stable template: manifest', () => {
  it('manifest binding passes with matching manifest hash', () => {
    const script = buildManifestBindingScript({ publisherPk: pkAA, manifestHash: sha3Hex('ab'.repeat(32)) });
    const ok = run(script, ctx({ state: s({ 0: '0x' + 'ab'.repeat(32) }) }), { [pkAA]: 'publisher' });
    expect(ok.success).toBe(true);
  });

  it('manifest binding fails with a tampered manifest', () => {
    const script = buildManifestBindingScript({ publisherPk: pkAA, manifestHash: sha3Hex('ab'.repeat(32)) });
    const bad = run(script, ctx({ state: s({ 0: '0x' + 'cd'.repeat(32) }) }), { [pkAA]: 'publisher' });
    expect(bad.success).toBe(false);
  });

  it('capability script enforces the permission allowlist', () => {
    const script = buildCapabilityScript({ agentPk: pkAA, permissions: [hx('read'), hx('write')], expiresAt: 2000n });
    const ok = run(script, ctx({ block: 1000, state: s({ 0: '0x' + hx('read') }) }), { [pkAA]: 'agent' });
    expect(ok.success).toBe(true);

    const denied = run(script, ctx({ block: 1000, state: s({ 0: '0x' + hx('admin') }) }), { [pkAA]: 'agent' });
    expect(denied.success).toBe(false);
  });

  it('manifest expiry fails after expiresAt', () => {
    const script = buildManifestExpiryScript({ signedAt: 100n, expiresAt: 500n, subscriptionInterval: 100n });
    const ok = run(script, ctx({ block: 300, state: s({ 0: 100, 1: 500 }), prevState: s({ 2: 0 }) }));
    expect(ok.success).toBe(true);
    const expired = run(script, ctx({ block: 600, state: s({ 0: 100, 1: 500 }), prevState: s({ 2: 0 }) }));
    expect(expired.success).toBe(false);
  });
});

describe('stable template: authority', () => {
  it('mandate enforcement passes within scope and expiry', () => {
    const script = buildMandateEnforcementScript({
      grantor: pkAA,
      scope: hx('totem:gov:vote'),
      revocationEpoch: 1n,
      scopePort: 1,
      revocationEpochPort: 2,
      expiryPort: 4,
      expiresAtBlock: 2000n,
    });
    const ok = run(script, ctx({
      block: 1000,
      state: s({ 1: '0x' + hx('totem:gov:vote'), 2: 1, 4: 2000, 3: 5 }),
      prevState: s({ 3: 4 }),
    }), { [pkAA]: 'grantor' });
    expect(ok.success).toBe(true);
  });

  it('mandate enforcement fails with a different scope', () => {
    const script = buildMandateEnforcementScript({
      grantor: pkAA,
      scope: hx('totem:gov:vote'),
      revocationEpoch: 1n,
      scopePort: 1,
      revocationEpochPort: 2,
      expiryPort: 4,
      expiresAtBlock: 2000n,
    });
    const bad = run(script, ctx({
      block: 1000,
      state: s({ 1: '0x' + hx('totem:gov:spend'), 2: 1, 4: 2000, 3: 5 }),
      prevState: s({ 3: 4 }),
    }), { [pkAA]: 'grantor' });
    expect(bad.success).toBe(false);
  });

  it('action authorization enforces the action hash and window', () => {
    const script = buildActionAuthorizationScript({
      actionHash: 'ab'.repeat(32),
      windowEnd: 1500n,
      noncePort: 5,
      actionPort: 6,
      windowEndPort: 7,
    });
    const ok = run(script, ctx({ block: 1000, state: s({ 5: 2, 6: '0x' + 'ab'.repeat(32) }), prevState: s({ 5: 1 }) }));
    expect(ok.success).toBe(true);

    const wrongAction = run(script, ctx({ block: 1000, state: s({ 5: 2, 6: '0x' + 'cd'.repeat(32) }), prevState: s({ 5: 1 }) }));
    expect(wrongAction.success).toBe(false);
  });

  it('usage tracking enforces count and amount caps', () => {
    const script = buildUsageTrackingScript({
      maxCount: 5n,
      maxAmount: '100',
      windowBlocks: 100n,
      countPort: 1,
      amountPort: 2,
      windowEndPort: 3,
    });
    const ok = run(script, ctx({ block: 1000, state: s({ 1: 3, 2: 50, 3: 1100, 10: 2 }), prevState: s({ 1: 2, 2: 40, 10: 1 }) }));
    expect(ok.success).toBe(true);

    const overCount = run(script, ctx({ block: 1000, state: s({ 1: 6, 2: 50, 3: 1100, 10: 2 }), prevState: s({ 1: 2, 2: 40, 10: 1 }) }));
    expect(overCount.success).toBe(false);
  });
});

describe('stable template: agent-policy', () => {
  it('payment intent enforces the risk limit and recipient', () => {
    const script = buildPaymentIntentScript({
      riskLimit: '100',
      allowedRecipient: pkBB,
      expiresAt: 2000n,
    });
    const ok = run(script, ctx({ block: 1000, state: s({ 20: 50, 21: '0x' + pkBB }) }));
    expect(ok.success).toBe(true);

    const overLimit = run(script, ctx({ block: 1000, state: s({ 20: 150, 21: '0x' + pkBB }) }));
    expect(overLimit.success).toBe(false);

    const wrongRecipient = run(script, ctx({ block: 1000, state: s({ 20: 50, 21: '0x' + pkAA }) }));
    expect(wrongRecipient.success).toBe(false);
  });

  it('agent proposal enforces the allowed transition table', () => {
    const script = buildAgentProposalScript({
      minConfidence: 0,
      allowedTransitions: { 0: ['1'], 1: ['2'] },
      expiresAt: 2000n,
    });
    const ok = run(script, ctx({ block: 1000, state: s({ 20: 1, 21: 0 }), prevState: s({ 20: 0 }) }));
    expect(ok.success).toBe(true);

    const bad = run(script, ctx({ block: 1000, state: s({ 20: 2, 21: 0 }), prevState: s({ 20: 0 }) }));
    expect(bad.success).toBe(false);
  });

  it('policy enforcement requires the policy signature', () => {
    const script = buildPolicyEnforcementScript({
      authorityPk: pkAA,
      riskThreshold: '50',
      policyRules: [hx('rule-1')],
      expiresAt: 2000n,
    });
    const ok = run(script, ctx({ block: 1000, state: s({ 20: 10, 21: '0x' + hx('rule-1') }) }), { [pkAA]: 'policy' });
    expect(ok.success).toBe(true);
    const noSig = run(script, ctx({ block: 1000, state: s({ 20: 10, 21: '0x' + hx('rule-1') }) }), {});
    expect(noSig.success).toBe(false);
  });
});

describe('stable template: lookup-protocol', () => {
  it('lease message requires the lease authority signature', () => {
    const script = buildLeaseMessageScript({ leaseId: hx('lease-1'), treeId: hx('tree-1'), authorityPk: pkAA, maxTtlBlocks: 100n });
    const ok = run(script, ctx({ state: s({ 0: '0x' + hx('tree-1'), 1: '0x' + hx('lease-1') }) }), { [pkAA]: 'authority' });
    expect(ok.success).toBe(true);
    const noSig = run(script, ctx({ state: s({ 0: '0x' + hx('tree-1'), 1: '0x' + hx('lease-1') }) }), {});
    expect(noSig.success).toBe(false);
  });

  it('coin update requires the authority signature and confirmations', () => {
    const script = buildCoinUpdateScript({
      coinId: 'ab'.repeat(32),
      tokenId: '00',
      authorityPk: pkAA,
      statePort: 1,
      blockWindowPort: 2,
      minConfirmations: 10n,
    });
    const ok = run(script, ctx({
      block: 1000,
      state: s({ 0: '0x' + 'ab'.repeat(32), 1: 1 }),
      prevState: s({ 1: 0, 2: 900 }),
      outputs: [outputTo('0xAA', 100, true)],
    }), { [pkAA]: 'authority' });
    expect(ok.success).toBe(true);
    const noSig = run(script, ctx({
      block: 1000,
      state: s({ 0: '0x' + 'ab'.repeat(32), 1: 1 }),
      prevState: s({ 1: 0, 2: 900 }),
      outputs: [outputTo('0xAA', 100, true)],
    }), {});
    expect(noSig.success).toBe(false);
  });

  it('trust message requires the authority signature and rating bounds', () => {
    const script = buildTrustMessageScript({
      trustId: hx('trust-1'),
      subjectId: hx('subject-1'),
      subjectType: hx('device'),
      authorityPk: pkAA,
      maxRating: 5,
      expiryWindow: 100n,
    });
    const ok = run(script, ctx({
      block: 1000,
      state: s({ 0: '0x' + hx('subject-1'), 1: '0x' + hx('device'), 2: 4 }),
      prevState: s({ 3: 950 }),
    }), { [pkAA]: 'authority' });
    expect(ok.success).toBe(true);

    const overRating = run(script, ctx({
      block: 1000,
      state: s({ 0: '0x' + hx('subject-1'), 1: '0x' + hx('device'), 2: 9 }),
      prevState: s({ 3: 950 }),
    }), { [pkAA]: 'authority' });
    expect(overRating.success).toBe(false);
  });
});

describe('stable template: proof', () => {
  const proofCfg = {
    authorityPk: pkAA,
    expiresAt: 2000n,
    anchorBlock: 100n,
    proofKind: 'capability' as const,
    confirmedAtPort: 1,
  };

  it('proof anchor requires the authority signature and confirmation', () => {
    const script = buildProofAnchorScript(proofCfg);
    const ok = run(script, ctx({ block: 1000, state: s({ 1: 500 }) }), { [pkAA]: 'authority' });
    expect(ok.success).toBe(true);
    const noSig = run(script, ctx({ block: 1000, state: s({ 1: 500 }) }), {});
    expect(noSig.success).toBe(false);
    const tooEarly = run(script, ctx({ block: 1000, state: s({ 1: 50 }) }), { [pkAA]: 'authority' });
    expect(tooEarly.success).toBe(false);
  });

  it('capability proof requires the capability kind', () => {
    const script = buildCapabilityProofScript(proofCfg);
    const ok = run(script, ctx({ block: 1000, state: s({ 0: '0x6361706162696c697479', 1: 'scope' }), prevState: s({ 1: 'scope' }) }), { [pkAA]: 'authority' });
    expect(ok.success).toBe(true);
    const wrongKind = run(script, ctx({ block: 1000, state: s({ 0: '0x00', 1: 'scope' }), prevState: s({ 1: 'scope' }) }), { [pkAA]: 'authority' });
    expect(wrongKind.success).toBe(false);
  });

  it('revocation proof requires the revocation epoch', () => {
    const script = buildRevocationProofScript(proofCfg);
    const ok = run(script, ctx({ block: 1000, state: s({ 0: 100, 1: 0, 2: 0 }), prevState: s({ 0: 100, 1: 0, 2: 0 }) }), { [pkAA]: 'authority' });
    expect(ok.success).toBe(true);
    const wrongEpoch = run(script, ctx({ block: 1000, state: s({ 0: 200, 1: 0, 2: 0 }), prevState: s({ 0: 200, 1: 0, 2: 0 }) }), { [pkAA]: 'authority' });
    expect(wrongEpoch.success).toBe(false);
  });

  it('proof delegation requires both signatures', () => {
    const script = buildProofDelegationScript(proofCfg);
    const ok = run(script, ctx({ block: 1000, state: s({ 0: pkAA, 1: pkBB }) }), { [pkAA]: 'delegator', [pkBB]: 'delegate' });
    expect(ok.success).toBe(true);
    const oneSig = run(script, ctx({ block: 1000, state: s({ 0: pkAA, 1: pkBB }) }), { [pkAA]: 'delegator' });
    expect(oneSig.success).toBe(false);
  });
});

describe('stable template: industrial-action', () => {
  it('commit script enforces the commitment hash and nonce', () => {
    const script = buildCommitScript({ committedHash: 'ab'.repeat(32), commitmentPort: 1, noncePort: 2 });
    const ok = run(script, ctx({ state: s({ 1: '0x' + 'ab'.repeat(32), 2: 5 }), prevState: s({ 2: 4 }) }));
    expect(ok.success).toBe(true);
    const wrongHash = run(script, ctx({ state: s({ 1: '0x' + 'cd'.repeat(32), 2: 5 }), prevState: s({ 2: 4 }) }));
    expect(wrongHash.success).toBe(false);
  });

  it('reveal script enforces SHA3(preimage) == committed', () => {
    const preimage = '0x' + 'ab'.repeat(32);
    const committed = sha3Hex('ab'.repeat(32));
    const script = buildRevealScript({ preimagePort: 1, commitmentPort: 2 });
    const ok = run(script, ctx({
      state: s({ 1: preimage }),
      prevState: s({ 1: preimage, 2: '0x' + committed }),
    }));
    expect(ok.success).toBe(true);
    const wrong = run(script, ctx({
      state: s({ 1: '0x' + 'cd'.repeat(32) }),
      prevState: s({ 1: '0x' + 'cd'.repeat(32), 2: '0x' + committed }),
    }));
    expect(wrong.success).toBe(false);
  });

  it('action state machine enforces the transition table', () => {
    const script = buildActionStateMachineScript({
      minNoticeBlocks: 10n,
      maxDurationBlocks: 100n,
      authorityPk: pkAA,
      noticePort: 1,
      durationPort: 2,
    });
    const ok = run(script, ctx({
      block: 1000,
      state: s({ 0: IA_STATUS.NOTICED, 1: 1000 }),
      prevState: s({ 0: IA_STATUS.PROPOSED }),
    }));
    expect(ok.success).toBe(true);

    const bad = run(script, ctx({
      block: 1000,
      state: s({ 0: IA_STATUS.ACTIVE, 1: 1000 }),
      prevState: s({ 0: IA_STATUS.PROPOSED }),
    }));
    expect(bad.success).toBe(false);
  });

  it('escrow enforcement enforces the condition hash and amount', () => {
    const script = buildEscrowEnforcementScript({ conditionHash: 'ab'.repeat(32), amount: '100', conditionPort: 1, amountPort: 2 });
    const ok = run(script, ctx({
      state: s({ 1: '0x' + 'ab'.repeat(32), 2: 100 }),
      prevState: s({ 1: '0x' + 'ab'.repeat(32), 2: 100 }),
    }));
    expect(ok.success).toBe(true);
    const wrongAmount = run(script, ctx({
      state: s({ 1: '0x' + 'ab'.repeat(32), 2: 200 }),
      prevState: s({ 1: '0x' + 'ab'.repeat(32), 2: 200 }),
    }));
    expect(wrongAmount.success).toBe(false);
  });
});

describe('stable template: liquidity-bond', () => {
  const cfg = {
    providerPk: pkAA,
    amount: '100',
    tokenId: '00',
    unlockBlock: 500n,
  };

  it('liquidity lock requires the provider signature and unlock block', () => {
    const script = buildLiquidityLockScript(cfg);
    const ok = run(script, ctx({
      block: 1000,
      state: s({ 0: 100, 1: 500, 2: POSITION_STATUS.ACTIVE }),
      outputs: [outputTo('0xAA', 100, true)],
    }), { [pkAA]: 'provider' });
    expect(ok.success).toBe(true);

    const beforeUnlock = run(script, ctx({
      block: 400,
      state: s({ 0: 100, 1: 500, 2: POSITION_STATUS.ACTIVE }),
      outputs: [outputTo('0xAA', 100, true)],
    }), { [pkAA]: 'provider' });
    expect(beforeUnlock.success).toBe(false);
  });

  it('fee accrual enforces the window and claimable amount', () => {
    const script = buildFeeAccrualScript(cfg);
    const ok = run(script, ctx({
      block: 1000,
      inputs: [coin(5)],
      state: s({ 10: 900, 11: 1100, 13: 10, 3: pkBB }),
      prevState: s({ 10: 900, 12: 0 }),
      outputs: [outputTo(pkBB, 5, true)],
    }));
    expect(ok.success).toBe(true);

    const outsideWindow = run(script, ctx({
      block: 1200,
      inputs: [coin(5)],
      state: s({ 10: 900, 11: 1100, 13: 10, 3: pkBB }),
      prevState: s({ 10: 900, 12: 0 }),
      outputs: [outputTo(pkBB, 5, true)],
    }));
    expect(outsideWindow.success).toBe(false);
  });

  it('withdrawal requires quiescing/active status and provider signature', () => {
    const script = buildWithdrawalScript(cfg);
    const ok = run(script, ctx({
      block: 1000,
      state: s({ 0: 100, 1: 500, 2: POSITION_STATUS.QUIESCING, 3: pkBB, 4: 1 }),
      prevState: s({ 3: pkBB, 4: 0 }),
      outputs: [outputTo('0xAA', 100, true)],
    }), { [pkAA]: 'provider' });
    expect(ok.success).toBe(true);

    const locked = run(script, ctx({
      block: 1000,
      state: s({ 0: 100, 1: 500, 2: POSITION_STATUS.COMMITTED, 3: pkBB, 4: 1 }),
      prevState: s({ 3: pkBB, 4: 0 }),
      outputs: [outputTo('0xAA', 100, true)],
    }), { [pkAA]: 'provider' });
    expect(locked.success).toBe(false);
  });

  it('position state machine enforces the lifecycle', () => {
    const script = buildPositionStateMachineScript({ governancePk: pkAA });
    const ok = run(script, ctx({
      state: s({ 0: POSITION_STATUS.ACTIVE }),
      prevState: s({ 0: POSITION_STATUS.COMMITTED }),
    }));
    expect(ok.success).toBe(true);

    const bad = run(script, ctx({
      state: s({ 0: POSITION_STATUS.WITHDRAWN }),
      prevState: s({ 0: POSITION_STATUS.DRAFT }),
    }));
    expect(bad.success).toBe(false);
  });
});

describe('stable template: provider-bond', () => {
  const cfg = {
    providerPk: pkAA,
    amount: '100',
    tokenId: '00',
    expiresAtBlock: 2000n,
    cliffBlock: 500n,
    bondPort: 1,
    expiryPort: 2,
    heartbeatPort: 3,
    slaPort: 4,
    governancePk: pkBB,
    maxHeartbeatBlocks: 100n,
    unbondingDurationBlocks: 100n,
    releaseRequestPort: 7,
    claimedPort: 8,
    challengeDeadlineBlock: 3000n,
  };

  it('bond lockup enforces amount, cliff, expiry, and provider signature', () => {
    const script = buildBondLockupScript(cfg);
    const ok = run(script, ctx({
      block: 1000,
      state: s({ 1: 100, 2: 2000, 5: BOND_STATUS.ACTIVE }),
      outputs: [outputTo('0xAA', 100, true)],
    }), { [pkAA]: 'provider' });
    expect(ok.success).toBe(true);

    const beforeCliff = run(script, ctx({
      block: 400,
      state: s({ 1: 100, 2: 2000, 5: BOND_STATUS.ACTIVE }),
      outputs: [outputTo('0xAA', 100, true)],
    }), { [pkAA]: 'provider' });
    expect(beforeCliff.success).toBe(false);
  });

  it('heartbeat enforces the max gap', () => {
    const script = buildHeartbeatScript(cfg);
    const ok = run(script, ctx({
      block: 1000,
      state: s({ 3: 1000 }),
      prevState: s({ 3: 950 }),
    }));
    expect(ok.success).toBe(true);

    const tooLate = run(script, ctx({
      block: 1000,
      state: s({ 3: 1000 }),
      prevState: s({ 3: 800 }),
    }));
    expect(tooLate.success).toBe(false);
  });

  it('bond state machine enforces the lifecycle', () => {
    const script = buildBondStateMachineScript(cfg);
    const ok = run(script, ctx({
      state: s({ 0: BOND_STATUS.PENDING }),
      prevState: s({ 0: BOND_STATUS.DECLARED }),
    }), { [pkBB]: 'governance' });
    expect(ok.success).toBe(true);

    const bad = run(script, ctx({
      state: s({ 0: BOND_STATUS.ACTIVE }),
      prevState: s({ 0: BOND_STATUS.DECLARED }),
    }), { [pkBB]: 'governance' });
    expect(bad.success).toBe(false);
  });

  it('bond release enforces unbonding duration and claimable amount', () => {
    const script = buildBondReleaseScript(cfg);
    const ok = run(script, ctx({
      block: 1000,
      state: s({ 5: BOND_STATUS.EXPIRING }),
      prevState: s({ 7: 900, 1: 100, 8: 0 }),
      outputs: [outputTo('0xAA', 100, true)],
    }), { [pkBB]: 'governance' });
    expect(ok.success).toBe(true);

    const noRequest = run(script, ctx({
      block: 1000,
      state: s({ 5: BOND_STATUS.EXPIRING }),
      prevState: s({ 7: 0, 1: 100, 8: 0 }),
      outputs: [outputTo('0xAA', 100, true)],
    }), { [pkBB]: 'governance' });
    expect(noRequest.success).toBe(false);
  });

  it('challenge enforces the dispute bond and adjudication deadline', () => {
    const script = buildChallengeScript({
      governancePk: pkBB,
      disputeBondAmount: '10',
      adjudicationBlocks: 100n,
      challengerRewardBps: 500,
      treasuryPk: pkAA,
    });
    const ok = run(script, ctx({
      block: 1000,
      inputs: [coin(10)],
      state: s({ 0: 1, 1: pkAA, 3: 1100 }),
      prevState: s({ 0: 0 }),
      outputs: [outputTo('0xAA', 10, true)],
    }), { [pkAA]: 'challenger' });
    expect(ok.success).toBe(true);

    const noBond = run(script, ctx({
      block: 1000,
      inputs: [coin(5)],
      state: s({ 0: 1, 1: pkAA, 3: 1100 }),
      prevState: s({ 0: 0 }),
      outputs: [outputTo('0xAA', 5, true)],
    }), { [pkAA]: 'challenger' });
    expect(noBond.success).toBe(false);
  });
});
