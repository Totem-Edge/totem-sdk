/**
 * Canonical state-transaction draft serialization.
 *
 * These primitives were originally part of `@totemsdk/omnia`, but they are not
 * channel logic: they turn a state-draft into canonical Minima bytes, compute
 * the signing digest, derive output coin IDs, and serialize witnesses. Hoisting
 * them here lets a stateful UTXO consumer (such as `@totemsdk/vtxo`) sign
 * and anchor transactions without depending on the eltoo channel package.
 *
 * The wire format is consensus-sensitive. Do not change it without a protocol
 * version bump and cross-implementation tests.
 */

import { MINIMA_DECIMALS, concat, sha3_256, writeMiniNumber } from '@totemsdk/core';
import type { StateValue } from '@totemsdk/core/scripts';

/** Sentinel coin ID for an output that is referenced by index. */
export const COINID_OUTPUT = '0x00';
/** Sentinel coin ID used by the eltoo/state-coin base input. */
export const COINID_ELTOO = '0x01';

export interface TxDraftInput {
  coinId: string;
  address: string;
  amount: bigint;
  tokenId: string;
  scriptHex?: string;
  /** Chain state flag of the input coin (needed for txnmine script checks). */
  storeState?: boolean;
  stateVariables?: StateValue[];
  /** Real MMR entry number from the input coin proof; must match txnmine. */
  mmrEntry?: bigint;
}

export interface TxDraftOutput {
  address: string;
  amount: bigint;
  tokenId: string;
  storeState: boolean;
  stateVariables?: StateValue[];
}

export interface TxDraft {
  type: string;
  inputs: TxDraftInput[];
  outputs: TxDraftOutput[];
  storeState: boolean;
  stateVariables: StateValue[];
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
  let hex = '0x';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

function concatBytesLocal(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
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
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error(`MiniByte value must be 0-255, got ${value}`);
  }
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
      data = writeMiniNumberLocal(
        typeof sv.value === 'bigint' ? sv.value : BigInt(String(sv.value)),
        (sv as StateValue & { scale?: number }).scale ?? 0,
      );
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

function serializeCoinForMinima(opts: {
  coinId: string;
  address: string;
  amount: bigint;
  tokenId: string;
  storeState: boolean;
  stateVariables: StateValue[];
  mmrEntry?: bigint;
}): Uint8Array {
  return concatBytesLocal([
    writeHashToStreamLocal(opts.coinId),
    writeHashToStreamLocal(opts.address),
    // Coin amounts are integer atoms: Java reads `MiniNumber(unscaled, scale)`
    // as unscaled x 10^-scale, so scale 44 turns 2e43 back into 0.2 MINIMA.
    writeMiniNumberLocal(opts.amount, MINIMA_DECIMALS),
    writeHashToStreamLocal(opts.tokenId),
    writeMiniByteLocal(opts.storeState),
    writeMMREntryNumberLocal(opts.mmrEntry ?? 0n),
    writeMiniByteLocal(false),
    writeMiniNumberLocal(0n),
    writeMiniNumberLocal(BigInt(opts.stateVariables.length)),
    ...opts.stateVariables.map(writeStateValueLocal),
    writeMiniByteLocal(false),
  ]);
}

/** Derive the coin IDs that a draft's outputs will have on chain. */
export function draftOutputCoinIds(draft: TxDraft): string[] {
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

/** Serialize a draft to canonical Minima transaction bytes. */
export function draftToCanonicalMinimaBytes(draft: TxDraft): Uint8Array {
  const outputCoinIds = draftOutputCoinIds(draft);
  const inputBytes = draft.inputs.map((input) => serializeCoinForMinima({
    coinId: input.coinId,
    address: input.address,
    amount: input.amount,
    tokenId: input.tokenId,
    storeState: input.storeState ?? false,
    stateVariables: input.stateVariables ?? [],
    mmrEntry: input.mmrEntry,
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

/** Alias used by call sites that describe the operation as "draft to bytes". */
export function draftToMinimaBytes(draft: TxDraft): Uint8Array {
  return draftToCanonicalMinimaBytes(draft);
}

/** The digest that is WOTS-signed for a state transaction. */
export function computeDraftDigest(draft: TxDraft): Uint8Array {
  return sha3_256(draftToCanonicalMinimaBytes(draft));
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

function bytesToHexString(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

function hexStringToBytes(hex: string): Uint8Array {
  const raw = strip0x(hex);
  const out = new Uint8Array(raw.length / 2);
  for (let i = 0; i < raw.length; i += 2) out[i / 2] = Number.parseInt(raw.slice(i, i + 2), 16);
  return out;
}

/** BigInt-safe JSON/hex draft serialization for storage and transport. */
export function serializeDraft(draft: TxDraft): string {
  return bytesToHexString(new TextEncoder().encode(JSON.stringify(draft, bigintReplacer)));
}

export function deserializeDraft(hex: string): TxDraft {
  return JSON.parse(new TextDecoder().decode(hexStringToBytes(hex)), bigintReviver) as TxDraft;
}

/** Legacy/test-only JSON draft digest. Production signatures must use computeDraftDigest(). */
export function computeDraftJsonDigest(draft: TxDraft): Uint8Array {
  const bytes = new TextEncoder().encode(JSON.stringify({
    type: draft.type,
    inputs: draft.inputs,
    outputs: draft.outputs,
    stateVariables: draft.stateVariables,
  }, bigintReplacer));
  return sha3_256(bytes);
}

export const computeLegacyDraftDigest = computeDraftJsonDigest;

/** Compatibility aliases for callers migrating from `@totemsdk/omnia`. */
export const serializeTxDraft = serializeDraft;
export const deserializeTxDraft = deserializeDraft;

export interface WitnessProofs {
  /** Serialized Minima CoinProof bytes, one per spending input. */
  coinProofs: Uint8Array[];
  /** Serialized Minima ScriptProof bytes required by the input scripts. */
  scriptProofs: Uint8Array[];
}

export interface WitnessOptions extends WitnessProofs {
  /** Serialized Minima Signature objects. Must match the transaction digest being broadcast. */
  signatures: Uint8Array[];
}

function serializeProofList(items: Uint8Array[]): Uint8Array[] {
  return [writeMiniNumber(BigInt(items.length), 0), ...items];
}

/** Serialize the signatures, coin proofs and script proofs for broadcast. */
export function serializeDraftWitness(options: WitnessOptions): Uint8Array {
  return concat(
    ...serializeProofList(options.signatures),
    ...serializeProofList(options.coinProofs),
    ...serializeProofList(options.scriptProofs),
  );
}

export function assertBroadcastProofs(
  proofs?: Partial<WitnessProofs>,
): asserts proofs is WitnessProofs {
  if (!proofs?.coinProofs?.length) {
    throw new Error('Missing serialized Minima coin proofs for Omnia broadcast');
  }
  if (!proofs.scriptProofs) {
    throw new Error('Missing serialized Minima script proofs for Omnia broadcast');
  }
}
