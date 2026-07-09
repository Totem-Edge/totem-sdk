/**
 * MultisigManager.addOwnSignature() — unified signing tests
 *
 * Verifies that addOwnSignature() always indexes the signature under
 * tx.config.ownPublicKey (no walletMode routing needed with unified derivation).
 */

import { MultisigManager } from '../multisig-manager.js';
import type { MultisigConfig } from '../multisig-manager.js';

const OWN_PK = '0x' + 'aa'.repeat(32);
const OTHER_PK = '0x' + 'cc'.repeat(32);
const MOCK_SIG = '0x' + 'de'.repeat(1088);
const MOCK_TX_HEX = '0x' + '01'.repeat(64);
const MOCK_DIGEST = '0x' + 'ff'.repeat(32);

function makeConfig(overrides: Partial<MultisigConfig> = {}): MultisigConfig {
  return {
    type: '2of2',
    threshold: 2,
    publicKeys: [OWN_PK, OTHER_PK],
    ownPublicKey: OWN_PK,
    ...overrides,
  };
}

describe('MultisigManager.addOwnSignature() — unified derivation', () => {
  it('indexes signature under ownPublicKey', async () => {
    const mgr = new MultisigManager();
    const tx = await mgr.createPendingTransaction(makeConfig(), MOCK_TX_HEX, MOCK_DIGEST);
    await mgr.addOwnSignature(tx.id, MOCK_SIG);
    const sigs = await mgr.getSignatures(tx.id);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].publicKey).toBe(OWN_PK);
  });

  it('indexes signature correctly when custom address is set', async () => {
    const CUSTOM_ADDR_PK = '0x' + 'bb'.repeat(32);
    const mgr = new MultisigManager();
    const config = makeConfig({
      publicKeys: [CUSTOM_ADDR_PK, OTHER_PK],
      ownPublicKey: CUSTOM_ADDR_PK,
    });
    const tx = await mgr.createPendingTransaction(config, MOCK_TX_HEX, MOCK_DIGEST);
    await mgr.addOwnSignature(tx.id, MOCK_SIG);
    const sigs = await mgr.getSignatures(tx.id);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].publicKey).toBe(CUSTOM_ADDR_PK);
  });

  it('throws when transaction is expired', async () => {
    const mgr = new MultisigManager();
    const tx = await mgr.createPendingTransaction(makeConfig(), MOCK_TX_HEX, MOCK_DIGEST);
    tx.status = 'expired';
    await expect(mgr.addOwnSignature(tx.id, MOCK_SIG)).rejects.toThrow('expired');
  });

  it('throws when transaction not found', async () => {
    const mgr = new MultisigManager();
    await expect(mgr.addOwnSignature('nonexistent', MOCK_SIG)).rejects.toThrow('not found');
  });
});
