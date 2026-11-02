/**
 * @totemsdk/tx-builder/node-assembler
 *
 * Optional node-side assembly adapter.
 *
 * This is the path used by the real mainnet apps:
 *
 *   txncreate -> txninput(scriptmmr:true) -> txnoutput -> txnstate
 *     -> txnbasics -> txnsign? -> txnpost -> txndelete
 *
 * It requires a local/paired Minima node and is **not** the edge path. Keep
 * `buildTransaction` + `serializeWitness` for zero-DB/edge signing.
 */

export interface NodeAssemblyCommandClient {
  /**
   * Send a command-level RPC call. The client is responsible for transport
   * encoding (the node command grammar needs spaces preserved in scripts).
   */
  command(name: string, params?: Record<string, unknown>): Promise<any>;
}

export interface NodeAssemblyInput {
  coinId: string;
  /** Add the coin's script + MMR proof (txninput scriptmmr:true). */
  scriptmmr?: boolean;
}

export interface NodeAssemblyOutput {
  address: string;
  amount: string;
  tokenId?: string;
  storeState?: boolean;
}

export interface NodeAssemblyState {
  port: number;
  value: string;
}

export interface NodeAssemblyParams {
  inputs: NodeAssemblyInput[];
  outputs: NodeAssemblyOutput[];
  state?: NodeAssemblyState[];
  /** Optional node-wallet signing public key (txnsign). */
  signPublicKey?: string;
  /** Run `txnbasics` (auto MMR proofs + scripts). Defaults to true. */
  basics?: boolean;
  /** Mine synchronously via `txnpost mine:true`. Defaults to true. */
  mine?: boolean;
  /** Delete the custom txn after posting. Defaults to true. */
  deleteAfter?: boolean;
  txnId?: string;
}

export interface NodeAssemblyResult {
  txnId: string;
  txpowid?: string;
  response?: unknown;
}

function randomTxnId(): string {
  return `txb-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Assemble, sign (optionally), and post a transaction using the node's own
 * `txn*` command surface.
 */
export async function assembleViaNode(
  client: NodeAssemblyCommandClient,
  params: NodeAssemblyParams,
): Promise<NodeAssemblyResult> {
  if (!params.inputs?.length) throw new Error('assembleViaNode: inputs are required');
  if (!params.outputs?.length) throw new Error('assembleViaNode: outputs are required');

  const txnId = params.txnId ?? randomTxnId();
  await client.command('txncreate', { id: txnId });

  try {
    for (const input of params.inputs) {
      await client.command('txninput', {
        id: txnId,
        coinid: input.coinId,
        ...(input.scriptmmr ? { scriptmmr: true } : {}),
      });
    }

    for (const output of params.outputs) {
      await client.command('txnoutput', {
        id: txnId,
        address: output.address,
        amount: output.amount,
        tokenid: output.tokenId ?? '0x00',
        storestate: output.storeState ?? false,
      });
    }

    for (const state of params.state ?? []) {
      await client.command('txnstate', {
        id: txnId,
        port: state.port,
        value: state.value,
      });
    }

    if (params.basics !== false) {
      await client.command('txnbasics', { id: txnId });
    }

    if (params.signPublicKey) {
      await client.command('txnsign', {
        id: txnId,
        publickey: params.signPublicKey,
      });
    }

    const posted = await client.command('txnpost', {
      id: txnId,
      mine: params.mine ?? true,
    });
    const response = posted?.response ?? posted;
    const txpowid = response?.txpowid ?? response?.response?.txpowid;

    if (params.deleteAfter !== false) {
      await client.command('txndelete', { id: txnId }).catch(() => undefined);
    }

    return { txnId, txpowid, response };
  } catch (error) {
    if (params.deleteAfter !== false) {
      await client.command('txndelete', { id: txnId }).catch(() => undefined);
    }
    throw error;
  }
}
