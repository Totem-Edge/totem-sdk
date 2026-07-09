import { createProofPortAdapter } from '../proof';
import type { ProofProvider, SignedProof } from '@totemsdk/proof';

function makeProvider(overrides: Partial<ProofProvider> = {}): ProofProvider {
  return {
    capabilities: ['hash:stamp', 'proof:verify'],
    stampHash: jest.fn().mockResolvedValue({ ok: true }),
    verifyProof: jest.fn().mockResolvedValue({ valid: true }),
    ...overrides,
  };
}

describe('createProofPortAdapter — createProof', () => {
  it('returns a proofId and unsigned proof', async () => {
    const provider = makeProvider({ stampHash: undefined });
    const port = createProofPortAdapter({ provider, issuer: 'MxISSUER' });
    const result = await port.createProof({
      subject: 'sensor-001',
      claims: [{ reading: 42 }],
    });
    expect(result.ok).toBe(true);
    expect(typeof result.data?.proofId).toBe('string');
    expect(result.data?.proof).toBeDefined();
  });

  it('stamps the canonical hash when provider supports it', async () => {
    const provider = makeProvider();
    const port = createProofPortAdapter({ provider, issuer: 'MxISSUER' });
    await port.createProof({ subject: 'sensor-002', claims: [] });
    expect(provider.stampHash).toHaveBeenCalledWith(expect.objectContaining({ hash: expect.any(String) }));
  });

  it('uses a custom defaultKind from context', async () => {
    const provider = makeProvider({ stampHash: undefined });
    const port = createProofPortAdapter({ provider, issuer: 'MxISSUER' });
    const result = await port.createProof({
      subject: 'doc-001',
      claims: [],
      context: { kind: 'ownership' },
    });
    const proof = result.data?.proof as { kind: string };
    expect(proof.kind).toBe('ownership');
  });

  it('returns ok:false when proof creation throws', async () => {
    const provider = makeProvider({ stampHash: jest.fn().mockRejectedValue(new Error('stamp failed')) });
    const port = createProofPortAdapter({ provider, issuer: 'MxISSUER' });
    const result = await port.createProof({ subject: 'x', claims: [] });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('stamp failed');
  });
});

describe('createProofPortAdapter — verifyProof', () => {
  const fakeProof: Partial<SignedProof> = {
    proofId: 'proof:001',
    kind: 'attestation',
    signature: { address: 'MxFOO', publicKey: '0xPK', signature: '0xSIG' },
  };

  it('delegates to provider.verifyProof', async () => {
    const provider = makeProvider();
    const port = createProofPortAdapter({ provider, issuer: 'MxISSUER' });
    const result = await port.verifyProof({ proof: fakeProof });
    expect(result.ok).toBe(true);
    expect(result.data?.valid).toBe(true);
    expect(provider.verifyProof).toHaveBeenCalledWith(fakeProof);
  });

  it('falls back to checkProof when verifyProof is absent', async () => {
    const provider = makeProvider({
      verifyProof: undefined,
      checkProof: jest.fn().mockResolvedValue({ ok: true }),
    });
    const port = createProofPortAdapter({ provider, issuer: 'MxISSUER' });
    const result = await port.verifyProof({ proof: fakeProof });
    expect(result.ok).toBe(true);
    expect(result.data?.valid).toBe(true);
  });

  it('returns ok:false when neither verifyProof nor checkProof is available', async () => {
    const provider = makeProvider({ verifyProof: undefined, checkProof: undefined });
    const port = createProofPortAdapter({ provider, issuer: 'MxISSUER' });
    const result = await port.verifyProof({ proof: fakeProof });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('NO_VERIFY_CAPABILITY');
  });
});
