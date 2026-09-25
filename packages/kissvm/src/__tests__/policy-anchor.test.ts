/**
 * Adversarial tests for the fail-closed Policy Anchor builder.
 *
 * These tests exercise the anchor script through the real KISSVM evaluator
 * using the legacy `mastBranches` fallback (no MMR proofs required) so the
 * focus stays on anchor-level authorization logic. Every committed root maps
 * to a trivial `RETURN TRUE` branch, so a spend only succeeds when the anchor
 * itself admits it.
 */

import {
  evaluateScript,
  buildPolicyAnchorScript,
  validatePolicyAnchorConfig,
} from '../index';
import type { ScriptWitness, TxContext, CoinData, OutputData, PolicyAnchorConfig } from '../index';

const PORTS = {
  regulatorRoot: 10,
  ownerRoot: 11,
  serviceProviderRoot: 12,
  firmwareApprovalRoot: 13,
  epoch: 14,
  manifestHash: 15,
  recoveryRoot: 16,
  emergencyRoot: 17,
  actionRoot: 18,
} as const;

const ROOTS = {
  reg: '0x' + '11'.repeat(32),
  owner: '0x' + '22'.repeat(32),
  sp: '0x' + '33'.repeat(32),
  fw: '0x' + '44'.repeat(32),
  rec: '0x' + '55'.repeat(32),
  emg: '0x' + '66'.repeat(32),
  rogue: '0x' + '99'.repeat(32),
};

function config(overrides: Partial<PolicyAnchorConfig> = {}): PolicyAnchorConfig {
  return {
    subjectId: 'SUBJ-1',
    subjectType: 'machine',
    institutionalRoot: '0xinst',
    initialEpoch: 7,
    ports: { ...PORTS },
    ...overrides,
  };
}

function mkWitness(): ScriptWitness {
  return { signatures: new Map() };
}

function baseCtx(overrides: Partial<TxContext> = {}): TxContext {
  const coin: CoinData = { amount: 100, tokenId: '0x00', coinId: '0xabc', address: '0xdeadbeef' };
  const out: OutputData = { address: '0xdeadbeef', amount: 100, tokenId: '0x00', keepState: true };
  return {
    block: 500,
    inputIndex: 0,
    inputs: [coin],
    outputs: [out],
    state: {},
    prevState: {},
    simulationMode: true,
    ...overrides,
  };
}

function committed(
  stateOverrides: Record<number, string> = {},
  prevOverrides: Record<number, string> = {},
): { state: Record<number, string>; prevState: Record<number, string> } {
  const prev: Record<number, string> = {
    0: 'SUBJ-1',
    [PORTS.regulatorRoot]: ROOTS.reg,
    [PORTS.ownerRoot]: ROOTS.owner,
    [PORTS.serviceProviderRoot]: ROOTS.sp,
    [PORTS.firmwareApprovalRoot]: ROOTS.fw,
    [PORTS.recoveryRoot]: ROOTS.rec,
    [PORTS.emergencyRoot]: ROOTS.emg,
    [PORTS.epoch]: '7',
    [PORTS.manifestHash]: '0xmanifest',
  };
  return { state: { ...prev, ...stateOverrides }, prevState: { ...prev, ...prevOverrides } };
}

function allBranches(): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of Object.values(ROOTS)) m.set(r, 'RETURN TRUE');
  return m;
}

function run(scriptConfig: PolicyAnchorConfig, state: Record<number, string>, prevState: Record<number, string>, ctxOverrides: Partial<TxContext> = {}) {
  const ctx = baseCtx({ state, prevState, mastBranches: allBranches(), ...ctxOverrides });
  return evaluateScript(buildPolicyAnchorScript(scriptConfig), mkWitness(), ctx);
}

// ─── Config validation ────────────────────────────────────────────────────────

describe('validatePolicyAnchorConfig', () => {
  test('accepts the default configuration', () => {
    expect(() => validatePolicyAnchorConfig(config())).not.toThrow();
  });

  test('rejects duplicate ports', () => {
    const cfg = config();
    cfg.ports.ownerRoot = cfg.ports.regulatorRoot;
    expect(() => validatePolicyAnchorConfig(cfg)).toThrow(/collision/);
  });

  test('rejects reuse of the reserved subject port', () => {
    const cfg = config();
    cfg.ports.epoch = 0;
    expect(() => validatePolicyAnchorConfig(cfg)).toThrow(/reserved for the subject/);
  });

  test('rejects a non-integer or negative port', () => {
    const cfg = config();
    cfg.ports.epoch = -1;
    expect(() => validatePolicyAnchorConfig(cfg)).toThrow(/non-negative integer/);
  });

  test('rejects an action-argument port colliding with a committed port', () => {
    const cfg = config();
    // actionRoot + 1 === 19; move a committed root there to force a collision.
    cfg.ports.regulatorRoot = cfg.ports.actionRoot + 1;
    expect(() => validatePolicyAnchorConfig(cfg)).toThrow(/action-argument port/);
  });
});

// ─── Fail-closed action selection ─────────────────────────────────────────────

describe('fail-closed action selection', () => {
  test('rejects action types outside the enabled set', () => {
    for (const t of [5, 999, -1]) {
      const { state, prevState } = committed({ [PORTS.actionRoot]: String(t) });
      expect(run(config(), state, prevState).passed).toBe(false);
    }
  });

  test('rejects recovery (3) when no recovery root is configured', () => {
    const { state, prevState } = committed({ [PORTS.actionRoot]: '3' });
    expect(run(config(), state, prevState).passed).toBe(false);
  });

  test('rejects emergency (4) when no emergency root is configured', () => {
    const { state, prevState } = committed({ [PORTS.actionRoot]: '4' });
    expect(run(config(), state, prevState).passed).toBe(false);
  });

  test('the generated script carries an explicit whitelist and exact epoch rule', () => {
    const script = buildPolicyAnchorScript(config());
    expect(script).toContain('ASSERT actionType EQ 0 OR actionType EQ 1 OR actionType EQ 2');
    expect(script).toContain('ASSERT epoch EQ INC(prevEpoch)');
  });
});

// ─── Normal action branch ─────────────────────────────────────────────────────

describe('normal action branch (0)', () => {
  test('accepts a committed selected root with a preserved successor', () => {
    const { state, prevState } = committed({
      [PORTS.actionRoot]: '0',
      [PORTS.actionRoot + 1]: ROOTS.reg,
    });
    expect(run(config(), state, prevState).passed).toBe(true);
  });

  test('rejects a spender-supplied root that is not committed', () => {
    const { state, prevState } = committed({
      [PORTS.actionRoot]: '0',
      [PORTS.actionRoot + 1]: ROOTS.rogue,
    });
    expect(run(config(), state, prevState).passed).toBe(false);
  });

  test('rejects a changed manifest commitment', () => {
    const { state, prevState } = committed({
      [PORTS.actionRoot]: '0',
      [PORTS.actionRoot + 1]: ROOTS.reg,
      [PORTS.manifestHash]: '0xevil',
    });
    expect(run(config(), state, prevState).passed).toBe(false);
  });

  test('rejects an epoch change on a normal action', () => {
    const { state, prevState } = committed({
      [PORTS.actionRoot]: '0',
      [PORTS.actionRoot + 1]: ROOTS.reg,
      [PORTS.epoch]: '8',
    });
    expect(run(config(), state, prevState).passed).toBe(false);
  });

  test('rejects a changed non-selected root', () => {
    const { state, prevState } = committed({
      [PORTS.actionRoot]: '0',
      [PORTS.actionRoot + 1]: ROOTS.reg,
      [PORTS.ownerRoot]: ROOTS.rogue,
    });
    expect(run(config(), state, prevState).passed).toBe(false);
  });

  test('rejects a subject mismatch', () => {
    const { state, prevState } = committed({
      0: 'SUBJ-2',
      [PORTS.actionRoot]: '0',
      [PORTS.actionRoot + 1]: ROOTS.reg,
    });
    expect(run(config(), state, prevState).passed).toBe(false);
  });

  test('rejects a spend without the successor anchor output', () => {
    const { state, prevState } = committed({
      [PORTS.actionRoot]: '0',
      [PORTS.actionRoot + 1]: ROOTS.reg,
    });
    const ctx = baseCtx({ state, prevState, mastBranches: allBranches(), outputs: [] });
    expect(evaluateScript(buildPolicyAnchorScript(config()), mkWitness(), ctx).passed).toBe(false);
  });
});

// ─── Root rotation branch ─────────────────────────────────────────────────────

describe('root rotation branch (1)', () => {
  test('accepts rotating exactly one declared root', () => {
    const { state, prevState } = committed({
      [PORTS.actionRoot]: '1',
      [PORTS.actionRoot + 1]: String(PORTS.regulatorRoot),
      [PORTS.regulatorRoot]: ROOTS.rogue,
    });
    expect(run(config(), state, prevState).passed).toBe(true);
  });

  test('rejects rotating a port that is not a committed root port', () => {
    const { state, prevState } = committed({
      [PORTS.actionRoot]: '1',
      [PORTS.actionRoot + 1]: String(PORTS.manifestHash),
    });
    expect(run(config(), state, prevState).passed).toBe(false);
  });

  test('rejects changing a second root alongside the declared one', () => {
    const { state, prevState } = committed({
      [PORTS.actionRoot]: '1',
      [PORTS.actionRoot + 1]: String(PORTS.regulatorRoot),
      [PORTS.regulatorRoot]: ROOTS.rogue,
      [PORTS.ownerRoot]: ROOTS.rogue,
    });
    expect(run(config(), state, prevState).passed).toBe(false);
  });

  test('rejects an epoch change during rotation', () => {
    const { state, prevState } = committed({
      [PORTS.actionRoot]: '1',
      [PORTS.actionRoot + 1]: String(PORTS.regulatorRoot),
      [PORTS.regulatorRoot]: ROOTS.rogue,
      [PORTS.epoch]: '8',
    });
    expect(run(config(), state, prevState).passed).toBe(false);
  });
});

// ─── Epoch advancement branch ─────────────────────────────────────────────────

describe('epoch advancement branch (2)', () => {
  test('accepts an exact +1 epoch advance with roots preserved', () => {
    const { state, prevState } = committed({
      [PORTS.actionRoot]: '2',
      [PORTS.epoch]: '8',
    });
    expect(run(config(), state, prevState).passed).toBe(true);
  });

  test('rejects a skipped epoch advance', () => {
    const { state, prevState } = committed({
      [PORTS.actionRoot]: '2',
      [PORTS.epoch]: '9',
    });
    expect(run(config(), state, prevState).passed).toBe(false);
  });

  test('rejects a non-advancing epoch', () => {
    const { state, prevState } = committed({
      [PORTS.actionRoot]: '2',
      [PORTS.epoch]: '7',
    });
    expect(run(config(), state, prevState).passed).toBe(false);
  });

  test('rejects a root change during epoch advancement', () => {
    const { state, prevState } = committed({
      [PORTS.actionRoot]: '2',
      [PORTS.epoch]: '8',
      [PORTS.regulatorRoot]: ROOTS.rogue,
    });
    expect(run(config(), state, prevState).passed).toBe(false);
  });
});

// ─── Recovery / emergency branches ────────────────────────────────────────────

describe('recovery and emergency branches', () => {
  test('accepts recovery when the committed recovery root is configured', () => {
    const { state, prevState } = committed({ [PORTS.actionRoot]: '3' });
    expect(run(config({ recoveryRoot: ROOTS.rec }), state, prevState).passed).toBe(true);
  });

  test('accepts emergency when the committed emergency root is configured', () => {
    const { state, prevState } = committed({ [PORTS.actionRoot]: '4' });
    expect(run(config({ emergencyRoot: ROOTS.emg }), state, prevState).passed).toBe(true);
  });

  test('rejects recovery when the committed recovery root is unset', () => {
    const { state, prevState } = committed({ [PORTS.actionRoot]: '3' });
    prevState[PORTS.recoveryRoot] = '0x00';
    state[PORTS.recoveryRoot] = '0x00';
    expect(run(config({ recoveryRoot: ROOTS.rec }), state, prevState).passed).toBe(false);
  });
});
