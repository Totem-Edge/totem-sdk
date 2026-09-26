import { sha3_256, hexToBytes, bytesToHex } from '@totemsdk/core';
import { MemoryStore } from '@totemsdk/storage';
import { MultisigManager, type MultisigConfig } from '../multisig-manager.js';
import { CoinSelectionService, CoinSelectionError } from '../coin-selection.js';

const OWN_PK = '0x' + 'aa'.repeat(32);
const OTHER_PK = '0x' + 'cc'.repeat(32);
const MOCK_SIG = '0x' + 'de'.repeat(1088);
const TX_HEX = '0x' + '01'.repeat(64);
const DIGEST = '0x' + bytesToHex(sha3_256(hexToBytes(TX_HEX)));

function makeConfig(overrides: Partial<MultisigConfig> = {}): MultisigConfig {
  return { type: '2of2', threshold: 2, publicKeys: [OWN_PK, OTHER_PK], ownPublicKey: OWN_PK, ...overrides };
}

describe('RFC-016 P5: tx-builder multisig validity', () => {
  it('an invalid signature never counts toward readiness', async () => {
    const mgr = new MultisigManager(new MemoryStore());
    const tx = await mgr.createPendingTransaction(makeConfig(), TX_HEX, DIGEST);
    await mgr.addOwnSignature(tx.id, MOCK_SIG); // invalid WOTS signature
    expect(await mgr.isReady(tx.id)).toBe(false);
    const reloaded = await mgr.getTransaction(tx.id);
    expect(reloaded?.status).toBe('pending');
  });

  it('rejects a digest that does not match the transaction hex', async () => {
    const mgr = new MultisigManager(new MemoryStore());
    await expect(
      mgr.createPendingTransaction(makeConfig(), TX_HEX, '0x' + 'ff'.repeat(32)),
    ).rejects.toThrow(/does not match/i);
  });
});

describe('RFC-016 P5: coin selection rejects non-positive targets', () => {
  it('throws INVALID_TARGET for a negative target instead of reporting success', () => {
    const service = new CoinSelectionService({ fetchSpendableCoins: async () => [] } as never);
    expect(() =>
      service.selectCoins([], { mode: 'global', targetAmount: '-1' }),
    ).toThrow(CoinSelectionError);
  });
});
