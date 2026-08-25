import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyManifest } from '@totemsdk/manifest';
import { signIdentityClaim, verifyIdentityClaim } from '@totemsdk/identity';
import { createHostSigning } from '../signing.js';
import { createHostIdentityAndManifest, createHostManifest, loadHostIdentity } from '../identity.js';
import { loadConfigFromEnv } from '../config.js';

const HEX_SEED = '0x' + 'ab'.repeat(32);

function tmpDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-host-identity-'));
  return path.join(dir, 'omnia.sqlite');
}

function config(overrides: Record<string, string> = {}) {
  return loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED, OMNIA_HOST_DB: tmpDbPath(), ...overrides });
}

describe('omnia-host identity + manifest', () => {
  it('derives a service identity document from the host seed', () => {
    const signing = createHostSigning(config());
    const identity = loadHostIdentity(config(), signing);
    expect(identity).toBeDefined();
    expect(identity!.document.kind).toBe('service');
    expect(identity!.document.rootAddress).toBe(signing.address);
    expect(identity!.document.id).toMatch(/^totem:id:service:/);
    expect(identity!.delegation).toBeUndefined();
  });

  it('accepts a valid delegated identity claim file', async () => {
    const signing = createHostSigning(config());
    const operatorSeed = new Uint8Array(32).fill(0x42);
    const claim = {
      id: 'delegation-1',
      type: 'delegates_to' as const,
      issuer: 'MxOperator',
      subject: 'totem:id:service:test',
      object: signing.address,
      issuedAt: Date.now(),
      payload: { scopes: ['omnia:operate'] },
    };
    const signed = await signIdentityClaim(claim, operatorSeed, 0);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-host-identity-file-'));
    const identityFile = path.join(dir, 'delegation.json');
    fs.writeFileSync(identityFile, JSON.stringify(signed));

    const identity = loadHostIdentity(config({ OMNIA_HOST_IDENTITY_FILE: identityFile }), signing);
    expect(identity!.delegation).toBeDefined();
    expect(verifyIdentityClaim(identity!.delegation!).valid).toBe(true);
  });

  it('rejects a delegation that does not target the host address', async () => {
    const signing = createHostSigning(config());
    const operatorSeed = new Uint8Array(32).fill(0x42);
    const claim = {
      id: 'delegation-1',
      type: 'delegates_to' as const,
      issuer: 'MxOperator',
      subject: 'totem:id:service:test',
      object: 'MxSomeoneElse',
      issuedAt: Date.now(),
      payload: { scopes: ['omnia:operate'] },
    };
    const signed = await signIdentityClaim(claim, operatorSeed, 0);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-host-identity-file-'));
    const identityFile = path.join(dir, 'delegation.json');
    fs.writeFileSync(identityFile, JSON.stringify(signed));

    expect(() => loadHostIdentity(config({ OMNIA_HOST_IDENTITY_FILE: identityFile }), signing))
      .toThrow('delegates to MxSomeoneElse');
  });

  it('rejects a non-delegation claim file', async () => {
    const signing = createHostSigning(config());
    const operatorSeed = new Uint8Array(32).fill(0x42);
    const claim = {
      id: 'payment-1',
      type: 'payment_recipient' as const,
      issuer: 'MxOperator',
      subject: 'totem:id:service:test',
      object: signing.address,
      issuedAt: Date.now(),
      payload: {},
    };
    const signed = await signIdentityClaim(claim, operatorSeed, 0);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-host-identity-file-'));
    const identityFile = path.join(dir, 'delegation.json');
    fs.writeFileSync(identityFile, JSON.stringify(signed));

    expect(() => loadHostIdentity(config({ OMNIA_HOST_IDENTITY_FILE: identityFile }), signing))
      .toThrow('must contain a delegates_to claim');
  });

  it('signs a boot-time EdgeServiceManifest that verifies', async () => {
    const signing = createHostSigning(config());
    const manifest = await createHostManifest(config(), signing);
    expect(manifest.manifest.type).toBe('edge-service');
    expect(manifest.manifest.serviceType).toBe('omnia-router');
    expect(manifest.authorAddress).toBe(signing.address);
    expect(verifyManifest(manifest).valid).toBe(true);
  });

  it('honors OMNIA_HOST_SERVICE_TYPE in the manifest', async () => {
    const signing = createHostSigning(config({ OMNIA_HOST_SERVICE_TYPE: 'lookup-provider' }));
    const manifest = await createHostManifest(config({ OMNIA_HOST_SERVICE_TYPE: 'lookup-provider' }), signing);
    expect(manifest.manifest.serviceType).toBe('lookup-provider');
  });

  it('assembles identity + manifest together', async () => {
    const signing = createHostSigning(config());
    const assembled = await createHostIdentityAndManifest(config(), signing);
    expect(assembled.identity).toBeDefined();
    expect(verifyManifest(assembled.manifest).valid).toBe(true);
  });
});
