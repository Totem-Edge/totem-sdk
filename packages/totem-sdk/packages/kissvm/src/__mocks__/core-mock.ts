import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto';
import { MiniNumber } from '../MiniNumber.js';
export { MiniNumber };

export function sha3_256(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha3-256').update(data).digest());
}

// ─── MMR helpers (pure JS, no WASM needed) ──────────────────────────────────

const u32be = (n: number) => new Uint8Array([(n>>>24)&0xff, (n>>>16)&0xff, (n>>>8)&0xff, n&0xff]);

function encodeMiniNumberZERO(): Uint8Array {
  return new Uint8Array([0x00, 0x01, 0x00]);
}

function encodeMiniStringUTF8(text: string): Uint8Array {
  const utf8 = new TextEncoder().encode(text);
  return concatBytes(u32be(utf8.length), utf8);
}

export function mmrLeafExact(script: string): Uint8Array {
  const zero = encodeMiniNumberZERO();
  const mstr = encodeMiniStringUTF8(script);
  return sha3_256(concatBytes(zero, concatBytes(mstr, zero)));
}

export function mmrRootFromSingleLeaf(script: string): Uint8Array {
  return mmrLeafExact(script);
}

export interface MMRData { data: Uint8Array; value: bigint }
export interface MMRProofChunk { isLeft: boolean; mmrData: MMRData }
export interface MMRProof { chunks: MMRProofChunk[] }

function serializeMiniNumber(n: bigint): Uint8Array {
  if (n === 0n) return encodeMiniNumberZERO();
  const neg = n < 0n;
  const abs = neg ? -n : n;
  let hex = abs.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const bytes = hexToBytes(hex);
  const scale = neg ? 0x80 : 0x00;
  return new Uint8Array([scale, bytes.length, ...bytes]);
}

function serializeMiniData(data: Uint8Array): Uint8Array {
  return concatBytes(u32be(data.length), data);
}

function javaHashAllObjects(...objs: Uint8Array[]): Uint8Array {
  const total = objs.reduce((n: number, p: Uint8Array) => n + p.length, 0);
  const all = new Uint8Array(total);
  let off = 0;
  for (const p of objs) { all.set(p, off); off += p.length; }
  return sha3_256(all);
}

export function createMMRDataLeafNode(pubkey: Uint8Array, sumValue: bigint = 0n): MMRData {
  const zero = serializeMiniNumber(0n);
  const pubkeySerialized = serializeMiniData(pubkey);
  const sumSerialized = serializeMiniNumber(sumValue);
  const hash = javaHashAllObjects(zero, pubkeySerialized, sumSerialized);
  return { data: hash, value: sumValue };
}

export function createMMRDataParentNode(left: MMRData, right: MMRData): MMRData {
  const sumValue = left.value + right.value;
  const one = new Uint8Array([0x00, 0x01, 0x01]);
  const leftDataSerialized = serializeMiniData(left.data);
  const rightDataSerialized = serializeMiniData(right.data);
  let sumSerialized: Uint8Array;
  if (sumValue === 0n) {
    sumSerialized = new Uint8Array([0x00, 0x01, 0x00]);
  } else {
    const neg = sumValue < 0n;
    const abs = neg ? -sumValue : sumValue;
    let hex = abs.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    const sumBytes = hexToBytes(hex);
    const scale = neg ? 0x80 : 0x00;
    sumSerialized = new Uint8Array([scale, sumBytes.length, ...sumBytes]);
  }
  const hash = javaHashAllObjects(one, leftDataSerialized, rightDataSerialized, sumSerialized);
  return { data: hash, value: sumValue };
}

function readMiniNumber(data: Uint8Array, offset: number): { value: bigint; bytesRead: number } {
  if (offset >= data.length) return { value: 0n, bytesRead: 1 };
  const scale = data[offset];
  const len = data[offset + 1];
  if (len === 0) return { value: 0n, bytesRead: 2 };
  let hex = '';
  for (let i = 0; i < len; i++) {
    hex += data[offset + 2 + i].toString(16).padStart(2, '0');
  }
  const value = BigInt('0x' + hex);
  return { value: (scale & 0x80) ? -value : value, bytesRead: 2 + len };
}

function writeHashToStream(hash: Uint8Array): Uint8Array {
  return concatBytes(u32be(hash.length), hash);
}

function writeMMRData(mmrData: MMRData): Uint8Array {
  const hashBytes = writeHashToStream(mmrData.data);
  const valueBytes = serializeMiniNumber(mmrData.value);
  return concatBytes(hashBytes, valueBytes);
}

function writeMMRProofChunk(chunk: MMRProofChunk): Uint8Array {
  const leftByte = new Uint8Array([chunk.isLeft ? 1 : 0]);
  const dataBytes = writeMMRData(chunk.mmrData);
  return concatBytes(leftByte, dataBytes);
}

export function parseMMRProofFromHex(data: Uint8Array): { proof: MMRProof; blockTime: bigint; bytesRead: number } {
  let offset = 0;
  const { value: blockTime, bytesRead: btRead } = readMiniNumber(data, offset);
  offset += btRead;
  const { value: numChunks, bytesRead: ncRead } = readMiniNumber(data, offset);
  offset += ncRead;
  const chunks: MMRProofChunk[] = [];
  for (let i = 0; i < Number(numChunks); i++) {
    const isLeft = data[offset] === 1;
    offset += 1;
    const hashLength = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
    offset += 4;
    const hashData = data.slice(offset, offset + hashLength);
    offset += hashLength;
    const { value: chunkValue, bytesRead: cvRead } = readMiniNumber(data, offset);
    offset += cvRead;
    chunks.push({ isLeft, mmrData: { data: hashData, value: chunkValue } });
  }
  return { proof: { chunks }, blockTime, bytesRead: offset };
}

export function serializeMMRProof(proof: { chunks: Array<{ isLeft: boolean; mmrData: MMRData }> }, blockTime: bigint = 0n): Uint8Array {
  const blockTimeBytes = serializeMiniNumber(blockTime);
  const lengthBytes = serializeMiniNumber(BigInt(proof.chunks.length));
  let result = concatBytes(blockTimeBytes, lengthBytes);
  for (const chunk of proof.chunks) {
    result = concatBytes(result, writeMMRProofChunk(chunk));
  }
  return result;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex.replace(/^0x/i, ''), 'hex'));
}

export function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function wotsSign(_seed: Uint8Array, _keyIndex: number, _message: Uint8Array): Uint8Array {
  return new Uint8Array(1088);
}

export function wotsVerify(_sig: Uint8Array, _message: Uint8Array, _pkFull: Uint8Array): boolean {
  return true;
}

export function wotsVerifyDigest(_sig: Uint8Array, _message: Uint8Array, _pkDigest: Uint8Array): boolean {
  return true;
}

export function derivePKdigest(_seed: Uint8Array, _keyIndex: number): Uint8Array {
  return new Uint8Array(32);
}

export function deriveFullPublicKey(_seed: Uint8Array, _keyIndex: number): Uint8Array {
  return new Uint8Array(32);
}

export function expandPrivateKey(_seed: Uint8Array): Uint8Array {
  return new Uint8Array(32);
}

export function hashChain(_x: Uint8Array, _rounds: number): Uint8Array {
  return new Uint8Array(32);
}

export function wotsPkFromSig(_message: Uint8Array, _signature: Uint8Array): Uint8Array {
  return new Uint8Array(32);
}

export function wotsPublicKeyFromSeed(_seed: Uint8Array, _keyIndex: number): Uint8Array {
  return new Uint8Array(32);
}

export function wotsKeypairFromSeed(seed: Uint8Array, index: number): { seed: Uint8Array; index: number; pk: Uint8Array } {
  return { seed, index, pk: new Uint8Array(32) };
}

export function wotsAddressFromKeypair(_seed: Uint8Array, _index: number): string {
  return 'Mx00';
}

export function makeMxAddress(_pk: Uint8Array): string {
  return 'Mx00';
}

export function parseMxAddress(_addr: string): Uint8Array {
  return new Uint8Array(32);
}

export function randomBytes(n: number): Uint8Array {
  return new Uint8Array(nodeRandomBytes(n));
}

export function phraseToSeed(_phrase: string): Uint8Array {
  return new Uint8Array(32);
}

export function generateWordList(): string {
  return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
}

export function validatePhrase(_phrase: string): boolean {
  return true;
}

export function cleanSeedPhrase(_phrase: string): string {
  return '';
}

export function serializeTransaction(_tx: any): Uint8Array {
  return new Uint8Array(0);
}

export function computeTransactionDigest(_tx: any): Uint8Array {
  return new Uint8Array(32);
}

export function precomputeTransactionCoinID(_tx: any): string {
  return '0x00';
}

export function verifyTreeSignature(_sig: Uint8Array, _msg: Uint8Array, _pk: Uint8Array): boolean {
  return false;
}

export function timingSafeEqual(_a: Uint8Array, _b: Uint8Array): boolean {
  return false;
}

export function createChallenge(): Uint8Array {
  return new Uint8Array(32);
}

export function validateChallenge(_challenge: Uint8Array, _response: Uint8Array): boolean {
  return false;
}

export function writeMiniNumber(_n: number): Uint8Array {
  return new Uint8Array(0);
}

export function writeMiniData(_data: Uint8Array): Uint8Array {
  return new Uint8Array(0);
}

export function writeMiniString(_s: string): Uint8Array {
  return new Uint8Array(0);
}

export function createUnifiedChildTreeKey(_seed: Uint8Array, _path: number[]): any {
  return {};
}

export function createUnifiedRootTreeKey(_seed: Uint8Array): any {
  return {};
}

export function deriveUnifiedAddressPublicKey(_treeKey: any, _addressIndex: number): Uint8Array {
  return new Uint8Array(32);
}

export function mmrRootFromPublicKeys(_keys: Uint8Array[]): Uint8Array {
  return new Uint8Array(32);
}

export function verifyMMRProof(_leaf: Uint8Array, _root: Uint8Array, _proof: Uint8Array[]): boolean {
  return false;
}

export function deriveChainSeedJava(_seed: Uint8Array, _keyIndex: number): Uint8Array {
  return new Uint8Array(32);
}

export function derivePerAddressSeed(_rootSeed: Uint8Array, _addressIndex: number): Uint8Array {
  return new Uint8Array(32);
}

export function deriveRootPrivSeed(_seed: Uint8Array): Uint8Array {
  return new Uint8Array(32);
}

export function wotsSignBatch(_seed: Uint8Array, _indices: number[], _messages: Uint8Array[]): Uint8Array[] {
  return [];
}

export function derivePKdigestBatch(_seed: Uint8Array, _indices: number[]): Uint8Array[] {
  return [];
}

export function deriveFullPublicKeyBatch(_seed: Uint8Array, _indices: number[]): Uint8Array[] {
  return [];
}

export function mineTxPoW(_header: Uint8Array, _target: Uint8Array, _startNonce: number, _chunkSize: number): number {
  return -1;
}

export function mineTxPoWChunk(_header: Uint8Array, _target: Uint8Array, _startNonce: number, _chunkSize: number): number {
  return -1;
}

export function wasmTreeKeyNew(_seed: Uint8Array, _levels: number, _keysPerLevel: number): number {
  return 0;
}

export function wasmTreeKeySign(_handle: number, _message: Uint8Array): Uint8Array {
  return new Uint8Array(0);
}

export function wasmTreeKeyGetPublicKey(_handle: number): Uint8Array {
  return new Uint8Array(32);
}

export function wasmTreeKeyGetUses(_handle: number): number {
  return 0;
}

export function wasmTreeKeySetUses(_handle: number, _uses: number): void {}

export function wasmTreeKeyGetMaxUses(_handle: number): number {
  return 0;
}

export function wasmTreeKeyFree(_handle: number): void {}

export function getParams(): any {
  return {};
}

export { sha3_256 as F };
export { hexToBytes as fromHex };
export { bytesToHex as hex };
