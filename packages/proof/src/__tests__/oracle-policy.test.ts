/**
 * Oracle observation policy / quorum / aggregation (RFC-048 §3.1, OMP-18).
 */
import {
  ORACLE_OBSERVATION_DOMAIN,
  applyOraclePolicy,
  medianAtoms,
} from '../oracle-policy.js';
import type { OracleObservationV1, OraclePolicy } from '../oracle-policy.js';

const NOW = 1_700_000_000_000;

function obs(over: Partial<OracleObservationV1> = {}): OracleObservationV1 {
  return {
    domain: ORACLE_OBSERVATION_DOMAIN,
    feedId: 'minima/usdt:spot',
    publisherId: 'pubA',
    subjectId: 'MINIMA/USDT',
    valueAtoms: '1000',
    scale: 0,
    unit: 'usd',
    observedAtMs: NOW - 1000,
    validUntilMs: NOW + 60_000,
    sequence: '1',
    contextHash: '0xctx',
    evidenceHash: '0xev',
    ...over,
  };
}

function policy(over: Partial<OraclePolicy> = {}): OraclePolicy {
  return {
    feedId: 'minima/usdt:spot',
    unit: 'usd',
    scale: 0,
    authorizedPublishers: ['pubA', 'pubB', 'pubC'],
    minQuorum: 3,
    aggregation: 'median',
    maxAgeMs: 60_000,
    maxFutureDriftMs: 5_000,
    maxDeviationBps: 100,
    ...over,
  };
}

describe('medianAtoms', () => {
  it('returns the median (lower-middle for even counts)', () => {
    expect(medianAtoms([1000n, 3000n, 2000n])).toBe(2000n);
    expect(medianAtoms([1000n, 2000n])).toBe(1000n);
  });
});

describe('applyOraclePolicy', () => {
  it('accepts a quorum of independent sources within the band', () => {
    const r = applyOraclePolicy(
      [obs({ publisherId: 'pubA', sourceId: 's1', valueAtoms: '1000', sequence: '1' }),
       obs({ publisherId: 'pubB', sourceId: 's2', valueAtoms: '1005', sequence: '2' }),
       obs({ publisherId: 'pubC', sourceId: 's3', valueAtoms: '995', sequence: '3' })],
      policy(),
      NOW,
    );
    expect(r.accepted).toBe(true);
    if (r.accepted) {
      expect(r.set.valueAtoms).toBe('1000');
      expect(r.set.aggregationMethod).toBe('median');
      expect(r.set.status).toBe('accepted');
    }
  });

  it('fails closed on domain separation', () => {
    const r = applyOraclePolicy([obs({ domain: 'evil' as never })], policy({ minQuorum: 1 }), NOW);
    expect(r.accepted).toBe(false);
  });

  it('fails closed on an untrusted publisher', () => {
    const r = applyOraclePolicy([obs({ publisherId: 'pubX' })], policy({ minQuorum: 1 }), NOW);
    expect(r.accepted).toBe(false);
  });

  it('fails closed on a stale observation', () => {
    const r = applyOraclePolicy([obs({ observedAtMs: NOW - 120_000 })], policy({ minQuorum: 1 }), NOW);
    expect(r.accepted).toBe(false);
  });

  it('fails closed on future drift', () => {
    const r = applyOraclePolicy([obs({ observedAtMs: NOW + 60_000 })], policy({ minQuorum: 1 }), NOW);
    expect(r.accepted).toBe(false);
  });

  it('fails closed on a schema (unit/scale) mismatch', () => {
    const r = applyOraclePolicy([obs({ unit: 'eur' })], policy({ minQuorum: 1 }), NOW);
    expect(r.accepted).toBe(false);
  });

  it('fails closed on missing evidence binding', () => {
    const r = applyOraclePolicy([obs({ evidenceHash: '' })], policy({ minQuorum: 1 }), NOW);
    expect(r.accepted).toBe(false);
  });

  it('fails closed when the quorum is not met (one API is one source)', () => {
    // Three signatures, but all from the same upstream source → one independent source.
    const r = applyOraclePolicy(
      [obs({ publisherId: 'pubA', sourceId: 's1', sequence: '1' }),
       obs({ publisherId: 'pubB', sourceId: 's1', sequence: '2' }),
       obs({ publisherId: 'pubC', sourceId: 's1', sequence: '3' })],
      policy(),
      NOW,
    );
    expect(r.accepted).toBe(false);
  });

  it('fails closed on a non-monotone sequence', () => {
    const r = applyOraclePolicy(
      [obs({ publisherId: 'pubA', sourceId: 's1', sequence: '5' }),
       obs({ publisherId: 'pubA', sourceId: 's2', sequence: '4' })],
      policy({ minQuorum: 1 }),
      NOW,
    );
    expect(r.accepted).toBe(false);
  });

  it('freezes on disagreement beyond the deviation band', () => {
    const r = applyOraclePolicy(
      [obs({ publisherId: 'pubA', sourceId: 's1', valueAtoms: '1000', sequence: '1' }),
       obs({ publisherId: 'pubB', sourceId: 's2', valueAtoms: '1000', sequence: '2' }),
       obs({ publisherId: 'pubC', sourceId: 's3', valueAtoms: '2000', sequence: '3' })],
      policy(),
      NOW,
    );
    expect(r.accepted).toBe(false);
  });

  it('threshold-agreement accepts when enough sources agree', () => {
    const r = applyOraclePolicy(
      [obs({ publisherId: 'pubA', sourceId: 's1', valueAtoms: '1000', sequence: '1' }),
       obs({ publisherId: 'pubB', sourceId: 's2', valueAtoms: '1001', sequence: '2' }),
       obs({ publisherId: 'pubC', sourceId: 's3', valueAtoms: '1300', sequence: '3' })],
      policy({ aggregation: 'threshold-agreement', agreementBps: 6000 }),
      NOW,
    );
    expect(r.accepted).toBe(true);
  });
});
