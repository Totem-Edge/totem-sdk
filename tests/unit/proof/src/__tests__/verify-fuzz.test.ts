/**
 * Deterministic mutation/fuzz test for proof verification.
 *
 * A valid WOTS-signed proof must stay invalid after any semantic mutation, and
 * malformed inputs must return { valid:false } rather than throwing.
 */

import { createProof, signProof, verifyProof } from '../index';
import type { SignedProof } from '../index';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function int(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function flipHex(value: string, rng: () => number): string {
  if (value.length === 0) return '00';
  const at = int(rng, 0, value.length - 1);
  const replacement = value[at].toLowerCase() === 'a' ? 'b' : 'a';
  return value.slice(0, at) + replacement + value.slice(at + 1);
}

function clone(proof: SignedProof): SignedProof {
  return JSON.parse(JSON.stringify(proof)) as SignedProof;
}

const SEED = new Uint8Array(32).fill(7);

function validProof(): SignedProof {
  const unsigned = createProof({
    kind: 'attestation',
    subject: { id: 'subject-1', kind: 'device' },
    issuer: 'MxISSUER',
    issuedAt: 1000,
    payload: { reading: 42, label: 'ok' },
  });
  return signProof(unsigned, SEED, 0);
}

describe('proof verification mutation properties', () => {
  const base = validProof();

  it('accepts the unmodified proof', () => {
    expect(verifyProof(base)).toMatchObject({ valid: true });
  });

  it('rejects 300 semantic mutations without throwing', () => {
    const rng = mulberry32(0x9a0f);
    for (let i = 0; i < 300; i += 1) {
      const proof = clone(base);
      let mutation = '';
      switch (int(rng, 0, 7)) {
        case 0: mutation = 'issuer'; proof.issuer = `MxEVIL-${i}-${int(rng, 0, 100)}`; break;
        case 1: mutation = 'subject'; proof.subject.id = `subject-mut-${i}-${int(rng, 0, 100000)}`; break;
        case 2: mutation = 'payload'; (proof.payload as Record<string, unknown>).reading = 42 + int(rng, 1, 100000); break;
        case 3: mutation = 'proofId'; proof.proofId = flipHex(proof.proofId, rng); break;
        case 4: mutation = 'signature'; proof.signature.signature = flipHex(proof.signature.signature, rng); break;
        case 5: mutation = 'publicKey'; proof.signature.publicKey = flipHex(proof.signature.publicKey, rng); break;
        case 6: mutation = 'address'; proof.signature.address = `MxEVIL-${i}-${int(rng, 0, 100)}`; break;
        default: mutation = 'expiresAt'; proof.expiresAt = 1; break;
      }
      const result = verifyProof(proof);
      if (result.valid) throw new Error(`mutation ${mutation} still verified (iteration ${i})`);
    }
  });

  it('rejects malformed values without throwing', () => {
    const values: unknown[] = [
      null,
      undefined,
      0,
      'proof',
      [],
      {},
      { signature: null },
      { signature: {} },
      { signature: { address: 1, publicKey: 2, signature: 3 } },
    ];
    for (const value of values) {
      expect(verifyProof(value as unknown as SignedProof).valid).toBe(false);
    }
  });
});
