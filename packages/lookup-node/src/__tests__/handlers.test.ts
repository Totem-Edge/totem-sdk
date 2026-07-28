/**
 * Query handler integration tests.
 *
 * Tests GET_COINS, GET_COIN, GET_PROOF, GET_TIP, GET_TOKEN, and BROADCAST_TXPOW
 * through a full ClientSession flow (with _skipAuth for convenience).
 */

import { LookupNode } from '../node.js';
import {
  makeMockProvider,
  connectTestClient,
  DEFAULT_COIN,
  DEFAULT_TIP,
  DEFAULT_TOKEN,
  DEFAULT_PROOF,
} from './helpers.js';

function makeNode(providerOverrides = {}) {
  return new LookupNode({
    provider: makeMockProvider(providerOverrides),
    pollIntervalMs: 60_000, // don't auto-poll in unit tests
    _skipAuth: true,
  });
}

describe('Query handlers', () => {
  it('GET_COINS returns coins from provider', async () => {
    const node = makeNode();
    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, {
      type: 'GET_COINS',
      version: 1,
      id: 'req-gc',
      payload: { address: '0xADDR1' },
    });

    const response = await buffer.waitFor((m) => m.id === 'req-gc');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coins = (response.payload as any).coins as typeof DEFAULT_COIN[];
    expect(Array.isArray(coins)).toBe(true);
    expect(coins[0].coinid).toBe('0xCOIN1');
    expect(coins[0].amount).toBe('1000000');
  });

  it('GET_COIN returns a single coin', async () => {
    const node = makeNode();
    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, {
      type: 'GET_COIN',
      version: 1,
      id: 'req-gco',
      payload: { coinId: '0xCOIN1' },
    });

    const response = await buffer.waitFor((m) => m.id === 'req-gco');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coin = (response.payload as any).coin;
    expect(coin).not.toBeNull();
    expect(coin.coinid).toBe('0xCOIN1');
  });

  it('GET_PROOF returns a PROOF_RESPONSE with matching coinId', async () => {
    const node = makeNode();
    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, {
      type: 'GET_PROOF',
      version: 1,
      id: 'req-gp',
      payload: { coinId: '0xCOIN1' },
    });

    const response = await buffer.waitFor((m) => m.id === 'req-gp');
    expect(response.type).toBe('PROOF_RESPONSE');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response.payload as any).coinId).toBe(DEFAULT_PROOF.coinid);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response.payload as any).proof).toEqual(DEFAULT_PROOF.data);
  });

  it('GET_TIP returns chain tip info', async () => {
    const node = makeNode();
    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, {
      type: 'GET_TIP',
      version: 1,
      id: 'req-gt',
      payload: {},
    });

    const response = await buffer.waitFor((m) => m.id === 'req-gt');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = response.payload as any;
    expect(p.block).toBe(DEFAULT_TIP.block);
    expect(p.hash).toBe(DEFAULT_TIP.hash);
  });

  it('GET_TOKEN returns token info', async () => {
    const node = makeNode();
    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, {
      type: 'GET_TOKEN',
      version: 1,
      id: 'req-gto',
      payload: { tokenId: '0xTOKEN1' },
    });

    const response = await buffer.waitFor((m) => m.id === 'req-gto');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = (response.payload as any).token;
    expect(token.tokenid).toBe(DEFAULT_TOKEN.tokenid);
  });

  it('BROADCAST_TXPOW (no relay) passes through to provider', async () => {
    const node = makeNode();
    const { buffer, clientTransport } = await connectTestClient(node);

    const txpow = 'ab'.repeat(100); // 200 hex chars
    buffer.send(clientTransport, {
      type: 'BROADCAST_TXPOW',
      version: 1,
      id: 'req-bc',
      payload: { txpowHex: txpow },
    });

    const response = await buffer.waitFor((m) => m.id === 'req-bc');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response.payload as any).success).toBe(true);
  });

  it('rate-limits clients exceeding rateLimitRpm', async () => {
    const node = new LookupNode({
      provider: makeMockProvider(),
      _skipAuth: true,
      rateLimitRpm: 2, // very low limit for testing
    });
    const { buffer, clientTransport } = await connectTestClient(node);

    // Send 3 requests — third should be rate-limited
    for (let i = 0; i < 3; i++) {
      buffer.send(clientTransport, {
        type: 'GET_TIP',
        version: 1,
        id: `req-rl-${i}`,
        payload: {},
      });
    }

    await buffer.waitFor((m) => m.type === 'ERROR' && m.payload.message?.includes('Too many'));
  });

  it('unauthenticated client receives AUTH_REQUIRED for queries', async () => {
    const node = new LookupNode({ provider: makeMockProvider(), pollIntervalMs: 60_000 });
    const [clientTransport, serverTransport] = await import('./helpers.js').then(
      ({ createTestPair }) => createTestPair(),
    );
    const buffer = await import('./helpers.js').then(({ MessageBuffer }) => new MessageBuffer(clientTransport));
    node.handleConnection(serverTransport);

    // Skip auth — send query directly
    buffer.send(clientTransport, {
      type: 'GET_TIP',
      version: 1,
      id: 'req-unauth',
      payload: {},
    });

    const errorMsg = await buffer.waitFor((m) => m.type === 'ERROR');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((errorMsg.payload as any).code).toBe('AUTH_REQUIRED');
  });
});
