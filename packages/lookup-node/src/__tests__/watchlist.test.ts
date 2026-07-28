/**
 * Watchlist + COIN_UPDATE push tests.
 *
 * Covers:
 *   - WATCH_REGISTER stores addresses in the watchlist
 *   - On new block, queries coins for watched addresses
 *   - Detects new coins → pushes COIN_UPDATE { eventType: 'new' }
 *   - Detects spent coins → pushes COIN_UPDATE { eventType: 'spent' }
 *   - WATCH_REMOVE cleans up the watchlist
 *   - Disconnected clients are removed from the watchlist
 */

import type { Coin, ChainTip } from '@totemsdk/chain-provider';
import { LookupNode } from '../node.js';
import { makeMockProvider, connectTestClient } from './helpers.js';

const COIN_A: Coin = { coinid: '0xCOIN_A', amount: '500', address: '0xWATCH', tokenid: '0x00' };
const COIN_B: Coin = { coinid: '0xCOIN_B', amount: '300', address: '0xWATCH', tokenid: '0x00' };

describe('Watchlist + COIN_UPDATE', () => {
  it('registers watched address and pushes COIN_UPDATE on new coin', async () => {
    let tipBlock = 1000;
    let coinsForWatch: Coin[] = [];

    const provider = makeMockProvider({
      getTip: jest.fn(async (): Promise<ChainTip> => ({ block: tipBlock, hash: `0x${tipBlock}` })),
      getCoins: jest.fn(async () => coinsForWatch),
    });

    const node = new LookupNode({ provider, pollIntervalMs: 60_000, _skipAuth: true });
    await node.start();

    const { buffer, clientTransport } = await connectTestClient(node);

    // Register a watch
    buffer.send(clientTransport, {
      type: 'WATCH_REGISTER',
      version: 1,
      payload: { addresses: ['0xWATCH'] },
    });

    await new Promise((r) => setTimeout(r, 30)); // let WATCH_REGISTER process

    // First poll: block 1001, COIN_A appears
    tipBlock = 1001;
    coinsForWatch = [COIN_A];
    await node.watchlist.forcePoll();

    const newCoinUpdate = await buffer.waitFor(
      (m) => m.type === 'COIN_UPDATE' && (m.payload as { eventType: string }).eventType === 'new',
    );
    expect((newCoinUpdate.payload as { coin: Coin }).coin.coinid).toBe('0xCOIN_A');
    expect((newCoinUpdate.payload as { block: number }).block).toBe(1001);

    await node.stop();
  });

  it('detects spent coins and pushes COIN_UPDATE { eventType: spent }', async () => {
    let tipBlock = 2000;
    let coinsForWatch: Coin[] = [COIN_A, COIN_B]; // initial state

    const provider = makeMockProvider({
      getTip: jest.fn(async (): Promise<ChainTip> => ({ block: tipBlock, hash: `0x${tipBlock}` })),
      getCoins: jest.fn(async () => coinsForWatch),
    });

    const node = new LookupNode({ provider, pollIntervalMs: 60_000, _skipAuth: true });
    await node.start();

    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, {
      type: 'WATCH_REGISTER',
      version: 1,
      payload: { addresses: ['0xWATCH'] },
    });
    await new Promise((r) => setTimeout(r, 30));

    // First poll: establishes initial state (both coins)
    tipBlock = 2001;
    await node.watchlist.forcePoll();
    await buffer.waitFor(
      (m) => m.type === 'COIN_UPDATE' && (m.payload as { eventType: string }).eventType === 'new',
      500,
    );

    // Second poll: COIN_B is spent
    tipBlock = 2002;
    coinsForWatch = [COIN_A]; // COIN_B is gone
    await node.watchlist.forcePoll();

    const spentUpdate = await buffer.waitFor(
      (m) => m.type === 'COIN_UPDATE' && (m.payload as { eventType: string }).eventType === 'spent',
    );
    expect((spentUpdate.payload as { coin: Coin }).coin.coinid).toBe('0xCOIN_B');

    await node.stop();
  });

  it('WATCH_REMOVE stops delivery for removed addresses', async () => {
    let tipBlock = 3000;
    const provider = makeMockProvider({
      getTip: jest.fn(async (): Promise<ChainTip> => ({ block: tipBlock, hash: `0x${tipBlock}` })),
      getCoins: jest.fn(async () => [COIN_A]),
    });

    const node = new LookupNode({ provider, pollIntervalMs: 60_000, _skipAuth: true });
    await node.start();
    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, {
      type: 'WATCH_REGISTER',
      version: 1,
      payload: { addresses: ['0xWATCH'] },
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(node.watchlist.getWatchedAddresses()).toContain('0xWATCH');

    buffer.send(clientTransport, {
      type: 'WATCH_REMOVE',
      version: 1,
      payload: { addresses: ['0xWATCH'] },
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(node.watchlist.getWatchedAddresses()).not.toContain('0xWATCH');

    // Poll after remove — no COIN_UPDATE should arrive
    tipBlock = 3001;
    await node.watchlist.forcePoll();
    await new Promise((r) => setTimeout(r, 50));

    const updates = buffer.messages.filter((m) => m.type === 'COIN_UPDATE');
    expect(updates).toHaveLength(0);

    await node.stop();
  });

  it('does not push duplicate COIN_UPDATE for unchanged coins across polls', async () => {
    let tipBlock = 4000;
    const provider = makeMockProvider({
      getTip: jest.fn(async (): Promise<ChainTip> => ({ block: tipBlock, hash: `0x${tipBlock}` })),
      getCoins: jest.fn(async () => [COIN_A]),
    });

    const node = new LookupNode({ provider, pollIntervalMs: 60_000, _skipAuth: true });
    await node.start();
    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, {
      type: 'WATCH_REGISTER',
      version: 1,
      payload: { addresses: ['0xWATCH'] },
    });
    await new Promise((r) => setTimeout(r, 30));

    // First poll
    tipBlock = 4001;
    await node.watchlist.forcePoll();
    await buffer.waitFor((m) => m.type === 'COIN_UPDATE');

    // Second poll — same coin, same tip block content
    tipBlock = 4002;
    await node.watchlist.forcePoll();
    await new Promise((r) => setTimeout(r, 50));

    // Only one COIN_UPDATE (from the first poll)
    const updates = buffer.messages.filter((m) => m.type === 'COIN_UPDATE');
    expect(updates).toHaveLength(1);

    await node.stop();
  });
});
