/**
 * Transaction-body mapping shared by the chain providers (OMN-074).
 *
 * Minima returns a TxPoW in a few shapes depending on the command and node
 * version (`txpow txpowid:` returns `{ found, txpow: { body: { txn } } }`,
 * while some node builds wrap the transaction directly). The mapping is
 * deliberately tolerant about the envelope and strict about the fields: if no
 * transaction body can be found, the result is `null` so callers fail closed.
 */

import type { ChainTransaction } from '../types.js';

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Coin ids are compared without the 0x prefix, case-insensitively. */
export function sameCoinId(a: string, b: string): boolean {
  return a.replace(/^0x/i, '').toLowerCase() === b.replace(/^0x/i, '').toLowerCase();
}

/** Map a Minima `txpow` response into a {@link ChainTransaction}. */
export function mapMinimaTransaction(txpowid: string, raw: unknown): ChainTransaction | null {
  const root = record(raw);
  if (!root) return null;
  if (root['found'] === false) return null;

  const txpow = record(root['txpow']) ?? root;
  const body = record(txpow['body']);
  const txn = record(body?.['txn']) ?? record(root['txn']);
  if (!txn) return null;

  const inputs: ChainTransaction['inputs'] = [];
  if (Array.isArray(txn['inputs'])) {
    for (const entry of txn['inputs']) {
      const input = record(entry);
      if (!input) continue;
      const coinId = text(input['coinid']) ?? text(input['coinId']) ?? text(input['coin']);
      if (!coinId) continue;
      inputs.push({
        coinId,
        ...(text(input['address']) ? { address: text(input['address'])! } : {}),
        ...(text(input['amount']) ? { amount: text(input['amount'])! } : {}),
        ...(text(input['tokenid']) ?? text(input['tokenId'])
          ? { tokenId: (text(input['tokenid']) ?? text(input['tokenId']))! }
          : {}),
      });
    }
  }

  const outputs: ChainTransaction['outputs'] = [];
  if (Array.isArray(txn['outputs'])) {
    for (const entry of txn['outputs']) {
      const output = record(entry);
      if (!output) continue;
      const address = text(output['address']);
      if (!address) continue;
      const coinId = text(output['coinid']) ?? text(output['coinId']);
      const amount = text(output['amount']) ?? '0';
      const tokenId = text(output['tokenid']) ?? text(output['tokenId']);
      outputs.push({
        address,
        amount,
        ...(coinId ? { coinId } : {}),
        ...(tokenId ? { tokenId } : {}),
      });
    }
  }

  const blockValue = txpow['block'] ?? root['block'];
  const block = typeof blockValue === 'number'
    ? blockValue
    : typeof blockValue === 'string' && /^\d+$/.test(blockValue)
      ? Number(blockValue)
      : undefined;

  return {
    txpowid: text(txpow['txpowid']) ?? text(root['txpowid']) ?? txpowid,
    ...(block !== undefined ? { block } : {}),
    inputs,
    outputs,
  };
}
