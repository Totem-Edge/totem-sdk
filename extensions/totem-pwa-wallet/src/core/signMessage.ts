import { sha3_256 } from '@noble/hashes/sha3.js';
import { WalletManager } from './WalletManager';
import { signAndSerialize } from './signing';

/**
 * Sign an arbitrary message for TOTEM_VERIFY / TOTEM_SIGN_DATA.
 *
 * WOTS signs a 32-byte digest, so hash the UTF-8 message first. This matches
 * the extension and `verifySignatureDetailed` on the server.
 *
 * The caller must already be unlocked; the leaf index is reserved here.
 */
export async function signVerificationMessage(message: string): Promise<string> {
  const treeKey = await WalletManager.getActiveTreeKey();
  const uses = await WalletManager.reserveNextUse();
  const digest = sha3_256(new TextEncoder().encode(message));
  return signAndSerialize(treeKey, digest, uses);
}
