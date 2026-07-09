/**
 * Minimal Minima unsigned-transaction binary parser.
 *
 * Parses the serialized transaction body (MinimaTransactionBuilder.serializeTransaction output)
 * and extracts the coinId and address from each input coin.
 * Returns null if the bytes are malformed or unparseable.
 *
 * Binary format per serializeTransaction in MinimaTransactionBuilder.ts:
 *   inputCount:  MiniNumber → [scale:1][len:1][data:len]
 *   for each input: Coin →
 *     coinId:        MiniData   (4-byte len + bytes)
 *     address:       MiniData   (4-byte len + bytes)
 *     amount:        MiniNumber (scale:1 + len:1 + data:len)
 *     tokenId:       MiniData   (4-byte len + bytes)
 *     storeState:    MiniByte   (1 byte)
 *     mmrEntryNumber: MiniNumber(scale) + MiniData(value)
 *     spent:         MiniByte   (1 byte)
 *     blockCreated:  MiniNumber (scale:1 + len:1 + data:len)
 *     stateCount:    MiniNumber
 *     state[0..n]:   [port:1][type:1][data: type-dependent]
 *     hasToken:      MiniByte   (0 or 1)
 *     if hasToken:   Token (6 fields: coinId, script, scale, totalAmount, name, created)
 *
 * State variable types (STATETYPE_*):
 *   1 = HEX    → MiniData
 *   2 = NUMBER → MiniNumber
 *   4 = STRING → MiniData
 *   8 = BOOL   → MiniByte (1 byte)
 */

export interface ParsedTxInput {
  coinId: string;   // 0x-prefixed hex
  address: string;  // 0x-prefixed hex
}

/**
 * Parse actual inputs from a serialized unsigned Minima transaction.
 * Returns null if the bytes cannot be parsed (malformed / unsupported format).
 * Returns an empty array for a transaction with zero inputs.
 */
export function parseTxInputs(txBytes: Uint8Array): ParsedTxInput[] | null {
  let o = 0;

  const toHexStr = (b: Uint8Array): string =>
    '0x' + Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');

  function read4be(): number {
    if (o + 4 > txBytes.length) throw new Error('eof');
    const n = ((txBytes[o] << 24) | (txBytes[o + 1] << 16) | (txBytes[o + 2] << 8) | txBytes[o + 3]) >>> 0;
    o += 4;
    return n;
  }

  function readMiniData(): Uint8Array {
    const len = read4be();
    if (o + len > txBytes.length) throw new Error('eof');
    const d = txBytes.slice(o, o + len);
    o += len;
    return d;
  }

  function skipMiniData(): void { readMiniData(); }

  function readMiniNumberValue(): bigint {
    if (o + 2 > txBytes.length) throw new Error('eof');
    o++; // skip scale byte
    const len = txBytes[o++];
    if (o + len > txBytes.length) throw new Error('eof');
    let v = 0n;
    for (let i = 0; i < len; i++) v = (v << 8n) | BigInt(txBytes[o++]);
    return v;
  }

  function skipMiniNumber(): void {
    if (o + 2 > txBytes.length) throw new Error('eof');
    o++; // scale
    const len = txBytes[o++];
    if (o + len > txBytes.length) throw new Error('eof');
    o += len;
  }

  // MMREntryNumber: writeMiniNumber(scale) + writeMiniData(unscaledValue)
  function skipMMREntryNumber(): void {
    skipMiniNumber(); // scale as MiniNumber
    skipMiniData();   // unscaled value as MiniData
  }

  // StateVariable: [port:1][type:1][data: type-specific]
  function skipStateVar(): void {
    if (o + 2 > txBytes.length) throw new Error('eof');
    o++; // port
    const t = txBytes[o++]; // type
    if (t === 1 || t === 4) skipMiniData();       // HEX or STRING → MiniData
    else if (t === 2) skipMiniNumber();           // NUMBER → MiniNumber
    else if (t === 8) { if (o >= txBytes.length) throw new Error('eof'); o++; } // BOOL → 1 byte
    else throw new Error(`Unknown state type: ${t}`);
  }

  // Token: coinId(MiniData) + script(MiniData) + scale(MiniNumber) + totalAmount(MiniNumber) + name(MiniData) + created(MiniNumber)
  function skipToken(): void {
    skipMiniData();   // coinId (writeHashToStream)
    skipMiniData();   // script
    skipMiniNumber(); // scale
    skipMiniNumber(); // totalAmount
    skipMiniData();   // name
    skipMiniNumber(); // created
  }

  function parseCoin(): ParsedTxInput {
    const coinId = readMiniData();
    const address = readMiniData();
    skipMiniNumber(); // amount
    skipMiniData();   // tokenId
    if (o >= txBytes.length) throw new Error('eof');
    o++; // storeState (MiniByte)
    skipMMREntryNumber();
    if (o >= txBytes.length) throw new Error('eof');
    o++; // spent (MiniByte)
    skipMiniNumber(); // blockCreated
    const stateCount = Number(readMiniNumberValue());
    for (let i = 0; i < stateCount; i++) skipStateVar();
    if (o >= txBytes.length) throw new Error('eof');
    const hasToken = txBytes[o++];
    if (hasToken) skipToken();
    return { coinId: toHexStr(coinId), address: toHexStr(address) };
  }

  try {
    const inputCount = Number(readMiniNumberValue());
    if (inputCount < 0 || inputCount > 255) return null;
    const inputs: ParsedTxInput[] = [];
    for (let i = 0; i < inputCount; i++) inputs.push(parseCoin());
    return inputs;
  } catch {
    return null;
  }
}

/**
 * Construct a minimal valid Minima transaction binary with a single input.
 * Useful for unit testing the parser.
 *
 * @param coinId32 - 32-byte coinId (default: 32 zeros)
 * @param address32 - 32-byte address (default: 32 zeros)
 */
export function buildMinimalTx1Input(coinId32?: Uint8Array, address32?: Uint8Array): Uint8Array {
  const coinId = coinId32 ?? new Uint8Array(32);
  const addr = address32 ?? new Uint8Array(32);

  if (coinId.length !== 32 || addr.length !== 32) {
    throw new Error('coinId and address must both be 32 bytes');
  }

  // MiniNumber(1): [scale=0][len=1][data=1]
  const miniNum1 = new Uint8Array([0, 1, 1]);
  // MiniNumber(0): [scale=0][len=1][data=0]
  const miniNum0 = new Uint8Array([0, 1, 0]);
  // 4-byte big-endian length for 32-byte hash
  const len32 = new Uint8Array([0, 0, 0, 32]);
  // tokenId MiniData: len=1, data=[0]
  const tokenId = new Uint8Array([0, 0, 0, 1, 0]);
  // storeState, spent, hasToken: all 0
  const zeroByte = new Uint8Array([0]);
  // mmrEntryNumber: MiniNumber([0,1,0]) + MiniData([0,0,0,1,0])
  const mmrScale = new Uint8Array([0, 1, 0]);
  const mmrValue = new Uint8Array([0, 0, 0, 1, 0]);

  return new Uint8Array([
    // inputCount = 1
    ...miniNum1,
    // Coin input:
    ...len32, ...coinId,    // coinId MiniData
    ...len32, ...addr,       // address MiniData
    ...miniNum1,             // amount MiniNumber(1)
    ...tokenId,              // tokenId MiniData
    ...zeroByte,             // storeState
    ...mmrScale, ...mmrValue, // mmrEntryNumber
    ...zeroByte,             // spent
    ...miniNum0,             // blockCreated MiniNumber(0)
    ...miniNum0,             // stateCount MiniNumber(0) → 0 state vars
    ...zeroByte,             // hasToken = 0
  ]);
}
