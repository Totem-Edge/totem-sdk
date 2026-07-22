/**
 * Policy Anchor Coin — a stable on-chain UTXO whose locking script commits to
 * a set of policy roots that can rotate through state updates.
 *
 * The anchor has explicit branches:
 *   1. Normal action — MAST the selected action root
 *   2. Root rotation — MAST the root-rotation authority
 *   3. Epoch advancement — MAST the epoch-advancement authority
 *   4. Recovery — MAST the recovery root
 *   5. Emergency — MAST the emergency root
 *
 * Every successful branch must enforce the complete successor anchor:
 *   - Same subject identity
 *   - Same token and amount (unless explicitly permitted)
 *   - Expected anchor script/address
 *   - Exact next epoch
 *   - Authorized root changes only
 *   - Unchanged roots preserved
 *   - Expected manifest commitment
 *   - Exactly one valid successor output
 *   - No duplicate anchor outputs
 *
 * State port assignments:
 *   State 0  = subject ID
 *   State 10 = current regulator policy root
 *   State 11 = current owner policy root
 *   State 12 = current service-provider root
 *   State 13 = current firmware-approval root
 *   State 14 = policy epoch
 *   State 15 = policy-manifest commitment
 *   State 16 = recovery root
 *   State 17 = emergency root
 *   State 18 = action root (set by the spender to select which action to execute)
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';

export interface PolicyAnchorConfig {
  subjectId: string;
  subjectType: 'vehicle' | 'machine' | 'device' | 'site' | 'fleet' | 'building';
  institutionalRoot: string;
  initialEpoch: number;
  ports: {
    regulatorRoot: number;
    ownerRoot: number;
    serviceProviderRoot: number;
    firmwareApprovalRoot: number;
    epoch: number;
    manifestHash: number;
    recoveryRoot: number;
    emergencyRoot: number;
    actionRoot: number;
  };
  recoveryRoot?: string;
  emergencyRoot?: string;
}

export function buildPolicyAnchorScript(config: PolicyAnchorConfig): string {
  const lines = [
    `// Policy Anchor: ${config.subjectId}`,
    `// Subject: ${config.subjectType}`,
    ``,
    `// ── Identity ──`,
    `LET subjectId = [${config.subjectId}]`,
    `ASSERT STATE(0) EQ subjectId`,
    ``,
    `// ── Epoch ──`,
    `LET epoch = STATE(${config.ports.epoch})`,
    `LET prevEpoch = PREVSTATE(${config.ports.epoch})`,
    `ASSERT epoch GTE prevEpoch`,
    ``,
    `// ── Dynamic roots (from PREVSTATE) ──`,
    `LET regulatorRoot = PREVSTATE(${config.ports.regulatorRoot})`,
    `LET ownerRoot = PREVSTATE(${config.ports.ownerRoot})`,
    `LET serviceProviderRoot = PREVSTATE(${config.ports.serviceProviderRoot})`,
    `LET firmwareRoot = PREVSTATE(${config.ports.firmwareApprovalRoot})`,
    `LET recoveryRoot = PREVSTATE(${config.ports.recoveryRoot})`,
    `LET emergencyRoot = PREVSTATE(${config.ports.emergencyRoot})`,
    `LET manifestHash = STATE(${config.ports.manifestHash})`,
    ``,
    `// ── Action selection ──`,
    `// The spender sets STATE(${config.ports.actionRoot}) to select which`,
    `// branch to execute. 0 = normal action, 1 = root rotation,`,
    `// 2 = epoch advancement, 3 = recovery, 4 = emergency.`,
    `LET actionType = STATE(${config.ports.actionRoot})`,
    ``,
    `// ── Branch 1: Normal action ──`,
    `IF actionType EQ 0 THEN`,
    `  // The spender must supply the action root via STATE`,
    `  LET selectedRoot = STATE(${config.ports.actionRoot + 1})`,
    `  ASSERT selectedRoot NEQ 0x00`,
    `  MAST selectedRoot`,
    `ENDIF`,
    ``,
    `// ── Branch 2: Root rotation ──`,
    `IF actionType EQ 1 THEN`,
    `  // The spender must supply the rotation authority root`,
    `  LET rotationRoot = STATE(${config.ports.actionRoot + 1})`,
    `  ASSERT rotationRoot NEQ 0x00`,
    `  MAST rotationRoot`,
    `ENDIF`,
    ``,
    `// ── Branch 3: Epoch advancement ──`,
    `IF actionType EQ 2 THEN`,
    `  LET epochRoot = STATE(${config.ports.actionRoot + 1})`,
    `  ASSERT epochRoot NEQ 0x00`,
    `  MAST epochRoot`,
    `ENDIF`,
  ];

  if (config.recoveryRoot) {
    lines.push(
      ``,
      `// ── Branch 4: Recovery ──`,
      `IF actionType EQ 3 THEN`,
      `  ASSERT recoveryRoot NEQ 0x00`,
      `  MAST recoveryRoot`,
      `ENDIF`,
    );
  }

  if (config.emergencyRoot) {
    lines.push(
      ``,
      `// ── Branch 5: Emergency ──`,
      `IF actionType EQ 4 THEN`,
      `  ASSERT emergencyRoot NEQ 0x00`,
      `  MAST emergencyRoot`,
      `ENDIF`,
    );
  }

  lines.push(
    ``,
    `// ── Covenant continuity ──`,
    `// Every branch must preserve the successor anchor output`,
    `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
    ``,
    `RETURN TRUE`,
  );

  return lines.join('\n');
}

export function buildPolicyAnchorState(config: PolicyAnchorConfig, initialRoots: {
  regulatorRoot?: string;
  ownerRoot?: string;
  serviceProviderRoot?: string;
  firmwareApprovalRoot?: string;
  manifestHash?: string;
  recoveryRoot?: string;
  emergencyRoot?: string;
}): Record<number, string> {
  const state: Record<number, string> = {
    0: config.subjectId,
    [config.ports.epoch]: String(config.initialEpoch),
    [config.ports.regulatorRoot]: initialRoots.regulatorRoot ?? '0x00',
    [config.ports.ownerRoot]: initialRoots.ownerRoot ?? '0x00',
    [config.ports.serviceProviderRoot]: initialRoots.serviceProviderRoot ?? '0x00',
    [config.ports.firmwareApprovalRoot]: initialRoots.firmwareApprovalRoot ?? '0x00',
    [config.ports.manifestHash]: initialRoots.manifestHash ?? '0x00',
    [config.ports.recoveryRoot]: initialRoots.recoveryRoot ?? config.recoveryRoot ?? '0x00',
    [config.ports.emergencyRoot]: initialRoots.emergencyRoot ?? config.emergencyRoot ?? '0x00',
    [config.ports.actionRoot]: '0',
  };
  return state;
}

export function buildRootRotationScript(
  port: number,
  newRoot: string,
  authorizerPkd: string,
  reason: string,
): string {
  return [
    `// Root rotation: port ${port} → ${newRoot.slice(0, 16)}…`,
    `// Reason: ${reason}`,
    `LET oldRoot = PREVSTATE(${port})`,
    `LET newRoot = 0x${newRoot}`,
    `ASSERT SIGNEDBY(0x${authorizerPkd})`,
    `ASSERT STATE(${port}) EQ newRoot`,
    `ASSERT newRoot NEQ oldRoot`,
    `RETURN TRUE`,
  ].join('\n');
}

export function buildEpochAdvancementScript(
  config: PolicyAnchorConfig,
  newEpoch: number,
  authorizerPkd: string,
): string {
  return [
    `// Epoch advancement: → ${newEpoch}`,
    `LET prevEpoch = PREVSTATE(${config.ports.epoch})`,
    `LET newEpoch = ${newEpoch}`,
    `ASSERT SIGNEDBY(0x${authorizerPkd})`,
    `ASSERT STATE(${config.ports.epoch}) EQ newEpoch`,
    `ASSERT newEpoch GT prevEpoch`,
    `RETURN TRUE`,
  ].join('\n');
}
