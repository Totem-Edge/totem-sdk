/**
 * End-to-end: real control server + env-seeded signer.
 *
 * Boots createOmniaHost with a real JSON-RPC/WebSocket control server on an
 * ephemeral port, an injected MinimalChainProvider mock, and a signer derived
 * from OMNIA_HOST_SEED. Exercises openChannel → pay → settle over HTTP JSON-RPC.
 */

jest.mock('@totemsdk/txpow', () => ({
  ...jest.requireActual('@totemsdk/txpow'),
  mineTxPoW: jest.fn(async (_txBody: Uint8Array, _target: Uint8Array) => ({
    minedHeaderBytes: new Uint8Array(100).fill(0x01),
    txpowId: new Uint8Array(32).fill(0xab),
    nonce: 42n,
    elapsedMs: 0,
    source: 'js' as const,
  })),
}));

import http from 'node:http';
import { createOmniaHost } from '../lifecycle.js';
import { createHostSigning } from '../signing.js';
import { loadConfigFromEnv } from '../config.js';

const HEX_SEED = '0x' + 'ab'.repeat(32);

function rpcCall(port: number, method: string, params: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: '/rpc',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (payload.error) reject(new Error(payload.error.message));
        else resolve(payload.result);
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

describe('omnia-host end-to-end (real control server)', () => {
  it('openChannel → pay → settle with an env-seeded signer', async () => {
    const port = 20000 + Math.floor(Math.random() * 20000);
    const config = loadConfigFromEnv({
      OMNIA_HOST_SEED: HEX_SEED,
      OMNIA_HOST_PORT: String(port),
      OMNIA_HOST_DB: `/tmp/omnia-host-e2e-${port}.sqlite`,
      OMNIA_LOCAL_PARTY_ID: 'alice',
      OMNIA_LOCAL_ADDRESS_INDEX: '0',
    });
    const signing = createHostSigning(config);

    const chainProvider = {
      broadcastTxPoW: jest.fn(async () => ({ txpowid: '0xtxpow-e2e' })),
      getToken: jest.fn(async (tokenId: string) => ({ tokenId, name: { name: 'Test' }, amount: '0', script: 'RETURN TRUE' })),
    };

    const host = createOmniaHost(config, {
      channelStore: new Map(),
      operationStore: {
        get: () => undefined,
        create: () => ({ operationId: 'x', status: 'pending' }),
        transition: () => ({ operationId: 'x', status: 'committed' }),
        listByStatus: () => [],
        close: jest.fn(async () => undefined),
      } as any,
      swarm: {
        advertise: jest.fn(),
        connectToPeer: jest.fn(async () => ({
          pubkey: 'peer',
          channelId: 'channel',
          sendMessage: jest.fn(),
          onMessage: jest.fn(),
          disconnect: jest.fn(),
          isConnected: jest.fn(() => true),
        })),
        listenForChannels: jest.fn(() => jest.fn()),
        broadcast: jest.fn(),
        close: jest.fn(async () => undefined),
      } as any,
      chainProvider: chainProvider as any,
      signer: signing.signer,
      leaseProvider: signing.leaseProvider,
      identity: { address: signing.address, publicKeyDigest: signing.publicKeyDigest },
      localParticipant: {
        partyId: 'alice',
        publicKeyDigest: signing.publicKeyDigest,
        addressIndex: 0,
        settlementAddress: '0x' + '44'.repeat(32),
      },
    });

    await host.start();
    try {
      const whoami = await rpcCall(port, 'totem_omniaWhoami', {});
      expect(whoami).toMatchObject({ address: signing.address, publicKeyDigest: signing.publicKeyDigest });

      const opened = await rpcCall(port, 'totem_omniaOpenChannel', {
        operationId: 'e2e-open',
        remotePartyId: 'bob',
        remotePublicKeyDigest: '0x' + 'bb'.repeat(32),
        remoteAddressIndex: 1,
        remoteSettlementAddress: '0x' + '55'.repeat(32),
        localAmount: '600',
        remoteAmount: '400',
        fundingCoinId: '0x' + 'aa'.repeat(32),
        fundingWitnessHex: '0x0909',
      });
      expect(opened).toMatchObject({ success: true });
      const channelId = opened.channelId as string;
      expect(channelId).toBeTruthy();

      // Simulate on-chain funding confirmation: activate the channel.
      const stored = host.channels!.get(channelId)!;
      host.channels!.set(channelId, { ...stored, status: 'active' });

      const paid = await rpcCall(port, 'totem_omniaPay', {
        operationId: 'e2e-pay',
        channelId,
        amount: '100',
      });
      expect(paid).toMatchObject({ success: true, sequence: 1 });

      const settled = await rpcCall(port, 'totem_omniaSettle', {
        operationId: 'e2e-settle',
        channelId,
        broadcastProofs: {
          coinProofs: ['0x010203'],
          scriptProofs: ['0x040506'],
        },
      });
      expect(settled).toMatchObject({ success: true });
      expect(chainProvider.broadcastTxPoW).toHaveBeenCalled();
    } finally {
      await host.close();
    }
  }, 60000);
});
