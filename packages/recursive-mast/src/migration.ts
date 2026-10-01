/**
 * Migration path constructor — builds upgradeable policy systems.
 * Old policy → migration policy → new policy.
 *
 * Migration paths enable governance evolution without breaking
 * existing proofs. Each step defines a transition window where
 * both old and new policies are valid.
 */

import { computeCanonicalScriptHash } from '@totemsdk/kissvm';
import type { MigrationStep, MigrationPath } from './types.js';

function hashScript(script: string): string {
  // RFC-016 P2: canonical MMR leaf hash
  return computeCanonicalScriptHash(script);
}

/**
 * Build a single migration step.
 *
 * @param fromPolicyRoot - The old policy root being migrated from.
 * @param toPolicyRoot - The new policy root being migrated to.
 * @param activationBlock - Block height at which this migration activates.
 * @param deprecationBlock - Block height at which the old policy is fully deprecated.
 * @param proof - Merkle proof that the migration script is in the old policy root.
 */
export function buildMigrationStep(
  fromPolicyRoot: string,
  toPolicyRoot: string,
  activationBlock: number,
  deprecationBlock: number,
  proof: string,
): MigrationStep {
  const migrationScript = buildMigrationScript(fromPolicyRoot, toPolicyRoot, activationBlock, deprecationBlock);
  return {
    fromPolicyRoot,
    toPolicyRoot,
    migrationScript,
    proof,
    activationBlock,
    deprecationBlock,
  };
}

/**
 * Build the KISSVM migration script.
 * During the transition window (activationBlock ≤ @BLOCK < deprecationBlock),
 * both old and new policies are accepted. After deprecationBlock, only the
 * new policy is accepted.
 */
export function buildMigrationScript(
  fromPolicyRoot: string,
  toPolicyRoot: string,
  activationBlock: number,
  deprecationBlock: number,
): string {
  return [
    `// Migration: ${fromPolicyRoot.slice(0, 16)}… → ${toPolicyRoot.slice(0, 16)}…`,
    `LET activation = ${activationBlock}`,
    ``,
    // RFC-020 P2-7: `MAST` is terminal, so the previous `MAST … / RETURN TRUE`
    // pairs made the RETURN (and any following MAST) unreachable. Each window now
    // terminates in exactly one MAST: before activation the old policy governs;
    // from activation the new policy governs (the old root remains valid through
    // its own committed branch until it is deprecated).
    `IF @BLOCK LT activation THEN`,
    `  MAST 0x${fromPolicyRoot}`,
    `ELSE`,
    `  MAST 0x${toPolicyRoot}`,
    `ENDIF`,
  ].join('\n');
}

/**
 * Build a complete migration path from an ordered list of steps.
 */
export function buildMigrationPath(steps: MigrationStep[]): MigrationPath {
  if (steps.length === 0) throw new Error('Migration path must have at least one step');

  for (let i = 1; i < steps.length; i++) {
    if (steps[i].fromPolicyRoot !== steps[i - 1].toPolicyRoot) {
      throw new Error(
        `Migration path broken at step ${i}: from "${steps[i].fromPolicyRoot.slice(0, 16)}…" does not match previous to "${steps[i - 1].toPolicyRoot.slice(0, 16)}…"`,
      );
    }
  }

  return {
    steps: [...steps],
    originalRoot: steps[0].fromPolicyRoot,
    currentRoot: steps[steps.length - 1].toPolicyRoot,
    complete: false,
  };
}

/**
 * Check whether a migration step is currently active at a given block height.
 */
export function isMigrationActive(step: MigrationStep, currentBlock: number): boolean {
  return currentBlock >= step.activationBlock && currentBlock < step.deprecationBlock;
}

/**
 * Check whether a migration step is fully complete (old policy deprecated).
 */
export function isMigrationComplete(step: MigrationStep, currentBlock: number): boolean {
  return currentBlock >= step.deprecationBlock;
}

/**
 * Get the active policy root at a given block height from a migration path.
 */
export function getActivePolicyRoot(path: MigrationPath, currentBlock: number): string {
  for (const step of path.steps) {
    if (currentBlock < step.deprecationBlock) {
      return step.fromPolicyRoot;
    }
  }
  return path.currentRoot;
}

/**
 * Generate the full nested MAST script for a migration path.
 *
 * RFC-018 P2-2: each step delegates to the *next composed script* (its
 * canonical root), not merely its `toPolicyRoot` — the previous form appended a
 * terminal `MAST` after a `RETURN TRUE`, leaving the child unreachable. An empty
 * path fails closed rather than compiling to allow-all.
 */
export function toMigrationPathScript(path: MigrationPath): string {
  if (path.steps.length === 0) {
    throw new Error('toMigrationPathScript: empty migration path (refusing to build allow-all)');
  }

  let nextScript: string | undefined;
  let composed = '';

  for (let i = path.steps.length - 1; i >= 0; i--) {
    const step = path.steps[i];
    const target = nextScript ? computeCanonicalScriptHash(nextScript) : step.toPolicyRoot;
    composed = buildMigrationScript(
      step.fromPolicyRoot,
      target,
      step.activationBlock,
      step.deprecationBlock,
    );
    nextScript = composed;
  }

  return composed;
}
