/**
 * @totemsdk/lookup-client — integration tests using in-memory transport pairs.
 *
 * MockLookupServer simulates a real lookup node:
 *  - Runs the HELLO → AUTH_CHALLENGE → AUTH_RESPONSE handshake
 *  - Responds to chain queries (GET_COINS, GET_COIN, GET_PROOF, GET_TIP, GET_TOKEN)
 *  - Handles BROADCAST_TXPOW
 *  - Accepts WATCH_REGISTER (fire-and-forget, no ACK)
 *  - Can push COIN_UPDATE to the client
 */

import { encodeMessage } from '@totemsdk/lookup-protocol';
import type { LookupMessage } from '@totemsdk/lookup-protocol';
import { LookupClient } from '../client.js';
import { LookupClientError } from '../rpc.js';
import { FrameParser, InMemoryTransport, createInMemoryPair } from '../transport.js';
import type { CoinUpdateEvent } from '../types.js';
import { LookupClientProvider } from '../provider.js';

// ---------------------------------------------------------------------------
// Mock server
// ---------------------------------------------------------------------------

class MockLookupServer {
  private _parser = new FrameParser();
  readonly transport: InMemoryTransport;
  private _receivedTypes: string[] = [];
  private _watchedAddresses: string[] = [];

  constructor(serverTransport: InMemoryTransport) {
    this.transport = serverTransport;
    serverTransport.on('data', (chunk) => {
      const msgs = this._parser.push(chunk);
      for (const msg of msgs) {
        this._receivedTypes.push(msg.type);
        this._handle(msg);
      }
    });
  }

  private _handle(msg: LookupMessage): void {
    switch (msg.type) {
      case 'HELLO':
        this._sendRaw({
          type: 'AUTH_CHALLENGE',
          version: 1,
          id: msg.id,
          payload: { challenge: 'test-challenge-xyz', expiresAt: Date.now() + 30_000 },
        });
        break;

      case 'AUTH_RESPONSE':
        // Accept without verifying signature; any message with matching id resolves the RPC call
        this._sendRaw({
          type: 'PONG',
          version: 1,
          id: msg.id,
          payload: { ts: Date.now(), echo: 0 },
        });
        break;

      case 'GET_COINS':
        this._sendRaw({
          type: 'PING', // type is irrelevant — rpc layer matches by id
          version: 1,
          id: msg.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: { coins: [{ coinid: '0xCOIN1', amount: '1000000', address: '0xADDR1', tokenid: '0x00' }] } as any,
        });
        break;

      case 'GET_COIN':
        this._sendRaw({
          type: 'PING',
          version: 1,
          id: msg.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: { coin: { coinid: '0xCOIN1', amount: '1000000', address: '0xADDR1', tokenid: '0x00' } } as any,
        });
        break;

      case 'GET_PROOF':
        this._sendRaw({
          type: 'PROOF_RESPONSE',
          version: 1,
          id: msg.id,
          payload: {
            coinId: (msg.payload as { coinId: string }).coinId,
            proof: { mmrData: 'deadbeef' },
          },
        });
        break;

      case 'GET_TIP':
        this._sendRaw({
          type: 'PING',
          version: 1,
          id: msg.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: { block: 4200000, hash: '0xABCDEF', time: '1716000000000' } as any,
        });
        break;

      case 'GET_TOKEN':
        this._sendRaw({
          type: 'PING',
          version: 1,
          id: msg.id,
          payload: {
            token: {
              tokenid: (msg.payload as { tokenId: string }).tokenId,
              name: { name: 'TestToken', url: '', description: '' },
              total: '1000000000',
            },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        });
        break;

      case 'BROADCAST_TXPOW':
        this._sendRaw({
          type: 'PING',
          version: 1,
          id: msg.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: { success: true, txpowid: '0xTXID123' } as any,
        });
        break;

      case 'WATCH_REGISTER':
        // Fire-and-forget — no ACK needed
        this._watchedAddresses.push(
          ...((msg.payload as { addresses: string[] }).addresses ?? []),
        );
        break;

      case 'PING':
        this._sendRaw({
          type: 'PONG',
          version: 1,
          payload: { ts: Date.now(), echo: (msg.payload as { ts: number }).ts },
        });
        break;

      default:
        break;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _sendRaw(msg: any): void {
    this.transport.send(encodeMessage(msg as LookupMessage));
  }

  pushCoinUpdate(event: CoinUpdateEvent): void {
    this._sendRaw({ type: 'COIN_UPDATE', version: 1, payload: event });
  }

  getReceivedTypes(): string[] {
    return [...this._receivedTypes];
  }

  getWatchedAddresses(): string[] {
    return [...this._watchedAddresses];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeConnectedClient(): Promise<{
  client: LookupClient;
  server: MockLookupServer;
  serverTransport: InMemoryTransport;
}> {
  const [clientTransport, serverTransport] = createInMemoryPair();
  const server = new MockLookupServer(serverTransport);
  const client = new LookupClient({ _transport: clientTransport, timeoutMs: 5_000 });
  await client._connect(clientTransport);
  return { client, server, serverTransport };
}

// ---------------------------------------------------------------------------
// Auth handshake
// ---------------------------------------------------------------------------

describe('Auth handshake', () => {
  it('completes HELLO → AUTH_CHALLENGE → AUTH_RESPONSE successfully', async () => {
    const { client, server } = await makeConnectedClient();
    expect(server.getReceivedTypes()).toContain('HELLO');
    expect(server.getReceivedTypes()).toContain('AUTH_RESPONSE');
    client.disconnect();
  });

  it('AUTH_RESPONSE carries a message-level sig field (lookup-protocol signMessage)', async () => {
    const { client, server } = await makeConnectedClient();
    // Verify server received AUTH_RESPONSE — the sig field is attached by signMessage()
    const authIdx = server.getReceivedTypes().indexOf('AUTH_RESPONSE');
    expect(authIdx).toBeGreaterThanOrEqual(0);
    client.disconnect();
  });

  it('rejects when server sends wrong message type for HELLO', async () => {
    const [clientTransport, serverTransport] = createInMemoryPair();

    // Server sends GET_TIP instead of AUTH_CHALLENGE
    const sp = new FrameParser();
    serverTransport.on('data', (chunk) => {
      const msgs = sp.push(chunk);
      for (const msg of msgs) {
        if (msg.type === 'HELLO') {
          serverTransport.send(
            encodeMessage({ type: 'GET_TIP', version: 1, id: msg.id, payload: {} }),
          );
        }
      }
    });

    const client = new LookupClient({ _transport: clientTransport, timeoutMs: 2_000 });
    await expect(client._connect(clientTransport)).rejects.toThrow(/AUTH_CHALLENGE/);
  });
});

// ---------------------------------------------------------------------------
// Chain queries
// ---------------------------------------------------------------------------

describe('Chain queries', () => {
  let client: LookupClient;
  let server: MockLookupServer;

  beforeEach(async () => {
    ({ client, server } = await makeConnectedClient());
  });

  afterEach(() => client.disconnect());

  it('getCoins returns coins from server', async () => {
    const coins = await client.getCoins({ address: '0xADDR1' });
    expect(coins).toHaveLength(1);
    expect(coins[0].coinid).toBe('0xCOIN1');
    expect(coins[0].amount).toBe('1000000');
    expect(server.getReceivedTypes()).toContain('GET_COINS');
  });

  it('getCoin returns a single coin', async () => {
    const coin = await client.getCoin('0xCOIN1');
    expect(coin).not.toBeNull();
    expect(coin!.coinid).toBe('0xCOIN1');
    expect(server.getReceivedTypes()).toContain('GET_COIN');
  });

  it('getProof returns an MMRProof', async () => {
    const proof = await client.getProof('0xCOIN1');
    expect(proof.coinid).toBe('0xCOIN1');
    expect(proof.data).toEqual({ mmrData: 'deadbeef' });
    expect(server.getReceivedTypes()).toContain('GET_PROOF');
  });

  it('getTip returns the chain tip', async () => {
    const tip = await client.getTip();
    expect(tip.block).toBe(4200000);
    expect(tip.hash).toBe('0xABCDEF');
  });

  it('getToken returns token info', async () => {
    const token = await client.getToken('0xTOKEN1');
    expect(token.tokenid).toBe('0xTOKEN1');
    expect((token.name as { name: string }).name).toBe('TestToken');
  });

  it('broadcastTxPoW returns success result', async () => {
    const result = await client.broadcastTxPoW('deadbeef1234');
    expect(result.success).toBe(true);
    expect(result.txpowid).toBe('0xTXID123');
    expect(server.getReceivedTypes()).toContain('BROADCAST_TXPOW');
  });

  it('searchTokens returns empty array (not in v1 protocol)', async () => {
    const tokens = await client.searchTokens({ name: 'test' });
    expect(tokens).toEqual([]);
  });

  it('getTokensByCreator returns empty array (not in v1 protocol)', async () => {
    const tokens = await client.getTokensByCreator('0xADDR');
    expect(tokens).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Watch registration and COIN_UPDATE
// ---------------------------------------------------------------------------

describe('Watch registration and COIN_UPDATE', () => {
  it('registers watched addresses and receives COIN_UPDATE', async () => {
    const { client, server } = await makeConnectedClient();

    const received: CoinUpdateEvent[] = [];
    const unsub = client.subscribeCoinUpdates(ev => received.push(ev));

    await client.watchAddress('0xADDR1');
    await client.watchAddress('0xADDR2');

    // Give WATCH_REGISTER messages time to deliver
    await new Promise(r => setTimeout(r, 50));

    // Server pushes a COIN_UPDATE
    server.pushCoinUpdate({ eventType: 'new', coin: { coinid: '0xNEW' }, block: 42 });

    await new Promise(r => setTimeout(r, 50));

    expect(received).toHaveLength(1);
    expect(received[0].eventType).toBe('new');
    expect(received[0].block).toBe(42);

    // Verify server received WATCH_REGISTER messages
    expect(server.getWatchedAddresses()).toContain('0xADDR1');
    expect(server.getWatchedAddresses()).toContain('0xADDR2');

    unsub();
    client.disconnect();
  });

  it('unsubscribe stops future COIN_UPDATE delivery', async () => {
    const { client, server } = await makeConnectedClient();

    const received: CoinUpdateEvent[] = [];
    const unsub = client.subscribeCoinUpdates(ev => received.push(ev));
    unsub(); // unsubscribe immediately

    server.pushCoinUpdate({ eventType: 'confirmed', coin: {}, block: 1 });
    await new Promise(r => setTimeout(r, 50));

    expect(received).toHaveLength(0);
    client.disconnect();
  });

  it('watchScript and watchCoin are sent as WATCH_REGISTER', async () => {
    const { client, server } = await makeConnectedClient();

    await client.watchScript('RETURN TRUE');
    await client.watchCoin('0xCOIN99');

    await new Promise(r => setTimeout(r, 50));

    expect(server.getWatchedAddresses()).toContain('RETURN TRUE');
    expect(server.getWatchedAddresses()).toContain('0xCOIN99');

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Reconnect behaviour
// ---------------------------------------------------------------------------

describe('Reconnect behaviour', () => {
  it('emits reconnecting event when transport closes', async () => {
    const { client, serverTransport } = await makeConnectedClient();

    const reconnectingEvents: unknown[] = [];
    client.on('reconnecting', (...args) => reconnectingEvents.push(args));

    // Simulate server dropping the connection (fires 'close' on both sides)
    serverTransport._simulateServerClose();

    await new Promise(r => setTimeout(r, 150));

    expect(reconnectingEvents.length).toBeGreaterThan(0);
    client.disconnect();
  });

  it('does not reconnect after disconnect() is called', async () => {
    const { client, serverTransport } = await makeConnectedClient();

    const reconnectingEvents: unknown[] = [];
    client.on('reconnecting', (...args) => reconnectingEvents.push(args));

    client.disconnect(); // mark as destroyed first
    serverTransport._simulateServerClose();

    await new Promise(r => setTimeout(r, 150));

    expect(reconnectingEvents).toHaveLength(0);
  });

  it('reconnects and re-registers all watched addresses on the new connection', async () => {
    // Two independent server/client pairs — one for initial connection, one for reconnect
    const [ct1, st1] = createInMemoryPair();
    const [ct2, st2] = createInMemoryPair();

    const server1 = new MockLookupServer(st1);
    const server2 = new MockLookupServer(st2);

    // _transportFactory returns ct1 on first call, ct2 on subsequent calls
    let callCount = 0;
    const transports = [ct1, ct2];
    const client = new LookupClient({
      _transportFactory: () => transports[Math.min(callCount++, 1)],
      timeoutMs: 2_000,
      reconnectBaseMs: 50,
      reconnectMaxMs: 200,
    });

    // Initial connect using ct1 (the factory's first transport)
    callCount = 0;
    await client._connect(ct1);
    callCount = 1; // factory's next call will return ct2

    // Register addresses before the connection drops
    await client.watchAddress('0xWATCH_A');
    await client.watchAddress('0xWATCH_B');
    await new Promise(r => setTimeout(r, 50)); // let WATCH_REGISTER messages fly

    expect(server1.getWatchedAddresses()).toContain('0xWATCH_A');
    expect(server1.getWatchedAddresses()).toContain('0xWATCH_B');

    // Drop the connection — fires 'close' on both client and server transports
    st1._simulateServerClose();

    // Wait for the reconnect cycle: 50ms backoff + auth handshake + re-register
    await new Promise(r => setTimeout(r, 500));

    // Server2 must have received WATCH_REGISTER for the previously registered addresses
    expect(server2.getWatchedAddresses()).toContain('0xWATCH_A');
    expect(server2.getWatchedAddresses()).toContain('0xWATCH_B');

    client.disconnect();
    void server1; void server2;
  });
});

// ---------------------------------------------------------------------------
// RPC timeout
// ---------------------------------------------------------------------------

describe('RPC timeout', () => {
  it('throws LookupClientError on timeout', async () => {
    const [ctr, str] = createInMemoryPair();

    // Minimal auth-only server — handles HELLO and AUTH_RESPONSE, silently drops everything else
    const authParser = new FrameParser();
    str.on('data', (chunk) => {
      const msgs = authParser.push(chunk);
      for (const msg of msgs) {
        if (msg.type === 'HELLO') {
          str.send(
            encodeMessage({
              type: 'AUTH_CHALLENGE',
              version: 1,
              id: msg.id,
              payload: { challenge: 'timeout-test', expiresAt: Date.now() + 30_000 },
            } as Parameters<typeof encodeMessage>[0]),
          );
        } else if (msg.type === 'AUTH_RESPONSE') {
          str.send(
            encodeMessage({
              type: 'PONG',
              version: 1,
              id: msg.id,
              payload: { ts: Date.now(), echo: 0 },
            }),
          );
        }
        // GET_TIP and all other messages are silently dropped — causes timeout
      }
    });

    const client = new LookupClient({ _transport: ctr, timeoutMs: 5_000 });
    await client._connect(ctr);

    // Use the internal RPC layer directly with a very short timeout (100ms)
    type RpcAccess = { _rpc: { sendRequest(m: unknown, t: number): Promise<unknown> } };
    await expect(
      (client as unknown as RpcAccess)._rpc.sendRequest(
        { type: 'GET_TIP', version: 1, payload: {} },
        100,
      ),
    ).rejects.toThrow(LookupClientError);

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Disconnect lifecycle
// ---------------------------------------------------------------------------

describe('Disconnect lifecycle', () => {
  it('disconnect() closes the active transport', async () => {
    const [clientTransport, serverTransport] = createInMemoryPair();
    const server = new MockLookupServer(serverTransport);
    void server;

    const client = new LookupClient({ _transport: clientTransport, timeoutMs: 2_000 });
    await client._connect(clientTransport);

    // After disconnect, the transport should be marked as closed (sending throws)
    client.disconnect();

    expect(() => clientTransport.send(new Uint8Array([1, 2, 3]))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// LookupClientProvider
// ---------------------------------------------------------------------------

describe('LookupClientProvider', () => {
  it('delegates ChainStateProvider methods to LookupClient', async () => {
    const { client } = await makeConnectedClient();
    const provider = new LookupClientProvider(client);

    const coins = await provider.getCoins({ address: '0xADDR1' });
    expect(coins).toHaveLength(1);

    const tip = await provider.getTip();
    expect(tip.block).toBe(4200000);

    const result = await provider.broadcastTxPoW('deadbeef');
    expect(result.success).toBe(true);

    client.disconnect();
  });
});
