/**
 * TxPoW output extraction.
 *
 * Lineage evidence for a splice successor is already available from a standard
 * node: `txpow txpowid:0x…` returns the full TxPoW body, whose outputs carry
 * their `coinid`. A MegaMMR node answers the same command (and exposes the same
 * body through its proof endpoints), so nothing new is needed on the node side.
 *
 * The node has returned this body under three shapes over time — bare, wrapped
 * in `txpow`, and (from the archive/analytics services) with `coin_id` instead
 * of `coinid` — so parsing is deliberately tolerant while still refusing to
 * guess: a response with no recognisable outputs yields `null`, never `[]`.
 */

interface RawOutput {
  coinid?: unknown;
  coin_id?: unknown;
  address?: unknown;
  tokenid?: unknown;
  token_id?: unknown;
  amount?: unknown;
  spent?: unknown;
}

export interface TxPowOutput {
  coinId: string;
  address?: string;
  tokenId?: string;
  amount?: string;
  spent?: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Locate the body of a TxPoW response regardless of envelope nesting. */
function bodyOf(response: unknown): Record<string, unknown> | null {
  const root = asRecord(response);
  if (!root) return null;

  const candidates: unknown[] = [
    asRecord(root.body),
    asRecord(asRecord(root.txpow)?.body),
    asRecord(asRecord(root.response)?.body),
    asRecord(asRecord(asRecord(root.response)?.txpow)?.body),
    // Some services return the body fields at the top level.
    root,
  ];
  for (const candidate of candidates) {
    const body = asRecord(candidate);
    if (body && Array.isArray(body.outputs)) return body;
  }
  return null;
}

/** Outputs of a TxPoW, or null when the response cannot be interpreted. */
export function extractTxPowOutputs(response: unknown): TxPowOutput[] | null {
  const body = bodyOf(response);
  if (!body) return null;
  const outputs = body.outputs;
  if (!Array.isArray(outputs)) return null;

  const parsed: TxPowOutput[] = [];
  for (const entry of outputs) {
    const record = asRecord(entry) as RawOutput | null;
    if (!record) continue;
    const coinId = record.coinid ?? record.coin_id;
    if (typeof coinId !== 'string' || coinId.length === 0) continue;
    const address = record.address;
    const tokenId = record.tokenid ?? record.token_id;
    const amount = record.amount;
    parsed.push({
      coinId,
      ...(typeof address === 'string' ? { address } : {}),
      ...(typeof tokenId === 'string' ? { tokenId } : {}),
      ...(typeof amount === 'string' ? { amount } : {}),
      ...(typeof record.spent === 'boolean' ? { spent: record.spent } : {}),
    });
  }
  return parsed;
}

/** Coin ids created by a TxPoW, or null when the response cannot be interpreted. */
export function extractTxPowCoinIds(response: unknown): string[] | null {
  const outputs = extractTxPowOutputs(response);
  return outputs === null ? null : outputs.map((output) => output.coinId);
}
