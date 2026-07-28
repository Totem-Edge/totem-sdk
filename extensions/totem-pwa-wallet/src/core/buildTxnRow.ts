/**
 * buildTxnRow.ts — Full TxnRow builder for the PWA wallet.
 *
 * Builds a byte-exact Minima TxnRow (the format txnimport expects) from:
 *   • parsed input CoinProofs (from /wots-hardened/coinproofs)
 *   • constructed output coins
 *   • a per-address WOTS TreeKey for signing
 *
 * Serialization primitives match Minima's Java Streamable interface exactly.
 */
import { sha3_256 } from '@noble/hashes/sha3';
import { serializeTreeSignature, type TreeKey } from '@totemsdk/core';

// ─── Utility ──────────────────────────────────────────────────────────────────

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!h.length) return new Uint8Array(0);
  const out = new Uint8Array(h.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

// ─── Minima serialization primitives ─────────────────────────────────────────
// These mirror Java's Streamable implementations byte-for-byte.

/** MiniData: 4-byte big-endian length followed by raw bytes */
function writeMiniData(data: Uint8Array): Uint8Array {
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, data.length, false);
  return concat(len, data);
}

/** MiniString: delegates to writeMiniData(UTF-8 bytes) */
function writeMiniString(str: string): Uint8Array {
  return writeMiniData(new TextEncoder().encode(str));
}

/**
 * MiniNumber: [scale: 1 byte][length: 1 byte][big-endian value bytes]
 * Value is stored as a Java BigInteger (unsigned big-endian, with leading 0x00 if sign bit set).
 */
function writeMiniNumber(value: bigint, scale = 0): Uint8Array {
  const sb = new Uint8Array([scale & 0xff]);
  if (value === 0n) return concat(sb, new Uint8Array([1, 0]));
  let h = value.toString(16);
  if (h.length & 1) h = '0' + h;
  const raw = hexToBytes(h);
  const data = raw[0] >= 0x80 ? concat(new Uint8Array([0]), raw) : raw;
  return concat(sb, new Uint8Array([data.length]), data);
}

/** Single boolean byte */
function writeMiniByte(v: boolean | number): Uint8Array {
  return new Uint8Array([v ? 1 : 0]);
}

/** Crypto.writeHashToStream = writeMiniData */
function writeHashToStream(hash: Uint8Array): Uint8Array {
  return writeMiniData(hash);
}

/**
 * MMREntryNumber: MiniNumber(scale=0) followed by MiniData(unscaled BigInt bytes).
 * Used for coin mmrEntryNumber and blockCreated fields.
 */
function writeMMREntryNumber(value: bigint): Uint8Array {
  const scalePart = writeMiniNumber(0n);
  if (value === 0n) return concat(scalePart, writeMiniData(new Uint8Array([0])));
  let h = value.toString(16);
  if (h.length & 1) h = '0' + h;
  const raw = hexToBytes(h);
  const data = raw[0] >= 0x80 ? concat(new Uint8Array([0]), raw) : raw;
  return concat(scalePart, writeMiniData(data));
}

/** Empty MMR proof: blockTime(MiniNumber=0) + proofChainLength(MiniNumber=0) */
function encodeEmptyMMRProof(): Uint8Array {
  return concat(writeMiniNumber(0n), writeMiniNumber(0n));
}

// ─── CoinProof parser ──────────────────────────────────────────────────────────

export interface ParsedInputCoin {
  coinId: Uint8Array;
  address: Uint8Array;
  rawAmountBytes: Uint8Array;
  tokenId: Uint8Array;
  storeState: boolean;
  rawMmrEntryBytes: Uint8Array;
  spent: boolean;
  rawBlockCreatedBytes: Uint8Array;
  /** Pre-serialized state variable bytes (count byte + var bytes) */
  rawStateSection: Uint8Array;
  rawTokenData?: Uint8Array;
  /** Original CoinProof hex — written verbatim into the Witness */
  coinProofHex: string;
}

function readU32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o+1] << 16) | (b[o+2] << 8) | b[o+3]) >>> 0;
}

/**
 * Parse a Minima CoinProof (from coinexport / /wots-hardened/coinproofs).
 * Extracts raw field bytes so serializeCoin can reconstruct the coin byte-exactly.
 *
 * CoinProof format: Coin.writeDataStream() + MMR proof bytes
 * Coin field order: coinId, address, amount, tokenId, storeState, mmrEntryNumber,
 *                   spent, blockCreated, stateVars, hasToken [+ Token]
 */
export function parseCoinFromProof(coinProofHex: string): ParsedInputCoin {
  const h = coinProofHex.startsWith('0x') ? coinProofHex.slice(2) : coinProofHex;
  const b = hexToBytes(h);
  let o = 0;

  const readMiniDataBytes = (): Uint8Array => {
    const len = readU32(b, o); o += 4;
    const data = b.slice(o, o + len); o += len;
    return data;
  };

  /** Read raw MiniNumber bytes, fixing len=0 (zero-length BigInteger is invalid in Java) */
  const readMiniNumberRaw = (): Uint8Array => {
    const start = o;
    const scale = b[o];
    const len = b[o + 1];
    if (len === 0) {
      o += 2;
      return new Uint8Array([scale, 1, 0]);
    }
    o += 2 + len;
    return b.slice(start, o);
  };

  // 1. coinId (MiniData = writeHashToStream)
  const coinId = readMiniDataBytes();
  // 2. address (MiniData)
  const address = readMiniDataBytes();
  // 3. amount (MiniNumber)
  const rawAmountBytes = readMiniNumberRaw();
  // 4. tokenId (MiniData)
  const tokenId = readMiniDataBytes();
  // 5. storeState (MiniByte)
  const storeState = b[o++] === 1;

  // 6. mmrEntryNumber (MMREntryNumber = MiniNumber_scale + MiniData_value)
  const mmrStart = o;
  { const mmrScaleLen = b[o + 1]; o += (mmrScaleLen === 0 ? 2 : 2 + mmrScaleLen); }
  { const mmrDataLen = readU32(b, o); o += 4 + mmrDataLen; }
  const rawMmrEntryBytes = b.slice(mmrStart, o);

  // 7. spent (MiniByte)
  const spent = b[o++] === 1;
  // 8. blockCreated (MiniNumber)
  const rawBlockCreatedBytes = readMiniNumberRaw();

  // 9. state variables: MiniNumber(count) + StateVariable[]
  const stateStart = o;
  const stateCountRaw = readMiniNumberRaw();
  // Parse count value from stateCountRaw
  let stateCount = 0;
  if (stateCountRaw.length >= 3) stateCount = stateCountRaw[2];  // scale=0, len=1, value

  for (let s = 0; s < stateCount && s < 256; s++) {
    o += 1; // port byte
    const type = b[o++]; // type byte
    if (type === 1) {
      // HEX: MiniData
      const l = readU32(b, o); o += 4 + l;
    } else if (type === 2) {
      // NUMBER: MiniNumber
      const l = b[o + 1]; o += (l === 0 ? 2 : 2 + l);
    } else if (type === 3) {
      // SCRIPT: MiniString (= MiniData)
      const l = readU32(b, o); o += 4 + l;
    }
  }
  const rawStateSection = b.slice(stateStart, o);

  // 10. hasToken (MiniByte) + optional Token
  const hasToken = b[o++] === 1;
  let rawTokenData: Uint8Array | undefined;
  if (hasToken) {
    const tokenStart = o;
    // Token: coinId(MiniData) + scale(MiniNumber) + totalAmount(MiniNumber) +
    //        name(MiniData) + created(MiniNumber)
    const _tokenCoinId = readMiniDataBytes();
    readMiniNumberRaw(); // scale
    readMiniNumberRaw(); // totalAmount
    readMiniDataBytes(); // name
    readMiniNumberRaw(); // created
    rawTokenData = b.slice(tokenStart, o);
  }

  return {
    coinId, address, rawAmountBytes, tokenId, storeState,
    rawMmrEntryBytes, spent, rawBlockCreatedBytes, rawStateSection,
    rawTokenData,
    coinProofHex: h,
  };
}

// ─── Coin serialization ───────────────────────────────────────────────────────

interface OutputCoin {
  coinId: Uint8Array;     // precomputed or zero
  address: Uint8Array;    // 32-byte address hash
  amountDecimal: string;  // "1.5" etc.
  tokenId: Uint8Array;    // 0x00 for native MINIMA
}

/** Parse decimal string to MiniNumber bytes (scale + len + value) */
function writeMiniNumberFromDecimal(decimal: string): Uint8Array {
  const s = decimal.trim();
  const dot = s.indexOf('.');
  if (dot === -1) return writeMiniNumber(BigInt(s || '0'));
  const intPart = s.slice(0, dot) || '0';
  const fracPart = s.slice(dot + 1);
  const scale = fracPart.length;
  const unscaled = BigInt(intPart + fracPart);
  return writeMiniNumber(unscaled, scale);
}

/** Serialize an input coin (from CoinProof) — byte-exact via raw extracted bytes */
function serializeInputCoin(c: ParsedInputCoin): Uint8Array {
  const parts: Uint8Array[] = [
    writeHashToStream(c.coinId),
    writeHashToStream(c.address),
    c.rawAmountBytes,
    writeMiniData(c.tokenId),
    writeMiniByte(c.storeState),
    c.rawMmrEntryBytes,
    writeMiniByte(c.spent),
    c.rawBlockCreatedBytes,
    c.rawStateSection,
  ];

  if (c.rawTokenData && c.rawTokenData.length > 0) {
    parts.push(writeMiniByte(true));
    parts.push(c.rawTokenData);
  } else {
    parts.push(writeMiniByte(false));
  }

  return concat(...parts);
}

/** Serialize an output coin (constructed, no CoinProof) */
function serializeOutputCoin(c: OutputCoin): Uint8Array {
  return concat(
    writeHashToStream(c.coinId),
    writeHashToStream(c.address),
    writeMiniNumberFromDecimal(c.amountDecimal),
    writeMiniData(c.tokenId),
    writeMiniByte(false),          // storeState
    writeMMREntryNumber(0n),       // mmrEntryNumber = 0
    writeMiniByte(false),          // spent
    writeMiniNumber(0n),           // blockCreated = 0
    writeMiniNumber(0n),           // state count = 0
    writeMiniByte(false),          // hasToken
  );
}

// ─── Transaction serialization ────────────────────────────────────────────────

const ZERO_LINK_HASH = new Uint8Array([0x00]); // Java Transaction.mLinkHash default

/**
 * Precompute output coinIDs before the digest is computed.
 * Formula (matches Java TxPoWGenerator.precomputeTransactionCoinID):
 *   outputCoinId[i] = SHA3-256( writeMiniData(inputs[0].coinId) || writeMiniNumber(i) )
 */
function precomputeOutputCoinIds(inputs: ParsedInputCoin[], outputs: OutputCoin[]): void {
  if (inputs.length === 0) return;
  const baseCoinId = inputs[0].coinId;
  for (let i = 0; i < outputs.length; i++) {
    const toHash = concat(writeMiniData(baseCoinId), writeMiniNumber(BigInt(i)));
    outputs[i].coinId = new Uint8Array(sha3_256(toHash));
  }
}

/** Serialize Transaction and return both bytes and its SHA3-256 digest for signing */
function serializeTransactionBytes(
  inputs: ParsedInputCoin[],
  outputs: OutputCoin[],
): { txBytes: Uint8Array; digestTx: Uint8Array } {
  const parts: Uint8Array[] = [];

  parts.push(writeMiniNumber(BigInt(inputs.length)));
  for (const c of inputs) parts.push(serializeInputCoin(c));

  parts.push(writeMiniNumber(BigInt(outputs.length)));
  for (const c of outputs) parts.push(serializeOutputCoin(c));

  parts.push(writeMiniNumber(0n)); // state variable count = 0

  parts.push(writeHashToStream(ZERO_LINK_HASH));

  const txBytes = concat(...parts);
  const digestTx = new Uint8Array(sha3_256(txBytes));
  return { txBytes, digestTx };
}

// ─── Witness serialization ────────────────────────────────────────────────────

function buildWotsUnlockScript(pubKeyHex: string): string {
  const raw = pubKeyHex.replace(/^0x/i, '').toUpperCase();
  return `RETURN SIGNEDBY(0x${raw})`;
}

function encodeScriptProof(script: string): Uint8Array {
  return concat(writeMiniString(script), encodeEmptyMMRProof());
}

/**
 * Serialize Minima Witness:
 *   sigCount(1) + Signature(serializeTreeSignature)
 *   + coinProofCount + rawCoinProofBytes[]
 *   + scriptCount(1) + scriptProof
 */
function serializeWitness(
  treeSig: ReturnType<TreeKey['sign']>,
  coinProofsHex: string[],
  unlockScript: string,
): Uint8Array {
  const parts: Uint8Array[] = [];

  // Signatures: 1 Signature = serializeTreeSignature(treeSig)
  parts.push(writeMiniNumber(1n));
  parts.push(serializeTreeSignature(treeSig) as Uint8Array);

  // CoinProofs: raw from coinexport
  parts.push(writeMiniNumber(BigInt(coinProofsHex.length)));
  for (const cpHex of coinProofsHex) {
    parts.push(hexToBytes(cpHex));
  }

  // ScriptProofs: one unlock script per unique input address
  parts.push(writeMiniNumber(1n));
  parts.push(encodeScriptProof(unlockScript));

  return concat(...parts);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface BuildSendParams {
  txId: string;
  treeKey: TreeKey;
  /** Serialized CoinProof hexes from /wots-hardened/coinproofs (one per input) */
  inputCoinProofsHex: string[];
  /** Recipient address as 0x hex */
  toAddressHex: string;
  /** Amount to send, decimal string e.g. "1.5" */
  toAmount: string;
  /** Change-back address (usually same as sender) */
  changeAddressHex: string;
  /** Change amount, decimal string */
  changeAmount: string;
  /** Per-address public key hex (for unlock script and validation) */
  perAddressPublicKey: string;
  /** WOTS key indices for setUses() — from /wots-hardened/prepare response */
  l1: number;
  l2: number;
}

export interface BuildSendResult {
  txnRowHex: string;     // 0x-prefixed, ready for /finalize signedHex
  digestTx: string;      // hex of SHA3-256(transaction bytes)
}

/**
 * Build a complete TxnRow hex for a simple MINIMA send.
 *
 * This is the value that must be passed as `signedHex` to /wots-hardened/finalize.
 * The format is TxnRow (not TxPoW): txnimport parses it as TxnRow.readDataStream().
 */
export async function buildTxnRowHex(params: BuildSendParams): Promise<BuildSendResult> {
  const {
    txId, treeKey, inputCoinProofsHex,
    toAddressHex, toAmount, changeAddressHex, changeAmount,
    perAddressPublicKey, l1, l2,
  } = params;

  // 1. Parse input coins from CoinProof
  const inputs = inputCoinProofsHex.map(parseCoinFromProof);
  if (inputs.length === 0) throw new Error('No input coins provided');

  // Helper: normalise hex address to bytes
  const addrToBytes = (hex: string): Uint8Array => {
    const h = hex.replace(/^0x/i, '');
    if (h.length !== 64) throw new Error(`Invalid 32-byte address: ${hex}`);
    return hexToBytes(h);
  };

  // Determine tokenId from first input (native MINIMA = [0x00])
  const tokenId = inputs[0].tokenId;

  // 2. Build output coins (no coinId yet — will be precomputed)
  const outputs: OutputCoin[] = [];

  if (parseFloat(toAmount) > 0) {
    outputs.push({
      coinId: new Uint8Array([0x00]),
      address: addrToBytes(toAddressHex),
      amountDecimal: toAmount,
      tokenId,
    });
  }

  if (parseFloat(changeAmount) > 0) {
    outputs.push({
      coinId: new Uint8Array([0x00]),
      address: addrToBytes(changeAddressHex),
      amountDecimal: changeAmount,
      tokenId,
    });
  }

  // 3. Precompute output coinIDs (must happen BEFORE digest computation)
  precomputeOutputCoinIds(inputs, outputs);

  // 4. Serialize Transaction + compute digestTx
  const { txBytes, digestTx } = serializeTransactionBytes(inputs, outputs);

  // 5. Set WOTS key index (l1 * 64 + l2) and sign the transaction digest
  treeKey.setUses(l1 * 64 + l2);
  const treeSig = treeKey.sign(digestTx);

  // 6. Build witness (signature + coinproofs + script)
  const unlockScript = buildWotsUnlockScript(perAddressPublicKey);
  const witnessBytes = serializeWitness(treeSig, inputCoinProofsHex, unlockScript);

  // 7. Assemble TxnRow: MiniString(id) + Transaction + Witness
  const txnRow = concat(
    writeMiniString(txId),
    txBytes,
    witnessBytes,
  );

  return {
    txnRowHex: '0x' + bytesToHex(txnRow),
    digestTx: '0x' + bytesToHex(digestTx),
  };
}

// ─── Coin selection helper ─────────────────────────────────────────────────────

export interface RawCoinRecord {
  coinid: string;
  amount: string;   // decimal string
  address: string;
  tokenid: string;
  spent?: boolean;
}

/** Decimal-string multiply by 10^SCALE to avoid float rounding */
const SCALE = 8;
const SCALE_FACTOR = BigInt(10 ** SCALE);

function parseAmountToBigInt(decimal: string): bigint {
  const s = decimal.trim();
  const dot = s.indexOf('.');
  if (dot === -1) return BigInt(s) * SCALE_FACTOR;
  const intPart = s.slice(0, dot) || '0';
  const fracPart = s.slice(dot + 1).padEnd(SCALE, '0').slice(0, SCALE);
  return BigInt(intPart) * SCALE_FACTOR + BigInt(fracPart);
}

function bigIntToDecimal(n: bigint): string {
  const s = n.toString().padStart(SCALE + 1, '0');
  const intPart = s.slice(0, s.length - SCALE) || '0';
  const fracPart = s.slice(s.length - SCALE).replace(/0+$/, '');
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

export interface CoinSelectionResult {
  selected: RawCoinRecord[];
  changeAmount: string;
  totalInputAmount: string;
}

/**
 * Select coins covering the requested amount.
 * Returns the selected coins and the change amount.
 */
export function selectCoins(
  coins: RawCoinRecord[],
  amountDecimal: string,
  tokenId = '0x00',
): CoinSelectionResult {
  const needed = parseAmountToBigInt(amountDecimal);
  const spendable = coins.filter(c =>
    !c.spent &&
    (c.tokenid === tokenId || c.tokenid === '0x00' && tokenId === '0x00') &&
    parseAmountToBigInt(c.amount) > 0n
  );

  // Sort descending — largest coins first (reduce number of inputs)
  spendable.sort((a, b) => {
    const d = parseAmountToBigInt(b.amount) - parseAmountToBigInt(a.amount);
    return d > 0n ? 1 : d < 0n ? -1 : 0;
  });

  const selected: RawCoinRecord[] = [];
  let total = 0n;

  for (const c of spendable) {
    selected.push(c);
    total += parseAmountToBigInt(c.amount);
    if (total >= needed) break;
  }

  if (total < needed) throw new Error(`Insufficient balance: have ${bigIntToDecimal(total)}, need ${amountDecimal}`);

  return {
    selected,
    changeAmount: bigIntToDecimal(total - needed),
    totalInputAmount: bigIntToDecimal(total),
  };
}
