import { sha3_256 } from '@totemsdk/core';
import { serializeTxBody } from '@totemsdk/txpow';
import type { OmniaChannel, OmniaTxDraft, StateValue, TxOutputDraft, HTLCRecord, SignedChannelState } from './types.js';
import { COINID_ELTOO } from './script.js';

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
export const COINID_OUTPUT = '0x00';
export const STATE_SETTLEMENT_PORT = 100;
export const STATE_SEQUENCE_PORT = 101;
export const STATE_COMMITMENT_V2_PORT = 102;

function channelStateVars(settlement: boolean, sequence: number): StateValue[] {
  return [
    { port: STATE_SETTLEMENT_PORT, value: settlement, type: 'bool' },
    { port: STATE_SEQUENCE_PORT, value: BigInt(sequence), type: 'number' },
  ];
}

function strip0x(hex: string): string {
  return hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
}

function hexToBytesLocal(hex: string): Uint8Array {
  const raw = strip0x(hex);
  if (raw.length === 0) return new Uint8Array();
  if (raw.length % 2 !== 0) throw new Error(`Invalid hex string: odd length (${raw.length})`);
  if (!/^[0-9a-fA-F]+$/.test(raw)) throw new Error(`Invalid hex string: ${hex}`);
  const out = new Uint8Array(raw.length / 2);
  for (let i = 0; i < raw.length; i += 2) out[i / 2] = Number.parseInt(raw.slice(i, i + 2), 16);
  return out;
}

function bytesToHexLocal(bytes: Uint8Array): string {
  return '0x' + Buffer.from(bytes).toString('hex');
}

function concatBytesLocal(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function bigintToJavaBytes(value: bigint): Uint8Array {
  if (value < 0n) throw new Error(`Negative MiniNumber values are not supported: ${value}`);
  if (value === 0n) return new Uint8Array([0]);
  let hex = value.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let bytes = hexToBytesLocal(hex);
  if ((bytes[0] & 0x80) !== 0) {
    const padded = new Uint8Array(bytes.length + 1);
    padded.set(bytes, 1);
    bytes = padded;
  }
  return bytes;
}

function writeMiniNumberLocal(value: bigint, scale = 0): Uint8Array {
  const unscaled = bigintToJavaBytes(value);
  if (unscaled.length > 255) throw new Error(`MiniNumber data too large: ${unscaled.length}`);
  const out = new Uint8Array(2 + unscaled.length);
  out[0] = scale & 0xff;
  out[1] = unscaled.length;
  out.set(unscaled, 2);
  return out;
}

function writeMiniDataLocal(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length, false);
  out.set(data, 4);
  return out;
}

function writeHashToStreamLocal(hex: string): Uint8Array {
  return writeMiniDataLocal(hexToBytesLocal(hex));
}

function writeMiniByteLocal(value: boolean | number): Uint8Array {
  if (typeof value === 'boolean') return new Uint8Array([value ? 1 : 0]);
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new Error(`MiniByte value must be 0-255, got ${value}`);
  return new Uint8Array([value]);
}

function writeMMREntryNumberLocal(value: bigint): Uint8Array {
  return concatBytesLocal([
    writeMiniNumberLocal(0n),
    writeMiniDataLocal(bigintToJavaBytes(value)),
  ]);
}

function writeStateValueLocal(sv: StateValue): Uint8Array {
  const port = writeMiniByteLocal(sv.port);
  let type: number;
  let data: Uint8Array;
  switch (sv.type) {
    case 'bool':
      type = 8;
      data = writeMiniByteLocal(sv.value === true || String(sv.value).toUpperCase() === 'TRUE');
      break;
    case 'number':
      type = 2;
      data = writeMiniNumberLocal(typeof sv.value === 'bigint' ? sv.value : BigInt(String(sv.value)));
      break;
    case 'hex':
      type = 1;
      data = writeMiniDataLocal(hexToBytesLocal(String(sv.value)));
      break;
    case 'string': {
      type = 4;
      const raw = String(sv.value);
      const bracketed = raw.startsWith('[') && raw.endsWith(']') ? raw : `[${raw}]`;
      data = writeMiniDataLocal(new TextEncoder().encode(bracketed));
      break;
    }
    default:
      throw new Error(`Unknown StateValue type: ${(sv as StateValue).type}`);
  }
  return concatBytesLocal([port, writeMiniByteLocal(type), data]);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

interface NormalizedStateValueForCommitment {
  port: number;
  type: StateValue['type'];
  value: string;
}

function normalizeStateValueForCommitment(sv: StateValue): NormalizedStateValueForCommitment {
  return {
    port: sv.port,
    type: sv.type,
    value: typeof sv.value === 'bigint' ? sv.value.toString() : String(sv.value),
  };
}

export function computeStateCommitmentV2(
  channel: OmniaChannel,
  sequence: number,
  balances: Record<string, bigint>,
  pendingHTLCs: HTLCRecord[],
  opts?: { settlement?: boolean; programStateVariables?: StateValue[] },
): Uint8Array {
  const programStateVariables = (opts?.programStateVariables ?? [])
    .filter(sv => ![STATE_SETTLEMENT_PORT, STATE_SEQUENCE_PORT, STATE_COMMITMENT_V2_PORT].includes(sv.port))
    .map(normalizeStateValueForCommitment)
    .sort((a, b) => a.port - b.port);

  const payload = {
    version: 2,
    channelId: channel.channelId,
    fundingAddress: channel.fundingAddress,
    fundingScriptHash: bytesToHexLocal(sha3_256(new TextEncoder().encode(channel.fundingScript.trim().toUpperCase()))),
    tokenId: channel.tokenId,
    tokenScale: channel.tokenScale ?? 0,
    totalValue: channel.totalValue.toString(),
    sequence,
    settlement: opts?.settlement ?? false,
    balances: Object.fromEntries(
      Object.entries(balances)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([party, balance]) => [party, balance.toString()]),
    ),
    htlcs: pendingHTLCs
      .filter(h => h.status === 'pending')
      .map(h => ({
        htlcId: h.htlcId,
        amount: h.amount.toString(),
        hashlock: h.hashlock,
        timeoutBlock: h.timeoutBlock.toString(),
        direction: h.direction,
        htlcAddress: h.htlcAddress,
        senderPublicKeyDigest: h.senderPublicKeyDigest,
        recipientPublicKeyDigest: h.recipientPublicKeyDigest,
      }))
      .sort((a, b) => a.htlcId.localeCompare(b.htlcId)),
    programStateVariables,
  };

  return sha3_256(new TextEncoder().encode(canonicalJson(payload)));
}

function channelStateVarsV2(
  channel: OmniaChannel,
  settlement: boolean,
  sequence: number,
  balances: Record<string, bigint>,
  pendingHTLCs: HTLCRecord[],
  programStateVariables: StateValue[] = [],
): StateValue[] {
  const base = channelStateVars(settlement, sequence);
  const commitment = computeStateCommitmentV2(channel, sequence, balances, pendingHTLCs, {
    settlement,
    programStateVariables,
  });
  return [
    ...base,
    ...programStateVariables.filter(sv => ![STATE_SETTLEMENT_PORT, STATE_SEQUENCE_PORT, STATE_COMMITMENT_V2_PORT].includes(sv.port)),
    { port: STATE_COMMITMENT_V2_PORT, value: bytesToHexLocal(commitment), type: 'hex' },
  ];
}

export function stateCommitmentV2Matches(channel: OmniaChannel, state: SignedChannelState, settlement = false): boolean {
  const sv = state.stateVariables.find(v => v.port === STATE_COMMITMENT_V2_PORT);
  if (!sv || sv.type !== 'hex') return false;
  const expected = bytesToHexLocal(computeStateCommitmentV2(channel, state.sequence, state.balances, state.pendingHTLCs, {
    settlement,
    programStateVariables: state.stateVariables,
  })).toLowerCase();
  return String(sv.value).toLowerCase() === expected;
}

/**
 * Convert a scaled token amount back to raw Minima units.
 * `rawAmount = scaledAmount / 10^tokenScale`
 * For native Minima (tokenScale=0), no conversion is needed.
 */
export function toRawMinima(scaledAmount: bigint, tokenScale: number): bigint {
  if (!Number.isInteger(tokenScale) || tokenScale < 0) {
    throw new Error(`tokenScale must be a non-negative integer, received ${tokenScale}`);
  }
  if (scaledAmount < 0n) throw new Error(`scaledAmount must be non-negative, received ${scaledAmount}`);
  if (tokenScale === 0) return scaledAmount;
  const divisor = 10n ** BigInt(tokenScale);
  if (scaledAmount % divisor !== 0n) {
    throw new Error(`scaledAmount ${scaledAmount} is not divisible by tokenScale divisor ${divisor}`);
  }
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
  programStateVariables: StateValue[] = [],
): OmniaTxDraft {
  const stateVars = channelStateVarsV2(channel, false, newSequence, newBalances, pendingHTLCs, programStateVariables);
  const rawTotal = toRawMinima(channel.totalValue, channel.tokenScale ?? 0);
  if (!channel.fundingAddress) {
    throw new Error(`channel.fundingAddress is required but not set on channel ${channel.channelId}`);
  }
  const scriptAddress = channel.fundingAddress;

  const input = {
    coinId: COINID_ELTOO,
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
  opts?: { floatingInput?: boolean; programStateVariables?: StateValue[] },
): OmniaTxDraft {
  const stateVars = channelStateVarsV2(channel, true, state.sequence, state.balances, state.pendingHTLCs, opts?.programStateVariables);

  const rawTotal = toRawMinima(channel.totalValue, channel.tokenScale ?? 0);
  if (!channel.fundingAddress) {
    throw new Error(`channel.fundingAddress is required but not set on channel ${channel.channelId}`);
  }
  const scriptAddress = channel.fundingAddress;

  const input = {
    coinId: opts?.floatingInput ? COINID_ELTOO : channel.latestCoinId ?? channel.fundingCoinId,
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

/** Legacy/test-only JSON draft digest. Production signatures must use computeOmniaTxDigest(). */
export const computeLegacyTxDraftDigest = computeTxDraftDigest;

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
  return omniaDraftToCanonicalMinimaBytes(draft);
}

export function minimaOutputCoinIdsForDraft(draft: OmniaTxDraft): string[] {
  if (draft.inputs.length === 0) return draft.outputs.map(() => COINID_OUTPUT);
  const baseCoinId = draft.inputs[0].coinId;
  if (baseCoinId.toLowerCase() === COINID_ELTOO.toLowerCase()) {
    return draft.outputs.map(() => COINID_OUTPUT);
  }

  return draft.outputs.map((_, index) => bytesToHexLocal(sha3_256(concatBytesLocal([
    writeMiniDataLocal(hexToBytesLocal(baseCoinId)),
    writeMiniNumberLocal(BigInt(index)),
  ]))));
}

function serializeCoinForMinima(opts: {
  coinId: string;
  address: string;
  amount: bigint;
  tokenId: string;
  storeState: boolean;
  stateVariables: StateValue[];
}): Uint8Array {
  const parts = [
    writeHashToStreamLocal(opts.coinId),
    writeHashToStreamLocal(opts.address),
    writeMiniNumberLocal(opts.amount),
    writeHashToStreamLocal(opts.tokenId),
    writeMiniByteLocal(opts.storeState),
    writeMMREntryNumberLocal(0n),
    writeMiniByteLocal(false),
    writeMiniNumberLocal(0n),
    writeMiniNumberLocal(BigInt(opts.stateVariables.length)),
    ...opts.stateVariables.map(writeStateValueLocal),
    writeMiniByteLocal(false),
  ];
  return concatBytesLocal(parts);
}

export function omniaDraftToCanonicalMinimaBytes(draft: OmniaTxDraft): Uint8Array {
  const outputCoinIds = minimaOutputCoinIdsForDraft(draft);
  const inputBytes = draft.inputs.map(input => serializeCoinForMinima({
    coinId: input.coinId,
    address: input.address,
    amount: input.amount,
    tokenId: input.tokenId,
    storeState: false,
    stateVariables: [],
  }));
  const outputBytes = draft.outputs.map((output, index) => serializeCoinForMinima({
    coinId: outputCoinIds[index],
    address: output.address,
    amount: output.amount,
    tokenId: output.tokenId,
    storeState: output.storeState,
    stateVariables: output.storeState ? (output.stateVariables ?? draft.stateVariables) : [],
  }));

  return concatBytesLocal([
    writeMiniNumberLocal(BigInt(inputBytes.length)),
    ...inputBytes,
    writeMiniNumberLocal(BigInt(outputBytes.length)),
    ...outputBytes,
    writeMiniNumberLocal(BigInt((draft.stateVariables ?? []).length)),
    ...(draft.stateVariables ?? []).map(writeStateValueLocal),
    writeHashToStreamLocal('0x00'),
  ]);
}

export function computeOmniaTxDigest(draft: OmniaTxDraft): Uint8Array {
  return sha3_256(omniaDraftToCanonicalMinimaBytes(draft));
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
