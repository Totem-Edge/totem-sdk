/**
 * Hawk-node support gate (RFC-073 §9).
 */

import './setup';

import {
  ensureHawkNodeSupported,
  UnsupportedHawkNodeError,
} from '../src/core/providers/nodeSupport';

function manifest(names: string[]) {
  return { commands: names.map((name) => ({ name })) };
}

const HAWK_COMMANDS = [
  'coinexport',
  'txnimport',
  'txnpost',
  'getchaintip',
  'getmmrproof',
  'sendtransaction',
  'coins',
];

const MINIMA_MORE_COMMANDS = ['coinexport', 'txnimport', 'txnpost', 'coins', 'tokens'];

describe('Hawk node support gate', () => {
  test('accepts a Hawk-node capability manifest', async () => {
    const client: any = { runCommand: jest.fn().mockResolvedValue(manifest(HAWK_COMMANDS)) };
    await expect(
      ensureHawkNodeSupported(client, 'http://hawk-node.test'),
    ).resolves.toBeUndefined();
  });

  test('rejects minima-more with an explicit unsupported error', async () => {
    const client: any = {
      runCommand: jest.fn().mockResolvedValue(manifest(MINIMA_MORE_COMMANDS)),
    };
    await expect(
      ensureHawkNodeSupported(client, 'http://minima-more.test'),
    ).rejects.toBeInstanceOf(UnsupportedHawkNodeError);
  });

  test('falls back to a sentinel command when capabilities is unknown', async () => {
    const client: any = {
      runCommand: jest.fn().mockRejectedValue(new Error('Unknown method: capabilities')),
      getTip: jest.fn().mockResolvedValue({ block: 1, hash: '0xabc' }),
    };
    await expect(
      ensureHawkNodeSupported(client, 'http://legacy-node.test'),
    ).resolves.toBeUndefined();
  });

  test('network failures are retryable rather than cached as unsupported', async () => {
    const client: any = { runCommand: jest.fn().mockRejectedValue(new Error('fetch failed')) };
    await expect(ensureHawkNodeSupported(client, 'http://offline-node.test')).rejects.toThrow(
      'fetch failed',
    );

    client.runCommand.mockResolvedValue(manifest(HAWK_COMMANDS));
    await expect(
      ensureHawkNodeSupported(client, 'http://offline-node.test'),
    ).resolves.toBeUndefined();
    expect(client.runCommand).toHaveBeenCalledTimes(2);
  });
});
