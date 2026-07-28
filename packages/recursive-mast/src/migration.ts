/**
 * Migration path constructor — builds upgradeable policy systems.
 * Old policy → migration policy → new policy.
 *
 * Migration paths enable governance evolution without breaking
 * existing proofs. Each step defines a transition window where
 * both old and new policies are valid.
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { MigrationStep, MigrationPath } from './types.js';

function hashScript(script: string): string {
  return bytesToHex(sha3_256(new TextEncoder().encode(script)));
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
    `LET oldRoot = 0x${fromPolicyRoot}`,
    `LET newRoot = 0x${toPolicyRoot}`,
    `LET activation = ${activationBlock}`,
    `LET deprecation = ${deprecationBlock}`,
    ``,
    `// Before activation: only old policy`,
    `IF @BLOCK LT activation THEN`,
    `  MAST 0x${fromPolicyRoot}`,
    `  RETURN TRUE`,
    `ENDIF`,
    ``,
    `// During transition: both policies accepted`,
    `IF @BLOCK LT deprecation THEN`,
    `  MAST 0x${fromPolicyRoot}`,
    `  RETURN TRUE`,
    `ENDIF`,
    ``,
    `// After deprecation: only new policy`,
    `MAST 0x${toPolicyRoot}`,
    `RETURN TRUE`,
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
 * Each step wraps the next in a migration transition.
 */
export function toMigrationPathScript(path: MigrationPath): string {
  if (path.steps.length === 0) return 'RETURN TRUE';

  let script = `// Final policy: ${path.currentRoot.slice(0, 16)}…\nRETURN TRUE`;

  for (let i = path.steps.length - 1; i >= 0; i--) {
    const step = path.steps[i];
    script = buildMigrationScript(step.fromPolicyRoot, step.toPolicyRoot, step.activationBlock, step.deprecationBlock)
      + `\n\n// Delegates to next step\n`
      + `MAST 0x${step.toPolicyRoot}`;
  }

  return script;
}
