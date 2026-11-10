import { fromChainProvider, fromMinimaRpc } from '../../../packages/tx-builder/src/coin-provider';
import { buildFundedPayment } from '../../../packages/tx-builder/src/fund';
import { signAndSerialize, reserveSigningIndices, commitSigningReservation } from '../../../packages/tx-builder/src/signer';
import { dryRunViaNode, submitSignedTxn, mineTransaction } from '../../../packages/tx-builder/src/submit';
import { createRawNodeCommandClient } from '../../../packages/tx-builder/src/node-transport';
import { createServer } from 'node:http';
import { createSignedByDescriptor } from '@totemsdk/core';
import type { WotsSignatureData } from '../../../packages/tx-builder/src/build';

const OWNER = '0x' + '11'.repeat(32);
const OTHER = '0x' + '22'.repeat(32);
const PUB = '0x' + '66'.repeat(32);
const TOKEN = '0x' + 'cd'.repeat(32);
const FEE = '0x' + '33'.repeat(32);

function chainProvider() {
  return {
    async getCoins(query: { address?: string; tokenId?: string }) {
      if (query.tokenId === TOKEN) {
        return [
          { coinid: '0x' + 'a1'.repeat(32), address: OWNER, amount: '60', tokenid: TOKEN, spent: false },
          { coinid: '0x' + 'a2'.repeat(32), address: OWNER, amount: '50', tokenid: TOKEN, spent: false },
          { coinid: '0x' + 'a3'.repeat(32), address: OWNER, amount: '1', tokenid: TOKEN, spent: true },
        ];
      }
      return [
        { coinid: '0x' + 'b1'.repeat(32), address: OWNER, amount: '1000', tokenid: '0x00', spent: false },
      ];
    },
    async exportCoin(coinId: string) {
      return { coinid: coinId, data: '0xdeadbeef' };
    },
  };
}

function wotsData(): WotsSignatureData {
  return {
    rootPublicKey: PUB,
    hierarchical: true,
    proofs: [
      {
        leafPubkey: '0x' + '88'.repeat(32),
        signature: '0x' + '99'.repeat(1088),
        mmrProof: '0x00',
      },
    ],
  };
}

describe('tx-builder P1', () => {
  test('adapts chain-provider coins and proofs', async () => {
    const provider = fromChainProvider(chainProvider());
    const coins = await provider.getCoins({ address: OWNER, tokenId: TOKEN });
    expect(coins).toHaveLength(3);
    expect(coins[0]).toMatchObject({ coinId: '0x' + 'a1'.repeat(32), tokenId: TOKEN });
    expect(await provider.getCoinProof(coins[1].coinId)).toBe('0xdeadbeef');
  });

  test('adapts raw Minima RPC coins', async () => {
    const provider = fromMinimaRpc({
      async coins() {
        return [{ coinid: '0x' + 'a1'.repeat(32), address: OWNER, amount: '10', tokenid: '0x00' }];
      },
      async coinExport() {
        return { data: '0xbeef' };
      },
    });
    const coins = await provider.getCoins({ address: OWNER, sendable: true });
    expect(coins[0].coinId).toBe('0x' + 'a1'.repeat(32));
    expect(await provider.getCoinProof(coins[0].coinId)).toBe('0xbeef');
  });

  test('selects token coins, a fee coin, and builds change', async () => {
    const funded = await buildFundedPayment({
      provider: fromChainProvider(chainProvider()),
      ownerAddresses: [OWNER],
      recipient: OTHER,
      amount: '80',
      tokenId: TOKEN,
      ownerPublicKey: PUB,
      feeAmount: '100',
      fetchProofs: true,
    });
    expect(funded.selected).toHaveLength(2);
    expect(funded.change).toBe('30');
    expect(funded.feeCoin).toMatchObject({ tokenId: '0x00', amount: '1000' });
    expect(funded.buildParams.inputs).toHaveLength(3);
    expect(funded.buildParams.inputs.every((i) => Boolean(i.coinProofHex))).toBe(true);
    expect(funded.buildParams.outputs).toEqual([
      { address: OTHER, amount: '80', tokenId: TOKEN },
      { address: OWNER, amount: '30', tokenId: TOKEN },
      { address: OWNER, amount: '1000', tokenId: '0x00' },
    ]);
  });

  test('does not duplicate an explicit fee coin that is already a selected input', async () => {
    const funded = await buildFundedPayment({
      provider: fromChainProvider(chainProvider()),
      ownerAddresses: [OWNER],
      recipient: OTHER,
      amount: '600',
      tokenId: '0x00',
      ownerPublicKey: PUB,
      feeCoinId: '0x' + 'b1'.repeat(32),
    });
    expect(funded.feeCoin).toBeUndefined();
    expect(funded.buildParams.inputs.map((i) => i.coinId)).toEqual(['0x' + 'b1'.repeat(32)]);
    expect(funded.buildParams.outputs).toEqual([
      { address: OTHER, amount: '600', tokenId: '0x00' },
      { address: OWNER, amount: '400', tokenId: '0x00' },
    ]);
  });

  test('signAndSerialize produces a TxnRow', async () => {
    const params = {
      inputs: [
        {
          coinId: '0x' + 'a1'.repeat(32),
          address: OWNER,
          amount: '10',
          tokenId: '0x00',
          scriptDescriptor: createSignedByDescriptor(OWNER, PUB),
        },
      ],
      outputs: [{ address: OTHER, amount: '9', tokenId: '0x00' }],
    };
    const signed = await signAndSerialize(params, { async sign() { return { wotsData: wotsData() }; } }, 'txn-p1');
    expect(signed.txnRow.length).toBeGreaterThan(0);
    expect(signed.digestHex).toBe(signed.built.digestTxHex);
  });

  test('lease helpers reserve and commit', async () => {
    const calls: string[] = [];
    const lease = {
      async reserveKeyUse() {
        calls.push('reserve');
        return { reservationId: 'r1', indices: { addressIndex: 0, l1: 1, l2: 2 }, expiresAt: Date.now() + 1000 };
      },
      async commitKeyUse(reservationId: string, txId: string) {
        calls.push(`commit:${reservationId}:${txId}`);
      },
      async burnReservation() {
        calls.push('burn');
      },
    };
    const reservation = await reserveSigningIndices(lease, { treeId: 'tree', digestHex: '0x' + '11'.repeat(32) });
    await commitSigningReservation(lease, reservation.reservationId, 'tx1');
    expect(calls).toEqual(['reserve', 'commit:r1:tx1']);
  });

  test('dry run and signed submit use txncheck/txnimport/txnpost', async () => {
    const calls: Array<[string, unknown]> = [];
    const client = {
      async command(name: string, params?: Record<string, unknown>) {
        calls.push([name, params]);
        if (name === 'txncheck') return { valid: true };
        if (name === 'txnpost') return { response: { txpowid: '0xabc' } };
        return { status: true };
      },
    };
    expect((await dryRunViaNode(client, 'txn-1')).valid).toBe(true);
    const submitted = await submitSignedTxn(client, { txnId: 'txn-1', txnRowHex: '0xdead' });
    expect(submitted.txpowid).toBe('0xabc');
    expect(calls.map(([name]) => name)).toEqual(['txncheck', 'txnimport', 'txnpost']);
    expect(calls[1][1]).toMatchObject({ id: 'txn-1', data: '0xdead' });
  });

  test('raw node transport preserves script spaces', async () => {
    let body = '';
    const server = createServer((req, res) => {
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: true, response: { ok: true } }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    const client = createRawNodeCommandClient({
      url: `http://127.0.0.1:${address.port}`,
      username: 'minima',
      password: 'test',
    });
    await client.command('txnscript', { id: 't1', scripts: { 'RETURN TRUE': '' } });
    expect(body).toContain('txnscript id:t1');
    expect(body).toContain('{"RETURN TRUE":""}');
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('mines a transaction into a TxPoW envelope', async () => {
    const built = await signAndSerialize(
      {
        inputs: [
          {
            coinId: '0x' + 'a1'.repeat(32),
            address: OWNER,
            amount: '10',
            tokenId: '0x00',
            scriptDescriptor: createSignedByDescriptor(OWNER, PUB),
          },
        ],
        outputs: [{ address: OTHER, amount: '9', tokenId: '0x00' }],
      },
      { async sign() { return { wotsData: wotsData() }; } },
      'txn-mine',
    );
    const mined = await mineTransaction({
      transaction: built.built.transaction,
      witness: built.witness,
      target: new Uint8Array(32).fill(0xff),
      mineOptions: { maxIterations: 10_000, _skipWorker: true } as any,
    });
    expect(mined.txpowHex.startsWith('0x')).toBe(true);
    expect(mined.txpowId).toMatch(/^0x[0-9a-f]{64}$/i);
  });
});
