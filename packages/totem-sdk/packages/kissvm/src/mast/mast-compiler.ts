/**
 * Canonical MAST compiler — produces Minima-compatible MMR roots,
 * script addresses, and ScriptProofs using the core package's
 * byte-exact MMR primitives.
 *
 * Algorithm (matching Minima Address.java + MMRSet.java):
 *   1. Use the EXACT script text (no normalization — Minima commits to
 *      the script as-is via MiniString encoding)
 *   2. Compute MMR leaf: sha3(MiniNumber.ZERO || MiniString(script) || MiniNumber.ZERO)
 *   3. Build MMR tree from all script leaves using canonical parent construction
 *   4. Compute Mx address from root via Base32 encoding
 *   5. Generate MMR proofs for each leaf including peak-bagging steps
 *
 * Peak bagging uses iterative adjacent-pairing (matching Minima Java's
 * MMRSet.getMMRRoot) rather than right-to-left chaining.
 *
 * This implementation handles arbitrary leaf counts (not just powers of 2).
 */

import {
  mmrLeafExact,
  createMMRDataParentNode,
  createMMRDataLeafNode,
  calculateProofRoot,
  parseMMRProofFromHex,
  serializeMMRProof,
  type MMRData,
  type MMRProof,
  type MMRProofChunk,
  type Bytes,
} from '@totemsdk/core';
import { scriptToAddress, makeMxAddress } from '@totemsdk/core';
import { bytesToHex, hexToBytes } from '@totemsdk/core';

export interface MinimaScriptProof {
  script: string;
  proofHex: string;
  address: string;
}

export interface CompiledMast {
  rootAddress: string;
  rootHex: string;
  scripts: MinimaScriptProof[];
  leafCount: number;
}

export interface PolicyGraphNode {
  id: string;
  name: string;
  scripts: string[];
  parentId?: string;
}

export interface PolicyDelegationEdge {
  from: string;
  to: string;
  constraints?: Record<string, unknown>;
}

export interface PolicyGraph {
  nodes: PolicyGraphNode[];
  edges: PolicyDelegationEdge[];
}

export interface CompiledPolicyNode {
  logicalNodeId: string;
  mast: CompiledMast;
}

export interface CompiledRecursivePolicy {
  graph: PolicyGraph;
  compiledNodes: Map<string, CompiledPolicyNode>;
  anchorRoot: string;
  anchorAddress: string;
}

interface MMRPeak {
  row: number;
  entryNumber: bigint;
  mmrData: MMRData;
}

class ScriptMMR {
  private entries = new Map<string, { row: number; entryNumber: bigint; mmrData: MMRData }>();
  private leafCount = 0;
  private maxRow = 0;
  private baggedPeaks: MMRData[] = [];

  private key(row: number, entry: bigint): string {
    return `${row}:${entry}`;
  }

  addLeaf(leafData: MMRData): void {
    const entryNumber = BigInt(this.leafCount);
    this.entries.set(this.key(0, entryNumber), { row: 0, entryNumber, mmrData: leafData });
    this.leafCount++;

    let currentRow = 0;
    let currentEntry = entryNumber;
    let currentData = leafData;

    while (currentEntry % 2n === 1n) {
      const siblingEntry = currentEntry - 1n;
      const sibling = this.entries.get(this.key(currentRow, siblingEntry));
      if (!sibling) break;

      const parentData = createMMRDataParentNode(sibling.mmrData, currentData);
      const parentRow = currentRow + 1;
      const parentEntry = currentEntry / 2n;

      this.entries.set(this.key(parentRow, parentEntry), {
        row: parentRow,
        entryNumber: parentEntry,
        mmrData: parentData,
      });

      if (parentRow > this.maxRow) this.maxRow = parentRow;

      currentRow = parentRow;
      currentEntry = parentEntry;
      currentData = parentData;
    }

    this.recomputeBaggedPeaks();
  }

  private recomputeBaggedPeaks(): void {
    const peaks = this.getPeaks();
    this.baggedPeaks = [];

    if (peaks.length === 0) return;

    // Iteratively pair adjacent peaks (matches Minima Java's MMRSet.getMMRRoot())
    let currentPeaks = peaks.map(e => e.mmrData);
    while (currentPeaks.length > 1) {
      const nextPeaks: MMRData[] = [];
      for (let i = 0; i < currentPeaks.length; i += 2) {
        if (i + 1 < currentPeaks.length) {
          nextPeaks.push(createMMRDataParentNode(currentPeaks[i], currentPeaks[i + 1]));
        } else {
          nextPeaks.push(currentPeaks[i]);
        }
      }
      currentPeaks = nextPeaks;
    }
    this.baggedPeaks.push(currentPeaks[0]);
  }

  private getPeaks(): Array<{ row: number; entryNumber: bigint; mmrData: MMRData }> {
    const peaks: Array<{ row: number; entryNumber: bigint; mmrData: MMRData }> = [];

    let highestRow = 0;
    let temp = this.leafCount;
    while (temp > 0) { highestRow++; temp >>= 1; }

    let leavesConsumed = 0;

    for (let row = highestRow - 1; row >= 0; row--) {
      const peakSize = 1 << row;
      if (this.leafCount & peakSize) {
        const entryNumber = BigInt(Math.floor(leavesConsumed / peakSize));
        const entry = this.entries.get(this.key(row, entryNumber));
        if (entry) {
          peaks.push(entry);
        }
        leavesConsumed += peakSize;
      }
    }

    return peaks;
  }

  getRoot(): MMRData | null {
    if (this.baggedPeaks.length === 0) return null;
    return this.baggedPeaks[this.baggedPeaks.length - 1];
  }

  getProof(leafIndex: number): MMRProof {
    const chunks: MMRProofChunk[] = [];

    // Walk up from leaf to its mountain peak (standard MMR sibling collection)
    let row = 0;
    let entryNumber = BigInt(leafIndex);
    while (true) {
      const siblingNumber = entryNumber % 2n === 0n
        ? entryNumber + 1n
        : entryNumber - 1n;
      const sibling = this.entries.get(this.key(row, siblingNumber));
      if (!sibling) break;
      const isLeft = siblingNumber < entryNumber;
      chunks.push({ isLeft, mmrData: sibling.mmrData });
      row++;
      entryNumber = entryNumber / 2n;
    }

    // Bagging proof: iteratively pair adjacent peaks (matches Minima Java's
    // MMRSet.getFullProofToRoot). At each level, if our peak's ancestor is
    // the left member of a pair, the sibling (right) is added as isLeft=false.
    // If it's the right member, the sibling (left) is added as isLeft=true.
    const peaks = this.getPeaks();
    const peakIndex = this.findLeafPeakIndex(leafIndex, peaks);
    let currentPeaks = peaks.map(p => p.mmrData);
    let currentIndex = peakIndex;

    while (currentPeaks.length > 1) {
      const nextPeaks: MMRData[] = [];
      for (let i = 0; i < currentPeaks.length; i += 2) {
        if (i + 1 < currentPeaks.length) {
          const left = currentPeaks[i];
          const right = currentPeaks[i + 1];
          const parent = createMMRDataParentNode(left, right);
          nextPeaks.push(parent);

          if (currentIndex === i) {
            chunks.push({ isLeft: false, mmrData: right });
            currentIndex = nextPeaks.length - 1;
          } else if (currentIndex === i + 1) {
            chunks.push({ isLeft: true, mmrData: left });
            currentIndex = nextPeaks.length - 1;
          }
        } else {
          nextPeaks.push(currentPeaks[i]);
          if (currentIndex === i) {
            currentIndex = nextPeaks.length - 1;
          }
        }
      }
      currentPeaks = nextPeaks;
    }

    return { chunks };
  }

  private findLeafPeakIndex(
    leafIndex: number,
    _peaks: Array<{ row: number; entryNumber: bigint; mmrData: MMRData }>,
  ): number {
    let n = leafIndex;
    let peakIdx = 0;

    let highestRow = 0;
    let temp = this.leafCount;
    while (temp > 0) { highestRow++; temp >>= 1; }

    for (let row = highestRow - 1; row >= 0; row--) {
      const peakSize = 1 << row;
      if (this.leafCount & peakSize) {
        if (n < peakSize) {
          return peakIdx;
        }
        n -= peakSize;
        peakIdx++;
      }
    }

    return peakIdx;
  }
}

export function compileMastTree(scripts: string[]): CompiledMast {
  if (scripts.length === 0) {
    throw new Error('Cannot compile empty MAST tree');
  }

  const leafHashes: Bytes[] = scripts.map(s => mmrLeafExact(s));
  const mmr = new ScriptMMR();

  for (const hash of leafHashes) {
    mmr.addLeaf({ data: hash, value: 0n });
  }

  const root = mmr.getRoot();
  if (!root) {
    throw new Error('Failed to compute MMR root');
  }

  const rootHex = bytesToHex(root.data);
  const rootAddress = makeMxAddress(root.data);

  const scriptProofs: MinimaScriptProof[] = scripts.map((script, i) => {
    const proof = mmr.getProof(i);
    const proofHex = bytesToHex(serializeMMRProof(proof, 0n));
    return {
      script,
      proofHex,
      address: rootAddress,
    };
  });

  return {
    rootAddress,
    rootHex,
    scripts: scriptProofs,
    leafCount: scripts.length,
  };
}

export function compilePolicyGraph(policy: PolicyGraph): CompiledRecursivePolicy {
  const compiledNodes = new Map<string, CompiledPolicyNode>();

  for (const node of policy.nodes) {
    const mast = compileMastTree(node.scripts);
    compiledNodes.set(node.id, {
      logicalNodeId: node.id,
      mast,
    });
  }

  const rootNode = policy.nodes.find(n => !n.parentId);
  if (!rootNode) {
    throw new Error('Policy graph must have a root node (no parentId)');
  }

  const rootCompiled = compiledNodes.get(rootNode.id);
  if (!rootCompiled) {
    throw new Error('Root node not compiled');
  }

  return {
    graph: policy,
    compiledNodes,
    anchorRoot: rootCompiled.mast.rootHex,
    anchorAddress: rootCompiled.mast.rootAddress,
  };
}

export function verifyScriptMembership(
  script: string,
  proofHex: string,
  expectedRoot: string,
): { valid: boolean; reason?: string } {
  const leafBytes = mmrLeafExact(script);
  const leafData: MMRData = { data: leafBytes, value: 0n };

  try {
    const proofBytes = hexToBytes(proofHex);
    const { proof } = parseMMRProofFromHex(proofBytes);
    const computedRoot = calculateProofRoot(leafData, proof);
    const computedRootHex = bytesToHex(computedRoot);

    if (computedRootHex !== expectedRoot) {
      return {
        valid: false,
        reason: `Root mismatch: computed ${computedRootHex.slice(0, 16)}…, expected ${expectedRoot.slice(0, 16)}…`,
      };
    }

    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      reason: `Proof verification failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function computeCanonicalScriptHash(script: string): string {
  return bytesToHex(mmrLeafExact(script));
}

export function computeCanonicalScriptAddress(script: string): string {
  return scriptToAddress(script);
}
