/**
 * Transaction Serialization & Digest Computation
 * 
 * Port of the extension's MinimaTransactionBuilder serialization logic
 * to the SDK core for full parity with the Totem wallet extension.
 * 
 * Matches Minima Java's Transaction.writeDataStream() and Coin.writeDataStream() exactly.
 * 
 * CRITICAL: Before computing the transaction digest for signing, you MUST call
 * precomputeTransactionCoinID() to set output coin IDs. Without this, the signed
 * digest won't match what the Minima node verifies, causing allsignaturesvalid=false.
 */

import { sha3_256 } from './wasm-sync.js';
import {
  writeMiniNumber,
  writeMiniData,
  writeHashToStream,
  writeMiniByte,
  writeMMREntryNumber,
  concat,
  hexToBytes,
  bytesToHex,
} from './Streamable.js';

const ZERO_TXPOWID = new Uint8Array([0x00]);

const STATETYPE_HEX = 1;
const STATETYPE_NUMBER = 2;
const STATETYPE_STRING = 4;
const STATETYPE_BOOL = 8;

export interface MinimaTransaction {
  linkHash: Uint8Array;
  inputs: MinimaCoin[];
  outputs: MinimaCoin[];
  state: StateVariable[];
}

export interface MinimaCoin {
  coinId: Uint8Array;
  address: Uint8Array;
  amount: string;
  tokenId: Uint8Array;
  token: MinimaToken | null;
  storeState: boolean;
  state: StateVariable[] | RawStateVariable[];
  mmrEntryNumber: bigint;
  spent: boolean;
  created: bigint;
  rawAmountBytes?: Uint8Array;
  rawMmrEntryBytes?: Uint8Array;
  rawBlockCreatedBytes?: Uint8Array;
  rawTokenData?: Uint8Array;
}

export interface ParsedMiniNumber {
  scale: number;
  unscaledValue: bigint;
}

export interface MinimaToken {
  coinId: Uint8Array;
  scale: number;
  totalAmount: bigint;
  name: Uint8Array;
  script: Uint8Array;
  created?: bigint;
}

export interface StateVariable {
  port: number;
  value: string | bigint | boolean | Uint8Array;
  type: 'bool' | 'number' | 'hex' | 'string';
}

export interface RawStateVariable {
  port: number;
  type: number;
  rawData: Uint8Array;
}

export interface CoinProofData {
  coinId: Uint8Array;
  address: Uint8Array;
  rawAmountBytes: Uint8Array;
  tokenId: Uint8Array;
  storeState: boolean;
  mmrEntryNumber: bigint;
  rawMmrEntryBytes: Uint8Array;
  spent: boolean;
  blockCreated: bigint;
  rawBlockCreatedBytes: Uint8Array;
  state: RawStateVariable[];
  rawTokenData?: Uint8Array;
}

export interface SpendableCoinInput {
  coinId: string;
  address: string;
  amount: string;
  tokenId: string;
  rawAmountBytes?: Uint8Array;
  coinProofData?: CoinProofData;
}

export interface TransactionBuildResult {
  transaction: MinimaTransaction;
  digestTx: Uint8Array;
  digestTxHex: string;
  serialized: Uint8Array;
  serializedHex: string;
}

export function parseDecimalToMiniNumber(decimal: string): ParsedMiniNumber {
  if (!decimal || decimal === '') {
    return { scale: 0, unscaledValue: 0n };
  }

  if (decimal.includes('e') || decimal.includes('E')) {
    throw new Error(`Scientific notation not supported: "${decimal}". Convert to plain decimal first.`);
  }

  let isNegative = false;
  let cleaned = decimal.trim();
  if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.slice(1);
  }

  const dotIndex = cleaned.indexOf('.');

  let scale: number;
  let unscaledStr: string;

  if (dotIndex === -1) {
    scale = 0;
    unscaledStr = cleaned;
  } else {
    const wholePart = cleaned.slice(0, dotIndex);
    const fracPart = cleaned.slice(dotIndex + 1);
    scale = fracPart.length;
    unscaledStr = wholePart + fracPart;
  }

  unscaledStr = unscaledStr.replace(/^0+/, '') || '0';

  let unscaledValue = BigInt(unscaledStr);
  if (isNegative && unscaledValue !== 0n) {
    unscaledValue = -unscaledValue;
  }

  return { scale, unscaledValue };
}

function encodeParsedMiniNumber(parsed: ParsedMiniNumber): Uint8Array {
  return writeMiniNumber(parsed.unscaledValue, parsed.scale);
}

function normalizeAddressToHex(addr: string): string {
  if (!addr) {
    return '0x00';
  }
  const trimmed = addr.trim();

  const hexAddr = trimmed.startsWith('0x') ? trimmed : '0x' + trimmed;
  const cleanHex = hexAddr.slice(2);
  if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
    throw new Error(`Invalid hex address: contains non-hex characters`);
  }
  if (cleanHex.length % 2 !== 0) {
    throw new Error(`Invalid hex address: odd length (${cleanHex.length} chars)`);
  }

  return hexAddr;
}

function serializeStateVariable(sv: StateVariable): Uint8Array {
  if (sv.port < 0 || sv.port > 255) {
    throw new Error(`StateVariable port must be 0-255, got ${sv.port}`);
  }

  const portByte = new Uint8Array([sv.port]);

  let typeByte: Uint8Array;
  let dataBytes: Uint8Array;

  switch (sv.type) {
    case 'bool':
      typeByte = new Uint8Array([STATETYPE_BOOL]);
      if (typeof sv.value === 'boolean') {
        dataBytes = new Uint8Array([sv.value ? 1 : 0]);
      } else if (typeof sv.value === 'string') {
        dataBytes = new Uint8Array([sv.value.toUpperCase() === 'TRUE' ? 1 : 0]);
      } else {
        throw new Error(`Invalid bool StateVariable value: ${sv.value}`);
      }
      break;

    case 'number':
      typeByte = new Uint8Array([STATETYPE_NUMBER]);
      if (typeof sv.value === 'bigint') {
        dataBytes = writeMiniNumber(sv.value);
      } else if (typeof sv.value === 'string') {
        dataBytes = writeMiniNumber(BigInt(sv.value));
      } else {
        throw new Error(`Invalid number StateVariable value: ${sv.value}`);
      }
      break;

    case 'hex':
      typeByte = new Uint8Array([STATETYPE_HEX]);
      if (typeof sv.value === 'string') {
        const normalizedHex = normalizeAddressToHex(sv.value);
        dataBytes = writeMiniData(hexToBytes(normalizedHex));
      } else if (sv.value instanceof Uint8Array) {
        dataBytes = writeMiniData(sv.value);
      } else {
        throw new Error(`Invalid hex StateVariable value: ${sv.value}`);
      }
      break;

    case 'string':
      typeByte = new Uint8Array([STATETYPE_STRING]);
      if (typeof sv.value === 'string') {
        let bracketedValue = sv.value;
        if (!sv.value.startsWith('[') || !sv.value.endsWith(']')) {
          bracketedValue = `[${sv.value}]`;
        }
        const utf8Bytes = new TextEncoder().encode(bracketedValue);
        dataBytes = writeMiniData(utf8Bytes);
      } else {
        throw new Error(`Invalid string StateVariable value: ${sv.value}`);
      }
      break;

    default:
      throw new Error(`Unknown StateVariable type: ${(sv as any).type}`);
  }

  return concat(portByte, typeByte, dataBytes);
}

function serializeToken(token: MinimaToken): Uint8Array {
  // Java Token.writeDataStream() order: coinId, script, scale, totalAmount, name, created
  const parts: Uint8Array[] = [];
  parts.push(writeHashToStream(token.coinId));
  parts.push(writeMiniData(token.script));
  parts.push(writeMiniNumber(BigInt(token.scale)));
  parts.push(writeMiniNumber(token.totalAmount, 0));
  parts.push(writeMiniData(token.name));
  parts.push(writeMiniNumber(token.created ?? 0n));
  return concat(...parts);
}

export function serializeCoin(coin: MinimaCoin): Uint8Array {
  const parts: Uint8Array[] = [];

  parts.push(writeHashToStream(coin.coinId));
  parts.push(writeHashToStream(coin.address));

  let amountBytes: Uint8Array;
  if (coin.rawAmountBytes && coin.rawAmountBytes.length > 0) {
    amountBytes = coin.rawAmountBytes;
  } else {
    const parsedAmount = parseDecimalToMiniNumber(coin.amount);
    amountBytes = encodeParsedMiniNumber(parsedAmount);
  }
  parts.push(amountBytes);

  parts.push(writeMiniData(coin.tokenId));
  parts.push(writeMiniByte(coin.storeState));

  let mmrBytes: Uint8Array;
  if (coin.rawMmrEntryBytes && coin.rawMmrEntryBytes.length > 0) {
    mmrBytes = coin.rawMmrEntryBytes;
  } else {
    mmrBytes = writeMMREntryNumber(coin.mmrEntryNumber);
  }
  parts.push(mmrBytes);

  parts.push(writeMiniByte(coin.spent));

  let createdBytes: Uint8Array;
  if (coin.rawBlockCreatedBytes && coin.rawBlockCreatedBytes.length > 0) {
    createdBytes = coin.rawBlockCreatedBytes;
  } else {
    createdBytes = writeMiniNumber(coin.created);
  }
  parts.push(createdBytes);

  const stateCountBytes = writeMiniNumber(BigInt(coin.state.length));
  parts.push(stateCountBytes);

  for (const sv of coin.state) {
    let svBytes: Uint8Array;
    if ('rawData' in sv) {
      const raw = sv as RawStateVariable;
      const portByte = new Uint8Array([raw.port]);
      const typeByte = new Uint8Array([raw.type]);
      svBytes = concat(portByte, typeByte, raw.rawData);
    } else {
      svBytes = serializeStateVariable(sv as StateVariable);
    }
    parts.push(svBytes);
  }

  if (coin.rawTokenData && coin.rawTokenData.length > 0) {
    parts.push(writeMiniByte(true));
    parts.push(coin.rawTokenData);
  } else if (coin.token) {
    parts.push(writeMiniByte(true));
    parts.push(serializeToken(coin.token));
  } else {
    parts.push(writeMiniByte(false));
  }

  return concat(...parts);
}

export function serializeTransaction(tx: MinimaTransaction): Uint8Array {
  const parts: Uint8Array[] = [];

  parts.push(writeMiniNumber(BigInt(tx.inputs.length)));

  for (const input of tx.inputs) {
    parts.push(serializeCoin(input));
  }

  parts.push(writeMiniNumber(BigInt(tx.outputs.length)));

  for (const output of tx.outputs) {
    parts.push(serializeCoin(output));
  }

  parts.push(writeMiniNumber(BigInt(tx.state.length)));

  for (const sv of tx.state) {
    parts.push(serializeStateVariable(sv));
  }

  parts.push(writeHashToStream(tx.linkHash));

  return concat(...parts);
}

export function computeTransactionDigest(tx: MinimaTransaction): Uint8Array {
  const serialized = serializeTransaction(tx);
  return sha3_256(serialized);
}

export function precomputeTransactionCoinID(tx: MinimaTransaction): void {
  if (tx.inputs.length === 0) return;

  const baseCoinId = tx.inputs[0].coinId;

  if (baseCoinId.length < 2) {
    throw new Error(
      `Cannot precompute output coinIDs: input[0].coinId is ${baseCoinId.length} byte(s) ` +
      `(placeholder?). Real coinId from CoinProof required for signing.`
    );
  }

  for (let i = 0; i < tx.outputs.length; i++) {
    const baseCoinIdStream = writeMiniData(baseCoinId);
    const outputIndexStream = writeMiniNumber(BigInt(i));
    const combined = concat(baseCoinIdStream, outputIndexStream);
    tx.outputs[i].coinId = sha3_256(combined);
  }
}

export function createDefaultTransaction(): MinimaTransaction {
  return {
    linkHash: ZERO_TXPOWID,
    inputs: [],
    outputs: [],
    state: [],
  };
}

export function buildMinimaCoin(opts: {
  coinId?: Uint8Array;
  address: Uint8Array;
  amount: string;
  tokenId?: Uint8Array;
  storeState?: boolean;
  state?: StateVariable[];
  mmrEntryNumber?: bigint;
  spent?: boolean;
  created?: bigint;
  rawAmountBytes?: Uint8Array;
  rawMmrEntryBytes?: Uint8Array;
  rawBlockCreatedBytes?: Uint8Array;
  coinProofData?: CoinProofData;
}): MinimaCoin {
  if (opts.coinProofData) {
    const cpd = opts.coinProofData;
    return {
      coinId: cpd.coinId,
      address: cpd.address,
      amount: opts.amount,
      tokenId: cpd.tokenId,
      token: null,
      storeState: cpd.storeState,
      state: cpd.state,
      mmrEntryNumber: cpd.mmrEntryNumber,
      spent: cpd.spent,
      created: cpd.blockCreated,
      rawAmountBytes: cpd.rawAmountBytes,
      rawMmrEntryBytes: cpd.rawMmrEntryBytes,
      rawBlockCreatedBytes: cpd.rawBlockCreatedBytes,
    };
  }

  return {
    coinId: opts.coinId || new Uint8Array([0x00]),
    address: opts.address,
    amount: opts.amount,
    tokenId: opts.tokenId || new Uint8Array([0x00]),
    token: null,
    storeState: opts.storeState ?? false,
    state: opts.state || [],
    mmrEntryNumber: opts.mmrEntryNumber ?? 0n,
    spent: opts.spent ?? false,
    created: opts.created ?? 0n,
    rawAmountBytes: opts.rawAmountBytes,
    rawMmrEntryBytes: opts.rawMmrEntryBytes,
    rawBlockCreatedBytes: opts.rawBlockCreatedBytes,
  };
}
