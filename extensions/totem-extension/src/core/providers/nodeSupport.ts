/**
 * Hawk-node capability check (RFC-073 §9).
 *
 * The extension's Hawk surface is implemented and validated against Hawk-node's
 * 132-command manifest. minima-more exposes 111 commands and lacks
 * `getchaintip`, `getmmrproof` and `sendtransaction`; it is not a supported Hawk
 * target and is rejected with an explicit error rather than failing later with
 * a command-not-found.
 */

import { createMinimaRpcClient, parseMinimaRpcUrl } from '@totemsdk/chain-provider';
import type { MinimaRpcClient } from '@totemsdk/chain-provider';

export const REQUIRED_HAWK_COMMANDS = [
  'coinexport',
  'txnimport',
  'txnpost',
  'getchaintip',
  'getmmrproof',
  'sendtransaction',
] as const;

export class UnsupportedHawkNodeError extends Error {
  readonly code = 'UNSUPPORTED_NODE';
  constructor(readonly missing: string[]) {
    super(
      `This node is not a supported Hawk node for the extension ` +
        `(missing: ${missing.join(', ')}). Use Hawk-node.`,
    );
    this.name = 'UnsupportedHawkNodeError';
  }
}

const supportCache = new Map<string, Promise<void>>();

function commandNamesFromManifest(manifest: any): Set<string> {
  const names = new Set<string>();
  const commands = manifest?.commands;
  if (!Array.isArray(commands)) return names;
  for (const command of commands) {
    if (typeof command === 'string') names.add(command);
    else if (command && typeof command.name === 'string') names.add(command.name);
  }
  return names;
}

function looksLikeUnknownCommand(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes('unknown method') ||
    message.includes('command not found') ||
    message.includes('unknown command') ||
    message.includes('invalid command')
  );
}

async function probeSupport(client: MinimaRpcClient): Promise<void> {
  let manifest: any;
  try {
    manifest = await client.runCommand('capabilities');
  } catch (error) {
    if (!looksLikeUnknownCommand(error)) throw error;
    // Very old/partial node without a manifest: use a sentinel command.
    try {
      await client.getTip();
      return;
    } catch (probeError) {
      if (looksLikeUnknownCommand(probeError)) {
        throw new UnsupportedHawkNodeError([...REQUIRED_HAWK_COMMANDS]);
      }
      throw probeError;
    }
  }

  const names = commandNamesFromManifest(manifest);
  if (names.size === 0) {
    throw new UnsupportedHawkNodeError([...REQUIRED_HAWK_COMMANDS]);
  }

  const missing = REQUIRED_HAWK_COMMANDS.filter((command) => !names.has(command));
  if (missing.length > 0) {
    throw new UnsupportedHawkNodeError(missing);
  }
}

export async function ensureHawkNodeSupported(
  client: MinimaRpcClient,
  url: string,
): Promise<void> {
  let pending = supportCache.get(url);
  if (!pending) {
    pending = probeSupport(client).catch((error) => {
      // Cache only the definitive unsupported verdict. Network/auth failures
      // must be retryable once the node is reachable again.
      if (!(error instanceof UnsupportedHawkNodeError)) supportCache.delete(url);
      throw error;
    });
    supportCache.set(url, pending);
  }
  await pending;
}

/**
 * Read-only support probe used by the chain resolver so reads fail with the
 * same explicit message instead of a later command-not-found error.
 */
export async function assertHawkNodeSupported(
  url: string,
  user?: string,
  pass?: string,
): Promise<void> {
  const { host, port, ssl } = parseMinimaRpcUrl(url);
  const client = createMinimaRpcClient({
    host,
    port,
    ssl,
    ...(user ? { username: user } : {}),
    ...(pass ? { password: pass } : {}),
    timeoutMs: 15_000,
  });
  await ensureHawkNodeSupported(client, url);
}
