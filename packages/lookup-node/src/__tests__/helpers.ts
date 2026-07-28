/**
 * Shared test utilities for @totemsdk/lookup-node tests.
 *
 * Provides:
 *   - TestTransport / createTestPair  — in-memory paired ITransport
 *   - MessageBuffer                   — accumulates received messages + waitFor helper
 *   - MockChainProvider               — jest-mock ChainStateProvider
 *   - connectTestClient               — full connect+auth helper using _skipAuth
 */

import { encodeMessage } from '@totemsdk/lookup-protocol';
import type { LookupMessage } from '@totemsdk/lookup-protocol';
import type { ChainStateProvider, Coin, ChainTip, MMRProof, TokenInfo, BroadcastResult } from '@totemsdk/chain-provider';
import { FrameParser } from '../framing.js';
import type { ITransport } from '../types.js';
import type { LookupNode } from '../node.js';
import type { ClientSession } from '../session.js';

// ---------------------------------------------------------------------------
// In-memory transport pair
// ---------------------------------------------------------------------------

type HandlerKey = 'data' | 'close' | 'error';

export class TestTransport implements ITransport {
  private readonly _handlers: Record<HandlerKey, Function[]> = {
    data: [],
    close: [],
    error: [],
  };
  _peer: TestTransport | null = null;
  _closed = false;

  on(event: HandlerKey, handler: Function): void {
    this._handlers[event].push(handler);
  }

  send(data: Uint8Array): void {
    if (this._closed) throw new Error('TestTransport is closed');
    const copy = new Uint8Array(data);
    setImmediate(() => {
      if (!this._peer) return;
      for (const h of this._peer._handlers.data) (h as (c: Uint8Array) => void)(copy);
    });
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    setImmediate(() => {
      for (const h of this._handlers.close) (h as () => void)();
    });
  }

  /** Simulate remote side dropping the connection (fires 'close' on THIS transport) */
  _simulateRemoteClose(): void {
    setImmediate(() => {
      for (const h of this._handlers.close) (h as () => void)();
    });
  }
}

export function createTestPair(): [TestTransport, TestTransport] {
  const a = new TestTransport();
  const b = new TestTransport();
  a._peer = b;
  b._peer = a;
  return [a, b];
}

// ---------------------------------------------------------------------------
// Message buffer — collects all received messages and allows async wait
// ---------------------------------------------------------------------------

export class MessageBuffer {
  readonly messages: LookupMessage[] = [];
  private readonly _parser = new FrameParser();

  constructor(transport: TestTransport) {
    transport.on('data', (chunk: Uint8Array) => {
      const msgs = this._parser.push(chunk);
      this.messages.push(...msgs);
    });
  }

  async waitFor(
    predicate: (msg: LookupMessage) => boolean,
    timeoutMs = 1_000,
  ): Promise<LookupMessage> {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
      const poll = setInterval(() => {
        const found = this.messages.find(predicate);
        if (found) {
          clearInterval(poll);
          resolve(found);
        } else if (Date.now() > deadline) {
          clearInterval(poll);
          reject(new Error(`waitFor timeout (${timeoutMs}ms) — messages: ${this.messages.map(m => m.type).join(', ')}`));
        }
      }, 10);
    });
  }

  send(transport: TestTransport, msg: LookupMessage): void {
    transport.send(encodeMessage(msg));
  }
}

// ---------------------------------------------------------------------------
// Mock ChainStateProvider
// ---------------------------------------------------------------------------

export const DEFAULT_COIN: Coin = {
  coinid: '0xCOIN1',
  amount: '1000000',
  address: '0xADDR1',
  tokenid: '0x00',
};

export const DEFAULT_TIP: ChainTip = { block: 1000, hash: '0xBLOCK1', time: '1716000000000' };

export const DEFAULT_TOKEN: TokenInfo = {
  tokenid: '0xTOKEN1',
  name: { name: 'TestToken' },
  total: '1000000000',
};

export const DEFAULT_PROOF: MMRProof = {
  coinid: '0xCOIN1',
  data: { mmrData: 'deadbeef' },
};

export const DEFAULT_BROADCAST: BroadcastResult = { success: true, txpowid: '0xTXID1' };

export function makeMockProvider(overrides: Partial<ChainStateProvider> = {}): ChainStateProvider {
  return {
    getCoins: jest.fn().mockResolvedValue([DEFAULT_COIN]),
    getCoin: jest.fn().mockResolvedValue(DEFAULT_COIN),
    getProof: jest.fn().mockResolvedValue(DEFAULT_PROOF),
    getTip: jest.fn().mockResolvedValue(DEFAULT_TIP),
    getToken: jest.fn().mockResolvedValue(DEFAULT_TOKEN),
    searchTokens: jest.fn().mockResolvedValue([]),
    getTokensByCreator: jest.fn().mockResolvedValue([]),
    broadcastTxPoW: jest.fn().mockResolvedValue(DEFAULT_BROADCAST),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Connect & authenticate a test client (_skipAuth mode)
// ---------------------------------------------------------------------------

export interface ConnectedClient {
  clientTransport: TestTransport;
  serverTransport: TestTransport;
  session: ClientSession;
  buffer: MessageBuffer;
}

export async function connectTestClient(node: LookupNode): Promise<ConnectedClient> {
  const [clientTransport, serverTransport] = createTestPair();
  const buffer = new MessageBuffer(clientTransport);
  const session = node.handleConnection(serverTransport);

  // Wait for AUTH_CHALLENGE (sent immediately on connection)
  await buffer.waitFor((m) => m.type === 'AUTH_CHALLENGE');

  // Send AUTH_RESPONSE (server has _skipAuth: true so any content is accepted)
  buffer.send(clientTransport, {
    type: 'AUTH_RESPONSE',
    version: 1,
    id: 'auth-1',
    payload: {
      challenge: 'any-challenge',
      publicKey: '00'.repeat(32),
      signature: '00'.repeat(64),
    },
  });

  // Wait for PONG (auth success)
  await buffer.waitFor((m) => m.type === 'PONG' && m.id === 'auth-1');

  return { clientTransport, serverTransport, session, buffer };
}
