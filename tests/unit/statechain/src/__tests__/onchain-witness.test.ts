/**
 * RFC-009 on-chain gate — the statechain cooperative branch validated by the
 * KISSVM script validator with real Minima TreeKey signatures.
 *
 * The SE identity is a TreeKey root (RFC-008); the locking script binds that
 * root (`MULTISIG(2 STATE(0) <SE-root>)`), and the witness carries the owner's
 * and SE's tree signatures. This is the on-chain witness that RFC-008's
 * Open Question 1 depends on.
 */

import { TreeKey, bytesToHex, sha3_256 } from '@totemsdk/core';
import { simulateSpend } from '@totemsdk/kissvm/simulate';
import { buildWitness } from '@totemsdk/kissvm/witness';
import type { CoinData, TxContext } from '@totemsdk/kissvm/types';
import { buildStatechainScript } from '../script.js';

jest.setTimeout(180_000);

const owner = new TreeKey(new Uint8Array(32).fill(0x41), 4, 2);
const se = new TreeKey(new Uint8Array(32).fill(0x42), 4, 2);
const ownerRoot = bytesToHex(owner.getPublicKey()).toLowerCase();
const seRoot = bytesToHex(se.getPublicKey()).toLowerCase();

const TX_DIGEST = sha3_256(new TextEncoder().encode('statechain-claim-tx-body'));

const COIN: CoinData = {
  amount: 100,
  tokenId: '0x00',
  coinId: '0x' + '11'.repeat(32),
  address: '0x' + '22'.repeat(32),
  coinCreatedBlock: 0,
};

function ctx(overrides: Partial<TxContext> = {}): TxContext {
  return {
    block: 10, // coinage 10 < RECLAIM_TIMELOCK(256) => cooperative MULTISIG branch
    inputIndex: 0,
    inputs: [COIN],
    outputs: [],
    state: { 0: '0x' + ownerRoot },
    prevState: {},
    txDigest: TX_DIGEST,
    ...overrides,
  };
}

describe('statechain on-chain witness (RFC-009 / RFC-008)', () => {
  const script = buildStatechainScript(seRoot);

  it('accepts the owner + SE root cooperative spend', async () => {
    const witness = buildWitness([owner.sign(TX_DIGEST), se.sign(TX_DIGEST)]);
    const res = await simulateSpend(script, COIN, ctx(), witness);
    expect(res.passed).toBe(true);
  });

  it('rejects when the SE co-signature is missing', async () => {
    const witness = buildWitness([owner.sign(TX_DIGEST)]);
    const res = await simulateSpend(script, COIN, ctx(), witness);
    expect(res.passed).toBe(false);
  });

  it('rejects an SE signature that does not reconstruct to the bound root', async () => {
    const imposter = new TreeKey(new Uint8Array(32).fill(0x99), 4, 2);
    const witness = buildWitness([owner.sign(TX_DIGEST), imposter.sign(TX_DIGEST)]);
    const res = await simulateSpend(script, COIN, ctx(), witness);
    expect(res.passed).toBe(false);
  });

  it('rejects a signature over a different transaction digest', async () => {
    const wrongDigest = sha3_256(new TextEncoder().encode('different'));
    const witness = buildWitness([owner.sign(TX_DIGEST), se.sign(TX_DIGEST)]);
    const res = await simulateSpend(script, COIN, ctx({ txDigest: wrongDigest }), witness);
    expect(res.passed).toBe(false);
  });

  it('keeps the unilateral reclaim path (owner only) after the timelock', async () => {
    const witness = buildWitness([owner.sign(TX_DIGEST)]);
    const res = await simulateSpend(script, COIN, ctx({ block: 1000 }), witness);
    expect(res.passed).toBe(true);
  });
});
