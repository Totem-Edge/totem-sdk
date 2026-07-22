/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Data privacy and consent management templates for recursive MAST.
 *
 * These templates encode data privacy operations as KISSVM scripts
 * that can be inserted into any layer of the policy chain. Each
 * template generates a PolicyLayer ready for use with
 * buildLayeredPolicy().
 *
 * Models:
 *   Data access consent          — Granular consent with purpose limitation
 *   GDPR subject request         — Access, rectification, erasure, portability
 *   Data portability             — Structured data export with format verification
 *   Zero-knowledge proof integration — Verify claim without revealing data
 *   Data escrow                  — Time-locked or condition-locked data release
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyLayer } from '../layered-policy.js';

// ─── Data access consent ─────────────────────────────────────────────────────

export function buildDataAccessConsentScript(
  dataSubjectPkd: string,
  options: {
    consentId: string;
    dataControllerPkd: string;
    dataProcessorPkd?: string;
    purposes: string[];
    dataCategories: string[];
    retentionBlocks: number;
    thirdPartySharing: boolean;
    consentPort: number;
    revocationPort: number;
    accessLogPort: number;
  },
): PolicyLayer {
  const purposeList = options.purposes.map(p => p).join(' ');
  const catList = options.dataCategories.map(c => c).join(' ');

  const lines = [
    `// Data consent: ${options.consentId}`,
    `LET subject = 0x${dataSubjectPkd}`,
    `LET controller = 0x${options.dataControllerPkd}`,
    ``,
    `// Consent must be active`,
    `ASSERT STATE(${options.consentPort}) EQ 1`,
    `ASSERT PREVSTATE(${options.revocationPort}) EQ 0`,
    ``,
    `// Purpose limitation`,
    `ASSERT CONTAINS([${purposeList}] STATE(0))`,
    ``,
    `// Data category limitation`,
    `ASSERT CONTAINS([${catList}] STATE(1))`,
    ``,
    `// Retention period`,
    `LET consentBlock = PREVSTATE(${options.accessLogPort})`,
    `ASSERT @BLOCK SUB consentBlock LTE ${options.retentionBlocks}`,
  ];

  if (options.dataProcessorPkd) {
    lines.push(
      ``,
      `// Processor bound`,
      `ASSERT STATE(2) EQ 0x${options.dataProcessorPkd}`,
    );
  }

  if (!options.thirdPartySharing) {
    lines.push(
      ``,
      `// No third-party sharing`,
      `ASSERT STATE(3) EQ 0`,
    );
  }

  lines.push(
    ``,
    `// Access logging`,
    `LET accessCount = PREVSTATE(${options.accessLogPort})`,
    `ASSERT STATE(${options.accessLogPort}) EQ INC(accessCount)`,
    ``,
    `ASSERT SIGNEDBY(controller)`,
    `RETURN TRUE`,
  );

  return {
    id: 'data-consent',
    name: `Consent: ${options.consentId}`,
    script: lines.join('\n'),
    authorityPkd: dataSubjectPkd,
    constraints: options,
  };
}

// ─── GDPR subject request ────────────────────────────────────────────────────

export function buildGdprSubjectRequestScript(
  dataSubjectPkd: string,
  options: {
    requestId: string;
    controllerPkd: string;
    requestType: 'access' | 'rectification' | 'erasure' | 'restriction' | 'portability' | 'objection';
    requestBlock: number;
    responseDeadlineBlocks: number;
    requestPort: number;
    responsePort: number;
    compliancePort: number;
  },
): PolicyLayer {
  return {
    id: 'gdpr',
    name: `GDPR: ${options.requestId}`,
    script: [
      `// GDPR request: ${options.requestId}`,
      `// Type: ${options.requestType}`,
      `LET subject = 0x${dataSubjectPkd}`,
      `LET controller = 0x${options.controllerPkd}`,
      ``,
      `// Request filing`,
      `ASSERT STATE(${options.requestPort}) EQ [${options.requestType}]`,
      `ASSERT @BLOCK GTE ${options.requestBlock}`,
      ``,
      `// Response deadline`,
      `ASSERT @BLOCK SUB ${options.requestBlock} LTE ${options.responseDeadlineBlocks}`,
      ``,
      `// Response recorded`,
      `ASSERT STATE(${options.responsePort}) NEQ 0`,
      ``,
      `// Compliance flag`,
      `ASSERT STATE(${options.compliancePort}) EQ 1`,
      ``,
      `ASSERT SIGNEDBY(controller)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: dataSubjectPkd,
    constraints: options,
  };
}

// ─── Data portability ────────────────────────────────────────────────────────

export function buildDataPortabilityScript(
  dataSubjectPkd: string,
  options: {
    exportId: string;
    sourceControllerPkd: string;
    targetControllerPkd: string;
    format: 'json' | 'csv' | 'hl7-fhir' | 'dicom' | 'parquet';
    schemaHash: string;
    dataHash: string;
    exportBlock: number;
    integrityPort: number;
  },
): PolicyLayer {
  return {
    id: 'portability',
    name: `Portability: ${options.exportId}`,
    script: [
      `// Data portability: ${options.exportId}`,
      `// Format: ${options.format}`,
      `LET subject = 0x${dataSubjectPkd}`,
      `LET source = 0x${options.sourceControllerPkd}`,
      `LET target = 0x${options.targetControllerPkd}`,
      ``,
      `// Source controller must sign`,
      `ASSERT SIGNEDBY(source)`,
      ``,
      `// Format and schema`,
      `ASSERT STATE(0) EQ [${options.format}]`,
      `ASSERT STATE(1) EQ [${options.schemaHash}]`,
      ``,
      `// Data integrity`,
      `ASSERT STATE(2) EQ [${options.dataHash}]`,
      ``,
      `// Export timing`,
      `ASSERT @BLOCK GTE ${options.exportBlock}`,
      ``,
      `// Integrity verification`,
      `ASSERT STATE(${options.integrityPort}) EQ 1`,
      ``,
      `// Target receives the data`,
      `ASSERT VERIFYOUT(@INPUT 0x${options.targetControllerPkd} 0 @TOKENID TRUE)`,
      ``,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: dataSubjectPkd,
    constraints: options,
  };
}

// ─── Zero-knowledge proof integration ────────────────────────────────────────

export function buildZkProofIntegrationScript(
  verifierPkd: string,
  options: {
    proofId: string;
    proverPkd: string;
    circuitId: string;
    publicInputsHash: string;
    proofHash: string;
    verificationKeyHash: string;
    statement: string;
    expiryBlock: number;
    proofPort: number;
    resultPort: number;
  },
): PolicyLayer {
  return {
    id: 'zk-proof',
    name: `ZK: ${options.proofId}`,
    script: [
      `// ZK proof: ${options.proofId}`,
      `// Circuit: ${options.circuitId}`,
      `// Statement: ${options.statement}`,
      `LET verifier = 0x${verifierPkd}`,
      `LET prover = 0x${options.proverPkd}`,
      ``,
      `// Proof identity`,
      `ASSERT STATE(0) EQ [${options.proofId}]`,
      `ASSERT STATE(1) EQ [${options.circuitId}]`,
      ``,
      `// Public inputs commitment`,
      `ASSERT STATE(2) EQ [${options.publicInputsHash}]`,
      ``,
      `// Proof commitment`,
      `ASSERT STATE(${options.proofPort}) EQ [${options.proofHash}]`,
      ``,
      `// Verification key`,
      `ASSERT STATE(3) EQ [${options.verificationKeyHash}]`,
      ``,
      `// Expiry`,
      `ASSERT @BLOCK LTE ${options.expiryBlock}`,
      ``,
      `// Verification result`,
      `ASSERT STATE(${options.resultPort}) EQ 1`,
      ``,
      `ASSERT SIGNEDBY(verifier)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: verifierPkd,
    constraints: options,
  };
}

// ─── Data escrow ─────────────────────────────────────────────────────────────

export function buildDataEscrowScript(
  depositorPkd: string,
  options: {
    escrowId: string;
    beneficiaryPkd: string;
    arbiterPkd: string;
    dataHash: string;
    releaseCondition: 'time-lock' | 'event' | 'multi-sig' | 'oracle';
    releaseBlock?: number;
    oraclePort?: number;
    custodianThreshold?: number;
    custodianPkds?: string[];
    escrowPort: number;
    releasePort: number;
  },
): PolicyLayer {
  const lines = [
    `// Data escrow: ${options.escrowId}`,
    `// Condition: ${options.releaseCondition}`,
    `LET depositor = 0x${depositorPkd}`,
    `LET beneficiary = 0x${options.beneficiaryPkd}`,
    `LET arbiter = 0x${options.arbiterPkd}`,
    ``,
    `// Data commitment`,
    `ASSERT STATE(${options.escrowPort}) EQ [${options.dataHash}]`,
    ``,
    `// Release condition`,
  ];

  switch (options.releaseCondition) {
    case 'time-lock':
      if (options.releaseBlock !== undefined) {
        lines.push(`ASSERT @BLOCK GTE ${options.releaseBlock}`);
      }
      break;
    case 'event':
      if (options.oraclePort !== undefined) {
        lines.push(`ASSERT PREVSTATE(${options.oraclePort}) EQ 1`);
      }
      break;
    case 'multi-sig':
      if (options.custodianPkds && options.custodianThreshold) {
        const custodianList = options.custodianPkds.map(c => `0x${c}`).join(' ');
        lines.push(`ASSERT MULTISIG(${options.custodianThreshold} ${custodianList})`);
      }
      break;
    case 'oracle':
      if (options.oraclePort !== undefined) {
        lines.push(`ASSERT PREVSTATE(${options.oraclePort}) EQ 1`);
      }
      break;
  }

  lines.push(
    ``,
    `// Release flag`,
    `ASSERT STATE(${options.releasePort}) EQ 1`,
    ``,
    `// Arbiter can always release in dispute`,
    `ASSERT SIGNEDBY(depositor) OR SIGNEDBY(arbiter)`,
    ``,
    `RETURN TRUE`,
  );

  return {
    id: 'data-escrow',
    name: `Escrow: ${options.escrowId}`,
    script: lines.join('\n'),
    authorityPkd: depositorPkd,
    constraints: options,
  };
}
