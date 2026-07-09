/**
 * Transaction Service
 * Handles WOTS signing flow: prepare → sign → finalize
 */

import { getApiBase, getApiBypassBase, getProjectId } from '../api/base';
import { TxSignLogger, TxSendLogger } from './TxLogger';

export interface PrepareRequest {
  to?: string;
  amount?: string;
  tokenId?: string;
  burn?: string;
  txId?: string;
  inputs?: Array<{ coinId: string }>;  // Coins from wallet to spend
  addressIndex?: number | null;  // CRITICAL: HD address index to allocate (must match coin's address)
}

export interface PrepareResponse {
  addressIndex: number;  // Which address (0-63)
  l1: number;            // L1 within per-address TreeKey (0-63)
  l2: number;            // L2 within per-address TreeKey (0-63)
  leaseToken: string;
  digestTx: string;
  digestL2: string | null;
  digestL3: string | null;
  txId: string;
  rootPublicKey: string;
  paramSet: string;
  leaseId: string;
  leaseTTL: number;
}

export interface SignRequest {
  addressIndex: number;  // Which address (0-63)
  l1: number;            // L1 within per-address TreeKey (0-63)
  l2: number;            // L2 within per-address TreeKey (0-63)
  digestTx: string;
}

/**
 * Sign request for per-address TreeKey architecture (2026-02-05)
 * 
 * In this architecture:
 * - addressIndex identifies which per-address TreeKey to use (0-63)
 * - l1, l2 are the signing indices within the per-address TreeKey (64×64 = 4,096 signatures)
 * - digestTx is the transaction digest to sign
 */
export interface SignPerAddressRequest {
  addressIndex: number;  // Which address (0-63)
  l1: number;            // L1 index within per-address TreeKey (0-63)
  l2: number;            // L2 index within per-address TreeKey (0-63)
  digestTx: string;      // Transaction digest (32 bytes hex)
}

/**
 * @deprecated Use HierarchicalWitnessBundle for proper TreeKey signatures
 * Legacy flat witness bundle - bypasses TreeKey hierarchy
 */
export interface WitnessBundle {
  addressIndex: number;  // Which address (0-63)
  l1: number;            // L1 within per-address TreeKey (0-63)
  l2: number;            // L2 within per-address TreeKey (0-63)
  signatures: {
    l1Proof: string[];
    l2Proof: string[];
    l3Proof: string[];
  };
}

/**
 * Hierarchical witness bundle using proper TreeKey signature chain.
 * 
 * Structure matches Minima's Signature.java:
 * - proofs[0]: Root signs L1 child's public key (parent-child signature)
 * - proofs[1]: L1 node signs L2 child's public key (parent-child signature)
 * - proofs[2]: L2 node signs the actual transaction data
 * 
 * Each SignatureProofHex contains:
 * - leafPubkey: 32-byte WOTS public key DIGEST (SHA3-256 of full L×32 key)
 * - signature: 1088-byte WOTS signature (hex) - L×32 = 34×32 bytes
 * - mmrProof: Serialized MMR proof linking leaf to node root (hex)
 * 
 * CRITICAL FIX (January 2026): leafPubkey is the 32-byte DIGEST from 
 * Java's Winternitz.getPublicKey() = SHA3-256(full_1088_byte_key).
 * BouncyCastle's WinternitzOTSignature.getPublicKey() hashes the full key.
 */
export interface SignatureProofHex {
  leafPubkey: string;   // 32-byte WOTS public key DIGEST as hex (SHA3-256 of full L×32 key)
  signature: string;    // 1088-byte WOTS signature as hex (L×32 = 34×32 bytes)
  mmrProof: string;     // Serialized MMR proof as hex
}

/**
 * HierarchicalWitnessBundle for TreeKey signatures
 * 
 * Index mapping (2026-02-11 unified naming):
 * - addressIndex: which HD address (0-63)
 * - l1: L1 index within per-address TreeKey (0-63)
 * - l2: L2 index within per-address TreeKey (0-63)
 * 
 * For per-address signing, proofs array contains 2 SignatureProofs:
 * - proof[0]: Root→L1 (address level to signing node)
 * - proof[1]: L1→DATA (signing node to actual signature)
 */
export interface HierarchicalWitnessBundle {
  addressIndex: number;    // Which address (0-63)
  l1: number;              // L1 index within per-address TreeKey (0-63)
  l2: number;              // L2 index within per-address TreeKey (0-63)
  rootPublicKey: string;   // Per-address TreeKey root (= address public key)
  proofs: SignatureProofHex[];  // 2 proofs for per-address, 3 for legacy 3-level
}

export interface FinalizeRequest {
  leaseToken: string;
  signedHex?: string;        // Deprecated: use signedBase64 for better Cloudflare compatibility
  signedBase64?: string;     // Preferred: base64-encoded transaction (bypasses WAF)
  transactionHex?: string;   // Optional: the unsigned transaction body
  importId?: string;         // Optional: client-provided import ID for txnimport
}

export interface FinalizeResponse {
  ok: boolean;
  leaseId: string;
  txpowid: string;
}

export class TransactionService {
  /**
   * Step 1: Request WOTS lease from Axia API
   */
  static async prepare(params: PrepareRequest, rootPublicKey: string): Promise<PrepareResponse> {
    const startTime = performance.now();
    const base = await getApiBase();
    const projectId = await getProjectId();
    
    const url = `${base.replace(/\/$/, '')}/v1/wots-hardened/prepare`;
    
    const txId = params.txId || `tx-${Date.now()}-${Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(36)).join('').slice(0, 11)}`;
    
    TxSignLogger.info(` 🔒 Requesting lease for transaction...`);
    TxSignLogger.info(`    txId: ${txId}`);
    TxSignLogger.info(`    to: ${params.to}`);
    TxSignLogger.info(`    amount: ${params.amount}`);
    TxSignLogger.info(`    addressIndex: ${params.addressIndex}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': projectId
      },
      body: JSON.stringify({
        txId,
        rootPublicKey,
        to: params.to,
        amount: params.amount,
        tokenId: params.tokenId || '0x00',
        burn: params.burn || null,
        inputs: params.inputs || [],  // Coins from wallet to spend
        paramSet: 'v2-spec',
        addressIndex: params.addressIndex,  // CRITICAL: Request specific address index for lease
        ttlMs: 120000,  // 2 minutes - BouncyCastle WOTS signing can take 30+ seconds
      })
    });

    if (response.status === 429) {
      const body = await response.json().catch(() => ({}));
      TxSignLogger.warn(` ⚠️  Daily WOTS signing limit reached: ${body.error || 'limit exceeded'}`);
      const err: any = new Error(body.error || 'Daily signing limit reached');
      err.code = 429;
      err.limit = body.limit;
      err.used = body.used;
      err.retryAfter = body.retryAfter;
      throw err;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      TxSignLogger.error(` ❌ Lease acquisition failed: ${error.error || response.status}`);
      throw new Error(error.error || `Prepare failed: ${response.status}`);
    }

    const result = await response.json();
    const elapsed = performance.now() - startTime;
    
    TxSignLogger.info(` ✅ Lease acquired successfully (${elapsed.toFixed(0)}ms)`);
    TxSignLogger.info(`    leaseId: ${result.leaseId}`);
    TxSignLogger.info(`    indices: (addressIndex=${result.addressIndex}, l1=${result.l1}, l2=${result.l2})`);
    TxSignLogger.info(`    flat index (for watermark tracking): ${result.addressIndex * 64 * 64 + result.l1 * 64 + result.l2} / 262,144`);
    TxSignLogger.info(`    TTL: ${result.leaseTTL}ms`);
    
    return result;
  }

  /**
   * Sign transaction using per-address TreeKey architecture (2026-02-05)
   * 
   * CRITICAL FIX: Now uses setUses() + sign() to produce 3 proofs matching Java exactly.
   * 
   * In this architecture, each address has its own TreeKey (size=64, depth=3).
   * The (l1, l2) indices are converted to a 'uses' counter: uses = l1 * 64 + l2
   * Then TreeKey.sign() uses baseConversion(uses) to produce 3 proofs:
   * - proofs[0]: Root signs L1 child's public key (Root→L1)
   * - proofs[1]: L1 node signs L2 child's public key (L1→L2)
   * - proofs[2]: L2 node signs the transaction digest (L2→DATA)
   * 
   * This matches Minima TreeKey.sign() exactly for depth=3 TreeKeys.
   * 
   * @param request - Sign request with addressIndex, l1, l2, digestTx
   * @param perAddressTreeKey - The per-address TreeKey for this address
   * @returns Hierarchical witness bundle and signed hex
   */
  static async signWithPerAddressTreeKey(
    request: SignPerAddressRequest,
    perAddressTreeKey: any // TreeKey type from totem-sdk
  ): Promise<{ witnessBundle: HierarchicalWitnessBundle; signedHex: string }> {
    const totalStartTime = performance.now();
    const { addressIndex, l1, l2, digestTx } = request;
    
    TxSignLogger.debug(`PerAddress: Starting PER-ADDRESS TreeKey signing (3-proof chain matching Java)...`);
    TxSignLogger.debug(`PerAddress:    addressIndex: ${addressIndex}, indices: (l1=${l1}, l2=${l2})`);
    
    // ASSERTION: Verify addressIndex is 0-based (0-63) not 1-based (1-64)
    if (addressIndex < 0 || addressIndex >= 64) {
      const errMsg = `CRITICAL: addressIndex ${addressIndex} is out of range (0-63). Possible off-by-one error!`;
      TxSignLogger.error(errMsg);
      throw new Error(errMsg);
    }
    
    // CRITICAL FIX (2026-02-05): Convert (l1, l2) indices to 'uses' counter for Java parity
    // Java's TreeKey.sign() uses baseConversion(uses) to compute path [addressIndex, l1, l2]
    // For depth=3 TreeKey with keysPerLevel=64: uses = l1 * 64 + l2
    // This produces 3 proofs matching Java exactly (Root → L1 → L2 → DATA)
    const KEYS_PER_LEVEL = 64;
    const uses = l1 * KEYS_PER_LEVEL + l2;
    TxSignLogger.info(`PerAddress: Converting indices to uses counter: (l1=${l1}, l2=${l2}) → uses=${uses}`);
    
    // Log the TreeKey's root public key for diagnostic comparison
    const treeKeyPubkey = perAddressTreeKey.getPublicKey();
    const pubkeyHex = Array.from(treeKeyPubkey).map((b: number) => b.toString(16).padStart(2, '0')).join('');
    TxSignLogger.info(`PerAddress ASSERTION CHECK:`);
    TxSignLogger.info(`  addressIndex: ${addressIndex} (should be 0-based, i.e., UI "Address ${addressIndex + 1}")`);
    TxSignLogger.info(`  TreeKey root pubkey: 0x${pubkeyHex.slice(0, 32)}...`);
    
    // Import utilities
    const { fromHex, setWotsLogger, disableWotsLogger } = await import('../../../../totem-sdk/packages/core/src/wots');
    const { serializeMMRProof } = await import('../../../../totem-sdk/packages/core/src/mmr');
    const { serializeTreeSignature, setTreeKeyLogger, disableTreeKeyLogger } = await import('../../../../totem-sdk/packages/core/src/treekey');
    
    let debugMode = false;
    try {
      if (typeof __DESIGNER_MODE__ !== 'undefined' && __DESIGNER_MODE__) {
        debugMode = (globalThis as any).WOTS_DEBUG_MODE === true;
        if (!debugMode && typeof localStorage !== 'undefined') {
          debugMode = localStorage.getItem('WOTS_DEBUG_MODE') === 'true';
        }
      }
    } catch (e) {
    }
    
    TxSignLogger.debug(`signWithPerAddressTreeKey called: addressIndex=${addressIndex}, l1=${l1}, l2=${l2}, debugMode=${debugMode}`);
    
    if (debugMode) {
      const consoleLogger = {
        debug: (msg: string) => console.log(`[WOTS-DEBUG] ${msg}`),
        info: (msg: string) => console.log(`[WOTS-DEBUG] ${msg}`),
        warn: (msg: string) => console.warn(`[WOTS-DEBUG] ${msg}`),
        error: (msg: string) => console.error(`[WOTS-DEBUG] ${msg}`),
      };
      setWotsLogger(consoleLogger as any);
      setTreeKeyLogger(consoleLogger as any);
      console.log('[WOTS-DEBUG] ═══════════════════════════════════════════════════════════');
      console.log('[WOTS-DEBUG] PER-ADDRESS VERBOSE CRYPTOGRAPHIC LOGGING ENABLED');
      console.log('[WOTS-DEBUG] ═══════════════════════════════════════════════════════════');
    }
    
    // Validate digest
    const digestBytes = fromHex(digestTx);
    if (digestBytes.length !== 32) {
      throw new Error(`Invalid digest length: ${digestBytes.length}, expected 32 bytes`);
    }
    
    TxSignLogger.trace(` === TRANSACTION DIGEST (what we're signing) ===`);
    TxSignLogger.trace(` digestTx (hex): ${digestTx}`);
    
    TxSignLogger.debug(`PerAddress: Setting uses=${uses} and calling TreeKey.sign() for 3-proof chain...`);
    const signStart = performance.now();
    
    // CRITICAL FIX (2026-02-05): Use setUses() + sign() to match Java's TreeKey.sign() exactly
    // This produces 3 proofs (Root → L1 → L2 → DATA) instead of 2
    // Java pattern: tk.setUses(uses) → tk.sign(zData) → tk.getUses()
    perAddressTreeKey.setUses(uses);
    const treeSignature = perAddressTreeKey.sign(digestBytes);
    const newUses = perAddressTreeKey.getUses();
    
    const signTime = performance.now() - signStart;
    TxSignLogger.debug(`PerAddress: TreeKey signing complete (${signTime.toFixed(0)}ms)`);
    TxSignLogger.debug(`PerAddress:    proofs generated: ${treeSignature.proofs.length} (should be 3 for Java parity)`);
    TxSignLogger.debug(`PerAddress:    uses counter: ${uses} → ${newUses}`);
    
    // Log serialized signature bytes for debugging
    const serializedSigBytes = serializeTreeSignature(treeSignature);
    TxSignLogger.trace(` === SERIALIZED SIGNATURE (${serializedSigBytes.length} bytes) ===`);
    
    // Build hierarchical witness bundle with unified naming
    const witnessBundle: HierarchicalWitnessBundle = {
      addressIndex,
      l1,
      l2,
      rootPublicKey: `0x${Array.from(perAddressTreeKey.getPublicKey()).map((b: number) => b.toString(16).padStart(2, '0')).join('')}`,
      proofs: treeSignature.proofs.map((proof: any) => ({
        leafPubkey: `0x${Array.from(proof.leafPubkey).map((b: number) => b.toString(16).padStart(2, '0')).join('')}`,
        signature: `0x${Array.from(proof.signature).map((b: number) => b.toString(16).padStart(2, '0')).join('')}`,
        mmrProof: `0x${Array.from(serializeMMRProof(proof.mmrProof)).map((b: number) => b.toString(16).padStart(2, '0')).join('')}`
      }))
    };
    
    // Serialize to hex (for logging/debug - actual serialization done by builder)
    const signedHex = `0x${Array.from(serializedSigBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
    
    const totalTime = performance.now() - totalStartTime;
    TxSignLogger.debug(`PerAddress: Total signing time: ${totalTime.toFixed(0)}ms`);
    
    // Disable debug loggers
    if (debugMode) {
      disableWotsLogger();
      disableTreeKeyLogger();
    }
    
    return { witnessBundle, signedHex };
  }
  
  /**
   * Step 3: Finalize transaction with Axia API
   */
  static async finalize(params: FinalizeRequest): Promise<FinalizeResponse> {
    const startTime = performance.now();
    // Use bypass URL to avoid Cloudflare WAF blocking large transaction payloads
    // The bypass subdomain (api2.axia.to) is DNS-only, routing directly to Render
    const base = await getApiBypassBase();
    const projectId = await getProjectId();
    
    const url = `${base.replace(/\/$/, '')}/v1/wots-hardened/finalize`;
    
    TxSignLogger.info(` 📤 Submitting signed transaction to network...`);
    TxSignLogger.info(`    url: ${url}`);
    TxSignLogger.info(`    leaseToken: ${params.leaseToken.slice(0, 16)}...`);
    TxSignLogger.info(`    format: ${params.signedBase64 ? 'base64' : 'hex'}`);
    TxSignLogger.info(`    size: ${params.signedBase64?.length || params.signedHex?.length || 0} chars`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': projectId
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      // Parse full error response to get Minima's actual error message
      let errorData: { error?: string; details?: string; rpcResponse?: string } = {};
      try {
        errorData = await response.json();
      } catch {
        // If JSON parse fails, try to get raw text
        try {
          const rawText = await response.text();
          TxSignLogger.error(` ❌ Raw error response: ${rawText}`);
          errorData = { error: response.statusText, details: rawText };
        } catch {
          errorData = { error: response.statusText };
        }
      }
      
      // Log ALL error details to help debug txnimport failures
      TxSignLogger.error(` ❌ Finalization failed!`);
      TxSignLogger.error(`    error: ${errorData.error || 'Unknown error'}`);
      TxSignLogger.error(`    details: ${errorData.details || 'No details'}`);
      TxSignLogger.error(`    rpcResponse: ${errorData.rpcResponse || 'No RPC response'}`);
      TxSignLogger.error(`    HTTP status: ${response.status}`);
      
      // Include full error info in the thrown error for debugging
      const fullError = errorData.details || errorData.rpcResponse 
        ? `${errorData.error}: ${errorData.details || errorData.rpcResponse}`
        : errorData.error || `Finalize failed: ${response.status}`;
      throw new Error(fullError);
    }

    const result = await response.json();
    const elapsed = performance.now() - startTime;
    
    TxSignLogger.info(` ✅ Transaction finalized (${elapsed.toFixed(0)}ms)`);
    TxSignLogger.info(`    txpowid: ${result.txpowid}`);
    TxSignLogger.info(`    leaseId: ${result.leaseId}`);
    TxSignLogger.info(` 🔥 WOTS indices now marked as USED (one-time signature consumed)`);
    
    return result;
  }

  /**
   * Fetch CoinProofs for input coins from the server via coinexport RPC
   * 
   * CoinProofs are required in the Witness section for transaction validation.
   * Each CoinProof contains the Coin + MMRProof proving the coin exists in the MMR tree.
   * 
   * @param leaseToken - JWT from /prepare (validates ownership)
   * @param coinIds - Array of coin IDs to fetch proofs for
   * @returns Array of CoinProof hex strings (in order of coinIds)
   */
  static async fetchCoinProofs(leaseToken: string, coinIds: string[]): Promise<string[]> {
    const startTime = performance.now();
    const base = await getApiBase();
    const projectId = await getProjectId();
    
    const url = `${base.replace(/\/$/, '')}/v1/wots-hardened/coinproofs`;
    
    TxSignLogger.info(` 📋 Fetching CoinProofs for ${coinIds.length} input coins...`);
    TxSignLogger.info(`    url: ${url}`);
    TxSignLogger.info(`    coinIds: ${coinIds.map(id => id.slice(0, 18) + '...').join(', ')}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': projectId
      },
      body: JSON.stringify({
        leaseToken,
        coinIds
      })
    });

    if (!response.ok) {
      const cfRay = response.headers.get('cf-ray');
      const origin = cfRay ? `Cloudflare proxy (CF-Ray: ${cfRay})` : 'App origin (no CF-Ray header)';
      TxSignLogger.error(` ❌ CoinProofs HTTP ${response.status} ${response.statusText} — source: ${origin}`);

      // Read body as text first to avoid losing it if it's an HTML error page (e.g. CF 502)
      let bodyText = '';
      try {
        bodyText = await response.text();
      } catch {
        bodyText = '(unreadable)';
      }

      // Try to parse as JSON for structured error details
      let parsed: any = null;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        // Not JSON — probably a Cloudflare HTML page
        TxSignLogger.error(`    raw body (first 500 chars): ${bodyText.slice(0, 500)}`);
      }

      if (parsed) {
        TxSignLogger.error(`    error: ${parsed.error || '(none)'}`);
        TxSignLogger.error(`    hint: ${parsed.hint || '(none)'}`);
        if (Array.isArray(parsed.failures) && parsed.failures.length > 0) {
          TxSignLogger.error(`    per-coin failures (${parsed.failures.length}):`);
          for (const f of parsed.failures) {
            TxSignLogger.error(`      coinId ${(f.coinId || '').slice(0, 18)}... → ${f.error}`);
          }
          // Surface the first failure reason in the thrown error for UI display
          const firstReason = parsed.failures[0]?.error || parsed.error || `HTTP ${response.status}`;
          throw new Error(firstReason);
        }
        throw new Error(parsed.error || `Failed to fetch CoinProofs: ${response.status}`);
      }

      throw new Error(`CoinProofs ${response.status} from ${origin}`);
    }

    const result = await response.json();
    const elapsed = performance.now() - startTime;
    
    if (!result.proofs || !Array.isArray(result.proofs)) {
      throw new Error('Invalid response: proofs array missing');
    }
    
    TxSignLogger.info(` ✅ CoinProofs fetched successfully (${elapsed.toFixed(0)}ms)`);
    TxSignLogger.info(`    count: ${result.proofs.length}`);
    
    // Return proofs in the same order as coinIds
    const proofsHex: string[] = [];
    for (const coinId of coinIds) {
      const proof = result.proofs.find((p: { coinId: string; coinProofHex: string }) => p.coinId === coinId);
      if (!proof || !proof.coinProofHex) {
        throw new Error(`CoinProof not found for coinId: ${coinId}`);
      }
      proofsHex.push(proof.coinProofHex);
    }
    
    return proofsHex;
  }

  /**
   * Step 3b: Submit a locally-mined TxPoW to Axia.
   *
   * Used when the extension mines the TxPoW in-browser (WASM).
   * The backend calls `txpowpost data:<hex>` to relay the pre-mined TxPoW to
   * the Minima network without any re-mining on the node side.
   */
  static async finalizeMined(params: { leaseToken: string; minedHex: string }): Promise<FinalizeResponse> {
    const startTime = performance.now();
    const base = await getApiBypassBase();
    const projectId = await getProjectId();
    const url = `${base.replace(/\/$/, '')}/v1/wots-hardened/finalize-mined`;

    TxSignLogger.info(` 📤 Submitting locally-mined TxPoW to network...`);
    TxSignLogger.info(`    url: ${url}`);
    TxSignLogger.info(`    leaseToken: ${params.leaseToken.slice(0, 16)}...`);
    TxSignLogger.info(`    minedHex length: ${params.minedHex.length} chars`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': projectId },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      let errorData: { error?: string; details?: string } = {};
      try { errorData = await response.json(); } catch { /* ignore */ }
      const msg = errorData.details || errorData.error || `finalize-mined failed: ${response.status}`;
      TxSignLogger.error(` ❌ finalize-mined failed: ${msg}`);
      throw new Error(msg);
    }

    const result = await response.json();
    const elapsed = performance.now() - startTime;
    TxSignLogger.info(` ✅ finalize-mined success (${elapsed.toFixed(0)}ms), txpowid: ${result.txpowid}`);
    return result;
  }

  /**
   * DEBUG: Fetch canonical transaction bytes from Minima node for comparison.
   * 
   * Use this to validate client-side serialization against the node's format.
   * Call GET /v1/wots-hardened/debug/export to get canonical bytes.
   */
  static async fetchCanonicalBytes(): Promise<{ txnExportHex: string; txId: string } | null> {
    try {
      const base = await getApiBase();
      const projectId = await getProjectId();
      
      const url = `${base.replace(/\/$/, '')}/v1/wots-hardened/debug/export`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': projectId
        }
      });

      if (!response.ok) {
        console.error('[DEBUG] Failed to fetch canonical bytes:', response.status);
        return null;
      }

      const result = await response.json();
      return {
        txnExportHex: result.txnExportHex,
        txId: result.txId
      };
    } catch (error) {
      console.error('[DEBUG] Error fetching canonical bytes:', error);
      return null;
    }
  }
}
