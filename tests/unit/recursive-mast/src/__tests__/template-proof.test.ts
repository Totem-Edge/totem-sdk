/**
 * RFC-016: the recursive-mast template mirrors must emit PROOF leaf preimages
 * as the authorizing *script* (Minima SCRIPT literal `[ … ]`), and MAST must
 * target the policy root. Verified by evaluating the emitted PROOF line against
 * a MAST root compiled from that leaf.
 */
import { evaluateScript } from '@totemsdk/kissvm';
import type { TxContext } from '@totemsdk/kissvm';
import { compileMastTree } from '@totemsdk/kissvm';
import { buildProofChain, verifyProofChain } from '../proof-chain.js';
import { buildAccessControlScript } from '../templates/access-control.js';
import { buildIdentityVerificationScript } from '../templates/identity-verification.js';
import { buildSensorProofScript, buildSensorFleetPolicy, buildSensorProofChain } from '../templates/sensor-proof.js';
import { buildFirmwareUpdateScript } from '../templates/firmware-update.js';
import { buildChannelFactoryScript, buildPaymentChannelScript } from '../templates/payment-channel.js';

const pkd = 'aa'.repeat(32);

function ctx(): TxContext {
  return {
    block: 500,
    inputIndex: 0,
    inputs: [{ amount: 100, tokenId: '0x00', coinId: '0xabc', address: '0xdeadbeef' }],
    outputs: [{ address: '0xdeadbeef', amount: 100, tokenId: '0x00', keepState: false }],
    state: {},
    prevState: {},
    simulationMode: true,
  };
}

function proofLine(script: string): string {
  const line = script.split('\n').find(l => l.includes('ASSERT PROOF('));
  if (!line) throw new Error('no PROOF line found');
  return line.trim();
}

function evalLine(line: string): boolean {
  return evaluateScript(`${line} RETURN TRUE`, { signatures: new Map() }, ctx()).passed;
}

describe('RFC-016: recursive-mast template PROOF leaf preimages', () => {
  it('access-control proves the operator leaf script', () => {
    const leaf = `ASSERT SIGNEDBY(0x${pkd}) RETURN TRUE`;
    const mast = compileMastTree([leaf]);
    const script = buildAccessControlScript({
      operatorPkd: pkd, action: 'read', target: 'valve-1', policyRoot: mast.rootHex,
      operatorProof: mast.scripts[0].proofHex, scopes: ['read'],
    });
    expect(script).toContain(`ASSERT PROOF([${leaf}] 0 0x${mast.rootHex} 0 0x${mast.scripts[0].proofHex})`);
    expect(script).not.toContain('PROOF(0x');
    expect(evalLine(proofLine(script))).toBe(true);
  });

  it('identity-verification proves the issuer leaf script', () => {
    const leaf = `ASSERT SIGNEDBY(0x${pkd}) RETURN TRUE`;
    const mast = compileMastTree([leaf]);
    const script = buildIdentityVerificationScript({
      documentId: 'doc-1', issuerPkd: pkd, subjectPkd: 'bb'.repeat(32),
      issuerPolicyRoot: mast.rootHex, issuerProof: mast.scripts[0].proofHex,
      revocationPort: 0, claims: {},
    });
    expect(script).toContain(`ASSERT PROOF([${leaf}] 0 0x${mast.rootHex} 0 0x${mast.scripts[0].proofHex})`);
    expect(evalLine(proofLine(script))).toBe(true);
  });

  it('sensor-proof proves the device leaf script and MASTs the root', () => {
    const leaf = `ASSERT SIGNEDBY(0x${pkd}) RETURN TRUE`;
    const mast = compileMastTree([leaf]);
    const script = buildSensorProofScript({
      deviceId: 'dev-1', devicePkd: pkd, policyRoot: mast.rootHex,
      deviceProof: mast.scripts[0].proofHex, maxAgeSeconds: 60, reading: '1', timestamp: 0, signature: 'aa',
    });
    expect(script).toContain(`MAST 0x${mast.rootHex}`);
    expect(script).not.toContain(`MAST 0x${pkd}`);
    expect(evalLine(proofLine(script))).toBe(true);
  });

  it('firmware-update proves the owner leaf script and MASTs the root', () => {
    const leaf = `ASSERT SIGNEDBY(0x${pkd}) RETURN TRUE`;
    const mast = compileMastTree([leaf]);
    const script = buildFirmwareUpdateScript({
      versionPort: 0, hashPort: 1, manufacturerPort: 2, manufacturerPkd: 'bb'.repeat(32),
      ownerPkd: pkd, policyRoot: mast.rootHex, updateProof: mast.scripts[0].proofHex,
    });
    expect(script).toContain(`MAST 0x${mast.rootHex}`);
    expect(script).not.toContain(`MAST 0x${pkd}`);
    expect(evalLine(proofLine(script))).toBe(true);
  });

  it('channel factory MASTs the policy root (not the zero hash)', () => {
    const script = buildChannelFactoryScript([pkd], 'ab'.repeat(32), 'cd'.repeat(32));
    expect(script).toContain(`MAST 0x${'ab'.repeat(32)}`);
    expect(script).not.toContain(`MAST 0x${'0'.repeat(64)}`);
  });

  it('sensor proof chain emits a real MMR proof that verifies', () => {
    const pkB = 'bb'.repeat(32);
    const fleet = buildSensorFleetPolicy([pkd, pkB], 'fleet');
    const chain = buildSensorProofChain(pkd, fleet, '42', 1700000000000);
    expect(chain).toHaveLength(1);
    const link = chain[0];
    expect(link.proof).not.toBe(link.scriptHash);
    expect(link.policyRoot).toBe(fleet.root.policyRoot);
    const built = buildProofChain(chain);
    expect(verifyProofChain(built).valid).toBe(true);
  });

  it('payment channel consumes channelProof when a leaf script is supplied', () => {
    const leaf = `ASSERT SIGNEDBY(0x${pkd}) RETURN TRUE`;
    const mast = compileMastTree([leaf]);
    const script = buildPaymentChannelScript({
      channelId: 'c1', partyAPkd: pkd, partyBPkd: 'bb'.repeat(32),
      sequencePort: 0, settlementPort: 1, policyRoot: mast.rootHex,
      channelProof: mast.scripts[0].proofHex, channelLeafScript: leaf,
    });
    expect(script).toContain(`ASSERT PROOF([${leaf}] 0 0x${mast.rootHex} 0 0x${mast.scripts[0].proofHex})`);
    expect(script.indexOf('ASSERT VERIFYOUT(@INPUT @ADDRESS')).toBeLessThan(script.lastIndexOf('MAST 0x'));
    expect(script.indexOf('ASSERT PROOF(')).toBeLessThan(script.lastIndexOf('MAST 0x'));
    expect(evalLine(proofLine(script))).toBe(true);
  });
});
