import crypto from 'crypto';

/**
 * Stateless helpers for the SE.
 *
 * The SE's identity and one-time WOTS signing live in `./seIdentity` (RFC-008):
 * a root-identity anchor with leased one-time leaves. The legacy
 * `getPublicKeyHex` / `seSign` (a fixed index-0 key that did not match the
 * advertised digest) have been removed (AUD-003/AUD-025), as has the generic
 * flat-WOTS `wotsVerifyDigestAsync` — owner authentication is now root-bound
 * TreeKey verification (RFC-009, see `./ownerAuth`). What remains here are the
 * reclaim-tx encryption helpers.
 */

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
