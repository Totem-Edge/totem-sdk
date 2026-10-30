/**
 * RFC-020 P2-7: experimental template correctness.
 *   - firmware-update / channel-factory: checks precede the terminal MAST
 *   - multi-jurisdiction: fails closed on an unrecognised jurisdiction
 *   - state-machine workflow: expressions reference defined locals
 */

import { buildFirmwareUpdateScript } from '../templates/firmware-update.js';
import { buildChannelFactoryScript } from '../templates/payment-channel.js';
import { buildMultiJurisdictionScript } from '../templates/legal.js';
import { buildStateMachineWorkflow } from '../templates/state-machine.js';

const pkA = 'aa'.repeat(32);
const pkB = 'bb'.repeat(32);

describe('RFC-020 P2-7: firmware / channel checks precede the terminal MAST', () => {
  it('firmware-update verifies the output before MAST and has no dead RETURN', () => {
    const script = buildFirmwareUpdateScript({
      versionPort: 0,
      hashPort: 1,
      manufacturerPort: 2,
      manufacturerPkd: pkA,
      ownerPkd: pkB,
      policyRoot: 'cc'.repeat(32),
      updateProof: 'dd',
    });
    expect(script.indexOf('ASSERT VERIFYOUT')).toBeLessThan(script.lastIndexOf('MAST 0x'));
    expect(script).not.toMatch(/MAST 0x[0-9a-f]+[^\n]*\n\s*RETURN/i);
    // RFC-020 P2-14: the manufacturer port is bound.
    expect(script).toContain('ASSERT STATE(2) EQ manufacturer');
  });

  it('channel factory verifies the output before MAST and has no dead RETURN', () => {
    const script = buildChannelFactoryScript([pkA], 'ab'.repeat(32), 'cd');
    expect(script.indexOf('ASSERT VERIFYOUT')).toBeLessThan(script.lastIndexOf('MAST 0x'));
    expect(script).not.toMatch(/MAST 0x[0-9a-f]+[^\n]*\n\s*RETURN/i);
  });
});

describe('RFC-020 P2-7: multi-jurisdiction fails closed', () => {
  const base = {
    instrumentId: 'instr-1',
    instrumentType: 'judgment' as const,
    homeJurisdiction: 'HOME',
    recognitionPort: 10,
    enforcementPort: 20,
    issueBlock: 0,
  };

  it('rejects a jurisdiction with no authority key', () => {
    expect(() =>
      buildMultiJurisdictionScript(pkA, {
        ...base,
        foreignJurisdictions: ['A', 'B'],
        foreignAuthorityPkds: [pkB],
      }),
    ).toThrow(/authority key|requires an authority/i);
  });

  it('rejects a zero authority key', () => {
    expect(() =>
      buildMultiJurisdictionScript(pkA, {
        ...base,
        foreignJurisdictions: ['A'],
        foreignAuthorityPkds: ['0x00'],
      }),
    ).toThrow(/authority key/i);
  });

  it('fails closed on an out-of-domain recognition flag', () => {
    const layer = buildMultiJurisdictionScript(pkA, {
      ...base,
      foreignJurisdictions: ['A'],
      foreignAuthorityPkds: [pkB],
    });
    expect(layer.script).toContain('EQ 0 OR STATE(10) EQ 1');
  });
});

describe('RFC-020 P2-7: state-machine workflow expressions', () => {
  it('references generated locals, not undefined identifiers', () => {
    const workflow = buildStateMachineWorkflow({
      id: 'sm',
      name: 'SM',
      statePort: 0,
      states: ['OFF', 'ON'],
      transitions: { OFF: ['ON'], ON: ['OFF'] },
      initialState: 'OFF',
      operatorPkd: pkA,
    });
    expect(workflow.script).toContain('curr_state');
    expect(workflow.script).not.toContain('newState');
  });
});
