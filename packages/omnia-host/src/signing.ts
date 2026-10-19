/**
 * Host signing material — derives the channel signer, WOTS lease provider,
 * and Minima address from env-provisioned key material.
 *
 * Key model (RFC-037 unified WOTS):
 *   - `baseSeed` comes from OMNIA_HOST_SEED (BIP39 mnemonic or 32-byte hex)
 *     or from an OMNIA_HOST_KEYFILE JSON.
 *   - The channel key is the unified child TreeKey
 *     `createUnifiedChildTreeKey(baseSeed, localAddressIndex)`; the participant's
 *     `publicKeyDigest` is its tree-root public key — the same key the on-chain
 *     `MULTISIG` eltoo script embeds.
 *   - Signatures are serialized hierarchical `TreeSignature`s (`serializeTreeSignature`)
 *     over the reserved leaf `(l1*64 + l2)`, verified by `verifyChannelSignature`.
 *   - The lease indices {addressIndex, l1, l2} select the one-time leaf.
 *
 * The lease journal/watermark persist in a directory next to the channel DB
 * (`<dbPath>.lease/`) so they survive restarts together with the channel store.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import {
  bytesToHex,
  createUnifiedChildTreeKey,
  hexToBytes,
  phraseToSeed,
  scriptFromWotsPk,
  scriptToAddress,
  serializeTreeSignature,
  type TreeKey,
} from '@totemsdk/core';
import type { StorageAdapter } from '@totemsdk/core';
import { FileStore } from '@totemsdk/storage/fs';
import { LocalLeaseProvider } from '@totemsdk/wots-lease';
import { allocateDeviceRange, deviceSlotForAddressIndex } from '@totemsdk/wots-lease';
import type { ChannelSigner } from '@totemsdk/omnia';
import type { SigningIndices, WotsLeaseProvider } from '@totemsdk/wots-lease';
import type { OmniaHostConfig } from './config.js';

export interface HostSigning {
  signer: ChannelSigner;
  leaseProvider: WotsLeaseProvider;
  /**
   * Stable ed25519 keypair used as the native Hyperswarm transport identity.
   * Derived deterministically from the host seed. The transport is classical
   * (noise); its public key is bound to the PQ identity by the signed manifest.
   */
  transportKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array };
  /** `0x`-prefixed hex transport public key (published in the signed manifest). */
  transportPubkey: string;
  /** Minima address for the unified child TreeKey (identity + channels). */
  address: string;
  /** Channel participant key: the unified child TreeKey root pubkey (RFC-037). */
  publicKeyDigest: string;
  /** 32-byte base seed (used by the identity/manifest layer). */
  baseSeed: Uint8Array;
  /** Unified child TreeKey used for channel + manifest signing (RFC-037). */
  treeKey: TreeKey;
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

/**
 * Derive the stable ed25519 transport keypair from the host seed.
 *
 * The transport is Hyperswarm's classical noise channel; this key is *not* the
 * quantum-resistant identity. It is published in the identity-signed manifest
 * so peers can bind it to the host's PQ identity.
 */
function deriveTransportKeyPair(baseSeed: Uint8Array): { publicKey: Uint8Array; secretKey: Uint8Array } {
  const seed = createHash('sha256')
    .update(Buffer.concat([Buffer.from(baseSeed), Buffer.from('omnia-transport-v1')]))
    .digest();
  // Ed25519 PKCS#8 DER prefix + 32-byte seed
  const pkcs8 = Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    seed,
  ]);
  const privateKey = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const spki = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }) as Buffer;
  const publicKey = spki.subarray(spki.length - 32);
  // sodium/ed25519 64-byte secret key = seed || publicKey
  const secretKey = Buffer.concat([seed, publicKey]);
  return { publicKey: new Uint8Array(publicKey), secretKey: new Uint8Array(secretKey) };
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
 *
 * Delegates to the hardened shared `FileStore` from `@totemsdk/storage/fs`
 * (RFC-007): one versioned codec record per key written temp+rename with an
 * fsync; corrupt records surface as `StorageError` (`corrupt`) rather than
 * silently returning JSON `null`. The directory is created on first write.
 */
export class JsonFileStorageAdapter implements StorageAdapter {
  private readonly store: FileStore;

  constructor(dir: string) {
    this.store = new FileStore(dir);
  }

  async get<T>(key: string): Promise<T | null> {
    return this.store.get(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    return this.store.set(key, value);
  }

  async remove(key: string): Promise<boolean> {
    return this.store.remove(key);
  }

  async clear(): Promise<void> {
    return this.store.clear();
  }

  async keys(): Promise<string[]> {
    return this.store.keys();
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
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

  const treeKey = createUnifiedChildTreeKey(baseSeed, addressIndex);
  const publicKey = treeKey.getPublicKey();
  const publicKeyDigest = `0x${bytesToHex(publicKey)}`;
  const address = scriptToAddress(scriptFromWotsPk(publicKey));

  const storage = new JsonFileStorageAdapter(leaseStorageDir(config.dbPath));
  const leaseProvider = new LocalLeaseProvider(storage, undefined, deviceId);

  const signer: ChannelSigner = {
    publicKeyDigest,
    async sign(payload: Uint8Array, indices: SigningIndices): Promise<Uint8Array> {
      // RFC-020 C1: honor the reserved leaf instead of hardcoding index 0. The
      // reservation must belong to this signer's address; the leaf within the
      // per-address tree is (l1*64 + l2). Signatures are serialized TreeSignatures
      // (RFC-037), verified by verifyChannelSignature against the tree-root pubkey.
      if (indices.addressIndex !== addressIndex) {
        throw new Error(
          `omnia-host signer address ${addressIndex} cannot sign reserved address ${indices.addressIndex}`,
        );
      }
      const leafIndex = indices.l1 * 64 + indices.l2;
      treeKey.setUses(leafIndex);
      return serializeTreeSignature(treeKey.sign(payload)) as Uint8Array;
    },
  };

  const transportKeyPair = deriveTransportKeyPair(baseSeed);
  const transportPubkey = `0x${bytesToHex(transportKeyPair.publicKey)}`;

  return {
    signer,
    leaseProvider,
    address,
    publicKeyDigest,
    transportKeyPair,
    transportPubkey,
    baseSeed,
    treeKey,
    addressIndex,
    deviceId,
  };
}

/** True when the config carries signing material (seed or keyfile). */
export function hasSigningMaterial(config: OmniaHostConfig): boolean {
  return Boolean(config.seed || config.keyfile);
}
