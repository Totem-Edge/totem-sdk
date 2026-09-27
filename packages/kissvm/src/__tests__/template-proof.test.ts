/**
 * RFC-016: template PROOF leaf preimages must be the authorizing *script*
 * (rendered as a Minima SCRIPT literal `[ … ]`), not the subject key bytes.
 * Each test compiles a MAST root from the leaf script the template commits to,
 * then evaluates the template's emitted `ASSERT PROOF( … )` line against that
 * root — it must pass.
 */
import { evaluateScript } from '../index';
import type { TxContext } from '../index';
import { compileMastTree } from '../mast/mast-compiler';
import { buildSensorProofScript } from '../templates/sensor-proof.js';
import { buildFirmwareUpdateScript, buildMultiSigFirmwareUpdateScript } from '../templates/firmware-update.js';
import { buildIdentityVerificationScript, buildDelegationProofScript } from '../templates/identity.js';
import { buildChannelFactoryScript } from '../templates/payment-channel.js';

const pkd = 'aa'.repeat(32);

function ctx(state: Record<number, string> = {}, prevState: Record<number, string> = {}): TxContext {
  return {
    block: 500,
    inputIndex: 0,
    inputs: [{ amount: 100, tokenId: '0x00', coinId: '0xabc', address: '0xdeadbeef' }],
    outputs: [{ address: '0xdeadbeef', amount: 100, tokenId: '0x00', keepState: false }],
    state,
    prevState,
    simulationMode: true,
  };
}

function proofLine(script: string): string {
  const line = script.split('\n').find(l => l.includes('ASSERT PROOF('));
  if (!line) throw new Error('no PROOF line found');
  return line.trim();
}

function evalLine(line: string, state: Record<number, string> = {}): boolean {
  return evaluateScript(`${line} RETURN TRUE`, { signatures: new Map() }, ctx(state)).passed;
}

describe('RFC-016: template PROOF leaf preimages are the authorizing script', () => {
  it('sensor-proof proves the device leaf script, and MASTs the policy root', () => {
    const leaf = `ASSERT SIGNEDBY(0x${pkd}) RETURN TRUE`;
    const mast = compileMastTree([leaf]);
    const script = buildSensorProofScript({
      deviceId: 'dev-1', devicePkd: pkd, policyRoot: mast.rootHex,
      deviceProof: mast.scripts[0].proofHex, maxAgeSeconds: 60,
    });
    expect(script).toContain(`ASSERT PROOF([${leaf}] 0 0x${mast.rootHex} 0 0x${mast.scripts[0].proofHex})`);
    expect(script).toContain(`MAST 0x${mast.rootHex}`);
    expect(script).not.toContain('PROOF(0x');
    expect(evalLine(proofLine(script))).toBe(true);
  });

  it('firmware-update proves the owner leaf script, and MASTs the policy root', () => {
    const leaf = `ASSERT SIGNEDBY(0x${pkd}) RETURN TRUE`;
    const mast = compileMastTree([leaf]);
    const script = buildFirmwareUpdateScript({
      versionPort: 0, hashPort: 1, manufacturerPort: 2, manufacturerPkd: 'bb'.repeat(32),
      ownerPkd: pkd, policyRoot: mast.rootHex, updateProof: mast.scripts[0].proofHex,
    });
    expect(script).toContain(`ASSERT PROOF([${leaf}] 0 0x${mast.rootHex} 0 0x${mast.scripts[0].proofHex})`);
    expect(script).toContain(`MAST 0x${mast.rootHex}`);
    expect(script).not.toContain(`MAST 0x${pkd}`);
    expect(script).not.toContain('PROOF(0x');
    expect(evalLine(proofLine(script))).toBe(true);
  });

  it('multi-sig firmware-update proves the owner leaf script', () => {
    const leaf = `ASSERT SIGNEDBY(0x${pkd}) RETURN TRUE`;
    const mast = compileMastTree([leaf]);
    const script = buildMultiSigFirmwareUpdateScript(
      ['cc'.repeat(32), 'dd'.repeat(32)], 2, 0, 1, pkd, mast.rootHex, mast.scripts[0].proofHex,
    );
    expect(script).toContain(`ASSERT PROOF([${leaf}] 0 0x${mast.rootHex} 0 0x${mast.scripts[0].proofHex})`);
    expect(script).toContain(`MAST 0x${mast.rootHex}`);
    expect(evalLine(proofLine(script))).toBe(true);
  });

  it('identity verification proves the identity leaf script (proof supplied via STATE(3))', () => {
    const leaf = `ASSERT SIGNEDBY(0x${pkd}) RETURN TRUE`;
    const mast = compileMastTree([leaf]);
    const script = buildIdentityVerificationScript({
      identityPk: pkd, claimHash: 'ab'.repeat(32), policyRoot: mast.rootHex,
    });
    expect(script).toContain(`ASSERT PROOF([${leaf}] 0 0x${mast.rootHex} 0 STATE(3))`);
    expect(script).not.toContain('PROOF(identityPk');
    expect(evalLine(proofLine(script), { 3: `0x${mast.scripts[0].proofHex}` })).toBe(true);
  });

  it('delegation proof proves the delegate leaf script', () => {
    const leaf = `ASSERT SIGNEDBY(0x${pkd}) RETURN TRUE`;
    const mast = compileMastTree([leaf]);
    const script = buildDelegationProofScript({
      delegatorPk: 'ee'.repeat(32), delegatePk: pkd, delegationRoot: mast.rootHex,
    });
    expect(script).toContain(`ASSERT PROOF([${leaf}] 0 0x${mast.rootHex} 0 STATE(3))`);
    expect(evalLine(proofLine(script), { 3: `0x${mast.scripts[0].proofHex}` })).toBe(true);
  });

  it('channel factory MASTs the policy root (not the zero hash)', () => {
    const script = buildChannelFactoryScript([pkd], 'ab'.repeat(32), 'cd'.repeat(32));
    expect(script).toContain(`MAST 0x${'ab'.repeat(32)}`);
    expect(script).not.toContain(`MAST 0x${'0'.repeat(64)}`);
  });
});
