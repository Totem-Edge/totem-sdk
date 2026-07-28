/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Institutional Recovery Templates — multi-layered key recovery for
 * institutional identities that must survive key loss, compromise,
 * succession, and disaster.
 *
 * Principles:
 *   1. No single recovery custodian can seize the identity.
 *   2. Recovery is time-delayed — cannot activate immediately.
 *   3. Recovery is auditable — public notice, epoch advancement.
 *   4. Operational keys are short-lived and delegated.
 *   5. The institutional root changes rarely.
 *   6. Recovery, emergency, and routine operations use separate roots.
 *
 * Recommended hierarchy:
 *   Permanent institutional identity
 *   ├── Cold governance root (3-of-5, hardware keys)
 *   ├── Operational controller (daily signing, firmware approvals)
 *   └── Emergency recovery policy (threshold, delay, public notice)
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';

// ─── Threshold recovery ─────────────────────────────────────────────────────

export interface ThresholdRecoveryConfig {
  /** The institutional identity root being recovered. */
  institutionalRoot: string;
  /** Recovery custodian public key digests. */
  custodians: string[];
  /** Number of custodians required to approve recovery. */
  threshold: number;
  /** Delay in blocks before recovery activates. */
  delayBlocks: number;
  /** Public notice endpoint (for audit). */
  noticeEndpoint?: string;
  /** Recovery identifier. */
  recoveryId: string;
}

/**
 * Build a threshold recovery script requiring M-of-N custodian signatures.
 * The recovery activates after a mandatory delay, during which the current
 * controller or another guardian can veto.
 */
export function buildThresholdRecoveryScript(config: ThresholdRecoveryConfig): string {
  const custodianList = config.custodians.map(c => `0x${c}`).join(' ');

  return [
    `// Threshold recovery: ${config.recoveryId}`,
    `// Requires ${config.threshold} of ${config.custodians.length} custodians`,
    `// Delay: ${config.delayBlocks} blocks`,
    ``,
    `// 1. Threshold check`,
    `ASSERT MULTISIG(${config.threshold} ${custodianList})`,
    ``,
    `// 2. Time-delayed activation`,
    `LET recoveryProposed = PREVSTATE(50)`,
    `LET currentBlock = @BLOCK`,
    `ASSERT currentBlock SUB recoveryProposed GTE ${config.delayBlocks}`,
    ``,
    `// 3. Replacement controller`,
    `LET newController = STATE(51)`,
    `ASSERT newController NEQ 0x00`,
    ``,
    `// 4. Public notice`,
    `ASSERT STATE(52) EQ [${config.recoveryId}]`,
    ``,
    `RETURN TRUE`,
  ].join('\n');
}

// ─── Epoch-based policy rotation ───────────────────────────────────────────

export interface EpochRotationConfig {
  /** The institutional root. */
  institutionalRoot: string;
  /** The current operational controller's PKD. */
  currentControllerPkd: string;
  /** The new operational controller's PKD. */
  newControllerPkd: string;
  /** The current epoch. */
  currentEpoch: number;
  /** The new epoch. */
  newEpoch: number;
  /** Minimum notice period in blocks. */
  noticeBlocks: number;
}

/**
 * Build an epoch-based controller rotation script.
 * The current controller must sign, and the new epoch must be strictly greater.
 * Old credentials cannot be replayed once the epoch advances.
 */
export function buildEpochRotationScript(config: EpochRotationConfig): string {
  return [
    `// Epoch rotation: ${config.currentEpoch} → ${config.newEpoch}`,
    `// Controller: ${config.currentControllerPkd.slice(0, 16)}… → ${config.newControllerPkd.slice(0, 16)}…`,
    ``,
    `LET oldController = 0x${config.currentControllerPkd}`,
    `LET newController = 0x${config.newControllerPkd}`,
    `LET prevEpoch = PREVSTATE(60)`,
    `LET newEpoch = STATE(60)`,
    ``,
    `// 1. Current controller must authorise`,
    `ASSERT SIGNEDBY(oldController)`,
    ``,
    `// 2. Epoch must advance`,
    `ASSERT newEpoch EQ ${config.newEpoch}`,
    `ASSERT newEpoch GT prevEpoch`,
    ``,
    `// 3. Notice period`,
    `ASSERT @BLOCK SUB PREVSTATE(61) GTE ${config.noticeBlocks}`,
    ``,
    `// 4. New controller is set`,
    `ASSERT STATE(62) EQ newController`,
    ``,
    `RETURN TRUE`,
  ].join('\n');
}

// ─── Short-lived delegated credentials ─────────────────────────────────────

export interface DelegatedCredentialConfig {
  /** The issuer's public key digest. */
  issuerPkd: string;
  /** The credential holder's public key digest. */
  holderPkd: string;
  /** The role being delegated. */
  role: string;
  /** The scope of the delegation. */
  scope: string;
  /** Block height at which the credential becomes valid. */
  validFrom: number;
  /** Block height at which the credential expires. */
  expiresAt: number;
  /** Maximum number of uses. */
  maxUses?: number;
}

/**
 * Build a short-lived delegated credential script.
 * Credentials are not encoded indefinitely — they expire, limiting the
 * damage from lost or compromised keys.
 */
export function buildDelegatedCredentialScript(config: DelegatedCredentialConfig): string {
  const lines = [
    `// Delegated credential: ${config.role}`,
    `LET issuer = 0x${config.issuerPkd}`,
    `LET holder = 0x${config.holderPkd}`,
    ``,
    `// 1. Issuer must authorise`,
    `ASSERT SIGNEDBY(issuer)`,
    ``,
    `// 2. Scope constraint`,
    `ASSERT STATE(70) EQ [${config.scope}]`,
    ``,
    `// 3. Validity window`,
    `ASSERT @BLOCK GTE ${config.validFrom}`,
    `ASSERT @BLOCK LTE ${config.expiresAt}`,
  ];

  if (config.maxUses !== undefined) {
    lines.push(
      ``,
      `// 4. Usage limit`,
      `LET uses = PREVSTATE(71)`,
      `ASSERT INC(uses) LTE ${config.maxUses}`,
    );
  }

  lines.push(``, `RETURN TRUE`);
  return lines.join('\n');
}

// ─── Institutional hierarchy builder ───────────────────────────────────────

export interface InstitutionalHierarchyConfig {
  /** The permanent institutional identity. */
  identityId: string;
  /** The institutional name. */
  name: string;
  /** Number of cold governance custodians. */
  governanceCustodians: number;
  /** Governance threshold. */
  governanceThreshold: number;
  /** Operational controller PKD. */
  operationalControllerPkd: string;
  /** Recovery delay in blocks. */
  recoveryDelayBlocks: number;
  /** Recovery custodian PKDs. */
  recoveryCustodians: string[];
  /** Recovery threshold. */
  recoveryThreshold: number;
  /** Current epoch. */
  epoch: number;
}

/**
 * Build the complete institutional identity hierarchy.
 *
 * Returns:
 *   - governanceScript: the cold governance root script
 *   - operationalScript: the daily operations script
 *   - recoveryScript: the emergency recovery script
 *   - institutionalRoot: the permanent identity root
 */
export function buildInstitutionalHierarchy(config: InstitutionalHierarchyConfig): {
  governanceScript: string;
  operationalScript: string;
  recoveryScript: string;
  institutionalRoot: string;
} {
  const governanceScript = [
    `// Institutional governance: ${config.name}`,
    `LET identity = [${config.identityId}]`,
    `ASSERT STATE(0) EQ identity`,
    `ASSERT MULTISIG(${config.governanceThreshold} ${Array(config.governanceCustodians).fill('PLACEHOLDER').map(() => '0x00').join(' ')})`,
    `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
    `RETURN TRUE`,
  ].join('\n');

  const operationalScript = [
    `// Operational controller: ${config.name}`,
    `LET controller = 0x${config.operationalControllerPkd}`,
    `ASSERT SIGNEDBY(controller)`,
    `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
    `RETURN TRUE`,
  ].join('\n');

  const recoveryScript = buildThresholdRecoveryScript({
    institutionalRoot: config.identityId,
    custodians: config.recoveryCustodians,
    threshold: config.recoveryThreshold,
    delayBlocks: config.recoveryDelayBlocks,
    recoveryId: `${config.identityId}-recovery`,
  });

  const institutionalRoot = bytesToHex(sha3_256(new TextEncoder().encode(
    governanceScript + operationalScript + recoveryScript
  )));

  return { governanceScript, operationalScript, recoveryScript, institutionalRoot };
}

// ─── Succession ─────────────────────────────────────────────────────────────

export interface SuccessionConfig {
  /** The institutional root. */
  institutionalRoot: string;
  /** The current controller PKD. */
  currentControllerPkd: string;
  /** The successor controller PKD. */
  successorPkd: string;
  /** Succession becomes active at this block. */
  effectiveBlock: number;
  /** Whether the current controller must also sign. */
  requiresCurrentController: boolean;
}

/**
 * Build a succession script for planned leadership transitions.
 * Unlike emergency recovery, succession is anticipated and planned.
 */
export function buildSuccessionScript(config: SuccessionConfig): string {
  const lines = [
    `// Succession: ${config.currentControllerPkd.slice(0, 16)}… → ${config.successorPkd.slice(0, 16)}…`,
    `LET current = 0x${config.currentControllerPkd}`,
    `LET successor = 0x${config.successorPkd}`,
  ];

  if (config.requiresCurrentController) {
    lines.push(`ASSERT SIGNEDBY(current)`);
  }

  lines.push(
    `ASSERT SIGNEDBY(successor)`,
    `ASSERT @BLOCK GTE ${config.effectiveBlock}`,
    `ASSERT STATE(0) EQ successor`,
    `RETURN TRUE`,
  );

  return lines.join('\n');
}