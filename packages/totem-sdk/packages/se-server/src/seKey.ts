import crypto from 'crypto';
import { sha3_256, bytesToHex } from '@totemsdk/core';

let _coreModule: any = null;

async function loadCore(): Promise<any> {
  if (_coreModule) return _coreModule;
  _coreModule = await import('@totemsdk/core' as string);
  return _coreModule;
}

/** Stateless WOTS key utilities — all functions take the seed as a parameter. */

/**
 * Derives the SE WOTS public key digest from seed.
 * Fast approximation using sha3_256 — consistent with what axia-api stores
 * in statechain_records.se_public_key and what clients verify against.
 */
export function getPublicKeyHex(seed: Uint8Array): string {
  const pkdBytes = sha3_256(
    Buffer.concat([Buffer.from(seed), Buffer.from([0, 0, 0, 0])]),
  );
  return bytesToHex(pkdBytes);
}

/** Full WOTS public key derivation (async, loads WASM core). */
export async function getPublicKeyHexAsync(seed: Uint8Array): Promise<string> {
  const core = await loadCore();
  const pkd = core.wotsPublicKeyFromSeed(seed, 0);
  return bytesToHex(pkd);
}

/** Sign commitmentBytes with the SE's WOTS key at index 0. */
export async function seSign(seed: Uint8Array, commitmentBytes: Uint8Array): Promise<Uint8Array> {
  const core = await loadCore();
  return core.wotsSign(seed, 0, commitmentBytes);
}

/** Verify a WOTS digest signature. Generic — verifies any operator's signature. */
export async function wotsVerifyDigestAsync(
  sig: Uint8Array,
  message: Uint8Array,
  pkDigest: Uint8Array,
): Promise<boolean> {
  const core = await loadCore();
  return core.wotsVerifyDigest(sig, message, pkDigest);
}

const RECLAIM_ENC_KEY_INFO = 'statechain-reclaim-tx-v1';

function getReclaimEncKey(seed: Uint8Array): Buffer {
  return crypto.createHmac('sha256', seed).update(RECLAIM_ENC_KEY_INFO).digest();
}

export function encryptReclaimTx(seed: Uint8Array, reclaimTxHex: string): string {
  const key = getReclaimEncKey(seed);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(reclaimTxHex, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}.${ct.toString('hex')}.${tag.toString('hex')}`;
}

export function decryptReclaimTx(seed: Uint8Array, enc: string): string {
  if (!enc.startsWith('enc:')) return enc;
  const parts = enc.slice(4).split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted reclaim tx format');
  const [ivHex, ctHex, tagHex] = parts;
  const key = getReclaimEncKey(seed);
  const iv = Buffer.from(ivHex, 'hex');
  const ct = Buffer.from(ctHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct).toString('utf8') + decipher.final('utf8');
}
