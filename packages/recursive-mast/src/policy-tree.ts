/**
 * Policy tree builder — constructs hierarchical governance structures
 * for recursive MAST. Each node is a policy root that authorizes scripts
 * and may delegate to child policy roots.
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyNode, PolicyTree } from './types.js';

export interface PolicyNodeInput {
  id: string;
  name: string;
  script: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

function hashScript(script: string): string {
  return bytesToHex(sha3_256(new TextEncoder().encode(script)));
}

function computePolicyRoot(scripts: string[]): string {
  if (scripts.length === 0) return hashScript('');
  if (scripts.length === 1) return hashScript(scripts[0]);
  const leaves = scripts.map(s => sha3_256(new TextEncoder().encode(s)));
  return buildMerkleRoot(leaves);
}

function buildMerkleRoot(leaves: Uint8Array[]): string {
  if (leaves.length === 0) return bytesToHex(sha3_256(new Uint8Array(0)));
  if (leaves.length === 1) return bytesToHex(leaves[0]);

  let level = leaves;
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      const pair = new Uint8Array(left.length + right.length);
      pair.set(left);
      pair.set(right, left.length);
      next.push(sha3_256(pair));
    }
    level = next;
  }
  return bytesToHex(level[0]);
}

/**
 * Build a policy tree from a flat list of nodes.
 * Nodes reference parents by `parentId`. The root is the node with no parent.
 *
 * @example
 * ```ts
 * const tree = buildPolicyTree([
 *   { id: 'root', name: 'National', script: 'RETURN TRUE' },
 *   { id: 'regional', name: 'Regional', script: 'ASSERT SIGNEDBY(STATE(0)) RETURN TRUE', parentId: 'root' },
 *   { id: 'local', name: 'Local', script: 'ASSERT SIGNEDBY(PREVSTATE(0)) RETURN TRUE', parentId: 'regional' },
 * ]);
 * ```
 */
export function buildPolicyTree(nodes: PolicyNodeInput[]): PolicyTree {
  const nodeMap = new Map<string, PolicyNode>();
  const childrenMap = new Map<string, PolicyNodeInput[]>();

  for (const node of nodes) {
    const parentId = node.parentId ?? '';
    const list = childrenMap.get(parentId) ?? [];
    list.push(node);
    childrenMap.set(parentId, list);
  }

  function buildNode(input: PolicyNodeInput): PolicyNode {
    const childInputs = childrenMap.get(input.id) ?? [];
    const children = childInputs.map(buildNode);

    const allScripts = [input.script, ...children.map(c => c.script)];
    const policyRoot = computePolicyRoot(allScripts);

    const node: PolicyNode = {
      id: input.id,
      name: input.name,
      scriptHash: hashScript(input.script),
      script: input.script,
      policyRoot,
      children,
      parentId: input.parentId,
      metadata: input.metadata,
    };
    nodeMap.set(input.id, node);
    return node;
  }

  const rootInputs = childrenMap.get('') ?? [];
  if (rootInputs.length === 0) throw new Error('No root node found (node with no parentId)');
  if (rootInputs.length > 1) throw new Error('Multiple root nodes found — policy tree must have a single root');

  const root = buildNode(rootInputs[0]);

  function maxDepth(node: PolicyNode): number {
    if (node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(maxDepth));
  }

  return { root, nodeMap, depth: maxDepth(root), nodeCount: nodeMap.size };
}

/**
 * Find a policy node by ID in the tree.
 */
export function findPolicyNode(tree: PolicyTree, id: string): PolicyNode | undefined {
  return tree.nodeMap.get(id);
}

/**
 * Get the path from root to a specific node.
 */
export function getPolicyPath(tree: PolicyTree, targetId: string): PolicyNode[] {
  const path: PolicyNode[] = [];
  let current = tree.nodeMap.get(targetId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? tree.nodeMap.get(current.parentId) : undefined;
  }
  return path;
}

/**
 * Get all leaf nodes (nodes with no children).
 */
export function getPolicyLeaves(tree: PolicyTree): PolicyNode[] {
  const leaves: PolicyNode[] = [];
  function collect(node: PolicyNode): void {
    if (node.children.length === 0) leaves.push(node);
    else node.children.forEach(collect);
  }
  collect(tree.root);
  return leaves;
}
