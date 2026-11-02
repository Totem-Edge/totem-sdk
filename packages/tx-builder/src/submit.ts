/**
 * @totemsdk/tx-builder/submit
 *
 * Dry-run and submission helpers for both node-command and TxPoW paths.
 */

import type { MineOptions } from '@totemsdk/txpow';

export interface TxnCommandClient {
  command(name: string, params?: Record<string, unknown>): Promise<any>;
}

export interface ChainBroadcastProvider {
  broadcastTxPoW(txpowHex: string): Promise<{ success: boolean; txpowid?: string; message?: string }>;
}

export interface TxPowMinWorkSource {
  getMinTxPowWork?(): Promise<string | null>;
}

export interface SubmitOptions {
  /** Mine synchronously via `txnpost mine:true`. Defaults to true. */
  mine?: boolean;
}

/** Parse a TxPoW id out of common node response shapes. */
export function extractTxPowId(response: any): string | undefined {
  return (
    response?.txpowid ??
    response?.response?.txpowid ??
    response?.result?.txpowid ??
    undefined
  );
}

/** `txncheck` a custom transaction before signing/posting. */
export async function dryRunViaNode(
  client: TxnCommandClient,
  txnId: string,
): Promise<{ valid: boolean; response?: unknown }> {
  const result = await client.command('txncheck', { id: txnId });
  return { valid: result?.valid === true || result?.response?.valid === true, response: result };
}

/** Import a signed TxnRow and post it. */
export async function submitSignedTxn(
  client: TxnCommandClient,
  params: { txnId: string; txnRowHex: string; mine?: boolean },
): Promise<{ txpowid?: string; response?: unknown }> {
  await client.command('txnimport', {
    id: params.txnId,
    data: params.txnRowHex,
  });
  const posted = await client.command('txnpost', {
    id: params.txnId,
    mine: params.mine ?? true,
  });
  return { txpowid: extractTxPowId(posted), response: posted };
}

/** Post an already-imported custom transaction. */
export async function submitTxnId(
  client: TxnCommandClient,
  txnId: string,
  options?: SubmitOptions,
): Promise<{ txpowid?: string; response?: unknown }> {
  const posted = await client.command('txnpost', {
    id: txnId,
    mine: options?.mine ?? true,
  });
  return { txpowid: extractTxPowId(posted), response: posted };
}

/** Delete a custom transaction after it has been posted. */
export async function deleteTxn(client: TxnCommandClient, txnId: string): Promise<void> {
  await client.command('txndelete', { id: txnId }).catch(() => undefined);
}

/** Broadcast a fully-mined TxPoW through a chain provider. */
export async function submitTxPoW(
  provider: ChainBroadcastProvider,
  txpowHex: string,
): Promise<{ success: boolean; txpowid?: string; message?: string }> {
  return provider.broadcastTxPoW(txpowHex);
}

export interface MinedTransaction {
  txpowHex: string;
  txpowId: string;
  target: Uint8Array;
  body: Uint8Array;
  elapsedMs: number;
}

/**
 * Serialize and mine a signed transaction into a TxPoW envelope.
 *
 * The caller supplies the transaction (or its serialized bytes) and witness.
 * The target defaults to the node's live `currentmintxpowwork` when a source is
 * provided, otherwise the protocol floor.
 */
export async function mineTransaction(params: {
  transaction: Uint8Array | unknown;
  witness: Uint8Array;
  target?: Uint8Array;
  minWorkSource?: TxPowMinWorkSource | null;
  mineOptions?: MineOptions;
}): Promise<MinedTransaction> {
  const { concat: concatBytes, serializeTransactionObject } = await import('@totemsdk/core');
  const { mineTxPoW, resolveTxPowTarget, serializeTxBody } = await import('@totemsdk/txpow');

  const txBytes =
    params.transaction instanceof Uint8Array
      ? params.transaction
      : serializeTransactionObject(params.transaction as any);
  const target = params.target ?? (await resolveTxPowTarget(params.minWorkSource ?? null));
  const body = serializeTxBody(txBytes, params.witness, { txnDifficulty: target });
  const mined = await mineTxPoW(body, target, params.mineOptions);
  const txpow = concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01]), body);
  return {
    txpowHex: '0x' + Array.from(txpow).map((b) => b.toString(16).padStart(2, '0')).join(''),
    txpowId: '0x' + Array.from(mined.txpowId).map((b) => b.toString(16).padStart(2, '0')).join(''),
    target,
    body,
    elapsedMs: mined.elapsedMs,
  };
}

/** Mine and broadcast in one call. */
export async function mineAndSubmitTxPoW(
  params: Parameters<typeof mineTransaction>[0],
  provider: ChainBroadcastProvider,
): Promise<{ mined: MinedTransaction; broadcast: { success: boolean; txpowid?: string; message?: string } }> {
  const mined = await mineTransaction(params);
  const broadcast = await provider.broadcastTxPoW(mined.txpowHex);
  return { mined, broadcast };
}
