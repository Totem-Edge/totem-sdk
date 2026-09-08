/**
 * chain-provider/__tests__/live-node.integration.test.ts — env-gated live-node
 * work: verifyDeposit against a real Minima node.
 *
 * Requires:
 *   MINIMA_RPC_HOST  (default localhost)
 *   MINIMA_RPC_PORT  (default 9001)
 *   MINIMA_RPC_USER  (default 'minima' — the totem-node auto RPC account)
 *   MINIMA_RPC_PASSWORD
 *   MINIMA_DEPOSIT_COINID   an unspent coin owned by MINIMA_DEPOSIT_ADDRESS
 *   MINIMA_DEPOSIT_ADDRESS  the address that owns the funding coin
 *
 * Skipped entirely when the environment is not configured, so CI stays green.
 */

import { createMinimaRpcClient, type MinimaRpcClient } from '@totemsdk/minima-rpc';
import { MinimaRpcProvider } from '../providers/minima-rpc';
import { verifyDepositMmrProof } from '../verify-deposit';
import { MMRTree } from '@totemsdk/core';

const HOST = process.env.MINIMA_RPC_HOST ?? 'localhost';
const PORT = Number(process.env.MINIMA_RPC_PORT ?? 9001);
const USERNAME = process.env.MINIMA_RPC_USER ?? 'minima';
const PASSWORD = process.env.MINIMA_RPC_PASSWORD;
const COIN_ID = process.env.MINIMA_DEPOSIT_COINID;
const OWNER = process.env.MINIMA_DEPOSIT_ADDRESS;

const configured = Boolean(PASSWORD && COIN_ID && OWNER);

function client(): MinimaRpcClient {
  return createMinimaRpcClient({ host: HOST, port: PORT, username: USERNAME, password: PASSWORD as string });
}

const run = configured ? describe : describe.skip;

run('live-node deposit verification', () => {
  it('confirms an unspent owned coin as a valid deposit', async () => {
    const provider = new MinimaRpcProvider(client());
    const result = await provider.verifyDeposit({
      coinId: COIN_ID as string,
      ownerAddress: OWNER as string,
    });
    expect(result.exists).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('fails validation for a different owner address', async () => {
    const provider = new MinimaRpcProvider(client());
    const result = await provider.verifyDeposit({
      coinId: COIN_ID as string,
      ownerAddress: 'MxFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
    });
    expect(result.valid).toBe(false);
    expect(result.ownedByOwner).toBe(false);
  });

  it('returns an MMR root for offline proof anchoring', async () => {
    const provider = new MinimaRpcProvider(client());
    const root = await provider.getMmrRoot();
    expect(typeof root).toBe('string');
    expect((root as string).length).toBeGreaterThan(0);
  });

  it('offline verify rejects a forged root', () => {
    const pubkeys = [0, 1, 2, 3].map((i) => new Uint8Array([i, i, i, i]));
    const tree = MMRTree.fromPublicKeys(pubkeys);
    const proof = tree.getProof(1);
    const forgery = new Uint8Array(32).fill(0xab);
    expect(verifyDepositMmrProof(pubkeys[1], proof as never, forgery)).toBe(false);
  });
});