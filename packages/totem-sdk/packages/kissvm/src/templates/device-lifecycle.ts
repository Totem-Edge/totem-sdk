/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Device lifecycle templates for recursive MAST.
 *
 * These templates cover the full device lifecycle:
 *   Commissioning → Operation → Transfer → Recovery → Decommissioning
 *
 * Each template generates a PolicyLayer that can be inserted into the
 * layered policy chain.
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyLayer } from '../mast/layered-policy.js';

// ─── Device commissioning ───────────────────────────────────────────────────

export function commissioningLayer(
  manufacturerPkd: string,
  options: {
    deviceId: string;
    installerPkd: string;
    sitePkd: string;
    acceptanceBlock?: number;
  },
): PolicyLayer {
  return {
    id: 'commissioning',
    name: `Commissioning: ${options.deviceId}`,
    script: [
      `// Commissioning: ${options.deviceId}`,
      `LET mfg = 0x${manufacturerPkd}`,
      `LET installer = 0x${options.installerPkd}`,
      `LET site = 0x${options.sitePkd}`,
      `ASSERT SIGNEDBY(mfg) AND SIGNEDBY(installer) AND SIGNEDBY(site)`,
      `ASSERT STATE(0) EQ [${options.deviceId}]`,
      options.acceptanceBlock !== undefined
        ? `ASSERT @BLOCK GTE ${options.acceptanceBlock}`
        : '',
      `RETURN TRUE`,
    ].filter(Boolean).join('\n'),
    authorityPkd: manufacturerPkd,
    constraints: options,
  };
}

// ─── Device ownership transfer ──────────────────────────────────────────────

export function transferLayer(
  currentOwnerPkd: string,
  options: {
    deviceId: string;
    newOwnerPkd: string;
    financePkd?: string;
    transferBlock: number;
  },
): PolicyLayer {
  const signers = [`SIGNEDBY(0x${currentOwnerPkd})`];
  if (options.financePkd) {
    signers.push(`SIGNEDBY(0x${options.financePkd})`);
  }

  return {
    id: 'transfer',
    name: `Transfer: ${options.deviceId}`,
    script: [
      `// Ownership transfer: ${options.deviceId}`,
      `LET oldOwner = 0x${currentOwnerPkd}`,
      `LET newOwner = 0x${options.newOwnerPkd}`,
      `ASSERT ${signers.join(' AND ')}`,
      `ASSERT @BLOCK GTE ${options.transferBlock}`,
      `ASSERT STATE(0) EQ [${options.deviceId}]`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: currentOwnerPkd,
    constraints: options,
  };
}

// ─── Cryptographic key rotation ─────────────────────────────────────────────

export function keyRotationLayer(
  devicePkd: string,
  options: {
    oldKeyPkd: string;
    newKeyPkd: string;
    recoveryPkd?: string;
    rotationBlock: number;
  },
): PolicyLayer {
  const signers = [`SIGNEDBY(0x${options.oldKeyPkd})`];
  if (options.recoveryPkd) {
    signers.push(`SIGNEDBY(0x${options.recoveryPkd})`);
  }

  return {
    id: 'key-rotation',
    name: `Key rotation: ${options.oldKeyPkd.slice(0, 16)}… → ${options.newKeyPkd.slice(0, 16)}…`,
    script: [
      `// Key rotation`,
      `LET oldKey = 0x${options.oldKeyPkd}`,
      `LET newKey = 0x${options.newKeyPkd}`,
      `ASSERT ${signers.join(' OR ')}`,
      `ASSERT @BLOCK GTE ${options.rotationBlock}`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: devicePkd,
    constraints: options,
  };
}

// ─── Compromised key recovery ───────────────────────────────────────────────

export function recoveryLayer(
  options: {
    primaryPkd: string;
    custodians: string[];
    threshold: number;
    recoveryId: string;
    expiryBlock: number;
  },
): PolicyLayer {
  const custodianList = options.custodians.map(c => `0x${c}`).join(' ');

  return {
    id: 'recovery',
    name: `Recovery: ${options.recoveryId}`,
    script: [
      `// Compromised key recovery: ${options.recoveryId}`,
      `ASSERT MULTISIG(${options.threshold} ${custodianList})`,
      `ASSERT @BLOCK LTE ${options.expiryBlock}`,
      `ASSERT STATE(0) EQ [${options.recoveryId}]`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: options.primaryPkd,
    constraints: options,
  };
}

// ─── Secure decommissioning ─────────────────────────────────────────────────

export function decommissioningLayer(
  ownerPkd: string,
  options: {
    deviceId: string;
    environmentalPkd?: string;
    recyclerPkd: string;
    decommissionBlock: number;
  },
): PolicyLayer {
  const signers = [`SIGNEDBY(0x${ownerPkd})`, `SIGNEDBY(0x${options.recyclerPkd})`];
  if (options.environmentalPkd) {
    signers.push(`SIGNEDBY(0x${options.environmentalPkd})`);
  }

  return {
    id: 'decommissioning',
    name: `Decommissioning: ${options.deviceId}`,
    script: [
      `// Decommissioning: ${options.deviceId}`,
      `ASSERT ${signers.join(' AND ')}`,
      `ASSERT @BLOCK GTE ${options.decommissionBlock}`,
      `ASSERT STATE(0) EQ [${options.deviceId}]`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: ownerPkd,
    constraints: options,
  };
}

// ─── Remote support session ─────────────────────────────────────────────────

export function remoteSupportLayer(
  customerPkd: string,
  options: {
    sessionId: string;
    technicianPkd: string;
    oemPkd: string;
    startBlock: number;
    maxDuration: number;
    allowedCommands: string[];
  },
): PolicyLayer {
  const cmdList = options.allowedCommands.map(c => c).join(' ');

  return {
    id: 'remote-support',
    name: `Remote support: ${options.sessionId}`,
    script: [
      `// Remote support: ${options.sessionId}`,
      `LET customer = 0x${customerPkd}`,
      `LET tech = 0x${options.technicianPkd}`,
      `LET oem = 0x${options.oemPkd}`,
      `ASSERT SIGNEDBY(customer) AND SIGNEDBY(tech) AND SIGNEDBY(oem)`,
      `ASSERT @BLOCK GTE ${options.startBlock}`,
      `ASSERT @BLOCK SUB ${options.startBlock} LTE ${options.maxDuration}`,
      `ASSERT CONTAINS([${cmdList}] STATE(0))`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: customerPkd,
    constraints: options,
  };
}

// ─── Configuration profile deployment ───────────────────────────────────────

export function configurationProfileLayer(
  sitePkd: string,
  options: {
    profileId: string;
    deviceId: string;
    baselinePkd?: string;
    industryPkd?: string;
    settingsHash: string;
  },
): PolicyLayer {
  const signers = [`SIGNEDBY(0x${sitePkd})`];
  if (options.baselinePkd) signers.push(`SIGNEDBY(0x${options.baselinePkd})`);
  if (options.industryPkd) signers.push(`SIGNEDBY(0x${options.industryPkd})`);

  return {
    id: 'config-profile',
    name: `Config: ${options.profileId}`,
    script: [
      `// Configuration profile: ${options.profileId}`,
      `ASSERT ${signers.join(' AND ')}`,
      `ASSERT STATE(0) EQ [${options.deviceId}]`,
      `ASSERT STATE(1) EQ [${options.settingsHash}]`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: sitePkd,
    constraints: options,
  };
}

// ─── Device certificate issuance ────────────────────────────────────────────

export function certificateIssuanceLayer(
  manufacturerPkd: string,
  options: {
    deviceId: string;
    supplyChainPkd?: string;
    deployerPkd: string;
    networkPkd: string;
    certificateExpiry: number;
  },
): PolicyLayer {
  const signers = [
    `SIGNEDBY(0x${manufacturerPkd})`,
    `SIGNEDBY(0x${options.deployerPkd})`,
    `SIGNEDBY(0x${options.networkPkd})`,
  ];
  if (options.supplyChainPkd) {
    signers.push(`SIGNEDBY(0x${options.supplyChainPkd})`);
  }

  return {
    id: 'certificate',
    name: `Certificate: ${options.deviceId}`,
    script: [
      `// Device certificate: ${options.deviceId}`,
      `ASSERT ${signers.join(' AND ')}`,
      `ASSERT @BLOCK LTE ${options.certificateExpiry}`,
      `ASSERT STATE(0) EQ [${options.deviceId}]`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: manufacturerPkd,
    constraints: options,
  };
}