/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Supply chain and logistics templates for recursive MAST.
 *
 * These templates encode supply chain operations as KISSVM scripts
 * that can be inserted into any layer of the policy chain. Each
 * template generates a PolicyLayer ready for use with
 * buildLayeredPolicy().
 *
 * Models:
 *   Provenance tracking        — Chain of custody with cryptographic audit
 *   Cold chain monitoring      — Temperature-bounded logistics
 *   Bill of lading             — Digital title transfer with carrier verification
 *   Customs clearance          — Multi-authority import/export verification
 *   Inventory management       — Stock level tracking with reorder triggers
 *   Quality inspection         — Multi-stage quality gate with acceptance criteria
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyLayer } from '../layered-policy.js';

// ─── Provenance tracking ─────────────────────────────────────────────────────

export function buildProvenanceScript(
  originPkd: string,
  options: {
    productId: string;
    batchId: string;
    originLocation: string;
    timestampBlock: number;
    documentHash: string;
    documentUri: string;
    previousCustodyPort: number;
    custodyCounterPort: number;
  },
): PolicyLayer {
  return {
    id: 'provenance',
    name: `Provenance: ${options.productId}`,
    script: [
      `// Provenance: ${options.productId}`,
      `// Batch: ${options.batchId}`,
      `// Origin: ${options.originLocation}`,
      `LET origin = 0x${originPkd}`,
      `ASSERT SIGNEDBY(origin)`,
      ``,
      `// Product identity`,
      `ASSERT STATE(0) EQ [${options.productId}]`,
      `ASSERT STATE(1) EQ [${options.batchId}]`,
      ``,
      `// Origin binding`,
      `ASSERT STATE(2) EQ [${options.originLocation}]`,
      `ASSERT @BLOCK GTE ${options.timestampBlock}`,
      ``,
      `// Document binding`,
      `ASSERT STATE(3) EQ [${options.documentHash}]`,
      `ASSERT STATE(4) EQ [${options.documentUri}]`,
      ``,
      `// Custody chain`,
      `LET prevCustody = PREVSTATE(${options.previousCustodyPort})`,
      `ASSERT STATE(${options.previousCustodyPort}) NEQ prevCustody`,
      `LET counter = PREVSTATE(${options.custodyCounterPort})`,
      `ASSERT STATE(${options.custodyCounterPort}) EQ INC(counter)`,
      ``,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: originPkd,
    constraints: options,
  };
}

// ─── Cold chain monitoring ───────────────────────────────────────────────────

export function buildColdChainScript(
  logisticsPkd: string,
  options: {
    shipmentId: string;
    minTemp: number;
    maxTemp: number;
    maxTempExcursionMinutes: number;
    sensorPort: number;
    excursionPort: number;
    startBlock: number;
    endBlock: number;
  },
): PolicyLayer {
  return {
    id: 'cold-chain',
    name: `Cold chain: ${options.shipmentId}`,
    script: [
      `// Cold chain: ${options.shipmentId}`,
      `// Range: ${options.minTemp}°C to ${options.maxTemp}°C`,
      `LET logistics = 0x${logisticsPkd}`,
      `ASSERT SIGNEDBY(logistics)`,
      ``,
      `// Shipment identity`,
      `ASSERT STATE(0) EQ [${options.shipmentId}]`,
      ``,
      `// Time window`,
      `ASSERT @BLOCK GTE ${options.startBlock}`,
      `ASSERT @BLOCK LTE ${options.endBlock}`,
      ``,
      `// Temperature bounds`,
      `LET temp = PREVSTATE(${options.sensorPort})`,
      `ASSERT temp GTE ${options.minTemp}`,
      `ASSERT temp LTE ${options.maxTemp}`,
      ``,
      `// Excursion tracking`,
      `LET excursion = PREVSTATE(${options.excursionPort})`,
      `ASSERT excursion LTE ${options.maxTempExcursionMinutes}`,
      ``,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: logisticsPkd,
    constraints: options,
  };
}

// ─── Bill of lading ──────────────────────────────────────────────────────────

export function buildBillOfLadingScript(
  shipperPkd: string,
  options: {
    bolId: string;
    carrierPkd: string;
    consigneePkd: string;
    origin: string;
    destination: string;
    cargoDescription: string;
    cargoValue: string;
    documentHash: string;
    issueBlock: number;
    deliveryDeadlineBlock: number;
    custodyPort: number;
  },
): PolicyLayer {
  return {
    id: 'bill-of-lading',
    name: `BoL: ${options.bolId}`,
    script: [
      `// Bill of lading: ${options.bolId}`,
      `// ${options.origin} → ${options.destination}`,
      `LET shipper = 0x${shipperPkd}`,
      `LET carrier = 0x${options.carrierPkd}`,
      `LET consignee = 0x${options.consigneePkd}`,
      ``,
      `// Issue: shipper and carrier must sign`,
      `IF STATE(${options.custodyPort}) EQ 0x${shipperPkd} THEN`,
      `  ASSERT SIGNEDBY(shipper) AND SIGNEDBY(carrier)`,
      `  ASSERT @BLOCK GTE ${options.issueBlock}`,
      `  ASSERT STATE(0) EQ [${options.bolId}]`,
      `  ASSERT STATE(1) EQ [${options.cargoDescription}]`,
      `  ASSERT STATE(2) EQ [${options.documentHash}]`,
      `ENDIF`,
      ``,
      `// Transit: carrier custody`,
      `IF STATE(${options.custodyPort}) EQ 0x${options.carrierPkd} THEN`,
      `  ASSERT SIGNEDBY(carrier)`,
      `  ASSERT @BLOCK LTE ${options.deliveryDeadlineBlock}`,
      `ENDIF`,
      ``,
      `// Delivery: consignee acceptance`,
      `IF STATE(${options.custodyPort}) EQ 0x${options.consigneePkd} THEN`,
      `  ASSERT SIGNEDBY(consignee) AND SIGNEDBY(carrier)`,
      `  ASSERT @BLOCK GTE ${options.issueBlock}`,
      `ENDIF`,
      ``,
      `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: shipperPkd,
    constraints: options,
  };
}

// ─── Customs clearance ───────────────────────────────────────────────────────

export function buildCustomsClearanceScript(
  importerPkd: string,
  options: {
    declarationId: string;
    customsAuthorityPkd: string;
    exporterPkd: string;
    originCountry: string;
    destinationCountry: string;
    hsCode: string;
    declaredValue: string;
    dutyRate: string;
    inspectionRequired: boolean;
    clearancePort: number;
    inspectionPort: number;
  },
): PolicyLayer {
  const lines = [
    `// Customs clearance: ${options.declarationId}`,
    `// ${options.originCountry} → ${options.destinationCountry}`,
    `// HS: ${options.hsCode}`,
    `LET importer = 0x${importerPkd}`,
    `LET customs = 0x${options.customsAuthorityPkd}`,
    `LET exporter = 0x${options.exporterPkd}`,
    ``,
    `// Declaration filing: importer and exporter sign`,
    `ASSERT SIGNEDBY(importer) AND SIGNEDBY(exporter)`,
    `ASSERT STATE(0) EQ [${options.declarationId}]`,
    `ASSERT STATE(1) EQ [${options.hsCode}]`,
    `ASSERT STATE(2) EQ [${options.declaredValue}]`,
  ];

  if (options.inspectionRequired) {
    lines.push(
      ``,
      `// Inspection required`,
      `ASSERT SIGNEDBY(customs)`,
      `ASSERT STATE(${options.inspectionPort}) EQ 1`,
    );
  }

  lines.push(
    ``,
    `// Duty calculation`,
    `LET duty = ${options.declaredValue} MUL ${options.dutyRate} DIV 10000`,
    `ASSERT VERIFYOUT(@INPUT 0x${options.customsAuthorityPkd} duty @TOKENID TRUE)`,
    ``,
    `// Clearance flag`,
    `ASSERT STATE(${options.clearancePort}) EQ 1`,
    ``,
    `RETURN TRUE`,
  );

  return {
    id: 'customs',
    name: `Customs: ${options.declarationId}`,
    script: lines.join('\n'),
    authorityPkd: importerPkd,
    constraints: options,
  };
}

// ─── Inventory management ────────────────────────────────────────────────────

export function buildInventoryScript(
  warehousePkd: string,
  options: {
    sku: string;
    locationId: string;
    minStock: number;
    maxStock: number;
    reorderPoint: number;
    reorderQuantity: number;
    stockPort: number;
    reorderFlagPort: number;
  },
): PolicyLayer {
  return {
    id: 'inventory',
    name: `Inventory: ${options.sku}`,
    script: [
      `// Inventory: ${options.sku}`,
      `// Location: ${options.locationId}`,
      `LET warehouse = 0x${warehousePkd}`,
      `ASSERT SIGNEDBY(warehouse)`,
      ``,
      `// SKU identity`,
      `ASSERT STATE(0) EQ [${options.sku}]`,
      `ASSERT STATE(1) EQ [${options.locationId}]`,
      ``,
      `// Stock level update`,
      `LET prevStock = PREVSTATE(${options.stockPort})`,
      `LET newStock = STATE(${options.stockPort})`,
      ``,
      `// Stock must stay within bounds`,
      `ASSERT newStock GTE ${options.minStock}`,
      `ASSERT newStock LTE ${options.maxStock}`,
      ``,
      `// Reorder trigger`,
      `IF newStock LTE ${options.reorderPoint} THEN`,
      `  ASSERT STATE(${options.reorderFlagPort}) EQ 1`,
      `ENDIF`,
      ``,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: warehousePkd,
    constraints: options,
  };
}

// ─── Quality inspection ──────────────────────────────────────────────────────

export function buildQualityInspectionScript(
  inspectorPkd: string,
  options: {
    lotId: string;
    standardId: string;
    sampleSize: number;
    acceptDefects: number;
    defectPort: number;
    resultPort: number;
    inspectorNotesHash: string;
  },
): PolicyLayer {
  return {
    id: 'quality',
    name: `Quality: ${options.lotId}`,
    script: [
      `// Quality inspection: ${options.lotId}`,
      `// Standard: ${options.standardId}`,
      `// Sample: ${options.sampleSize}, max defects: ${options.acceptDefects}`,
      `LET inspector = 0x${inspectorPkd}`,
      `ASSERT SIGNEDBY(inspector)`,
      ``,
      `// Lot identity`,
      `ASSERT STATE(0) EQ [${options.lotId}]`,
      `ASSERT STATE(1) EQ [${options.standardId}]`,
      ``,
      `// Defect count`,
      `LET defects = STATE(${options.defectPort})`,
      `ASSERT defects LTE ${options.acceptDefects}`,
      ``,
      `// Result: 1 = accepted, 0 = rejected`,
      `ASSERT STATE(${options.resultPort}) EQ 1`,
      ``,
      `// Inspector notes binding`,
      `ASSERT STATE(2) EQ [${options.inspectorNotesHash}]`,
      ``,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: inspectorPkd,
    constraints: options,
  };
}
