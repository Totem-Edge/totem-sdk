import { createManifestPortAdapter } from '../manifest';
import type { EdgeServiceManifest } from '@totemsdk/manifest';

const SEED = new Uint8Array(32).fill(0x07);

const MANIFEST: EdgeServiceManifest = {
  type: 'edge-service',
  serviceId: 'test-svc',
  name: 'Test Service',
  version: '1.0.0',
  operatorAddress: 'MxPLACEHOLDER', // overwritten after sign
  serviceType: 'sensor',
  description: 'adapter test',
  capabilities: [],
  tags: [],
};

describe('createManifestPortAdapter — sign', () => {
  it('returns a SignedManifest with authorAddress and signature', async () => {
    const port = createManifestPortAdapter();
    const manifest: EdgeServiceManifest = { ...MANIFEST, operatorAddress: 'MxADDR' };
    const result = await port.sign(manifest, SEED, 0);
    expect(result.ok).toBe(true);
    const signed = result.data?.signed as { authorAddress: string; signature: string };
    expect(typeof signed.authorAddress).toBe('string');
    expect(signed.authorAddress.toUpperCase().startsWith('MX')).toBe(true);
    expect(typeof signed.signature).toBe('string');
  }, 30000);

  it('is deterministic — same seed and manifest produce same signature', async () => {
    const port = createManifestPortAdapter();
    const manifest: EdgeServiceManifest = { ...MANIFEST, operatorAddress: 'MxADDR' };
    const r1 = await port.sign(manifest, SEED, 0);
    const r2 = await port.sign(manifest, SEED, 0);
    expect((r1.data?.signed as { signature: string }).signature)
      .toBe((r2.data?.signed as { signature: string }).signature);
  }, 60000);
});

describe('createManifestPortAdapter — verify', () => {
  it('verifies a freshly signed manifest', async () => {
    const port = createManifestPortAdapter();
    const addr = 'MxTEMPADDR';
    // sign with a manifest whose operatorAddress will be overwritten by signManifest's authorAddress
    // so we need to sign first, get the real address, then re-sign with the correct manifest
    const tempResult = await port.sign({ ...MANIFEST, operatorAddress: addr }, SEED, 1);
    expect(tempResult.ok).toBe(true);
    const signed = tempResult.data?.signed as { authorAddress: string };
    // Re-sign with the authorAddress filled in correctly
    const finalResult = await port.sign(
      { ...MANIFEST, operatorAddress: signed.authorAddress },
      SEED,
      1
    );
    expect(finalResult.ok).toBe(true);
    const vResult = await port.verify(finalResult.data?.signed);
    expect(vResult.ok).toBe(true);
    expect(vResult.data?.valid).toBe(true);
  }, 60000);

  it('returns valid:false for a tampered manifest', async () => {
    const port = createManifestPortAdapter();
    const r = await port.sign({ ...MANIFEST, operatorAddress: 'MxADDR' }, SEED, 2);
    const signed = r.data?.signed as Record<string, unknown>;
    const tampered = { ...signed, manifest: { ...(signed.manifest as object), version: '9.9.9' } };
    const vResult = await port.verify(tampered);
    expect(vResult.ok).toBe(true);
    expect(vResult.data?.valid).toBe(false);
  }, 30000);
});
