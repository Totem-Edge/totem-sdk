/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Standard layer templates for the 7-layer policy chain.
 *
 * Each template generates a KISSVM script for a specific layer in the
 * authority chain. Templates are composable — pick the layers you need
 * and buildLayeredPolicy() chains them together via nested MAST.
 *
 * Layer types:
 *   Asset root       — The thing being governed (device, vehicle, building)
 *   Manufacturer     — OEM policy: model limits, firmware signing, warranty
 *   Product/model    — Product-line or model-specific constraints
 *   Regulatory       — Jurisdiction, standards, compliance
 *   Owner/fleet      — Purchaser, lessor, fleet manager
 *   Site             — Physical location, plant, depot
 *   Operator         — Technician, driver, user
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyLayer } from '../layered-policy.js';

// ─── Asset layer ────────────────────────────────────────────────────────────

export function assetLayer(
  assetId: string,
  assetName: string,
): PolicyLayer {
  return {
    id: 'asset',
    name: assetName,
    script: [
      `// Asset: ${assetName}`,
      `LET assetId = [${assetId}]`,
      `ASSERT STATE(0) EQ assetId`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: '',
  };
}

// ─── Manufacturer layer ─────────────────────────────────────────────────────

export function manufacturerLayer(
  manufacturerPkd: string,
  manufacturerName: string,
  options?: {
    modelId?: string;
    maxFirmwareVersion?: number;
    requiredSignatures?: number;
  },
): PolicyLayer {
  const lines = [
    `// Manufacturer: ${manufacturerName}`,
    `LET mfg = 0x${manufacturerPkd}`,
    `ASSERT SIGNEDBY(mfg)`,
  ];
  if (options?.modelId) {
    lines.push(`LET modelId = [${options.modelId}]`);
    lines.push(`ASSERT STATE(1) EQ modelId`);
  }
  if (options?.maxFirmwareVersion !== undefined) {
    lines.push(`ASSERT STATE(2) LTE ${options.maxFirmwareVersion}`);
  }
  if (options?.requiredSignatures && options.requiredSignatures > 1) {
    lines.push(`ASSERT MULTISIG(${options.requiredSignatures} mfg)`);
  }
  lines.push(`RETURN TRUE`);

  return {
    id: 'manufacturer',
    name: manufacturerName,
    script: lines.join('\n'),
    authorityPkd: manufacturerPkd,
    constraints: options,
  };
}

// ─── Product/model layer ────────────────────────────────────────────────────

export function productLayer(
  productPkd: string,
  productName: string,
  modelId: string,
): PolicyLayer {
  return {
    id: 'product',
    name: productName,
    script: [
      `// Product: ${productName}`,
      `LET product = 0x${productPkd}`,
      `ASSERT SIGNEDBY(product)`,
      `ASSERT STATE(1) EQ [${modelId}]`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: productPkd,
    constraints: { modelId },
  };
}

// ─── Regulatory layer ───────────────────────────────────────────────────────

export function regulatoryLayer(
  regulatorPkd: string,
  jurisdiction: string,
  regulation: string,
  options?: {
    expiryBlock?: number;
    requiredStandards?: string[];
  },
): PolicyLayer {
  const lines = [
    `// Regulatory: ${jurisdiction} — ${regulation}`,
    `LET regulator = 0x${regulatorPkd}`,
    `ASSERT SIGNEDBY(regulator)`,
    `ASSERT STATE(2) EQ [${jurisdiction}]`,
    `ASSERT STATE(3) EQ [${regulation}]`,
  ];
  if (options?.expiryBlock !== undefined) {
    lines.push(`ASSERT @BLOCK LTE ${options.expiryBlock}`);
  }
  if (options?.requiredStandards) {
    for (const std of options.requiredStandards) {
      lines.push(`ASSERT STATE(4) EQ [${std}]`);
    }
  }
  lines.push(`RETURN TRUE`);

  return {
    id: 'regulatory',
    name: `${jurisdiction} — ${regulation}`,
    script: lines.join('\n'),
    authorityPkd: regulatorPkd,
    constraints: { jurisdiction, regulation, ...options },
  };
}

// ─── Owner/fleet layer ──────────────────────────────────────────────────────

export function ownerLayer(
  ownerPkd: string,
  ownerName: string,
  options?: {
    fleetId?: string;
    maxOperatingHours?: number;
    geoFence?: string[];
  },
): PolicyLayer {
  const lines = [
    `// Owner: ${ownerName}`,
    `LET owner = 0x${ownerPkd}`,
    `ASSERT SIGNEDBY(owner)`,
  ];
  if (options?.fleetId) {
    lines.push(`ASSERT STATE(5) EQ [${options.fleetId}]`);
  }
  if (options?.maxOperatingHours !== undefined) {
    lines.push(`ASSERT STATE(6) LTE ${options.maxOperatingHours}`);
  }
  if (options?.geoFence && options.geoFence.length > 0) {
    const fenceList = options.geoFence.map(g => g).join(' ');
    lines.push(`ASSERT CONTAINS([${fenceList}] STATE(7))`);
  }
  lines.push(`RETURN TRUE`);

  return {
    id: 'owner',
    name: ownerName,
    script: lines.join('\n'),
    authorityPkd: ownerPkd,
    constraints: options,
  };
}

// ─── Site layer ─────────────────────────────────────────────────────────────

export function siteLayer(
  sitePkd: string,
  siteName: string,
  options?: {
    siteId?: string;
    safetyZone?: string;
    maxPersonnel?: number;
  },
): PolicyLayer {
  const lines = [
    `// Site: ${siteName}`,
    `LET site = 0x${sitePkd}`,
    `ASSERT SIGNEDBY(site)`,
  ];
  if (options?.siteId) {
    lines.push(`ASSERT STATE(8) EQ [${options.siteId}]`);
  }
  if (options?.safetyZone) {
    lines.push(`ASSERT STATE(9) EQ [${options.safetyZone}]`);
  }
  if (options?.maxPersonnel !== undefined) {
    lines.push(`ASSERT STATE(10) LTE ${options.maxPersonnel}`);
  }
  lines.push(`RETURN TRUE`);

  return {
    id: 'site',
    name: siteName,
    script: lines.join('\n'),
    authorityPkd: sitePkd,
    constraints: options,
  };
}

// ─── Operator layer ─────────────────────────────────────────────────────────

export function operatorLayer(
  operatorPkd: string,
  operatorName: string,
  options?: {
    certificationId?: string;
    maxCommandDuration?: number;
    allowedCommands?: string[];
    requiresCoSigner?: string;
  },
): PolicyLayer {
  const lines = [
    `// Operator: ${operatorName}`,
    `LET operator = 0x${operatorPkd}`,
    `ASSERT SIGNEDBY(operator)`,
  ];
  if (options?.certificationId) {
    lines.push(`ASSERT STATE(11) EQ [${options.certificationId}]`);
  }
  if (options?.maxCommandDuration !== undefined) {
    lines.push(`ASSERT STATE(12) LTE ${options.maxCommandDuration}`);
  }
  if (options?.allowedCommands && options.allowedCommands.length > 0) {
    const cmdList = options.allowedCommands.map(c => c).join(' ');
    lines.push(`ASSERT CONTAINS([${cmdList}] STATE(13))`);
  }
  if (options?.requiresCoSigner) {
    lines.push(`ASSERT SIGNEDBY(0x${options.requiresCoSigner})`);
  }
  lines.push(`RETURN TRUE`);

  return {
    id: 'operator',
    name: operatorName,
    script: lines.join('\n'),
    authorityPkd: operatorPkd,
    constraints: options,
  };
}

// ─── Emergency override layer ───────────────────────────────────────────────

export function emergencyLayer(
  securityPkd: string,
  options?: {
    vulnerabilityId?: string;
    maxDuration?: number;
    requiresTwoPerson?: boolean;
  },
): PolicyLayer {
  const lines = [
    `// Emergency override`,
    `LET security = 0x${securityPkd}`,
    `ASSERT SIGNEDBY(security)`,
  ];
  if (options?.vulnerabilityId) {
    lines.push(`ASSERT STATE(14) EQ [${options.vulnerabilityId}]`);
  }
  if (options?.maxDuration !== undefined) {
    lines.push(`ASSERT STATE(15) LTE ${options.maxDuration}`);
  }
  if (options?.requiresTwoPerson) {
    lines.push(`ASSERT MULTISIG(2 security)`);
  }
  lines.push(`RETURN TRUE`);

  return {
    id: 'emergency',
    name: 'Emergency Security Override',
    script: lines.join('\n'),
    authorityPkd: securityPkd,
    constraints: options,
  };
}