/**
 * TxPoWRelay tests.
 *
 * Covers:
 *   - Spam filter: rejects TxPoW shorter than spamMinBytes
 *   - Work verifier: rejects TxPoW that fails the verifyWorkFn
 *   - Dedup: second submission of same TxPoW is rejected
 *   - Successful relay: passes through to provider.broadcastTxPoW
 *   - Direct broadcast (no relay): provider.broadcastTxPoW is called directly
 */

import { LookupNode } from '../node.js';
import { makeMockProvider, connectTestClient } from './helpers.js';

/** Generate a hex string of `n` bytes */
const hex = (n: number) => 'ab'.repeat(n);

describe('TxPoWRelay', () => {
  function makeRelayNode(verifyWorkFn?: (h: string) => boolean) {
    return new LookupNode({
      provider: makeMockProvider(),
      _skipAuth: true,
      relay: {
        enabled: true,
        spamMinBytes: 50,  // require >= 50 bytes (100 hex chars)
        verifyWorkFn,
      },
    });
  }

  it('rejects TxPoW shorter than spamMinBytes', async () => {
    const node = makeRelayNode();
    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, {
      type: 'BROADCAST_TXPOW',
      version: 1,
      id: 'relay-short',
      payload: { txpowHex: hex(10) }, // only 10 bytes — below 50-byte limit
    });

    const response = await buffer.waitFor((m) => m.id === 'relay-short');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response.payload as any).success).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response.payload as any).message).toMatch(/too short/i);
  });

  it('rejects TxPoW that fails verifyWorkFn', async () => {
    const badPrefix = 'ff'.repeat(32); // "high" hash value — won't pass difficulty check

    const node = makeRelayNode((txpowHex) => {
      // Reject if txpow starts with 'ff' (pretend difficulty requires leading zeros)
      return !txpowHex.startsWith('ff');
    });
    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, {
      type: 'BROADCAST_TXPOW',
      version: 1,
      id: 'relay-bad-work',
      payload: { txpowHex: badPrefix + 'ab'.repeat(50) },
    });

    const response = await buffer.waitFor((m) => m.id === 'relay-bad-work');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response.payload as any).success).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response.payload as any).message).toMatch(/work threshold/i);
  });

  it('rejects duplicate TxPoW submission', async () => {
    const node = makeRelayNode(() => true); // accept all work
    const { buffer, clientTransport } = await connectTestClient(node);

    const txpow = hex(100);

    buffer.send(clientTransport, {
      type: 'BROADCAST_TXPOW',
      version: 1,
      id: 'relay-dup-1',
      payload: { txpowHex: txpow },
    });
    await buffer.waitFor((m) => m.id === 'relay-dup-1');

    buffer.send(clientTransport, {
      type: 'BROADCAST_TXPOW',
      version: 1,
      id: 'relay-dup-2',
      payload: { txpowHex: txpow }, // same TxPoW
    });

    const response2 = await buffer.waitFor((m) => m.id === 'relay-dup-2');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response2.payload as any).success).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response2.payload as any).message).toMatch(/duplicate/i);
  });

  it('accepts valid TxPoW and returns provider broadcast result', async () => {
    const node = makeRelayNode(() => true); // accept all work
    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, {
      type: 'BROADCAST_TXPOW',
      version: 1,
      id: 'relay-ok',
      payload: { txpowHex: hex(100) },
    });

    const response = await buffer.waitFor((m) => m.id === 'relay-ok');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response.payload as any).success).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response.payload as any).txpowid).toBe('0xTXID1');
  });

  it('without relay: BROADCAST_TXPOW calls provider directly', async () => {
    const broadcastMock = jest.fn().mockResolvedValue({ success: true, txpowid: '0xDIRECT' });
    const node = new LookupNode({
      provider: makeMockProvider({ broadcastTxPoW: broadcastMock }),
      _skipAuth: true,
      // relay NOT configured
    });
    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, {
      type: 'BROADCAST_TXPOW',
      version: 1,
      id: 'direct-bc',
      payload: { txpowHex: hex(100) },
    });

    const response = await buffer.waitFor((m) => m.id === 'direct-bc');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((response.payload as any).txpowid).toBe('0xDIRECT');
    expect(broadcastMock).toHaveBeenCalledWith(hex(100));
  });
});
