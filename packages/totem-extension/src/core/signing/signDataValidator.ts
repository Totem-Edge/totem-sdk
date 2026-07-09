import { sha3_256 } from '@noble/hashes/sha3';
import { parseTxInputs } from '../transaction/txParser';
import { mxToHex } from '../utils/minima-base32';

export type SignDataManifestInput = {
  inputIndex: number;
  coinId: string;
  address: string;
  amount: string;
  tokenId: string;
};

export type SignDataManifest = {
  blobHash: string;
  digestTx: string;
  inputs: SignDataManifestInput[];
};

export type SignDataValidationError = { error: string; errorCode: string };

export type SignDataValidationOk = {
  parsedInputs: { coinId: string; address: string }[];
  digestHex: string;
  ownedCount: number;
  walletAddrsHex: string[];
  manifestInputs: SignDataManifestInput[];
};

export type SignDataValidationResult =
  | { ok: false; result: SignDataValidationError }
  | { ok: true; data: SignDataValidationOk };

export function normalizeAddrToHex(addr: string): string {
  if (!addr) return '';
  if (addr.startsWith('Mx') || addr.startsWith('mx')) return mxToHex(addr).toLowerCase();
  return addr.toLowerCase();
}

export function computeManifestBlobHash(digestTx: string, inputs: SignDataManifestInput[]): string {
  const normalizedDigest = digestTx.startsWith('0x') ? digestTx.toLowerCase() : '0x' + digestTx.toLowerCase();
  const canonical = JSON.stringify({
    digestTx: normalizedDigest,
    inputs: [...inputs].sort((a, b) => a.inputIndex - b.inputIndex)
  });
  const hashBytes = sha3_256(new TextEncoder().encode(canonical));
  return Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function validateSignData(
  unsignedHex: unknown,
  signingManifest: unknown,
  walletAddrs: string[]
): SignDataValidationResult {
  // 1. hex format
  if (!unsignedHex || typeof unsignedHex !== 'string') {
    return { ok: false, result: { error: 'unsignedHex is required', errorCode: 'INVALID_HEX' } };
  }
  const hexPattern = unsignedHex.startsWith('0x') ? /^0x[0-9a-fA-F]+$/ : /^[0-9a-fA-F]+$/;
  if (!hexPattern.test(unsignedHex)) {
    return { ok: false, result: { error: 'unsignedHex contains invalid characters', errorCode: 'INVALID_HEX' } };
  }
  const hexStr = unsignedHex.startsWith('0x') ? unsignedHex.slice(2) : unsignedHex;
  if (hexStr.length % 2 !== 0) {
    return { ok: false, result: { error: 'unsignedHex is odd-length', errorCode: 'INVALID_HEX' } };
  }
  const hexBytes = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < hexStr.length; i += 2) hexBytes[i / 2] = parseInt(hexStr.slice(i, i + 2), 16);

  // 2. signingManifest required
  if (!signingManifest || typeof signingManifest !== 'object') {
    return { ok: false, result: { error: 'signingManifest is required', errorCode: 'MISSING_SIGNING_MANIFEST' } };
  }
  const m = signingManifest as Partial<SignDataManifest>;
  if (!m.blobHash || !m.digestTx || !Array.isArray(m.inputs) || m.inputs.length === 0) {
    return { ok: false, result: { error: 'signingManifest requires blobHash, digestTx, and inputs[]', errorCode: 'INVALID_SIGNING_MANIFEST' } };
  }
  if (!/^(0x)?[0-9a-fA-F]{64}$/.test(m.blobHash)) {
    return { ok: false, result: { error: 'signingManifest.blobHash must be a 64-hex-char SHA3-256 digest', errorCode: 'INVALID_SIGNING_MANIFEST' } };
  }

  // 3. parse tx binary
  const parsedInputs = parseTxInputs(hexBytes);
  if (parsedInputs === null) {
    return { ok: false, result: { error: 'unsignedHex could not be parsed as a Minima transaction', errorCode: 'INVALID_HEX' } };
  }

  // 4. digestTx must equal SHA3-256(hexBytes)
  const digestBytes = sha3_256(hexBytes);
  const digestHex = '0x' + Array.from(digestBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const normalizedManifestDigest = m.digestTx.startsWith('0x') ? m.digestTx.toLowerCase() : '0x' + m.digestTx.toLowerCase();
  if (digestHex !== normalizedManifestDigest) {
    return { ok: false, result: { error: 'signingManifest.digestTx does not match SHA3-256 of unsignedHex', errorCode: 'DIGEST_MISMATCH' } };
  }

  // 5. blobHash integrity: SHA3-256(JSON.stringify({digestTx, sorted inputs}))
  const expectedBlobHash = computeManifestBlobHash(m.digestTx, m.inputs);
  const normalizedBlobHash = m.blobHash.startsWith('0x') ? m.blobHash.slice(2).toLowerCase() : m.blobHash.toLowerCase();
  if (expectedBlobHash !== normalizedBlobHash) {
    return { ok: false, result: { error: 'signingManifest.blobHash does not match canonical manifest content', errorCode: 'BLOB_HASH_MISMATCH' } };
  }

  // 6. every manifest input must match the parsed tx at the same index (coinId + address)
  if (parsedInputs.length !== m.inputs.length) {
    return { ok: false, result: { error: `manifest has ${m.inputs.length} inputs but tx has ${parsedInputs.length}`, errorCode: 'MANIFEST_INPUT_MISMATCH' } };
  }
  for (const inp of m.inputs) {
    const idx = inp.inputIndex;
    if (idx < 0 || idx >= parsedInputs.length) {
      return { ok: false, result: { error: `inputIndex ${idx} out of bounds`, errorCode: 'MANIFEST_INPUT_MISMATCH' } };
    }
    if (parsedInputs[idx].coinId.toLowerCase().replace(/^0x/, '') !== inp.coinId.toLowerCase().replace(/^0x/, '')) {
      return { ok: false, result: { error: `inputs[${idx}].coinId mismatch`, errorCode: 'MANIFEST_INPUT_MISMATCH' } };
    }
    if (parsedInputs[idx].address.toLowerCase().replace(/^0x/, '') !== normalizeAddrToHex(inp.address).replace(/^0x/, '')) {
      return { ok: false, result: { error: `inputs[${idx}].address mismatch`, errorCode: 'MANIFEST_INPUT_MISMATCH' } };
    }
  }

  // 7. at least one input is wallet-owned
  const walletAddrsHex = walletAddrs.map(a => normalizeAddrToHex(a));
  const manifestAddrsHex = m.inputs.map(inp => normalizeAddrToHex(inp.address));
  const ownedCount = manifestAddrsHex.filter(a => walletAddrsHex.includes(a)).length;
  if (ownedCount === 0) {
    return { ok: false, result: { error: 'None of the signing inputs belong to this wallet', errorCode: 'INPUT_OWNERSHIP_VIOLATION' } };
  }

  return { ok: true, data: { parsedInputs, digestHex, ownedCount, walletAddrsHex, manifestInputs: m.inputs as SignDataManifestInput[] } };
}
