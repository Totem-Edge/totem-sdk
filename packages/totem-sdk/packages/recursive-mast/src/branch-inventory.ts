/**
 * Branch inventory — a manifest-committed inventory of all policy
 * branches, enabling availability audits to detect missing branches.
 *
 * Without a committed inventory, an availability audit cannot know
 * whether a branch is missing from all stores or simply doesn't exist.
 * The manifest must commit to the expected branch set.
 *
 * The inventory is a content-addressed list of branch descriptors
 * that the manifest's policyPackageHash commits to.
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import { canonicalHash, type EncodingDomain } from './canonical-encoding.js';

export interface BranchInventoryEntry {
  scriptHash: string;
  action: string;
  role?: string;
  policyRoot: string;
  critical: boolean;
  recoveryPath: boolean;
}

export interface BranchInventory {
  policyId: string;
  version: number;
  epoch: number;
  policyRoot: string;
  branches: BranchInventoryEntry[];
  createdAt: number;
}

export function computeBranchInventoryHash(inventory: BranchInventory): string {
  const payload: Record<string, unknown> = {
    policyId: inventory.policyId,
    version: inventory.version,
    epoch: inventory.epoch,
    policyRoot: inventory.policyRoot,
    branches: inventory.branches.map(b => ({
      scriptHash: b.scriptHash,
      action: b.action,
      role: b.role ?? null,
      policyRoot: b.policyRoot,
      critical: b.critical,
      recoveryPath: b.recoveryPath,
    })),
    createdAt: inventory.createdAt,
  };

  return canonicalHash('BRIN' as EncodingDomain, payload);
}

export function getCriticalBranches(inventory: BranchInventory): BranchInventoryEntry[] {
  return inventory.branches.filter(b => b.critical);
}

export function getRecoveryBranches(inventory: BranchInventory): BranchInventoryEntry[] {
  return inventory.branches.filter(b => b.recoveryPath);
}

export function getBranchesByAction(inventory: BranchInventory, action: string): BranchInventoryEntry[] {
  return inventory.branches.filter(b => b.action === action);
}

export function getBranchesByRole(inventory: BranchInventory, role: string): BranchInventoryEntry[] {
  return inventory.branches.filter(b => b.role === role);
}

export function validateInventoryCoverage(
  inventory: BranchInventory,
  availableHashes: Set<string>,
): {
  coverage: number;
  total: number;
  available: number;
  missing: BranchInventoryEntry[];
  missingCritical: BranchInventoryEntry[];
  missingRecovery: BranchInventoryEntry[];
} {
  const missing: BranchInventoryEntry[] = [];
  const missingCritical: BranchInventoryEntry[] = [];
  const missingRecovery: BranchInventoryEntry[] = [];

  for (const branch of inventory.branches) {
    if (!availableHashes.has(branch.scriptHash)) {
      missing.push(branch);
      if (branch.critical) missingCritical.push(branch);
      if (branch.recoveryPath) missingRecovery.push(branch);
    }
  }

  const total = inventory.branches.length;
  const available = total - missing.length;

  return {
    coverage: total > 0 ? available / total : 1,
    total,
    available,
    missing,
    missingCritical,
    missingRecovery,
  };
}
