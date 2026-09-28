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

import type { PolicyNode, PolicyTree, ProofLink } from './types.js';
import { buildPolicyTree, type PolicyNodeInput } from './policy-tree.js';
import { buildProofChain } from './proof-chain.js';
import { computeCanonicalScriptHash, compileMastTree } from './mast-compiler.js';

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

  // RFC-016 hardening: derive the proof chain from the *composed* nested
  // scripts (the ones actually executed), not the original layer scripts with
  // empty proofs. Each link proves its composed script against its own
  // canonical MMR root, and link[i].script contains `MAST <link[i+1].root>`.
  const composed: string[] = new Array(config.layers.length);
  composed[config.layers.length - 1] = config.layers[config.layers.length - 1].script;
  for (let i = config.layers.length - 2; i >= 0; i--) {
    composed[i] = `${stripTrailingReturn(config.layers[i].script)}\nMAST 0x${computeCanonicalScriptHash(composed[i + 1])}`;
  }

  const proofLinks: ProofLink[] = composed.map((script, i) => {
    const mast = compileMastTree([script]);
    return {
      scriptHash: computeCanonicalScriptHash(script),
      policyRoot: mast.rootHex,
      proof: mast.scripts[0].proofHex,
      script,
      label: config.layers[i].name,
      metadata: { layerId: config.layers[i].id, authorityPkd: config.layers[i].authorityPkd },
    };
  });

  const proofChain = buildProofChain(proofLinks);

  const mastScript = composed[0];

  return { tree, proofChain, mastScript };
}

/**
 * Build the nested MAST KISSVM script for a layered policy.
 * Each layer delegates to the next via MAST.
 */
/**
 * RFC-016 hardening: `MAST` is terminal in the evaluator (it throws a
 * ReturnSignal). A delegating script must therefore end with `MAST <childRoot>`;
 * a trailing `RETURN` would make the nested branch unreachable.
 */
function stripTrailingReturn(script: string): string {
  // RFC-018 RM-LAYER-001: only a terminal `RETURN TRUE` may be stripped. A
  // terminal `RETURN FALSE` (an explicit deny) must fail closed, not become a
  // delegation; trailing blank/comment lines are tolerated.
  let t = script.replace(/\s+$/, '');
  // Drop trailing blank / comment-only lines so an inline RETURN is terminal.
  t = t.replace(/(?:\n[ \t]*(?:\/\/[^\n]*)?)+$/, '');
  const retTrue = t.match(/(?:^|\s)RETURN\s+TRUE\s*(?:\/\/[^\n]*)?$/i);
  if (retTrue) return t.slice(0, retTrue.index).replace(/\s+$/, '');
  const anyRet = t.match(/(?:^|\s)RETURN\b[^\n]*$/i);
  if (anyRet) {
    throw new Error('stripTrailingReturn: refusing to strip a terminal RETURN that is not RETURN TRUE');
  }
  return t;
}

export function buildLayeredMastScript(config: LayeredPolicyConfig): string {
  // RFC-016 I4: an empty policy must fail construction, not become allow-all.
  if (config.layers.length === 0) {
    throw new Error('buildLayeredMastScript: empty layers (refusing to build an allow-all policy)');
  }

  let script = config.layers[config.layers.length - 1].script;

  for (let i = config.layers.length - 2; i >= 0; i--) {
    // RFC-016 P2: the MAST root must be the canonical MMR script hash so the
    // evaluator's witness lookup matches the proof the VM computes.
    const nextRoot = computeCanonicalScriptHash(script);
    script = `${stripTrailingReturn(config.layers[i].script)}\nMAST 0x${nextRoot}`;
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