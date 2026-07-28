/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Commercial and financial model templates for recursive MAST.
 *
 * These templates encode business logic as KISSVM scripts that can be
 * inserted into any layer of the policy chain. Each template generates
 * a PolicyLayer ready for use with buildLayeredPolicy().
 *
 * Models:
 *   Machine-as-a-Service      — Usage entitlement, metered operation
 *   Pay-per-use               — Paid operation cycles
 *   Feature licensing          — Software feature activation
 *   Warranty-conditioned       — Maintenance schedule compliance
 *   Automated escrow           — Verified work → payment release
 *   Equipment leasing          — Lessor → lessee control
 *   Telemetry licensing        — Data access with expiry
 *   Carbon/energy programmes   — Metered incentive verification
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyLayer } from '../layered-policy.js';

// ─── Machine-as-a-Service ───────────────────────────────────────────────────

export function maasLayer(
  financePkd: string,
  options: {
    contractId: string;
    maxCycles?: number;
    ratePerCycle?: string;
    expiryBlock?: number;
  },
): PolicyLayer {
  const lines = [
    `// Machine-as-a-Service: ${options.contractId}`,
    `LET finance = 0x${financePkd}`,
    `ASSERT SIGNEDBY(finance)`,
    `ASSERT STATE(20) EQ [${options.contractId}]`,
  ];
  if (options.maxCycles !== undefined) {
    lines.push(`LET cycleCount = PREVSTATE(21)`);
    lines.push(`ASSERT INC(cycleCount) LTE ${options.maxCycles}`);
  }
  if (options.ratePerCycle !== undefined) {
    lines.push(`ASSERT @AMOUNT EQ ${options.ratePerCycle}`);
  }
  if (options.expiryBlock !== undefined) {
    lines.push(`ASSERT @BLOCK LTE ${options.expiryBlock}`);
  }
  lines.push(`RETURN TRUE`);

  return {
    id: 'maas',
    name: `MaaS: ${options.contractId}`,
    script: lines.join('\n'),
    authorityPkd: financePkd,
    constraints: options,
  };
}

// ─── Pay-per-use ────────────────────────────────────────────────────────────

export function payPerUseLayer(
  providerPkd: string,
  options: {
    contractId: string;
    ratePerUnit: string;
    maxUnitsPerTx?: number;
    tokenId?: string;
  },
): PolicyLayer {
  const lines = [
    `// Pay-per-use: ${options.contractId}`,
    `LET provider = 0x${providerPkd}`,
    `LET units = STATE(20)`,
    `LET total = units MUL ${options.ratePerUnit}`,
    `ASSERT SIGNEDBY(provider)`,
    `ASSERT @AMOUNT EQ total`,
    `ASSERT @TOKENID EQ [${options.tokenId ?? '0x00'}]`,
  ];
  if (options.maxUnitsPerTx !== undefined) {
    lines.push(`ASSERT units LTE ${options.maxUnitsPerTx}`);
  }
  lines.push(`RETURN TRUE`);

  return {
    id: 'pay-per-use',
    name: `Pay-per-use: ${options.contractId}`,
    script: lines.join('\n'),
    authorityPkd: providerPkd,
    constraints: options,
  };
}

// ─── Feature licensing ──────────────────────────────────────────────────────

export function featureLicenseLayer(
  oemPkd: string,
  options: {
    featureId: string;
    featureName: string;
    region?: string;
    expiryBlock?: number;
    subscriptionTier?: string;
  },
): PolicyLayer {
  const lines = [
    `// Feature license: ${options.featureId}`,
    `LET oem = 0x${oemPkd}`,
    `ASSERT SIGNEDBY(oem)`,
    `ASSERT STATE(20) EQ [${options.featureId}]`,
  ];
  if (options.region) {
    lines.push(`ASSERT STATE(21) EQ [${options.region}]`);
  }
  if (options.expiryBlock !== undefined) {
    lines.push(`ASSERT @BLOCK LTE ${options.expiryBlock}`);
  }
  if (options.subscriptionTier) {
    lines.push(`ASSERT STATE(22) GTE [${options.subscriptionTier}]`);
  }
  lines.push(`RETURN TRUE`);

  return {
    id: 'feature-license',
    name: `Feature: ${options.featureName}`,
    script: lines.join('\n'),
    authorityPkd: oemPkd,
    constraints: options,
  };
}

// ─── Warranty-conditioned servicing ─────────────────────────────────────────

export function warrantyLayer(
  manufacturerPkd: string,
  options: {
    warrantyId: string;
    maintenanceSchedule: string;
    authorisedParts?: string[];
    certifiedTechnicianPkd?: string;
  },
): PolicyLayer {
  const lines = [
    `// Warranty: ${options.warrantyId}`,
    `LET mfg = 0x${manufacturerPkd}`,
    `ASSERT SIGNEDBY(mfg)`,
    `ASSERT STATE(20) EQ [${options.maintenanceSchedule}]`,
  ];
  if (options.authorisedParts && options.authorisedParts.length > 0) {
    const partsList = options.authorisedParts.map(p => p).join(' ');
    lines.push(`ASSERT CONTAINS([${partsList}] STATE(21))`);
  }
  if (options.certifiedTechnicianPkd) {
    lines.push(`ASSERT SIGNEDBY(0x${options.certifiedTechnicianPkd})`);
  }
  lines.push(`RETURN TRUE`);

  return {
    id: 'warranty',
    name: `Warranty: ${options.warrantyId}`,
    script: lines.join('\n'),
    authorityPkd: manufacturerPkd,
    constraints: options,
  };
}

// ─── Automated maintenance escrow ───────────────────────────────────────────

export function escrowLayer(
  escrowPkd: string,
  options: {
    escrowId: string;
    workOrderId: string;
    requiredEvidence: string[];
    paymentAmount: string;
    beneficiaryPkd: string;
  },
): PolicyLayer {
  const evidenceChecks = options.requiredEvidence.map((e, i) =>
    `ASSERT STATE(${30 + i}) EQ [${e}]`,
  );

  return {
    id: 'escrow',
    name: `Escrow: ${options.escrowId}`,
    script: [
      `// Escrow: ${options.escrowId}`,
      `LET escrow = 0x${escrowPkd}`,
      `ASSERT SIGNEDBY(escrow)`,
      `ASSERT STATE(20) EQ [${options.workOrderId}]`,
      ...evidenceChecks,
      `ASSERT VERIFYOUT(@INPUT 0x${options.beneficiaryPkd} ${options.paymentAmount} @TOKENID TRUE)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: escrowPkd,
    constraints: options,
  };
}

// ─── Equipment leasing ──────────────────────────────────────────────────────

export function leasingLayer(
  lessorPkd: string,
  options: {
    leaseId: string;
    lesseePkd: string;
    startBlock: number;
    endBlock: number;
    maxOperatingHours?: number;
    restrictedCommands?: string[];
  },
): PolicyLayer {
  const lines = [
    `// Lease: ${options.leaseId}`,
    `LET lessor = 0x${lessorPkd}`,
    `LET lessee = 0x${options.lesseePkd}`,
    `ASSERT SIGNEDBY(lessor) OR SIGNEDBY(lessee)`,
    `ASSERT @BLOCK GTE ${options.startBlock}`,
    `ASSERT @BLOCK LTE ${options.endBlock}`,
  ];
  if (options.maxOperatingHours !== undefined) {
    lines.push(`ASSERT PREVSTATE(20) LTE ${options.maxOperatingHours}`);
  }
  if (options.restrictedCommands && options.restrictedCommands.length > 0) {
    const cmdList = options.restrictedCommands.map(c => c).join(' ');
    lines.push(`ASSERT NOT CONTAINS([${cmdList}] STATE(21))`);
  }
  lines.push(`RETURN TRUE`);

  return {
    id: 'leasing',
    name: `Lease: ${options.leaseId}`,
    script: lines.join('\n'),
    authorityPkd: lessorPkd,
    constraints: options,
  };
}

// ─── Telemetry data licensing ───────────────────────────────────────────────

export function telemetryLicenseLayer(
  dataOwnerPkd: string,
  options: {
    licenseId: string;
    dataBuyerPkd: string;
    permittedCategories: string[];
    expiryBlock: number;
    maxDataAge?: number;
  },
): PolicyLayer {
  const catList = options.permittedCategories.map(c => c).join(' ');

  const lines = [
    `// Telemetry license: ${options.licenseId}`,
    `LET owner = 0x${dataOwnerPkd}`,
    `LET buyer = 0x${options.dataBuyerPkd}`,
    `ASSERT SIGNEDBY(owner)`,
    `ASSERT CONTAINS([${catList}] STATE(20))`,
    `ASSERT @BLOCK LTE ${options.expiryBlock}`,
  ];
  if (options.maxDataAge !== undefined) {
    lines.push(`ASSERT @BLOCK SUB STATE(21) LTE ${options.maxDataAge}`);
  }
  lines.push(`RETURN TRUE`);

  return {
    id: 'telemetry',
    name: `Telemetry: ${options.licenseId}`,
    script: lines.join('\n'),
    authorityPkd: dataOwnerPkd,
    constraints: options,
  };
}

// ─── Carbon/energy programme ────────────────────────────────────────────────

export function carbonProgrammeLayer(
  programmePkd: string,
  options: {
    programmeId: string;
    methodology: string;
    verifierPkd: string;
    incentiveRate: string;
    requiredMeterPort: number;
  },
): PolicyLayer {
  return {
    id: 'carbon',
    name: `Carbon: ${options.programmeId}`,
    script: [
      `// Carbon programme: ${options.programmeId}`,
      `LET programme = 0x${programmePkd}`,
      `LET verifier = 0x${options.verifierPkd}`,
      `ASSERT SIGNEDBY(programme) AND SIGNEDBY(verifier)`,
      `ASSERT STATE(20) EQ [${options.methodology}]`,
      `LET reading = PREVSTATE(${options.requiredMeterPort})`,
      `LET incentive = reading MUL ${options.incentiveRate}`,
      `ASSERT VERIFYOUT(@INPUT 0x${programmePkd} incentive @TOKENID TRUE)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: programmePkd,
    constraints: options,
  };
}

// ─── Usage-based insurance ──────────────────────────────────────────────────

export function usageBasedInsuranceLayer(
  insurerPkd: string,
  options: {
    policyId: string;
    driverPkd: string;
    maxSpeed?: number;
    geoFence?: string[];
    maxNightDriving?: number;
    requiredTelemetryPorts: number[];
  },
): PolicyLayer {
  const lines = [
    `// Insurance: ${options.policyId}`,
    `LET insurer = 0x${insurerPkd}`,
    `LET driver = 0x${options.driverPkd}`,
    `ASSERT SIGNEDBY(insurer)`,
    `ASSERT STATE(20) EQ [${options.policyId}]`,
  ];
  if (options.maxSpeed !== undefined) {
    lines.push(`ASSERT PREVSTATE(21) LTE ${options.maxSpeed}`);
  }
  if (options.geoFence && options.geoFence.length > 0) {
    const fence = options.geoFence.map(g => g).join(' ');
    lines.push(`ASSERT CONTAINS([${fence}] PREVSTATE(22))`);
  }
  if (options.maxNightDriving !== undefined) {
    lines.push(`ASSERT PREVSTATE(23) LTE ${options.maxNightDriving}`);
  }
  lines.push(`RETURN TRUE`);

  return {
    id: 'insurance',
    name: `Insurance: ${options.policyId}`,
    script: lines.join('\n'),
    authorityPkd: insurerPkd,
    constraints: options,
  };
}

// ─── Vehicle-to-grid participation ──────────────────────────────────────────

export function vehicleToGridLayer(
  gridOperatorPkd: string,
  options: {
    agreementId: string;
    batteryWarrantyPkd: string;
    maxExportKw: number;
    maxDischargePercent: number;
    incentiveRate: string;
  },
): PolicyLayer {
  return {
    id: 'v2g',
    name: `V2G: ${options.agreementId}`,
    script: [
      `// Vehicle-to-grid: ${options.agreementId}`,
      `LET grid = 0x${gridOperatorPkd}`,
      `LET warranty = 0x${options.batteryWarrantyPkd}`,
      `ASSERT SIGNEDBY(grid) AND SIGNEDBY(warranty)`,
      `ASSERT STATE(20) LTE ${options.maxExportKw}`,
      `ASSERT STATE(21) GTE ${options.maxDischargePercent}`,
      `LET export = STATE(20)`,
      `LET incentive = export MUL ${options.incentiveRate}`,
      `ASSERT VERIFYOUT(@INPUT 0x${gridOperatorPkd} incentive @TOKENID TRUE)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: gridOperatorPkd,
    constraints: options,
  };
}