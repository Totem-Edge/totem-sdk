import { sha3_256 } from '@totemsdk/core';
import { serializeTxBody } from '@totemsdk/txpow';
import {
  hexToBytes,
  serializeTransaction,
  createDefaultTransaction,
  buildMinimaCoin,
  type StateVariable as CoreStateVariable,
} from '@totemsdk/core';
import type { OmniaChannel, OmniaTxDraft, StateValue, TxOutputDraft, HTLCRecord, SignedChannelState } from './types.js';

// ── @totemsdk/tx-builder compatible types ───────────────────────────────────
// Mirror of EnhancedBuildParams / EnhancedCoinInput / EnhancedCoinOutput from
// @totemsdk/tx-builder (packages/tx-builder/src/enhanced-types.ts).
// Kept local to avoid a build-time dependency on tx-builder's compiled dist.
// When integrating with the full Minima chain, import these from @totemsdk/tx-builder
// directly and pass the result to @totemsdk/core's serializeTransaction().

interface TxBuilderInput {
  coinId: string;
  address: string;
  /** Decimal string — EnhancedCoinInput.amount is a string, not bigint. */
  amount: string;
  tokenId?: string;
  scriptDescriptor: { type: string };
  coinProofHex?: string;
}

interface TxBuilderOutput {
  address: string;
  amount: string;
  tokenId?: string;
  storeState?: boolean;
  state?: StateValue[];
}

export interface EnhancedBuildParams {
  inputs: TxBuilderInput[];
  outputs: TxBuilderOutput[];
  transactionState?: StateValue[];
  linkHash?: Uint8Array;
}

const TOKENID_MINIMA = '0x00';

function channelStateVars(settlement: boolean, sequence: number): StateValue[] {
  return [
    { port: 100, value: settlement, type: 'bool' },
    { port: 101, value: BigInt(sequence), type: 'number' },
  ];
}

/**
 * Convert a scaled token amount back to raw Minima units.
 * `rawAmount = scaledAmount / 10^tokenScale`
 * For native Minima (tokenScale=0), no conversion is needed.
 */
function toRawMinima(scaledAmount: bigint, tokenScale: number): bigint {
  if (tokenScale === 0) return scaledAmount;
  const divisor = 10n ** BigInt(tokenScale);
  return scaledAmount / divisor;
}

export function buildFundingTx(
  fundingScript: string,
  fundingScriptAddress: string,
  totalValue: bigint,
  tokenId: string,
  tokenScale: number,
  inputCoinIds: string[],
  inputAmounts: bigint[],
  inputAddresses: string[],
): OmniaTxDraft {
  // All TX amounts must be in raw Minima units.
  // Callers supply inputAmounts in the same scaled token units as totalValue;
  // convert them here so that inputs and output are consistent.
  const inputs = inputCoinIds.map((coinId, i) => ({
    coinId,
    address: inputAddresses[i] ?? '',
    amount: toRawMinima(inputAmounts[i] ?? 0n, tokenScale),
    tokenId,
    scriptHex: '',
  }));

  const rawTotal = toRawMinima(totalValue, tokenScale);
  const output: TxOutputDraft = {
    address: fundingScriptAddress,
    amount: rawTotal,
    tokenId,
    storeState: true,
    stateVariables: channelStateVars(false, 0),
  };

  return {
    type: 'funding',
    inputs,
    outputs: [output],
    storeState: true,
    stateVariables: channelStateVars(false, 0),
  };
}

export function buildUpdateTx(
  channel: OmniaChannel,
  newSequence: number,
  newBalances: Record<string, bigint>,
  pendingHTLCs: HTLCRecord[],
): OmniaTxDraft {
  const stateVars = channelStateVars(false, newSequence);
  const rawTotal = toRawMinima(channel.totalValue, channel.tokenScale ?? 0);
  if (!channel.fundingAddress) {
    throw new Error(`channel.fundingAddress is required but not set on channel ${channel.channelId}`);
  }
  const scriptAddress = channel.fundingAddress;

  const input = {
    coinId: channel.latestCoinId ?? channel.fundingCoinId,
    address: scriptAddress,
    amount: rawTotal,
    tokenId: channel.tokenId,
    scriptHex: channel.fundingScript,
  };

  const channelOutput: TxOutputDraft = {
    address: scriptAddress,
    amount: rawTotal,
    tokenId: channel.tokenId,
    storeState: true,
    stateVariables: stateVars,
  };

  return {
    type: 'update',
    inputs: [input],
    outputs: [channelOutput],
    storeState: true,
    stateVariables: stateVars,
  };
}

export function buildSettlementTx(
  channel: OmniaChannel,
  state: SignedChannelState,
  partyAddresses: Record<string, string>,
): OmniaTxDraft {
  const stateVars: StateValue[] = [
    { port: 100, value: true, type: 'bool' },
    { port: 101, value: BigInt(state.sequence), type: 'number' },
  ];

  const rawTotal = toRawMinima(channel.totalValue, channel.tokenScale ?? 0);
  if (!channel.fundingAddress) {
    throw new Error(`channel.fundingAddress is required but not set on channel ${channel.channelId}`);
  }
  const scriptAddress = channel.fundingAddress;

  const input = {
    coinId: channel.latestCoinId ?? channel.fundingCoinId,
    address: scriptAddress,
    amount: rawTotal,
    tokenId: channel.tokenId,
    scriptHex: channel.fundingScript,
  };

  const outputs: TxOutputDraft[] = [];

  for (const party of channel.parties) {
    const scaledBalance = state.balances[party.partyId] ?? 0n;
    const rawBalance = toRawMinima(scaledBalance, channel.tokenScale ?? 0);
    const addr = partyAddresses[party.partyId];
    if (!addr) throw new Error(`Missing settlement address for party ${party.partyId}`);
    if (rawBalance > 0n) {
      outputs.push({
        address: addr,
        amount: rawBalance,
        tokenId: channel.tokenId,
        storeState: false,
        stateVariables: [],
      });
    }
  }

  for (const htlc of state.pendingHTLCs) {
    if (htlc.status === 'pending') {
      const rawHtlcAmount = toRawMinima(htlc.amount, channel.tokenScale ?? 0);
      outputs.push({
        address: htlc.htlcAddress,
        amount: rawHtlcAmount,
        tokenId: channel.tokenId,
        storeState: false,
        stateVariables: [],
      });
    }
  }

  return {
    type: 'settlement',
    inputs: [input],
    outputs,
    storeState: true,
    stateVariables: stateVars,
  };
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? `__bigint__${value.toString()}` : value;
}

function bigintReviver(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith('__bigint__')) {
    return BigInt(value.slice(10));
  }
  return value;
}

export function serializeTxDraft(draft: OmniaTxDraft): string {
  return Buffer.from(JSON.stringify(draft, bigintReplacer), 'utf8').toString('hex');
}

export function deserializeTxDraft(hex: string): OmniaTxDraft {
  return JSON.parse(Buffer.from(hex, 'hex').toString('utf8'), bigintReviver) as OmniaTxDraft;
}

export function computeTxDraftDigest(draft: OmniaTxDraft): Uint8Array {
  const bytes = new TextEncoder().encode(JSON.stringify({
    type: draft.type,
    inputs: draft.inputs,
    outputs: draft.outputs,
    stateVariables: draft.stateVariables,
  }, bigintReplacer));
  return sha3_256(bytes);
}

/**
 * Canonical state commitment — the 32-byte digest that is WOTS-signed and
 * WOTS-verified for every channel update.
 *
 * Covers the FULL off-chain state: sequence number, per-party balance split,
 * and all pending HTLCs. This ensures signatures are cryptographically bound
 * to balances and HTLC content and cannot be repurposed for a tampered state.
 *
 * NOTE: `buildUpdateTx` intentionally encodes only the UTXO total on-chain
 * (eltoo design). The per-party split is off-chain. Without this commitment,
 * a signer could sign a state and an adversary could swap the balances while
 * keeping the WOTS signature valid — breaking the dispute trust model.
 *
 * Sorted lexicographically by key to ensure determinism regardless of the
 * order in which balance/HTLC entries appear in the caller's object.
 */
export function computeStateCommitment(
  sequence: number,
  balances: Record<string, bigint>,
  pendingHTLCs: HTLCRecord[],
): Uint8Array {
  const canonical = {
    sequence,
    balances: Object.fromEntries(
      Object.entries(balances)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, v.toString()]),
    ),
    htlcs: pendingHTLCs
      .filter(h => h.status === 'pending')
      .map(h => ({
        htlcId: h.htlcId,
        amount: h.amount.toString(),
        hashlock: h.hashlock,
        timeoutBlock: h.timeoutBlock.toString(),
        direction: h.direction,
      }))
      .sort((a, b) => a.htlcId.localeCompare(b.htlcId)),
  };
  return sha3_256(new TextEncoder().encode(JSON.stringify(canonical)));
}

/**
 * Convert an `OmniaTxDraft` to `@totemsdk/tx-builder`'s `EnhancedBuildParams`.
 *
 * This is the bridge between the Omnia state-machine draft format and the
 * canonical Minima TX representation used by the tx-builder. Amounts are
 * converted from `bigint` to decimal string as required by `EnhancedCoinInput`
 * and `EnhancedCoinOutput`.
 *
 * To produce real Minima binary TX bytes, pass the returned `EnhancedBuildParams`
 * to `@totemsdk/core`'s `serializeTransaction()`, then use `buildTxPoWPayload()`
 * to wrap the result in a TxPoW body for mining and broadcast.
 */
export function toEnhancedBuildParams(draft: OmniaTxDraft): EnhancedBuildParams {
  const inputs: TxBuilderInput[] = draft.inputs.map(inp => ({
    coinId: inp.coinId,
    address: inp.address,
    amount: inp.amount.toString(),
    tokenId: inp.tokenId,
    scriptDescriptor: { type: 'RETURN_TRUE' },
    coinProofHex: inp.scriptHex || undefined,
  }));

  const outputs: TxBuilderOutput[] = draft.outputs.map(out => ({
    address: out.address,
    amount: out.amount.toString(),
    tokenId: out.tokenId,
    storeState: out.storeState,
    state: out.storeState ? draft.stateVariables.map(sv => ({
      port: sv.port,
      value: sv.value,
      type: sv.type,
    })) : undefined,
  }));

  return {
    inputs,
    outputs,
    transactionState: draft.stateVariables.map(sv => ({
      port: sv.port,
      value: sv.value,
      type: sv.type,
    })),
  };
}

/**
 * Convert an `OmniaTxDraft` to canonical Minima binary TX bytes using
 * `@totemsdk/core`'s `serializeTransaction`.
 *
 * This replaces JSON-encoded draft bytes in the TxPoW mining/broadcast path,
 * ensuring settlement transactions are byte-exact Minima protocol messages
 * rather than an internal representation.
 *
 * Call site pattern:
 * ```
 * const txBytes   = omniaDraftToMinimaBytes(draft);
 * const txBody    = serializeTxBody(txBytes, witnessBytes);
 * const mined     = await mineTxPoW(txBody, difficulty);
 * const fullTxPoW = concatBytes(mined.minedHeaderBytes, new Uint8Array([0x01]), txBody);
 * await chainProvider.broadcastTxPoW(Buffer.from(fullTxPoW).toString('hex'));
 * ```
 */
export function omniaDraftToMinimaBytes(draft: OmniaTxDraft): Uint8Array {
  const tx = createDefaultTransaction();

  const toCoreSvs = (svs: StateValue[]): CoreStateVariable[] =>
    svs.map(sv => ({
      port: sv.port,
      value: sv.value as string | bigint | boolean | Uint8Array,
      type: sv.type as 'bool' | 'number' | 'hex' | 'string',
    }));

  for (const inp of draft.inputs) {
    tx.inputs.push(buildMinimaCoin({
      coinId: hexToBytes(inp.coinId),
      address: hexToBytes(inp.address),
      amount: inp.amount.toString(),
      tokenId: hexToBytes(inp.tokenId),
    }));
  }

  for (const out of draft.outputs) {
    const svs = toCoreSvs(out.stateVariables ?? draft.stateVariables);
    tx.outputs.push(buildMinimaCoin({
      address: hexToBytes(out.address),
      amount: out.amount.toString(),
      tokenId: hexToBytes(out.tokenId),
      storeState: out.storeState ?? false,
      state: out.storeState ? svs : [],
    }));
  }

  tx.state = toCoreSvs(draft.stateVariables);

  return serializeTransaction(JSON.stringify(tx));
}

/**
 * Wrap pre-serialized Minima TX + witness bytes in a `@totemsdk/txpow` body
 * ready for PoW mining and chain broadcast.
 *
 * Architecture:
 * ```
 * OmniaTxDraft
 *   → toEnhancedBuildParams()          (@totemsdk/tx-builder types)
 *   → @totemsdk/core serializeTransaction()  (Minima binary TX bytes)
 *   → buildTxPoWPayload(txBytes, witnessBytes) → serializeTxBody()
 *   → mineTxPoW() / broadcastTxPoW()
 * ```
 *
 * @param txBytes      - Pre-serialized Minima Transaction bytes from `@totemsdk/core`.
 * @param witnessBytes - Pre-serialized Minima Witness bytes (WOTS signatures).
 * @returns TxPoW body bytes ready for PoW mining.
 */
export function buildTxPoWPayload(txBytes: Uint8Array, witnessBytes: Uint8Array): Uint8Array {
  return serializeTxBody(txBytes, witnessBytes);
}
