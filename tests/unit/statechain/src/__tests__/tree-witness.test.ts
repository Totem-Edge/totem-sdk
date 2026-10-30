/**
 * RFC-009 Phase 3 — Minima-faithful witness serialization + cooperative claim.
 *
 * `buildMinimaWitnessBytes` serializes Minima `Signature` objects (owner + SE
 * tree signatures). This test round-trips the bytes, re-parses the signatures,
 * and validates them with the KISSVM validator against the statechain script;
 * it also smoke-tests the `claimOwnership` tree path.
 */

import {
  TreeKey,
  bytesToHex,
  hexToBytes,
  sha3_256,
  concatBytes,
  writeMiniNumber,
  serializeTreeSignature,
  deserializeTreeSignature,
} from '@totemsdk/core';
import type { TreeSignature } from '@totemsdk/core';
import { simulateSpend } from '@totemsdk/kissvm/simulate';
import { buildWitness } from '@totemsdk/kissvm/witness';
import type { CoinData, TxContext } from '@totemsdk/kissvm/types';
import { buildMinimaWitnessBytes } from '@totemsdk/tx-builder';

import { buildStatechainScript } from '../script.js';
import { claimOwnership } from '../claim.js';
import type { StateChain, SEClient } from '../types.js';

jest.setTimeout(180_000);

const owner = new TreeKey(new Uint8Array(32).fill(0x41), 4, 2);
const se = new TreeKey(new Uint8Array(32).fill(0x42), 4, 2);
const ownerRoot = bytesToHex(owner.getPublicKey()).toLowerCase();
const seRoot = bytesToHex(se.getPublicKey()).toLowerCase();
const DIGEST = sha3_256(new TextEncoder().encode('claim-tx-digest'));

const COIN: CoinData = {
  amount: 100,
  tokenId: '0x00',
  coinId: '0x' + '11'.repeat(32),
  address: '0x' + '22'.repeat(32),
  coinCreatedBlock: 0,
};

function parseMinimaWitness(data: Uint8Array): TreeSignature[] {
  let offset = 2 + data[1]; // leading MiniNumber(count): scale(1) + len(1) + data
  const count = data[2];
  const sigs: TreeSignature[] = [];
  for (let i = 0; i < count; i++) {
    const sig = deserializeTreeSignature(data.slice(offset));
    sigs.push(sig);
    offset += serializeTreeSignature(sig).length;
  }
  const tailExpected = concatBytes(writeMiniNumber(0n, 0), writeMiniNumber(0n, 0));
  expect(data.slice(offset)).toEqual(tailExpected);
  return sigs;
}

describe('Minima-faithful witness serialization (RFC-009 Phase 3)', () => {
  it('round-trips owner + SE tree signatures and validates in KISSVM', async () => {
    const ownerSig = owner.sign(DIGEST);
    const seSig = se.sign(DIGEST);

    const witnessBytes = buildMinimaWitnessBytes([ownerSig, seSig]);
    const [parsedOwner, parsedSe] = parseMinimaWitness(witnessBytes);

    const ctx: TxContext = {
      block: 10,
      inputIndex: 0,
      inputs: [COIN],
      outputs: [],
      state: { 0: '0x' + ownerRoot },
      prevState: {},
      txDigest: DIGEST,
    };
    const res = await simulateSpend(
      buildStatechainScript(seRoot),
      COIN,
      ctx,
      buildWitness([parsedOwner, parsedSe]),
    );
    expect(res.passed).toBe(true);
  });

  it('claimOwnership emits a Minima tree witness for a tree-capable owner', async () => {
    const seSig = se.sign(DIGEST);
    const seClient: SEClient = {
      blindSign: async () => ({
        kind: 'child',
        member: 'se',
        childIndex: 0,
        address: 'unused',
        publicKey: seRoot,
        signature: bytesToHex(serializeTreeSignature(seSig)),
        message: bytesToHex(DIGEST),
        proofVersion: 1,
      }),
      revokeKey: async () => undefined,
      isRevoked: async () => false,
    };

    const chain: StateChain = {
      chainId: 'sc_test',
      coinId: '0x' + '11'.repeat(32),
      tokenId: '0x00',
      amount: 100n,
      sePublicKey: seRoot,
      lockingScript: buildStatechainScript(seRoot),
      lockingAddress: '0x' + '22'.repeat(32),
      currentOwner: {
        partyId: 'owner',
        publicKeyDigest: ownerRoot,
        signTree: async (m: Uint8Array) => owner.sign(m),
      },
      transferHistory: [],
      status: 'active',
      reclaimTx: '0x00',
      reclaimAddress: '0x' + '33'.repeat(32),
      reclaimTimelock: 256,
      createdAt: 0,
    };

    const payload = await claimOwnership(chain, { seClient });
    expect(payload.txHex.length).toBeGreaterThan(200);
  });
});
