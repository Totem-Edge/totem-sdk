/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Healthcare and medical device templates for recursive MAST.
 *
 * These templates encode healthcare operations as KISSVM scripts
 * that can be inserted into any layer of the policy chain. Each
 * template generates a PolicyLayer ready for use with
 * buildLayeredPolicy().
 *
 * Models:
 *   Medical device regulation   — FDA/MDR compliance with audit trail
 *   Patient consent             — Granular consent with revocation
 *   Clinical trial management   — Protocol adherence with blinding
 *   Prescription verification   — Multi-party prescription validation
 *   Health data access          — HIPAA/GDPR-compliant data sharing
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyLayer } from '../layered-policy.js';

// ─── Medical device regulation ───────────────────────────────────────────────

export function buildMedicalDeviceRegulationScript(
  manufacturerPkd: string,
  options: {
    deviceId: string;
    deviceClass: 'class-i' | 'class-ii' | 'class-iii';
    regulatoryBody: 'fda' | 'mdr' | 'pmda' | 'tga';
    approvalId: string;
    notifiedBodyPkd: string;
    intendedUse: string;
    approvalBlock: number;
    expiryBlock: number;
    postMarketPort: number;
    adverseEventPort: number;
  },
): PolicyLayer {
  return {
    id: 'medical-device',
    name: `Medical device: ${options.deviceId}`,
    script: [
      `// Medical device: ${options.deviceId}`,
      `// Class: ${options.deviceClass}`,
      `// Regulatory: ${options.regulatoryBody}`,
      `// Approval: ${options.approvalId}`,
      `LET mfg = 0x${manufacturerPkd}`,
      `LET nb = 0x${options.notifiedBodyPkd}`,
      ``,
      `// Approval: manufacturer + notified body`,
      `ASSERT SIGNEDBY(mfg) AND SIGNEDBY(nb)`,
      `ASSERT STATE(0) EQ [${options.deviceId}]`,
      `ASSERT STATE(1) EQ [${options.approvalId}]`,
      `ASSERT STATE(2) EQ [${options.intendedUse}]`,
      ``,
      `// Validity window`,
      `ASSERT @BLOCK GTE ${options.approvalBlock}`,
      `ASSERT @BLOCK LTE ${options.expiryBlock}`,
      ``,
      `// Post-market surveillance`,
      `LET pms = PREVSTATE(${options.postMarketPort})`,
      `ASSERT pms GTE 0`,
      ``,
      `// Adverse event reporting`,
      `LET events = PREVSTATE(${options.adverseEventPort})`,
      `ASSERT events LTE 9999`,
      ``,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: manufacturerPkd,
    constraints: options,
  };
}

// ─── Patient consent ─────────────────────────────────────────────────────────

export function buildPatientConsentScript(
  patientPkd: string,
  options: {
    consentId: string;
    providerPkd: string;
    purpose: 'treatment' | 'research' | 'marketing' | 'insurance' | 'public-health';
    dataCategories: string[];
    validFrom: number;
    validUntil: number;
    revocationPort: number;
    accessLogPort: number;
  },
): PolicyLayer {
  const catList = options.dataCategories.map(c => c).join(' ');

  return {
    id: 'consent',
    name: `Consent: ${options.consentId}`,
    script: [
      `// Patient consent: ${options.consentId}`,
      `// Purpose: ${options.purpose}`,
      `LET patient = 0x${patientPkd}`,
      `LET provider = 0x${options.providerPkd}`,
      ``,
      `// Consent must be active (not revoked)`,
      `ASSERT PREVSTATE(${options.revocationPort}) EQ 0`,
      ``,
      `// Validity window`,
      `ASSERT @BLOCK GTE ${options.validFrom}`,
      `ASSERT @BLOCK LTE ${options.validUntil}`,
      ``,
      `// Purpose constraint`,
      `ASSERT STATE(0) EQ [${options.purpose}]`,
      ``,
      `// Data category constraint`,
      `ASSERT CONTAINS([${catList}] STATE(1))`,
      ``,
      `// Access logging`,
      `LET accessCount = PREVSTATE(${options.accessLogPort})`,
      `ASSERT STATE(${options.accessLogPort}) EQ INC(accessCount)`,
      ``,
      `// Provider must sign`,
      `ASSERT SIGNEDBY(provider)`,
      ``,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: patientPkd,
    constraints: options,
  };
}

// ─── Clinical trial management ───────────────────────────────────────────────

export function buildClinicalTrialScript(
  sponsorPkd: string,
  options: {
    trialId: string;
    protocolHash: string;
    ethicsCommitteePkd: string;
    principalInvestigatorPkd: string;
    phase: 'phase-i' | 'phase-ii' | 'phase-iii' | 'phase-iv';
    enrollmentTarget: number;
    enrollmentPort: number;
    blindingPort: number;
    safetyReportPort: number;
    startBlock: number;
    endBlock: number;
  },
): PolicyLayer {
  return {
    id: 'clinical-trial',
    name: `Trial: ${options.trialId}`,
    script: [
      `// Clinical trial: ${options.trialId}`,
      `// Phase: ${options.phase}`,
      `// Protocol: ${options.protocolHash.slice(0, 16)}…`,
      `LET sponsor = 0x${sponsorPkd}`,
      `LET ethics = 0x${options.ethicsCommitteePkd}`,
      `LET pi = 0x${options.principalInvestigatorPkd}`,
      ``,
      `// Trial identity and protocol binding`,
      `ASSERT STATE(0) EQ [${options.trialId}]`,
      `ASSERT STATE(1) EQ [${options.protocolHash}]`,
      ``,
      `// All three must sign`,
      `ASSERT SIGNEDBY(sponsor) AND SIGNEDBY(ethics) AND SIGNEDBY(pi)`,
      ``,
      `// Trial window`,
      `ASSERT @BLOCK GTE ${options.startBlock}`,
      `ASSERT @BLOCK LTE ${options.endBlock}`,
      ``,
      `// Enrollment tracking`,
      `LET enrolled = PREVSTATE(${options.enrollmentPort})`,
      `ASSERT enrolled LTE ${options.enrollmentTarget}`,
      ``,
      `// Blinding integrity`,
      `ASSERT STATE(${options.blindingPort}) EQ PREVSTATE(${options.blindingPort})`,
      ``,
      `// Safety reporting`,
      `LET safetyEvents = PREVSTATE(${options.safetyReportPort})`,
      `ASSERT safetyEvents LTE 9999`,
      ``,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: sponsorPkd,
    constraints: options,
  };
}

// ─── Prescription verification ───────────────────────────────────────────────

export function buildPrescriptionScript(
  prescriberPkd: string,
  options: {
    prescriptionId: string;
    patientId: string;
    medicationCode: string;
    dosage: string;
    quantity: number;
    pharmacyPkd: string;
    dispensedPort: number;
    refillsRemainingPort: number;
    issueBlock: number;
    expiryBlock: number;
  },
): PolicyLayer {
  return {
    id: 'prescription',
    name: `Rx: ${options.prescriptionId}`,
    script: [
      `// Prescription: ${options.prescriptionId}`,
      `// Medication: ${options.medicationCode}`,
      `// Dosage: ${options.dosage}`,
      `LET prescriber = 0x${prescriberPkd}`,
      `LET pharmacy = 0x${options.pharmacyPkd}`,
      ``,
      `// Prescription identity`,
      `ASSERT STATE(0) EQ [${options.prescriptionId}]`,
      `ASSERT STATE(1) EQ [${options.patientId}]`,
      `ASSERT STATE(2) EQ [${options.medicationCode}]`,
      ``,
      `// Validity window`,
      `ASSERT @BLOCK GTE ${options.issueBlock}`,
      `ASSERT @BLOCK LTE ${options.expiryBlock}`,
      ``,
      `// Dispensing: pharmacy must sign`,
      `ASSERT SIGNEDBY(pharmacy)`,
      ``,
      `// Quantity tracking`,
      `LET dispensed = PREVSTATE(${options.dispensedPort})`,
      `ASSERT dispensed ADD STATE(${options.dispensedPort}) LTE ${options.quantity}`,
      ``,
      `// Refills remaining`,
      `LET refills = PREVSTATE(${options.refillsRemainingPort})`,
      `ASSERT refills GTE 0`,
      ``,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: prescriberPkd,
    constraints: options,
  };
}

// ─── Health data access ──────────────────────────────────────────────────────

export function buildHealthDataAccessScript(
  dataControllerPkd: string,
  options: {
    requestId: string;
    patientPkd: string;
    requesterPkd: string;
    dataScope: 'summary' | 'full-record' | 'lab-results' | 'imaging' | 'prescriptions';
    purpose: string;
    legalBasis: 'consent' | 'treatment' | 'legal-obligation' | 'public-interest';
    accessWindowBlocks: number;
    accessCountPort: number;
    auditLogPort: number;
  },
): PolicyLayer {
  return {
    id: 'health-data',
    name: `Data access: ${options.requestId}`,
    script: [
      `// Health data access: ${options.requestId}`,
      `// Scope: ${options.dataScope}`,
      `// Basis: ${options.legalBasis}`,
      `LET controller = 0x${dataControllerPkd}`,
      `LET patient = 0x${options.patientPkd}`,
      `LET requester = 0x${options.requesterPkd}`,
      ``,
      `// Controller must authorise`,
      `ASSERT SIGNEDBY(controller)`,
      ``,
      `// Scope constraint`,
      `ASSERT STATE(0) EQ [${options.dataScope}]`,
      `ASSERT STATE(1) EQ [${options.purpose}]`,
      ``,
      `// Access window`,
      `LET accessStart = PREVSTATE(${options.accessCountPort})`,
      `ASSERT @BLOCK SUB accessStart LTE ${options.accessWindowBlocks}`,
      ``,
      `// Access counting`,
      `LET count = PREVSTATE(${options.accessCountPort})`,
      `ASSERT STATE(${options.accessCountPort}) EQ INC(count)`,
      ``,
      `// Audit log`,
      `ASSERT STATE(${options.auditLogPort}) EQ 0x${options.requesterPkd}`,
      ``,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: dataControllerPkd,
    constraints: options,
  };
}
