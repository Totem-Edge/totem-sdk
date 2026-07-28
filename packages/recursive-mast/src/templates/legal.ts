/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Legal and notarization templates for recursive MAST.
 *
 * These templates encode legal operations as KISSVM scripts
 * that can be inserted into any layer of the policy chain. Each
 * template generates a PolicyLayer ready for use with
 * buildLayeredPolicy().
 *
 * Models:
 *   Document notarization       — Timestamped document binding with witness
 *   Timestamp verification      — Prove document existed before a block
 *   Smart contract execution    — Conditional legal contract with oracle
 *   Power of attorney           — Delegated legal authority with scope
 *   Multi-jurisdiction recognition — Cross-border legal instrument acceptance
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyLayer } from '../layered-policy.js';

// ─── Document notarization ───────────────────────────────────────────────────

export function buildDocumentNotarizationScript(
  notaryPkd: string,
  options: {
    documentId: string;
    documentHash: string;
    documentUri: string;
    documentType: 'contract' | 'deed' | 'affidavit' | 'certificate' | 'power-of-attorney' | 'will';
    signatoryPkd: string;
    witnessPkds: string[];
    jurisdiction: string;
    notarizationBlock: number;
    notarySealPort: number;
  },
): PolicyLayer {
  const witnessChecks = options.witnessPkds.map((w, i) =>
    `ASSERT SIGNEDBY(0x${w})`,
  );

  return {
    id: 'notarization',
    name: `Notarization: ${options.documentId}`,
    script: [
      `// Notarization: ${options.documentId}`,
      `// Type: ${options.documentType}`,
      `// Jurisdiction: ${options.jurisdiction}`,
      `LET notary = 0x${notaryPkd}`,
      `LET signatory = 0x${options.signatoryPkd}`,
      ``,
      `// Document binding`,
      `ASSERT STATE(0) EQ [${options.documentId}]`,
      `ASSERT STATE(1) EQ [${options.documentHash}]`,
      `ASSERT STATE(2) EQ [${options.documentUri}]`,
      ``,
      `// Signatory must sign`,
      `ASSERT SIGNEDBY(signatory)`,
      ``,
      `// Witnesses must sign`,
      ...witnessChecks,
      ``,
      `// Notary must sign`,
      `ASSERT SIGNEDBY(notary)`,
      ``,
      `// Timestamp`,
      `ASSERT @BLOCK GTE ${options.notarizationBlock}`,
      ``,
      `// Notary seal`,
      `ASSERT STATE(${options.notarySealPort}) EQ 1`,
      ``,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: notaryPkd,
    constraints: options,
  };
}

// ─── Timestamp verification ──────────────────────────────────────────────────

export function buildTimestampVerificationScript(
  timestampAuthorityPkd: string,
  options: {
    stampId: string;
    documentHash: string;
    previousStampHash: string;
    stampBlock: number;
    stampPort: number;
    chainPort: number;
  },
): PolicyLayer {
  return {
    id: 'timestamp',
    name: `Timestamp: ${options.stampId}`,
    script: [
      `// Timestamp: ${options.stampId}`,
      `LET authority = 0x${timestampAuthorityPkd}`,
      ``,
      `// Document hash`,
      `ASSERT STATE(${options.stampPort}) EQ [${options.documentHash}]`,
      ``,
      `// Chain integrity: links to previous stamp`,
      `ASSERT STATE(${options.chainPort}) EQ [${options.previousStampHash}]`,
      ``,
      `// Block height proof`,
      `ASSERT @BLOCK GTE ${options.stampBlock}`,
      ``,
      `ASSERT SIGNEDBY(authority)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: timestampAuthorityPkd,
    constraints: options,
  };
}

// ─── Smart contract execution ────────────────────────────────────────────────

export function buildSmartContractExecutionScript(
  partyAPkd: string,
  options: {
    contractId: string;
    partyBPkd: string;
    contractHash: string;
    governingLaw: string;
    disputeResolution: 'arbitration' | 'mediation' | 'court';
    arbiterPkd: string;
    oraclePkd?: string;
    conditionPort: number;
    performancePort: number;
    breachPort: number;
    effectiveBlock: number;
    expiryBlock: number;
  },
): PolicyLayer {
  const lines = [
    `// Smart contract: ${options.contractId}`,
    `// Law: ${options.governingLaw}`,
    `// Dispute: ${options.disputeResolution}`,
    `LET partyA = 0x${partyAPkd}`,
    `LET partyB = 0x${options.partyBPkd}`,
    `LET arbiter = 0x${options.arbiterPkd}`,
    ``,
    `// Contract binding`,
    `ASSERT STATE(0) EQ [${options.contractId}]`,
    `ASSERT STATE(1) EQ [${options.contractHash}]`,
    ``,
    `// Validity window`,
    `ASSERT @BLOCK GTE ${options.effectiveBlock}`,
    `ASSERT @BLOCK LTE ${options.expiryBlock}`,
  ];

  if (options.oraclePkd) {
    lines.push(
      ``,
      `// Oracle condition`,
      `ASSERT STATE(${options.conditionPort}) EQ 1`,
      `ASSERT SIGNEDBY(0x${options.oraclePkd})`,
    );
  }

  lines.push(
    ``,
    `// Performance: both parties sign`,
    `IF STATE(${options.performancePort}) EQ 1 THEN`,
    `  ASSERT SIGNEDBY(partyA) AND SIGNEDBY(partyB)`,
    `ENDIF`,
    ``,
    `// Breach: arbiter resolves`,
    `IF STATE(${options.breachPort}) EQ 1 THEN`,
    `  ASSERT SIGNEDBY(arbiter)`,
    `ENDIF`,
    ``,
    `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
    `RETURN TRUE`,
  );

  return {
    id: 'contract',
    name: `Contract: ${options.contractId}`,
    script: lines.join('\n'),
    authorityPkd: partyAPkd,
    constraints: options,
  };
}

// ─── Power of attorney ───────────────────────────────────────────────────────

export function buildPowerOfAttorneyScript(
  principalPkd: string,
  options: {
    poaId: string;
    agentPkd: string;
    scope: 'general' | 'financial' | 'healthcare' | 'property' | 'business';
    powers: string[];
    limitations: string[];
    effectiveBlock: number;
    expiryBlock: number;
    revocationPort: number;
    exerciseLogPort: number;
  },
): PolicyLayer {
  const powerList = options.powers.map(p => p).join(' ');
  const limitList = options.limitations.map(l => l).join(' ');

  return {
    id: 'power-of-attorney',
    name: `PoA: ${options.poaId}`,
    script: [
      `// Power of attorney: ${options.poaId}`,
      `// Scope: ${options.scope}`,
      `LET principal = 0x${principalPkd}`,
      `LET agent = 0x${options.agentPkd}`,
      ``,
      `// Not revoked`,
      `ASSERT PREVSTATE(${options.revocationPort}) EQ 0`,
      ``,
      `// Validity window`,
      `ASSERT @BLOCK GTE ${options.effectiveBlock}`,
      `ASSERT @BLOCK LTE ${options.expiryBlock}`,
      ``,
      `// Granted powers`,
      `ASSERT CONTAINS([${powerList}] STATE(0))`,
      ``,
      `// Limitations`,
      `ASSERT NOT CONTAINS([${limitList}] STATE(0))`,
      ``,
      `// Agent must sign`,
      `ASSERT SIGNEDBY(agent)`,
      ``,
      `// Exercise logging`,
      `LET exerciseCount = PREVSTATE(${options.exerciseLogPort})`,
      `ASSERT STATE(${options.exerciseLogPort}) EQ INC(exerciseCount)`,
      ``,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: principalPkd,
    constraints: options,
  };
}

// ─── Multi-jurisdiction recognition ──────────────────────────────────────────

export function buildMultiJurisdictionScript(
  homeAuthorityPkd: string,
  options: {
    instrumentId: string;
    instrumentType: 'judgment' | 'award' | 'order' | 'certificate' | 'license';
    homeJurisdiction: string;
    foreignJurisdictions: string[];
    foreignAuthorityPkds: string[];
    recognitionPort: number;
    enforcementPort: number;
    issueBlock: number;
    apostilleHash?: string;
  },
): PolicyLayer {
  const jurisdictionChecks = options.foreignJurisdictions.map((j, i) => {
    const pkd = options.foreignAuthorityPkds[i] ?? '0x00';
    return [
      `// Recognition by ${j}`,
      `IF STATE(${options.recognitionPort + i}) EQ 1 THEN`,
      `  ASSERT SIGNEDBY(0x${pkd})`,
      `ENDIF`,
    ].join('\n');
  });

  const lines = [
    `// Multi-jurisdiction: ${options.instrumentId}`,
    `// Type: ${options.instrumentType}`,
    `// Home: ${options.homeJurisdiction}`,
    `LET home = 0x${homeAuthorityPkd}`,
    ``,
    `// Instrument identity`,
    `ASSERT STATE(0) EQ [${options.instrumentId}]`,
    `ASSERT STATE(1) EQ [${options.homeJurisdiction}]`,
  ];

  if (options.apostilleHash) {
    lines.push(`ASSERT STATE(2) EQ [${options.apostilleHash}]`);
  }

  lines.push(
    ``,
    `// Issue block`,
    `ASSERT @BLOCK GTE ${options.issueBlock}`,
    ``,
    `// Home authority must sign`,
    `ASSERT SIGNEDBY(home)`,
    ``,
    `// Foreign jurisdiction recognition`,
    ...jurisdictionChecks,
    ``,
    `// Enforcement flag`,
    `ASSERT STATE(${options.enforcementPort}) EQ 1`,
    ``,
    `RETURN TRUE`,
  );

  return {
    id: 'multi-jurisdiction',
    name: `Multi-jurisdiction: ${options.instrumentId}`,
    script: lines.join('\n'),
    authorityPkd: homeAuthorityPkd,
    constraints: options,
  };
}
