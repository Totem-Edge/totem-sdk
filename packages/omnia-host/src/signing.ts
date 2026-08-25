/**
 * Host signing material — derives the channel signer, WOTS lease provider,
 * and Minima address from env-provisioned key material.
 *
 * Key model (matches @totemsdk/omnia's verification path):
 *   - `baseSeed` comes from OMNIA_HOST_SEED (BIP39 mnemonic or 32-byte hex)
 *     or from an OMNIA_HOST_KEYFILE JSON.
 *   - `perAddressSeed = derivePerAddressSeed(baseSeed, localAddressIndex)`.
 *   - The channel participant's `publicKeyDigest` is the flat WOTS PK digest
 *     `derivePKdigest(perAddressSeed, 0)` — omnia verifies signatures with
 *     `wotsVerifyDigest(sig, digest, pkDigest)`, which is key-index agnostic,
 *     so the signer always signs with key index 0 of the per-address seed.
 *   - The lease indices {addressIndex, l1, l2} are slot bookkeeping for
 *     double-sign prevention (watermark monotonicity), not key derivation.
 *
 * The lease journal/watermark persist in a directory next to the channel DB
 * (`<dbPath>.lease/`) so they survive restarts together with the channel store.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import {
  bytesToHex,
  derivePKdigest,
  derivePerAddressSeed,
  hexToBytes,
  phraseToSeed,
  wotsAddressFromKeypair,
  wotsKeypairFromSeed,
  wotsSign,
} from '@totemsdk/core';
import type { StorageAdapter } from '@totemsdk/core';
import { LocalLeaseProvider } from '@totemsdk/wots-lease';
import { allocateDeviceRange, deviceSlotForAddressIndex } from '@totemsdk/wots-lease';
import type { ChannelSigner } from '@totemsdk/omnia';
import type { SigningIndices, WotsLeaseProvider } from '@totemsdk/wots-lease';
import type { OmniaHostConfig } from './config.js';

export interface HostSigning {
  signer: ChannelSigner;
  leaseProvider: WotsLeaseProvider;
  address: string;
  publicKeyDigest: string;
  /** 32-byte base seed (used by the identity/manifest layer). */
  baseSeed: Uint8Array;
  /** Per-address seed used for channel signing (key index 0). */
  perAddressSeed: Uint8Array;
  addressIndex: number;
  deviceId: string;
}

interface KeyfilePayload {
  seed: string;
  encrypted?: boolean;
  salt?: string;
  iv?: string;
  authTag?: string;
}

const KEYFILE_SCRYPT_N = 16384;
const KEYFILE_SCRYPT_R = 8;
const KEYFILE_SCRYPT_P = 1;
const KEYFILE_KEY_LEN = 32;

function decryptSeed(payload: KeyfilePayload, passphrase: string | undefined): Uint8Array {
  if (!payload.encrypted) {
    return hexToBytes(payload.seed);
  }
  if (!passphrase) {
    throw new Error('OMNIA_HOST_KEYFILE is encrypted — OMNIA_HOST_KEYFILE_PASSPHRASE is required');
  }
  if (!payload.salt || !payload.iv || !payload.authTag) {
    throw new Error('OMNIA_HOST_KEYFILE is marked encrypted but is missing salt/iv/authTag');
  }
  const key = scryptSync(passphrase, Buffer.from(payload.salt, 'hex'), KEYFILE_KEY_LEN, {
    N: KEYFILE_SCRYPT_N,
    r: KEYFILE_SCRYPT_R,
    p: KEYFILE_SCRYPT_P,
  });
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(payload.seed, 'hex')),
    decipher.final(),
  ]);
  return new Uint8Array(plain);
}

/** Encrypt a 32-byte seed into a keyfile payload (used by tooling/tests). */
export function encryptSeedForKeyfile(seed: Uint8Array, passphrase: string): KeyfilePayload {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, KEYFILE_KEY_LEN, {
    N: KEYFILE_SCRYPT_N,
    r: KEYFILE_SCRYPT_R,
    p: KEYFILE_SCRYPT_P,
  });
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(seed), cipher.final()]);
  return {
    seed: encrypted.toString('hex'),
    encrypted: true,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

function resolveBaseSeed(config: OmniaHostConfig): Uint8Array {
  if (config.seed) {
    const trimmed = config.seed.trim();
    if (/^(0x)?[0-9a-fA-F]+$/.test(trimmed)) {
      return hexToBytes(trimmed);
    }
    return phraseToSeed(trimmed);
  }
  if (config.keyfile) {
    const keyfilePath = path.resolve(process.cwd(), config.keyfile);
    let raw: string;
    try {
      raw = fs.readFileSync(keyfilePath, 'utf8');
    } catch (error) {
      throw new Error(
        `OMNIA_HOST_KEYFILE could not be read at ${keyfilePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    let payload: KeyfilePayload;
    try {
      payload = JSON.parse(raw) as KeyfilePayload;
    } catch {
      throw new Error(`OMNIA_HOST_KEYFILE at ${keyfilePath} is not valid JSON`);
    }
    if (typeof payload.seed !== 'string' || payload.seed.length === 0) {
      throw new Error(`OMNIA_HOST_KEYFILE at ${keyfilePath} is missing a "seed" field`);
    }
    const seed = decryptSeed(payload, config.keyfilePassphrase);
    if (seed.length !== 32) {
      throw new Error(`OMNIA_HOST_KEYFILE seed must be 32 bytes; got ${seed.length}`);
    }
    return seed;
  }
  throw new Error('createHostSigning requires OMNIA_HOST_SEED or OMNIA_HOST_KEYFILE');
}

/**
 * JSON-file-backed StorageAdapter rooted at a directory next to the channel DB.
 * Each key is stored as `<key>.json`; the directory is created on first write.
 */
export class JsonFileStorageAdapter implements StorageAdapter {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  private fileFor(key: string): string {
    const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.dir, `${safe}.json`);
  }

  private ensureDir(): void {
    fs.mkdirSync(this.dir, { recursive: true });
  }

  async get<T>(key: string): Promise<T | null> {
    const file = this.fileFor(key);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.ensureDir();
    fs.writeFileSync(this.fileFor(key), JSON.stringify(value));
  }

  async remove(key: string): Promise<boolean> {
    const file = this.fileFor(key);
    if (!fs.existsSync(file)) return false;
    fs.unlinkSync(file);
    return true;
  }

  async clear(): Promise<void> {
    if (!fs.existsSync(this.dir)) return;
    for (const entry of fs.readdirSync(this.dir)) {
      fs.unlinkSync(path.join(this.dir, entry));
    }
  }

  async keys(): Promise<string[]> {
    if (!fs.existsSync(this.dir)) return [];
    return fs.readdirSync(this.dir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length));
  }

  async has(key: string): Promise<boolean> {
    return fs.existsSync(this.fileFor(key));
  }
}

/** Directory holding the lease journal/watermark next to the channel DB. */
export function leaseStorageDir(dbPath: string): string {
  return `${dbPath}.lease`;
}

/** Extract the numeric slot from a `device-N` id, or undefined. */
function parseDeviceSlot(deviceId: string): number | undefined {
  const match = /^device-?(\d+)$/i.exec(deviceId);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Derive the host's signing stack from config.
 *
 * Throws when no key material is configured. Callers gate this behind
 * `config.readOnly` / key presence checks.
 */
export function createHostSigning(config: OmniaHostConfig): HostSigning {
  const baseSeed = resolveBaseSeed(config);
  const addressIndex = config.localAddressIndex ?? 0;
  const pinnedSlot = config.deviceId ? parseDeviceSlot(config.deviceId) : undefined;
  const deviceSlot = pinnedSlot ?? deviceSlotForAddressIndex(addressIndex);
  const deviceId = config.deviceId ?? `device-${deviceSlot}`;
  const range = allocateDeviceRange({ deviceSlot, deviceId });
  if (addressIndex < range.startAddressIndex || addressIndex > range.endAddressIndex) {
    throw new Error(
      `localAddressIndex ${addressIndex} is outside device slot ${deviceSlot} range ` +
      `${range.startAddressIndex}–${range.endAddressIndex}`,
    );
  }

  const perAddressSeed = derivePerAddressSeed(baseSeed, addressIndex);
  const kp = wotsKeypairFromSeed(perAddressSeed, 0);
  const publicKeyDigest = `0x${bytesToHex(kp.pk)}`;
  const address = wotsAddressFromKeypair(kp);

  const signer: ChannelSigner = {
    publicKeyDigest,
    async sign(payload: Uint8Array, _indices: SigningIndices): Promise<Uint8Array> {
      return wotsSign(perAddressSeed, 0, payload);
    },
  };

  const storage = new JsonFileStorageAdapter(leaseStorageDir(config.dbPath));
  const leaseProvider = new LocalLeaseProvider(storage, undefined, deviceId);

  return {
    signer,
    leaseProvider,
    address,
    publicKeyDigest,
    baseSeed,
    perAddressSeed,
    addressIndex,
    deviceId,
  };
}

/** True when the config carries signing material (seed or keyfile). */
export function hasSigningMaterial(config: OmniaHostConfig): boolean {
  return Boolean(config.seed || config.keyfile);
}
