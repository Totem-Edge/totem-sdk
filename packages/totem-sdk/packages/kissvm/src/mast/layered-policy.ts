/**
 * Layered policy builder — composes the standard 7-layer policy chain
 * from reusable layer templates. Each layer is a policy root that
 * authorizes scripts and delegates to the next layer via nested MAST.
 *
 * Standard chain:
 *   Asset root → Manufacturer → Product/model → Regulatory → Owner/fleet → Site → Operator → Action
 *
 * Not every layer must be used. A firmware update might traverse 6 layers;
 * a maintenance command might traverse only 3.
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyNode, PolicyTree, ProofLink } from './types.js';
import { buildPolicyTree, type PolicyNodeInput } from './policy-tree.js';
import { buildProofChain } from './proof-chain.js';

// ─── Layer definitions ─────────────────────────────────────────────────────

export interface PolicyLayer {
  /** Unique identifier for this layer. */
  id: string;
  /** Human-readable layer name. */
  name: string;
  /** The KISSVM script for this layer. */
  script: string;
  /** The public key digest of the authority controlling this layer. */
  authorityPkd: string;
  /** Optional: constraints specific to this layer. */
  constraints?: Record<string, unknown>;
}

export interface LayeredPolicyConfig {
  /** Asset root identifier (e.g. device serial, fleet ID, site ID). */
  assetId: string;
  /** Asset root name. */
  assetName: string;
  /** Ordered layers from root to action. */
  layers: PolicyLayer[];
  /** Optional: maximum allowed depth (default 7). */
  maxDepth?: number;
}

/**
 * Build a layered policy tree from a config.
 * Returns a PolicyTree where each layer is a node, plus a proof chain
 * that can be used for nested MAST execution.
 *
 * @example
 * ```ts
 * const { tree, proofChain } = buildLayeredPolicy({
 *   assetId: 'robot-arm-001',
 *   assetName: 'Robot Arm',
 *   layers: [
 *     { id: 'manufacturer', name: 'Robot Corp', script: mfgScript, authorityPkd: mfgPk },
 *     { id: 'regulatory', name: 'EU Machinery Directive', script: regScript, authorityPkd: regPk },
 *     { id: 'owner', name: 'Factory GmbH', script: ownerScript, authorityPkd: ownerPk },
 *     { id: 'site', name: 'Plant A', script: siteScript, authorityPkd: sitePk },
 *     { id: 'operator', name: 'Technician', script: opScript, authorityPkd: opPk },
 *   ],
 * });
 * ```
 */
export function buildLayeredPolicy(config: LayeredPolicyConfig): {
  tree: PolicyTree;
  proofChain: ReturnType<typeof buildProofChain>;
  mastScript: string;
} {
  const nodes: PolicyNodeInput[] = [];
  let parentId: string | undefined;

  for (const layer of config.layers) {
    nodes.push({
      id: layer.id,
      name: layer.name,
      script: layer.script,
      parentId,
      metadata: { authorityPkd: layer.authorityPkd, ...layer.constraints },
    });
    parentId = layer.id;
  }

  const tree = buildPolicyTree(nodes);

  const proofLinks: ProofLink[] = config.layers.map((layer) => ({
    scriptHash: bytesToHex(sha3_256(new TextEncoder().encode(layer.script))),
    policyRoot: tree.nodeMap.get(layer.id)?.policyRoot ?? '',
    proof: '',
    script: layer.script,
    label: layer.name,
    metadata: { layerId: layer.id, authorityPkd: layer.authorityPkd },
  }));

  const proofChain = buildProofChain(proofLinks);

  const mastScript = buildLayeredMastScript(config);

  return { tree, proofChain, mastScript };
}

/**
 * Build the nested MAST KISSVM script for a layered policy.
 * Each layer delegates to the next via MAST.
 */
export function buildLayeredMastScript(config: LayeredPolicyConfig): string {
  if (config.layers.length === 0) return 'RETURN TRUE';

  let script = config.layers[config.layers.length - 1].script;

  for (let i = config.layers.length - 2; i >= 0; i--) {
    const nextRoot = bytesToHex(sha3_256(new TextEncoder().encode(
      script.trim().toUpperCase()
    )));
    script = `${config.layers[i].script}\nMAST 0x${nextRoot}`;
  }

  return script;
}

/**
 * Build a subset of layers — useful when some layers are optional.
 * Only includes layers that are present in the `include` array.
 */
export function buildLayerSubset(
  config: LayeredPolicyConfig,
  include: string[],
): { tree: PolicyTree; proofChain: ReturnType<typeof buildProofChain> } {
  const filtered = {
    ...config,
    layers: config.layers.filter(l => include.includes(l.id)),
  };
  const { tree, proofChain } = buildLayeredPolicy(filtered);
  return { tree, proofChain };
}

/**
 * Standard layer IDs for the canonical 7-layer chain.
 */
export const STANDARD_LAYERS = {
  ASSET: 'asset',
  MANUFACTURER: 'manufacturer',
  PRODUCT: 'product',
  REGULATORY: 'regulatory',
  OWNER: 'owner',
  SITE: 'site',
  OPERATOR: 'operator',
} as const;