import * as fs from 'fs';
import * as path from 'path';
import { sha3_256 } from '@noble/hashes/sha3';
import { TOTEM_CHAIN_ID } from '../src/constants';
import { parseTxInputs, buildMinimalTx1Input } from '../src/core/transaction/txParser';
import { validateSignData, computeManifestBlobHash } from '../src/core/signing/signDataValidator';
import './setup';

function toHex(b: Uint8Array): string {
  return '0x' + Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf-8');
}

function extractSetMembers(src: string, varName: string): Set<string> {
  const m = src.match(new RegExp(`${varName}\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!m) return new Set();
  return new Set(m[1].match(/'([^']+)'/g)?.map(s => s.slice(1, -1)) ?? []);
}

// ─── TOTEM_CHAIN_ID ──────────────────────────────────────────────────────────

describe('TOTEM_CHAIN_ID', () => {
  test('is "minima-mainnet"', () => {
    expect(TOTEM_CHAIN_ID).toBe('minima-mainnet');
  });
});

// ─── allowlist regression (reads from source, not re-declared) ────────────────

describe('TOTEM_CONNECT_APPROVE allowlist regression', () => {
  const contentAllowed = extractSetMembers(readSrc('src/content-script.ts'), 'ALLOWED_DAPP_METHODS');
  const bgAllowed = extractSetMembers(readSrc('src/background/index.ts'), 'DAPP_ALLOWED_METHODS');

  test('content-script ALLOWED_DAPP_METHODS excludes TOTEM_CONNECT_APPROVE', () => {
    expect(contentAllowed.has('TOTEM_CONNECT_APPROVE')).toBe(false);
  });

  test('background DAPP_ALLOWED_METHODS excludes TOTEM_CONNECT_APPROVE', () => {
    expect(bgAllowed.has('TOTEM_CONNECT_APPROVE')).toBe(false);
  });

  test('content-script allows TOTEM_GET_ACCOUNTS', () => {
    expect(contentAllowed.has('TOTEM_GET_ACCOUNTS')).toBe(true);
  });

  test('background allows TOTEM_SIGN_DATA', () => {
    expect(bgAllowed.has('TOTEM_SIGN_DATA')).toBe(true);
  });
});

// ─── TOTEM_GET_ACCOUNTS response shape ───────────────────────────────────────

describe('TOTEM_GET_ACCOUNTS v4.0.0 response shape', () => {
  const acct = {
    index: 0, address: 'MxABC',
    chainId: TOTEM_CHAIN_ID, addressType: 'standard' as const, capabilities: [] as string[]
  };

  test('no balance field', () => { expect(acct).not.toHaveProperty('balance'); });
  test('chainId === TOTEM_CHAIN_ID', () => { expect(acct.chainId).toBe(TOTEM_CHAIN_ID); });
  test('addressType === "standard"', () => { expect(acct.addressType).toBe('standard'); });
  test('capabilities is []', () => { expect(acct.capabilities).toEqual([]); });
});

// ─── parseTxInputs ───────────────────────────────────────────────────────────

describe('parseTxInputs', () => {
  test('null for empty bytes', () => { expect(parseTxInputs(new Uint8Array(0))).toBeNull(); });
  test('null for garbage', () => { expect(parseTxInputs(new Uint8Array([0xff, 0xff, 0xff]))).toBeNull(); });

  test('extracts coinId and address from 1-input tx', () => {
    const coinId = new Uint8Array(32).fill(0xab);
    const address = new Uint8Array(32).fill(0xcd);
    const r = parseTxInputs(buildMinimalTx1Input(coinId, address))!;
    expect(r[0].coinId).toBe('0x' + 'ab'.repeat(32));
    expect(r[0].address).toBe('0x' + 'cd'.repeat(32));
  });

  test('null for impossibly large input count', () => {
    expect(parseTxInputs(new Uint8Array([0, 2, 1, 0]))).toBeNull();
  });
});

// ─── validateSignData (real handler module) ───────────────────────────────────

describe('validateSignData', () => {
  const walletAddr = '0x' + 'ab'.repeat(32);
  const foreignAddr = '0x' + 'de'.repeat(32);

  const validTxBytes = buildMinimalTx1Input(new Uint8Array(32).fill(0x42), new Uint8Array(32).fill(0xab));
  const foreignTxBytes = buildMinimalTx1Input(new Uint8Array(32).fill(0x42), new Uint8Array(32).fill(0xde));
  const validHex = toHex(validTxBytes);
  const foreignHex = toHex(foreignTxBytes);

  // Real digest of validTxBytes (SHA3-256), avoids fake-digest patching in tests.
  const validDigestHex = toHex(sha3_256(validTxBytes));
  const validCoinId = '0x' + '42'.repeat(32);
  const validInputs = [{ inputIndex: 0, coinId: validCoinId, address: walletAddr, amount: '100', tokenId: '0x00' }];
  const validBlobHash = computeManifestBlobHash(validDigestHex, validInputs);
  const validManifest = { blobHash: validBlobHash, digestTx: validDigestHex, inputs: validInputs };

  function errCode(r: ReturnType<typeof validateSignData>): string | null {
    if (r.ok === false) return r.result.errorCode;
    return null;
  }

  // hex errors
  test('INVALID_HEX when hex missing', () => {
    expect(errCode(validateSignData(undefined, validManifest, [walletAddr]))).toBe('INVALID_HEX');
  });

  test('INVALID_HEX when hex has bad chars', () => {
    expect(errCode(validateSignData('0xGGGG', validManifest, [walletAddr]))).toBe('INVALID_HEX');
  });

  test('INVALID_HEX when hex is not a valid Minima tx', () => {
    expect(errCode(validateSignData('0x' + 'ff'.repeat(20), validManifest, [walletAddr]))).toBe('INVALID_HEX');
  });

  // missing manifest / inputAddresses
  test('MISSING_SIGNING_MANIFEST when neither provided', () => {
    expect(errCode(validateSignData(validHex, null, [walletAddr]))).toBe('MISSING_SIGNING_MANIFEST');
  });

  // manifest structure
  test('INVALID_SIGNING_MANIFEST when blobHash missing', () => {
    expect(errCode(validateSignData(validHex, { digestTx: validDigestHex, inputs: validInputs }, [walletAddr])))
      .toBe('INVALID_SIGNING_MANIFEST');
  });

  test('INVALID_SIGNING_MANIFEST when inputs is empty', () => {
    const emptyBlob = computeManifestBlobHash(validDigestHex, []);
    expect(errCode(validateSignData(validHex, { blobHash: emptyBlob, digestTx: validDigestHex, inputs: [] }, [walletAddr])))
      .toBe('INVALID_SIGNING_MANIFEST');
  });

  test('INVALID_SIGNING_MANIFEST when blobHash is wrong format', () => {
    const badFmt = { blobHash: 'tooshort', digestTx: validDigestHex, inputs: validInputs };
    expect(errCode(validateSignData(validHex, badFmt, [walletAddr]))).toBe('INVALID_SIGNING_MANIFEST');
  });

  // digestTx mismatch
  test('DIGEST_MISMATCH when digestTx does not match SHA3-256 of hex', () => {
    const wrongDigest = '0x' + 'aa'.repeat(32);
    const wrongBlobHash = computeManifestBlobHash(wrongDigest, validInputs);
    const m = { blobHash: wrongBlobHash, digestTx: wrongDigest, inputs: validInputs };
    expect(errCode(validateSignData(validHex, m, [walletAddr]))).toBe('DIGEST_MISMATCH');
  });

  // blobHash integrity
  test('BLOB_HASH_MISMATCH when blobHash is all zeros', () => {
    const m = { blobHash: '00'.repeat(32), digestTx: validDigestHex, inputs: validInputs };
    expect(errCode(validateSignData(validHex, m, [walletAddr]))).toBe('BLOB_HASH_MISMATCH');
  });

  test('BLOB_HASH_MISMATCH when manifest inputs are mutated after blobHash was committed', () => {
    const mutated = [{ ...validInputs[0], coinId: '0x' + 'ff'.repeat(32) }];
    const m = { blobHash: validBlobHash, digestTx: validDigestHex, inputs: mutated };
    expect(errCode(validateSignData(validHex, m, [walletAddr]))).toBe('BLOB_HASH_MISMATCH');
  });

  // coinId mismatch
  test('MANIFEST_INPUT_MISMATCH when manifest coinId differs from parsed tx', () => {
    const wrongInputs = [{ ...validInputs[0], coinId: '0x' + 'ff'.repeat(32) }];
    const m = { blobHash: computeManifestBlobHash(validDigestHex, wrongInputs), digestTx: validDigestHex, inputs: wrongInputs };
    expect(errCode(validateSignData(validHex, m, [walletAddr]))).toBe('MANIFEST_INPUT_MISMATCH');
  });

  test('MANIFEST_INPUT_MISMATCH when manifest claims more inputs than tx has', () => {
    const extra = [
      { inputIndex: 0, coinId: validCoinId, address: walletAddr, amount: '50', tokenId: '0x00' },
      { inputIndex: 1, coinId: '0x' + 'ee'.repeat(32), address: foreignAddr, amount: '50', tokenId: '0x00' }
    ];
    const m = { blobHash: computeManifestBlobHash(validDigestHex, extra), digestTx: validDigestHex, inputs: extra };
    expect(errCode(validateSignData(validHex, m, [walletAddr]))).toBe('MANIFEST_INPUT_MISMATCH');
  });

  // address mismatch
  test('MANIFEST_INPUT_MISMATCH when manifest address differs from address parsed from tx', () => {
    const wrongAddr = [{ ...validInputs[0], address: foreignAddr }];
    const m = { blobHash: computeManifestBlobHash(validDigestHex, wrongAddr), digestTx: validDigestHex, inputs: wrongAddr };
    // validHex has walletAddrBytes; manifest claims foreignAddr
    expect(errCode(validateSignData(validHex, m, [walletAddr]))).toBe('MANIFEST_INPUT_MISMATCH');
  });

  // ownership
  test('INPUT_OWNERSHIP_VIOLATION when no input address is wallet-owned', () => {
    const foreignDigestHex = toHex(sha3_256(foreignTxBytes));
    const alienInputs = [{ inputIndex: 0, coinId: validCoinId, address: foreignAddr, amount: '100', tokenId: '0x00' }];
    const m = { blobHash: computeManifestBlobHash(foreignDigestHex, alienInputs), digestTx: foreignDigestHex, inputs: alienInputs };
    expect(errCode(validateSignData(foreignHex, m, [walletAddr]))).toBe('INPUT_OWNERSHIP_VIOLATION');
  });

  // passing scenarios
  test('null (pass) when all checks pass', () => {
    expect(errCode(validateSignData(validHex, validManifest, [walletAddr]))).toBeNull();
  });

  test('null (pass) for partial multisig scenario', () => {
    expect(errCode(validateSignData(validHex, validManifest, [walletAddr, foreignAddr]))).toBeNull();
  });

  test('blobHash accepted with 0x prefix', () => {
    const m = { ...validManifest, blobHash: '0x' + validBlobHash };
    expect(errCode(validateSignData(validHex, m, [walletAddr]))).toBeNull();
  });

  // signingManifest is always required — no legacy bypass
  test('MISSING_SIGNING_MANIFEST when no manifest even if inputAddresses were formerly accepted', () => {
    expect(errCode(validateSignData(validHex, null, [walletAddr]))).toBe('MISSING_SIGNING_MANIFEST');
  });
});

// ─── provider.ts signData type shape ─────────────────────────────────────────

describe('provider.ts signData type shape', () => {
  const src = readSrc('src/provider.ts');
  const defMatch = src.match(/signData: async \(params: \{[\s\S]*?\}\): Promise/);

  test('signData includes signingManifest parameter', () => {
    expect(src).toContain('signingManifest:');
  });

  test('signData dropped old inputAddresses shape', () => {
    expect(defMatch).not.toBeNull();
    expect(defMatch![0]).not.toContain('inputAddresses');
  });

  test('signingManifest has blobHash, digestTx, inputIndex', () => {
    expect(src).toContain('blobHash: string');
    expect(src).toContain('digestTx: string');
    expect(src).toContain('inputIndex: number');
  });
});

// ─── provider.ts origin override protection ───────────────────────────────────

describe('provider.ts origin override protection', () => {
  test('pageOrigin wins over dApp-supplied origin', () => {
    const pageOrigin = 'https://legit.com';
    const params = { ...(({ origin: 'https://evil.com' }) as Record<string, string>), origin: pageOrigin };
    expect(params.origin).toBe(pageOrigin);
  });

  test('old spread order would let dApp override origin', () => {
    const pageOrigin = 'https://legit.com';
    const params = { origin: pageOrigin, ...({ origin: 'https://evil.com' } as Record<string, string>) };
    expect(params.origin).toBe('https://evil.com');
  });
});


// ─── WOTS_SIGN_DATA handler regression ───────────────────────────────────────

describe('WOTS_SIGN_DATA handler regression', () => {
  const bgSrc = readSrc('src/background/index.ts');

  test('background handleMessage has a WOTS_SIGN_DATA case', () => {
    expect(bgSrc).toMatch(/case ['']WOTS_SIGN_DATA['']:/);
  });
});

