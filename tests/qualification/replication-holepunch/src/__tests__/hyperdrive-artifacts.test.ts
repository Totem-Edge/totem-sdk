import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bytesToHex, sha3_256 } from '@totemsdk/core';
import { runBackendConformance } from '@totemsdk/storage/conformance';
import {
  artifactPath,
  artifactRefFor,
  HyperdriveArtifactBackend,
} from '../hyperdrive-artifacts';

const dirs: string[] = [];
const makeDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'rep-drive-'));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('HyperdriveArtifactBackend', () => {
  it('writes and reads content-addressed bytes, and survives reopen', async () => {
    const storagePath = join(makeDir(), 'drive');
    const bytes = new TextEncoder().encode('evidence-bytes');
    const ref = artifactRefFor('proofgraph', bytes);

    const backend = await HyperdriveArtifactBackend.open({ storagePath });
    await backend.put(ref, bytes);
    expect(await backend.get(ref)).toMatchObject({ status: 'ok', bytes });
    await backend.close();

    const reopened = await HyperdriveArtifactBackend.open({ storagePath });
    expect(await reopened.get(ref)).toMatchObject({ status: 'ok', bytes });
    await reopened.close();
  });

  it('returns not-found for an unknown ref and corrupt for tampered bytes', async () => {
    const storagePath = join(makeDir(), 'drive');
    const backend = await HyperdriveArtifactBackend.open({ storagePath });
    const missing = { namespace: 'proofgraph', algorithm: 'sha3-256' as const, digest: 'ff'.repeat(32) };
    expect((await backend.get(missing)).status).toBe('not-found');

    const bytes = new Uint8Array([1, 2, 3]);
    const ref = artifactRefFor('proofgraph', bytes);
    await backend.put(ref, bytes);
    await backend.raw.put(artifactPath(ref), Buffer.from([9, 9, 9]));
    const read = await backend.get(ref);
    expect(read.status).toBe('corrupt');
    expect(read.message).toMatch(/digest mismatch/);
    await backend.close();
  });

  it('refuses bytes that do not match the ref digest', async () => {
    const backend = await HyperdriveArtifactBackend.open({ storagePath: join(makeDir(), 'drive') });
    const ref = { namespace: 'proofgraph', algorithm: 'sha3-256' as const, digest: bytesToHex(sha3_256(new Uint8Array([1]))) };
    await expect(backend.put(ref, new Uint8Array([2]))).rejects.toThrow(/do not match ref digest/);
    await backend.close();
  });

  it('declares immutable/buffered capabilities', async () => {
    const backend = await HyperdriveArtifactBackend.open({ storagePath: join(makeDir(), 'drive') });
    expect(backend.capabilities).toMatchObject({
      writable: true,
      deletable: false,
      acknowledge: 'buffered',
      atomic: false,
      retention: 'fixed',
      offlineReadable: true,
    });
    await backend.close();
  });
});

runBackendConformance('HyperdriveArtifactBackend conformance', async () => {
  const backend = await HyperdriveArtifactBackend.open({ storagePath: join(makeDir(), 'conformance') });
  return { backend };
}, { digestAware: true });
