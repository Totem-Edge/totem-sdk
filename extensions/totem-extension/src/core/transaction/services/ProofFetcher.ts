/**
 * Proof Fetcher Service
 * 
 * Handles fetching real MMR proofs from MegaMMR and SmartRouter.
 * This enables building valid witnesses for transaction inputs.
 * 
 * Proof types:
 * - CoinProof: Proves a coin exists in the MMR tree (for inputs)
 * - ScriptProof: MMRProof for MAST branch execution
 */

import type { MMRProof, MMRProofChunk } from '../types/ScriptTypes';

export interface CoinProofResult {
  coinId: string;
  proof: string;
  mmrEntryNumber: bigint;
  blockTime: bigint;
}

export interface ProofFetcherConfig {
  apiBaseUrl: string;
  timeout?: number;
}

/**
 * ProofFetcher handles retrieval of CoinProofs and MMRProofs from the network.
 */
export class ProofFetcher {
  private config: ProofFetcherConfig;
  private proofCache: Map<string, CoinProofResult> = new Map();
  
  constructor(config: ProofFetcherConfig) {
    this.config = {
      timeout: 30000,
      ...config
    };
  }
  
  /**
   * Fetch CoinProofs for transaction inputs.
   * 
   * CoinProofs are obtained via the coinexport RPC command through
   * our backend API. They prove each input coin exists in the MMR.
   */
  async fetchCoinProofs(coinIds: string[]): Promise<Map<string, CoinProofResult>> {
    const results = new Map<string, CoinProofResult>();
    const uncached: string[] = [];
    
    for (const coinId of coinIds) {
      const cached = this.proofCache.get(coinId.toLowerCase());
      if (cached) {
        results.set(coinId.toLowerCase(), cached);
      } else {
        uncached.push(coinId);
      }
    }
    
    if (uncached.length === 0) {
      return results;
    }
    
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/v1/wots/coinproofs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ coinIds: uncached }),
        signal: AbortSignal.timeout(this.config.timeout!)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch coin proofs: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.proofs) {
        for (const proof of data.proofs) {
          const result: CoinProofResult = {
            coinId: proof.coinId,
            proof: proof.proof,
            mmrEntryNumber: BigInt(proof.mmrEntryNumber || 0),
            blockTime: BigInt(proof.blockTime || 0)
          };
          
          const normalizedId = proof.coinId.toLowerCase();
          results.set(normalizedId, result);
          this.proofCache.set(normalizedId, result);
        }
      }
      
      return results;
    } catch (err) {
      console.error('[ProofFetcher] Failed to fetch coin proofs:', err);
      throw err;
    }
  }
  
  /**
   * Fetch a single CoinProof.
   */
  async fetchCoinProof(coinId: string): Promise<CoinProofResult | null> {
    const results = await this.fetchCoinProofs([coinId]);
    return results.get(coinId.toLowerCase()) || null;
  }
  
  /**
   * Create an MMR tree from scripts (for MAST).
   * 
   * Uses the mmrcreate RPC command to build a merkle tree of scripts
   * and get proofs for each branch.
   */
  async createMMRTree(scripts: string[]): Promise<{
    root: string;
    proofs: Map<string, MMRProof>;
  }> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/v1/wots/mmrcreate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ scripts }),
        signal: AbortSignal.timeout(this.config.timeout!)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create MMR tree: ${response.status}`);
      }
      
      const data = await response.json();
      
      const proofs = new Map<string, MMRProof>();
      if (data.proofs) {
        for (const [script, proofData] of Object.entries(data.proofs)) {
          proofs.set(script, parseMMRProofFromData(proofData as any));
        }
      }
      
      return {
        root: data.root,
        proofs
      };
    } catch (err) {
      console.error('[ProofFetcher] Failed to create MMR tree:', err);
      throw err;
    }
  }
  
  /**
   * Verify an MMR proof locally.
   */
  async verifyMMRProof(
    data: string,
    proof: MMRProof,
    expectedRoot: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/v1/wots/mmrproof`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data,
          proof: serializeMMRProofToData(proof),
          root: expectedRoot
        }),
        signal: AbortSignal.timeout(this.config.timeout!)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to verify MMR proof: ${response.status}`);
      }
      
      const result = await response.json();
      return result.valid === true;
    } catch (err) {
      console.error('[ProofFetcher] Failed to verify MMR proof:', err);
      return false;
    }
  }
  
  /**
   * Get current block number for timelock validation.
   */
  async getCurrentBlock(): Promise<bigint> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/v1/status/block`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(this.config.timeout!)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get current block: ${response.status}`);
      }
      
      const data = await response.json();
      return BigInt(data.block || 0);
    } catch (err) {
      console.error('[ProofFetcher] Failed to get current block:', err);
      throw err;
    }
  }
  
  /**
   * Clear the proof cache.
   */
  clearCache(): void {
    this.proofCache.clear();
  }
  
  /**
   * Get cache size.
   */
  get cacheSize(): number {
    return this.proofCache.size;
  }
}

function parseMMRProofFromData(data: {
  blockTime?: string | number;
  proofChain?: Array<{ isLeft: boolean; data: string }>;
  chunks?: Array<{ isLeft: boolean; mmrData?: { data: string; value?: string | number } }>;
}): MMRProof {
  // Support both old (proofChain) and new (chunks) formats
  if (data.chunks) {
    return {
      chunks: data.chunks.map(chunk => ({
        isLeft: chunk.isLeft,
        mmrData: {
          data: hexToBytes(chunk.mmrData?.data || '0x'),
          value: BigInt(chunk.mmrData?.value || 0)
        }
      }))
    };
  }
  // Legacy format conversion
  return {
    chunks: (data.proofChain || []).map(chunk => ({
      isLeft: chunk.isLeft,
      mmrData: {
        data: hexToBytes(chunk.data),
        value: 0n
      }
    }))
  };
}

function serializeMMRProofToData(proof: MMRProof): {
  chunks: Array<{ isLeft: boolean; mmrData: { data: string; value: string } }>;
} {
  return {
    chunks: proof.chunks.map(chunk => ({
      isLeft: chunk.isLeft,
      mmrData: {
        data: bytesToHex(chunk.mmrData.data),
        value: chunk.mmrData.value.toString()
      }
    }))
  };
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

let fetcherInstance: ProofFetcher | null = null;

export function getProofFetcher(config?: ProofFetcherConfig): ProofFetcher {
  if (!fetcherInstance && config) {
    fetcherInstance = new ProofFetcher(config);
  }
  if (!fetcherInstance) {
    throw new Error('ProofFetcher not initialized. Call with config first.');
  }
  return fetcherInstance;
}

export function initProofFetcher(config: ProofFetcherConfig): ProofFetcher {
  fetcherInstance = new ProofFetcher(config);
  return fetcherInstance;
}
