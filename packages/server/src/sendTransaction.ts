/**
 * sendTransaction — End-to-end Minima transaction send for @totemsdk/node.
 *
 * Orchestrates: fetch coins → FIFO select → build tx → sign (WOTS via
 * per-address TreeKey) → fetch/cache difficulty → mine (worker_threads,
 * non-blocking) → assemble complete TxPoW bytes → submit to Axia.
 *
 * WOTS ONE-TIME KEY WARNING
 * ─────────────────────────────────────────────────────────────────────────
 * WOTS keys MUST only be used once. Supply unique `signingIndices` for every
 * call. Reusing (l1, l2) for different messages compromises the private key.
 * Use a WatermarkStore from `@totemsdk/core` to track used indices.
 */

import fetch from 'node-fetch';
import {
  phraseToSeed,
  deriveUnifiedAddressPublicKey,
  scriptFromWotsPk,
  scriptToAddress,
  mxToHex,
  createUnifiedChildTreeKey,
  serializeTreeSignature,
  precomputeTransactionCoinIDTx,
  computeTransactionDigest,
  serializeTransaction,
  bytesToHex,
  // Canonical byte primitives from Streamable.ts (dist/index.d.ts re-exports these)
  writeMiniNumber,
  writeMiniData,
  concat,
  hexToBytes,
  type MinimaTransaction,
  type MinimaCoin,
} from '@totemsdk/core';
import {
  fetchTxPowTarget,
  serializeTxBody,
  mineTxPoW,
  type MineResult,
} from '@totemsdk/txpow';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

/** Parameters for `sendTransaction()`. */
export interface SendParams {
  /**
   * 24-word Minima seed phrase.
   * Store securely — never log or expose this value.
   */
  seed: string;

  /**
   * Account index (0–63) — determines which per-address TreeKey is used.
   * Must match the address that owns the coins to be spent.
   */
  addressIndex: number;

  /**
   * Recipient address — Mx-prefix or hex (with or without `0x`).
   */
  toAddress: string;

  /**
   * Amount to send as a decimal string, e.g. `"10"` or `"0.5"`.
   */
  amount: string;

  /**
   * Token ID. Defaults to `"0x00"` (native MIN).
   */
  tokenId?: string;

  /** Axia API base URL, e.g. `"https://api.axia.to"`. */
  axiaBaseUrl: string;

  /** Axia API key (sent as `x-api-key` header). */
  apiKey: string;

  /**
   * WOTS one-time signing indices. Must be unique per transaction.
   * l1 ∈ [0, 63], l2 ∈ [0, 63].
   */
  signingIndices: { l1: number; l2: number };

  /** Optional AbortSignal to cancel mining. */
  signal?: AbortSignal;

  /**
   * Hash iterations per async yield during mining.
   * Default: 10 000. Lower = more responsive; higher = slightly faster.
   */
  chunkSize?: number;
}

/** Result returned by `sendTransaction()` on success. */
export interface SendResult {
  /** Canonical TxPoW ID assigned by the Minima network (hex). */
  txpowId: string;
  /** Always `'submitted'` on success. */
  status: 'submitted';
  /** Mining engine: `'wasm'` when the pre-compiled binary was used. */
  miningSource: MineResult['source'];
  /** Wall-clock mining time in milliseconds (excludes API latency). */
  elapsedMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

interface CoinEntry {
  coinId: string;
  address: string;
  amount: string;
  tokenId: string;
  created: string;
  mmrEntry: string;
  storeState: boolean;
}

interface CoinProofEntry {
  coinId: string;
  coinProofHex: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level difficulty cache
// ─────────────────────────────────────────────────────────────────────────────

interface DifficultyCache {
  value: Uint8Array;
  fetchedAt: number;
}

const _difficultyCache = new Map<string, DifficultyCache>();
const DIFFICULTY_CACHE_TTL_MS = 60_000;

async function getCachedDifficulty(axiaBase: string, signal?: AbortSignal): Promise<Uint8Array> {
  const cached = _difficultyCache.get(axiaBase);
  if (cached && Date.now() - cached.fetchedAt < DIFFICULTY_CACHE_TTL_MS) {
    return cached.value;
  }
  const value = await fetchTxPowTarget(axiaBase);
  _difficultyCache.set(axiaBase, { value, fetchedAt: Date.now() });
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Witness serialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build Witness bytes matching Minima's Witness.writeDataStream().
 *
 * Wire format (Streamable.ts canonical encoding):
 *   writeMiniNumber(1)          — signatureCount = 1
 *   treeSignatureBytes          — from serializeTreeSignature()
 *   writeMiniNumber(N)          — coinProofCount
 *   for each proof: raw bytes   — already serialized by coinexport
 *   writeMiniNumber(1)          — scriptProofCount = 1
 *   writeMiniData(utf8(script)) — MiniString: unlock script
 *   writeMiniNumber(0)          — MMRProof.blockTime = 0
 *   writeMiniNumber(0)          — MMRProof.proofChain length = 0
 */
function buildWitnessBytes(
  sigBytes: Uint8Array,
  coinProofHexes: string[],
  unlockScript: string
): Uint8Array {
  const parts: Uint8Array[] = [];

  // Signatures: one TreeSignature
  parts.push(writeMiniNumber(1n));
  parts.push(sigBytes);

  // CoinProofs: already serialized as Coin+MMRProof by the Minima node's coinexport
  parts.push(writeMiniNumber(BigInt(coinProofHexes.length)));
  for (const hex of coinProofHexes) {
    parts.push(hexToBytes(hex));
  }

  // ScriptProofs: one entry (unlock script for the from-address)
  parts.push(writeMiniNumber(1n));
  // ScriptProof = MiniString(script) + MMRProof(empty)
  // MiniString in Minima is MiniData wrapping UTF-8 bytes
  parts.push(writeMiniData(new TextEncoder().encode(unlockScript)));
  // Empty MMRProof: blockTime=0, proofChain.length=0
  parts.push(writeMiniNumber(0n));
  parts.push(writeMiniNumber(0n));

  return concat(...parts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Axia API helpers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchCoinsFromAxia(
  axiaBase: string,
  address: string,
  apiKey: string,
  tokenId: string,
  signal?: AbortSignal
): Promise<CoinEntry[]> {
  const url = `${axiaBase}/v1/wallet/sdk/coins?address=${encodeURIComponent(address)}`;
  const resp = await fetch(url, {
    headers: { 'x-api-key': apiKey },
    signal: signal as any,
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`fetchCoins HTTP ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { ok: boolean; coins?: CoinEntry[]; error?: string };
  if (!data.ok || !data.coins) {
    throw new Error(`fetchCoins error: ${data.error ?? 'no coins returned'}`);
  }
  const normToken = (tokenId || '0x00').toLowerCase();
  return data.coins.filter(c => (c.tokenId || '0x00').toLowerCase() === normToken);
}

async function fetchProofsFromAxia(
  axiaBase: string,
  coinIds: string[],
  apiKey: string,
  signal?: AbortSignal
): Promise<CoinProofEntry[]> {
  const resp = await fetch(`${axiaBase}/v1/wallet/sdk/proofs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ coinIds }),
    signal: signal as any,
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`fetchProofs HTTP ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { ok: boolean; proofs?: CoinProofEntry[]; error?: string };
  if (!data.ok || !data.proofs) {
    throw new Error(`fetchProofs error: ${data.error ?? 'no proofs returned'}`);
  }
  return data.proofs;
}

async function submitMinedTxPoW(
  axiaBase: string,
  minedHex: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<string> {
  const resp = await fetch(`${axiaBase}/v1/wallet/sdk/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ minedHex }),
    signal: signal as any,
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`submitMined HTTP ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { ok: boolean; txpowId?: string; error?: string };
  if (!data.ok || !data.txpowId) {
    throw new Error(`submitMined error: ${data.error ?? 'no txpowId returned'}`);
  }
  return data.txpowId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixed-point arithmetic (10^8 scale — Minima max 8 decimal places)
// ─────────────────────────────────────────────────────────────────────────────

const _SCALE = 100_000_000n;
function _toScaled(s: string): bigint {
  const [i, f = ''] = s.split('.');
  return BigInt(i || '0') * _SCALE + BigInt(f.padEnd(8, '0').slice(0, 8));
}
function _fromScaled(n: bigint): string {
  if (n === 0n) return '0';
  const frac = (n % _SCALE).toString().padStart(8, '0').replace(/0+$/, '');
  return frac ? `${n / _SCALE}.${frac}` : `${n / _SCALE}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coin selection (FIFO)
// ─────────────────────────────────────────────────────────────────────────────

function selectCoins(coins: CoinEntry[], amountNeeded: bigint): CoinEntry[] {
  const selected: CoinEntry[] = [];
  let total = 0n;
  for (const coin of coins) {
    if (total >= amountNeeded) break;
    selected.push(coin);
    total += _toScaled(coin.amount);
  }
  if (total < amountNeeded) {
    throw new Error(
      `Insufficient balance: need ${_fromScaled(amountNeeded)} but have ${_fromScaled(total)} across ${coins.length} coins`
    );
  }
  return selected;
}

// ─────────────────────────────────────────────────────────────────────────────
// Address normalisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a Minima address (Mx-prefix or hex) to raw bytes.
 * scriptToAddress() returns Mx format, so this is also used to convert
 * the sender's own from-address to bytes for coin construction.
 */
function addressToBytes(addr: string): Uint8Array {
  if (addr.toUpperCase().startsWith('MX')) {
    return hexToBytes(mxToHex(addr));
  }
  return hexToBytes(addr);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a Minima transaction end-to-end.
 *
 * Fetches spendable coins for the sender address, builds and signs a
 * transaction using a per-address WOTS TreeKey, mines TxPoW in a
 * `worker_threads` Worker (non-blocking), then submits the mined TxPoW to
 * Axia for broadcast on the Minima network.
 *
 * The difficulty target is cached per `axiaBaseUrl` for 60 seconds to avoid
 * redundant network round-trips in high-throughput scenarios.
 *
 * @example
 * ```ts
 * import { sendTransaction } from '@totemsdk/node';
 *
 * const result = await sendTransaction({
 *   seed: 'word1 word2 ... word24',
 *   addressIndex: 0,
 *   toAddress: 'MxABC...',
 *   amount: '10',
 *   axiaBaseUrl: 'https://api.axia.to',
 *   apiKey: 'ak_live_...',
 *   signingIndices: { l1: 0, l2: 0 },
 * });
 * console.log('TxPoW ID:', result.txpowId);
 * console.log(`Mined in ${result.elapsedMs}ms via ${result.miningSource}`);
 * ```
 *
 * @throws If there are insufficient coins, signing fails, mining is aborted,
 *   or the Axia API returns an error.
 */
export async function sendTransaction(params: SendParams): Promise<SendResult> {
  const {
    seed,
    addressIndex,
    toAddress,
    amount,
    tokenId = '0x00',
    axiaBaseUrl,
    apiKey,
    signingIndices,
    signal,
    chunkSize,
  } = params;

  const axiaBase = axiaBaseUrl.replace(/\/$/, '');
  let amountScaled: bigint;
  try { amountScaled = _toScaled(amount); } catch { amountScaled = 0n; }
  if (amountScaled <= 0n) {
    throw new Error(`Invalid amount: "${amount}" — must be a positive decimal number`);
  }
  const { l1, l2 } = signingIndices;
  if (l1 < 0 || l1 > 63 || l2 < 0 || l2 > 63) {
    throw new Error(`signingIndices (l1=${l1}, l2=${l2}) must each be in [0, 63]`);
  }

  // ── 1. Derive sender identity from seed ──────────────────────────────────
  const baseSeed = phraseToSeed(seed);
  const addrPubkeyBytes = deriveUnifiedAddressPublicKey(baseSeed, addressIndex);
  const addrPubkeyHex = bytesToHex(addrPubkeyBytes).toUpperCase();

  // fromScript → Mx address (used for the API call) + raw bytes (used in coins)
  const fromScript = scriptFromWotsPk(addrPubkeyBytes);
  const fromAddressMx = scriptToAddress(fromScript);          // Mx-format
  const fromAddrBytes = hexToBytes(mxToHex(fromAddressMx));  // canonical bytes

  // Unlock script for the witness ScriptProof
  const unlockScript = `RETURN SIGNEDBY(0x${addrPubkeyHex})`;

  // ── 2. Normalise recipient address to raw bytes ──────────────────────────
  const toAddrBytes = addressToBytes(toAddress);

  // ── 3. Fetch spendable coins ─────────────────────────────────────────────
  const coins = await fetchCoinsFromAxia(axiaBase, fromAddressMx, apiKey, tokenId, signal);
  if (coins.length === 0) {
    throw new Error(`No spendable ${tokenId} coins found at ${fromAddressMx}`);
  }

  // ── 4. FIFO coin selection ────────────────────────────────────────────────
  const selected = selectCoins(coins, amountScaled);
  const totalInputScaled = selected.reduce((s, c) => s + _toScaled(c.amount), 0n);
  const changeScaled = totalInputScaled - amountScaled;

  // ── 5. Fetch CoinProofs for witness ──────────────────────────────────────
  const coinIds = selected.map(c => c.coinId);
  const proofEntries = await fetchProofsFromAxia(axiaBase, coinIds, apiKey, signal);
  const proofMap = new Map(proofEntries.map(p => [p.coinId, p.coinProofHex]));
  const coinProofHexes = selected.map(c => {
    const hex = proofMap.get(c.coinId);
    if (!hex) throw new Error(`Missing CoinProof for coin ${c.coinId}`);
    return hex;
  });

  // ── 6. Build MinimaTransaction ───────────────────────────────────────────
  const tokenIdBytes = hexToBytes(tokenId);

  const inputs: MinimaCoin[] = selected.map(c => ({
    coinId: hexToBytes(c.coinId),
    address: fromAddrBytes,
    amount: c.amount,
    tokenId: tokenIdBytes,
    token: null,
    storeState: c.storeState ?? false,
    state: [],
    mmrEntryNumber: BigInt(c.mmrEntry || '0'),
    spent: false,
    created: BigInt(c.created || '0'),
  }));

  const outputs: MinimaCoin[] = [
    {
      coinId: new Uint8Array([0x00]),
      address: toAddrBytes,
      amount,
      tokenId: tokenIdBytes,
      token: null,
      storeState: false,
      state: [],
      mmrEntryNumber: 0n,
      spent: false,
      created: 0n,
    },
  ];

  if (changeScaled > 0n) {
    outputs.push({
      coinId: new Uint8Array([0x00]),
      address: fromAddrBytes,
      amount: _fromScaled(changeScaled),
      tokenId: tokenIdBytes,
      token: null,
      storeState: false,
      state: [],
      mmrEntryNumber: 0n,
      spent: false,
      created: 0n,
    });
  }

  const tx: MinimaTransaction = {
    linkHash: new Uint8Array([0x00]),
    inputs,
    outputs,
    state: [],
  };

  // ── 7. Precompute output coin IDs, compute digest, sign ──────────────────
  precomputeTransactionCoinIDTx(tx);
  const digest = computeTransactionDigest(tx);

  const treeKey = createUnifiedChildTreeKey(baseSeed, addressIndex);
  treeKey.setUses(l1 * 64 + l2);
  const treeSignature = treeKey.sign(digest);
  const sigBytes = serializeTreeSignature(treeSignature);

  // ── 8. Serialise transaction and build witness ────────────────────────────
  const txBytes = serializeTransaction(tx);
  const witnessBytes = buildWitnessBytes(sigBytes, coinProofHexes, unlockScript);

  // ── 9. Fetch cached difficulty and build TxBody ───────────────────────────
  const txnDifficulty = await getCachedDifficulty(axiaBase, signal);
  const txBodyBytes = serializeTxBody(txBytes, witnessBytes, { txnDifficulty });

  // ── 10. Mine TxPoW (worker_threads — event loop never blocked) ───────────
  const mineResult = await mineTxPoW(txBodyBytes, txnDifficulty, { signal, chunkSize });

  // ── 11. Assemble full TxPoW: minedHeader + 0x01 (has-body) + txBody ──────
  const txpowBytes = concat(
    mineResult.minedHeaderBytes,
    new Uint8Array([0x01]),
    txBodyBytes
  );
  const minedHex = bytesToHex(txpowBytes);

  // ── 12. Submit to Axia for broadcast ─────────────────────────────────────
  const txpowId = await submitMinedTxPoW(axiaBase, minedHex, apiKey, signal);

  return {
    txpowId,
    status: 'submitted',
    miningSource: mineResult.source,
    elapsedMs: mineResult.elapsedMs,
  };
}
