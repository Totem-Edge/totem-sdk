/**
 * RFC-020 P2-13 (TXB-MULTISIG-008/009): MultisigManager must not leak live
 * internal objects, and must not clobber terminal statuses on expiry.
 */

import { sha3_256, hexToBytes, bytesToHex } from '@totemsdk/core';
import { MultisigManager } from '../multisig-manager.js';
import type { MultisigConfig } from '../multisig-manager.js';

const OWN_PK = '0x' + 'aa'.repeat(32);
const OTHER_PK = '0x' + 'cc'.repeat(32);
const MOCK_TX_HEX = '0x' + '01'.repeat(64);
const MOCK_DIGEST = '0x' + bytesToHex(sha3_256(hexToBytes(MOCK_TX_HEX)));

function makeConfig(): MultisigConfig {
  return { type: '2of2', threshold: 2, publicKeys: [OWN_PK, OTHER_PK], ownPublicKey: OWN_PK };
}

describe('MultisigManager read models (RFC-020 P2-13)', () => {
  it('returns detached objects so callers cannot mutate internal state', async () => {
    const mgr = new MultisigManager();
    const tx = await mgr.createPendingTransaction(makeConfig(), MOCK_TX_HEX, MOCK_DIGEST);

    tx.config.publicKeys.push('0x' + 'ee'.repeat(32));
    tx.signatures.set('x', { publicKey: 'x', signature: 'y', signatureType: 'wots' });

    const internal = await mgr.getTransaction(tx.id);
    expect(internal?.config.publicKeys).toHaveLength(2);
    expect(internal?.signatures.size).toBe(0);
  });

  it('does not clobber a terminal status when listing pending transactions', async () => {
    const mgr = new MultisigManager();
    const tx = await mgr.createPendingTransaction(makeConfig(), MOCK_TX_HEX, MOCK_DIGEST, -1);
    await mgr.markBroadcast(tx.id);

    const pending = await mgr.getAllPending();
    expect(pending.find((t) => t.id === tx.id)).toBeUndefined();

    const internal = await mgr.getTransaction(tx.id);
    expect(internal?.status).toBe('broadcast');
  });
});
