/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Firmware Update Template — authorized firmware updates with rollback protection.
 *
 * Use case: edge-modbus, edge-can, edge-ble, edge-lorawan, edge-ros2, edge-matter
 *
 * Workflow:
 *   1. Current firmware version is read from PREVSTATE
 *   2. New firmware version must be strictly greater
 *   3. Update must be signed by the manufacturer
 *   4. Update must be authorized by the device owner's policy
 *   5. Rollback is prevented (version must increase)
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PrevStateWorkflow } from '../types.js';
import { buildPrevStateWorkflow, buildStateTransition } from '../prevstate.js';

export interface FirmwareUpdateConfig {
  /** STATE port for firmware version. */
  versionPort: number;
  /** STATE port for firmware hash. */
  hashPort: number;
  /** STATE port for manufacturer public key. */
  manufacturerPort: number;
  /** The manufacturer's public key digest. */
  manufacturerPkd: string;
  /** The device owner's public key digest. */
  ownerPkd: string;
  /** The policy root authorizing firmware updates. */
  policyRoot: string;
  /** Merkle proof that the update script is in the policy root. */
  updateProof: string;
}

/**
 * Build the KISSVM firmware update script.
 *
 * The script:
 *   1. Reads current version from PREVSTATE
 *   2. Validates new version > current version (no rollback)
 *   3. Verifies manufacturer signature over the firmware hash
 *   4. Verifies owner authorization via policy
 *   5. Preserves new version and hash in STATE
 */
export function buildFirmwareUpdateScript(config: FirmwareUpdateConfig): string {
  return [
    `// Firmware update for device owned by ${config.ownerPkd.slice(0, 16)}…`,
    `LET prevVersion = PREVSTATE(${config.versionPort})`,
    `LET newVersion = STATE(${config.versionPort})`,
    `LET newHash = STATE(${config.hashPort})`,
    `LET manufacturer = 0x${config.manufacturerPkd}`,
    `LET owner = 0x${config.ownerPkd}`,
    ``,
    `// 1. Version must increase (no rollback)`,
    `ASSERT newVersion GT prevVersion`,
    ``,
    `// 2. Manufacturer must sign the firmware hash`,
    `ASSERT SIGNEDBY(manufacturer)`,
    ``,
    `// 3. Owner must authorize via policy`,
    `ASSERT PROOF(0x${config.ownerPkd} 0 0x${config.policyRoot} 0 0x${config.updateProof})`,
    `MAST 0x${config.ownerPkd}`,
    ``,
    `// 4. Preserve new state`,
    `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
    `RETURN TRUE`,
  ].join('\n');
}

/**
 * Build a PREVSTATE workflow for firmware updates.
 */
export function buildFirmwareUpdateWorkflow(config: FirmwareUpdateConfig): PrevStateWorkflow {
  return buildPrevStateWorkflow(
    'firmware-update',
    'Firmware Update',
    [
      buildStateTransition(config.versionPort, 'version', 'newVersion', 'prevVersion', 'newVersion'),
      buildStateTransition(config.hashPort, 'hash', 'newHash', 'prevHash', 'newHash'),
    ],
    buildFirmwareUpdateScript(config),
  );
}

/**
 * Build a multi-signature firmware update script (requires N of M manufacturer signatures).
 *
 * @param manufacturerPkds - List of manufacturer public key digests.
 * @param threshold - Number of required signatures.
 */
export function buildMultiSigFirmwareUpdateScript(
  manufacturerPkds: string[],
  threshold: number,
  versionPort: number,
  hashPort: number,
  ownerPkd: string,
  policyRoot: string,
  updateProof: string,
): string {
  const signerChecks = manufacturerPkds.map(pk => `SIGNEDBY(0x${pk})`).join(', ');
  return [
    `// Multi-sig firmware update (${threshold} of ${manufacturerPkds.length})`,
    `LET prevVersion = PREVSTATE(${versionPort})`,
    `LET newVersion = STATE(${versionPort})`,
    `LET newHash = STATE(${hashPort})`,
    ``,
    `ASSERT newVersion GT prevVersion`,
    `ASSERT MULTISIG(${threshold} ${signerChecks})`,
    `ASSERT PROOF(0x${ownerPkd} 0 0x${policyRoot} 0 0x${updateProof})`,
    `MAST 0x${ownerPkd}`,
    `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
    `RETURN TRUE`,
  ].join('\n');
}
