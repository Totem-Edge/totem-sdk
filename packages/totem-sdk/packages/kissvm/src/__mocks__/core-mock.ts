import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto';

export function sha3_256(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha3-256').update(data).digest());
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
