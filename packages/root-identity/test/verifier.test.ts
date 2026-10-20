import { UnifiedIdentityWallet } from '../src/UnifiedIdentityWallet.js';
import {
  createRootIdentityProofVerifier,
  decodeRootIdentityProof,
  encodeRootIdentityProof,
} from '../src/verifier.js';

const SEED = new Uint8Array(32).fill(0xab);

describe('root-identity proof verifier (P0-B)', () => {
  it('roundtrips and verifies a real ownership proof', async () => {
    const wallet = new UnifiedIdentityWallet(SEED, 4);
    const proof = wallet.proveOwnership([0, 1]);
    const encoded = encodeRootIdentityProof(proof);
    expect(decodeRootIdentityProof(encoded)).toEqual(proof);

    const verifier = createRootIdentityProofVerifier();
    const result = await verifier.verify(encoded, {
      expectedRootAddress: proof.rootAddress,
      expectedAddress: proof.childAddresses[0],
      purpose: 'manifest-binding',
    });

    expect(result.valid).toBe(true);
    expect(result.rootAddress).toBe(proof.rootAddress);
    expect(result.provenAddresses).toEqual(proof.childAddresses);
    expect(result.proofDigest).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('rejects a different expected root', async () => {
    const wallet = new UnifiedIdentityWallet(SEED, 4);
    const proof = wallet.proveOwnership([0]);
    const verifier = createRootIdentityProofVerifier();

    const result = await verifier.verify(proof, { expectedRootAddress: 'MxOTHER' });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/root address mismatch/);
  });

  it('rejects an address not covered by the proof', async () => {
    const wallet = new UnifiedIdentityWallet(SEED, 4);
    const proof = wallet.proveOwnership([0]);
    const verifier = createRootIdentityProofVerifier();

    const result = await verifier.verify(proof, {
      expectedRootAddress: proof.rootAddress,
      expectedAddress: 'MxOTHER',
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not proven/);
  });

  it('rejects a tampered child address', async () => {
    const wallet = new UnifiedIdentityWallet(SEED, 4);
    const proof = wallet.proveOwnership([0]);
    const verifier = createRootIdentityProofVerifier();

    const result = await verifier.verify({ ...proof, childAddresses: ['MxTAMPERED'] });
    expect(result.valid).toBe(false);
  });

  it('rejects malformed inputs without throwing', async () => {
    const verifier = createRootIdentityProofVerifier();
    await expect(verifier.verify('not-json')).resolves.toMatchObject({ valid: false });
    await expect(verifier.verify({ rootAddress: 'x' })).resolves.toMatchObject({ valid: false });
  });
});
