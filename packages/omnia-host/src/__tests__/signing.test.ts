import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { wotsVerifyDigest, hexToBytes } from '@totemsdk/core';
import { createHostSigning, encryptSeedForKeyfile, hasSigningMaterial, JsonFileStorageAdapter, leaseStorageDir } from '../signing.js';
import { loadConfigFromEnv } from '../config.js';

const HEX_SEED = '0x' + 'ab'.repeat(32);

function tmpDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-host-signing-'));
  return path.join(dir, 'omnia.sqlite');
}

describe('createHostSigning', () => {
  it('derives a signer whose signatures verify against its publicKeyDigest', async () => {
    const dbPath = tmpDbPath();
    const signing = createHostSigning(loadConfigFromEnv({
      OMNIA_HOST_SEED: HEX_SEED,
      OMNIA_HOST_DB: dbPath,
      OMNIA_LOCAL_ADDRESS_INDEX: '0',
    }));

    expect(signing.publicKeyDigest).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(signing.address).toMatch(/^Mx/);

    const payload = new Uint8Array(32).fill(7);
    const sig = await signing.signer.sign(payload, { addressIndex: 0, l1: 0, l2: 0 });
    expect(sig.length).toBe(1088);
    expect(wotsVerifyDigest(sig, payload, hexToBytes(signing.publicKeyDigest))).toBe(true);
  });

  it('accepts both mnemonic and hex seed forms', () => {
    const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const fromMnemonic = createHostSigning(loadConfigFromEnv({
      OMNIA_HOST_SEED: mnemonic,
      OMNIA_HOST_DB: tmpDbPath(),
    }));
    const fromHex = createHostSigning(loadConfigFromEnv({
      OMNIA_HOST_SEED: HEX_SEED,
      OMNIA_HOST_DB: tmpDbPath(),
    }));
    expect(fromMnemonic.publicKeyDigest).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(fromHex.publicKeyDigest).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it('loads an unencrypted keyfile', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-host-keyfile-'));
    const keyfile = path.join(dir, 'host.json');
    fs.writeFileSync(keyfile, JSON.stringify({ seed: HEX_SEED }));

    const signing = createHostSigning(loadConfigFromEnv({
      OMNIA_HOST_KEYFILE: keyfile,
      OMNIA_HOST_DB: tmpDbPath(),
    }));
    expect(signing.publicKeyDigest).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it('loads an encrypted keyfile with the passphrase', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-host-keyfile-'));
    const keyfile = path.join(dir, 'host.json');
    const payload = encryptSeedForKeyfile(hexToBytes(HEX_SEED), 'hunter2');
    fs.writeFileSync(keyfile, JSON.stringify(payload));

    const signing = createHostSigning(loadConfigFromEnv({
      OMNIA_HOST_KEYFILE: keyfile,
      OMNIA_HOST_KEYFILE_PASSPHRASE: 'hunter2',
      OMNIA_HOST_DB: tmpDbPath(),
    }));
    expect(signing.publicKeyDigest).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it('rejects an encrypted keyfile without a passphrase', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-host-keyfile-'));
    const keyfile = path.join(dir, 'host.json');
    fs.writeFileSync(keyfile, JSON.stringify(encryptSeedForKeyfile(hexToBytes(HEX_SEED), 'hunter2')));

    expect(() => createHostSigning(loadConfigFromEnv({
      OMNIA_HOST_KEYFILE: keyfile,
      OMNIA_HOST_DB: tmpDbPath(),
    }))).toThrow('OMNIA_HOST_KEYFILE_PASSPHRASE is required');
  });

  it('rejects a missing keyfile with a path in the error', () => {
    expect(() => createHostSigning(loadConfigFromEnv({
      OMNIA_HOST_KEYFILE: './does-not-exist.json',
      OMNIA_HOST_DB: tmpDbPath(),
    }))).toThrow('OMNIA_HOST_KEYFILE could not be read');
  });

  it('persists the lease journal next to the channel DB', async () => {
    const dbPath = tmpDbPath();
    const signing = createHostSigning(loadConfigFromEnv({
      OMNIA_HOST_SEED: HEX_SEED,
      OMNIA_HOST_DB: dbPath,
    }));

    const reservation = await signing.leaseProvider.reserveKeyUse({ treeId: 'test-tree' });
    expect(reservation.indices).toBeDefined();
    expect(leaseStorageDir(dbPath)).toBe(`${dbPath}.lease`);
    expect(fs.existsSync(leaseStorageDir(dbPath))).toBe(true);
    expect(fs.readdirSync(leaseStorageDir(dbPath)).length).toBeGreaterThan(0);
  });

  it('rejects an address index outside its device slot', () => {
    expect(() => createHostSigning(loadConfigFromEnv({
      OMNIA_HOST_SEED: HEX_SEED,
      OMNIA_HOST_DB: tmpDbPath(),
      OMNIA_LOCAL_ADDRESS_INDEX: '9',
      OMNIA_HOST_DEVICE_ID: 'device-0',
    }))).toThrow('outside device slot');
  });

  it('hasSigningMaterial reflects seed/keyfile presence', () => {
    expect(hasSigningMaterial(loadConfigFromEnv({}))).toBe(false);
    expect(hasSigningMaterial(loadConfigFromEnv({ OMNIA_HOST_SEED: HEX_SEED }))).toBe(true);
    expect(hasSigningMaterial(loadConfigFromEnv({ OMNIA_HOST_KEYFILE: './k.json' }))).toBe(true);
  });
});

describe('JsonFileStorageAdapter (RFC-007 Phase 2 hardening)', () => {
  it('round-trips bigint and bytes through the shared codec', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-host-json-'));
    const adapter = new JsonFileStorageAdapter(dir);
    const value = { n: 9n, bytes: new Uint8Array([9]), flags: [true, false] };
    await adapter.set('k', value);
    const read = await adapter.get<typeof value>('k');
    expect(read).toEqual(value);
    expect(typeof read?.n).toBe('bigint');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('surfaces corrupt records (strict) instead of returning null', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-host-json-'));
    const adapter = new JsonFileStorageAdapter(dir);
    await adapter.set('good', 1);
    const file = path.join(dir, `${Buffer.from('good', 'utf8').toString('hex')}.bin`);
    fs.writeFileSync(file, 'garbage');
    await expect(adapter.get('good')).rejects.toThrow();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
