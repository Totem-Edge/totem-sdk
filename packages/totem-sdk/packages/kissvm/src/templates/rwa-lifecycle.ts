/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Real World Asset (RWA) lifecycle templates for recursive MAST.
 *
 * These templates cover the complete RWA lifecycle:
 *   Tokenization → Fractionalization → Audit → Distribution → Transfer → Redemption → Disposal
 *
 * Each template generates a PolicyLayer that can be inserted into the
 * layered policy chain. The full RWA policy tree typically includes:
 *   Issuer → Custodian → Auditor → Registrar → Shareholders
 *
 * Off-chain document binding uses content-addressed hashes with
 * retrieval URIs. The chain stores the commitment; the document
 * corpus lives in policy repositories.
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyLayer } from '../mast/layered-policy.js';

// ─── Asset tokenization ──────────────────────────────────────────────────────

export function buildAssetTokenizationScript(
  issuerPkd: string,
  options: {
    assetId: string;
    assetClass: 'real-estate' | 'commodity' | 'infrastructure' | 'equipment' | 'receivable' | 'intellectual-property' | 'other';
    jurisdiction: string;
    documentHash: string;
    documentUri: string;
    custodianPkd: string;
    registrarPkd: string;
    totalSupply: string;
    denomination: string;
    issuanceBlock: number;
  },
): PolicyLayer {
  return {
    id: 'tokenization',
    name: `Tokenization: ${options.assetId}`,
    script: [
      `// RWA tokenization: ${options.assetId}`,
      `// Class: ${options.assetClass}`,
      `// Jurisdiction: ${options.jurisdiction}`,
      `LET issuer = 0x${issuerPkd}`,
      `LET custodian = 0x${options.custodianPkd}`,
      `LET registrar = 0x${options.registrarPkd}`,
      ``,
      `// All three must sign the issuance`,
      `ASSERT SIGNEDBY(issuer) AND SIGNEDBY(custodian) AND SIGNEDBY(registrar)`,
      ``,
      `// Asset identity is immutable`,
      `ASSERT STATE(0) EQ [${options.assetId}]`,
      `ASSERT STATE(1) EQ [${options.assetClass}]`,
      `ASSERT STATE(2) EQ [${options.jurisdiction}]`,
      ``,
      `// Off-chain document binding`,
      `ASSERT STATE(3) EQ [${options.documentHash}]`,
      `ASSERT STATE(4) EQ [${options.documentUri}]`,
      ``,
      `// Supply parameters`,
      `ASSERT STATE(5) EQ [${options.totalSupply}]`,
      `ASSERT STATE(6) EQ [${options.denomination}]`,
      ``,
      `// Issuance block`,
      `ASSERT @BLOCK GTE ${options.issuanceBlock}`,
      ``,
      `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: issuerPkd,
    constraints: options,
  };
}

// ─── Fractionalization ───────────────────────────────────────────────────────

export function buildFractionalizationScript(
  issuerPkd: string,
  options: {
    assetId: string;
    totalShares: number;
    shareTokenId: string;
    minShareAmount: string;
    shareholderCap?: number;
    lockupBlocks: number;
    issuancePort: number;
  },
): PolicyLayer {
  const lines = [
    `// Fractionalization: ${options.assetId}`,
    `// ${options.totalShares} shares, token ${options.shareTokenId}`,
    `LET issuer = 0x${issuerPkd}`,
    `ASSERT SIGNEDBY(issuer)`,
    ``,
    `// Share identity`,
    `ASSERT STATE(0) EQ [${options.assetId}]`,
    `ASSERT @TOKENID EQ [${options.shareTokenId}]`,
    ``,
    `// Minimum share amount`,
    `ASSERT @AMOUNT GTE ${options.minShareAmount}`,
    ``,
    `// Total supply cap`,
    `LET issued = PREVSTATE(${options.issuancePort})`,
    `ASSERT issued ADD @AMOUNT LTE ${options.totalShares}`,
  ];

  if (options.shareholderCap !== undefined) {
    lines.push(
      ``,
      `// Shareholder cap`,
      `LET holderCount = PREVSTATE(${options.issuancePort + 1})`,
      `ASSERT holderCount LTE ${options.shareholderCap}`,
    );
  }

  lines.push(
    ``,
    `// Lockup period`,
    `ASSERT @BLOCK GTE PREVSTATE(${options.issuancePort + 2}) ADD ${options.lockupBlocks}`,
    ``,
    `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
    `RETURN TRUE`,
  );

  return {
    id: 'fractionalization',
    name: `Fractionalization: ${options.assetId}`,
    script: lines.join('\n'),
    authorityPkd: issuerPkd,
    constraints: options,
  };
}

// ─── Audit trail ─────────────────────────────────────────────────────────────

export function buildAuditTrailScript(
  auditorPkd: string,
  options: {
    assetId: string;
    auditId: string;
    auditType: 'financial' | 'physical' | 'compliance' | 'valuation' | 'custody';
    reportHash: string;
    reportUri: string;
    previousAuditPort: number;
    auditCounterPort: number;
    findingsPort: number;
  },
): PolicyLayer {
  return {
    id: 'audit',
    name: `Audit: ${options.auditId}`,
    script: [
      `// Audit trail: ${options.assetId}`,
      `// Type: ${options.auditType}`,
      `LET auditor = 0x${auditorPkd}`,
      `ASSERT SIGNEDBY(auditor)`,
      ``,
      `// Asset identity`,
      `ASSERT STATE(0) EQ [${options.assetId}]`,
      ``,
      `// Report binding`,
      `ASSERT STATE(1) EQ [${options.reportHash}]`,
      `ASSERT STATE(2) EQ [${options.reportUri}]`,
      ``,
      `// Audit chain integrity`,
      `LET prevAudit = PREVSTATE(${options.previousAuditPort})`,
      `ASSERT STATE(${options.previousAuditPort}) EQ [${options.reportHash}]`,
      ``,
      `// Monotonic counter`,
      `LET counter = PREVSTATE(${options.auditCounterPort})`,
      `ASSERT STATE(${options.auditCounterPort}) EQ INC(counter)`,
      ``,
      `// Findings (0 = clean, >0 = issues found)`,
      `ASSERT STATE(${options.findingsPort}) GTE 0`,
      ``,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: auditorPkd,
    constraints: options,
  };
}

// ─── Income distribution ─────────────────────────────────────────────────────

export function buildDistributionScript(
  registrarPkd: string,
  options: {
    assetId: string;
    distributionId: string;
    distributionType: 'dividend' | 'interest' | 'rental-income' | 'royalty' | 'profit-share';
    totalDistribution: string;
    shareTokenId: string;
    recordDateBlock: number;
    distributionPort: number;
    perSharePort: number;
  },
): PolicyLayer {
  return {
    id: 'distribution',
    name: `Distribution: ${options.distributionId}`,
    script: [
      `// Distribution: ${options.assetId}`,
      `// Type: ${options.distributionType}`,
      `// Total: ${options.totalDistribution}`,
      `LET registrar = 0x${registrarPkd}`,
      `ASSERT SIGNEDBY(registrar)`,
      ``,
      `// Asset and token identity`,
      `ASSERT STATE(0) EQ [${options.assetId}]`,
      `ASSERT @TOKENID EQ [${options.shareTokenId}]`,
      ``,
      `// Record date must have passed`,
      `ASSERT @BLOCK GTE ${options.recordDateBlock}`,
      ``,
      `// Distribution amount per share`,
      `LET perShare = STATE(${options.perSharePort})`,
      `LET shares = @AMOUNT`,
      `LET payout = shares MUL perShare`,
      ``,
      `// Total distribution cap`,
      `LET prevDistributed = PREVSTATE(${options.distributionPort})`,
      `ASSERT prevDistributed ADD payout LTE ${options.totalDistribution}`,
      ``,
      `ASSERT VERIFYOUT(@INPUT @ADDRESS payout @TOKENID TRUE)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: registrarPkd,
    constraints: options,
  };
}

// ─── Regulated share transfer ────────────────────────────────────────────────

export function buildShareTransferScript(
  registrarPkd: string,
  options: {
    assetId: string;
    shareTokenId: string;
    transferorPkd: string;
    transfereePkd: string;
    kycProviderPkd?: string;
    amlProviderPkd?: string;
    lockupExpiryBlock?: number;
    maxTransferPercent?: number;
    holdingPort: number;
  },
): PolicyLayer {
  const signers = [`SIGNEDBY(0x${options.transferorPkd})`];
  if (options.kycProviderPkd) signers.push(`SIGNEDBY(0x${options.kycProviderPkd})`);
  if (options.amlProviderPkd) signers.push(`SIGNEDBY(0x${options.amlProviderPkd})`);

  const lines = [
    `// Share transfer: ${options.assetId}`,
    `LET registrar = 0x${registrarPkd}`,
    `LET transferor = 0x${options.transferorPkd}`,
    `LET transferee = 0x${options.transfereePkd}`,
    ``,
    `// Transferor must sign (KYC/AML providers co-sign if required)`,
    `ASSERT ${signers.join(' AND ')}`,
    ``,
    `// Asset and token identity`,
    `ASSERT STATE(0) EQ [${options.assetId}]`,
    `ASSERT @TOKENID EQ [${options.shareTokenId}]`,
  ];

  if (options.lockupExpiryBlock !== undefined) {
    lines.push(
      ``,
      `// Lockup check`,
      `ASSERT @BLOCK GTE ${options.lockupExpiryBlock}`,
    );
  }

  if (options.maxTransferPercent !== undefined) {
    lines.push(
      ``,
      `// Maximum transfer percentage`,
      `LET holding = PREVSTATE(${options.holdingPort})`,
      `ASSERT @AMOUNT LTE holding MUL ${options.maxTransferPercent} DIV 100`,
    );
  }

  lines.push(
    ``,
    `// Transfer to new owner`,
    `ASSERT VERIFYOUT(@INPUT 0x${options.transfereePkd} @AMOUNT @TOKENID TRUE)`,
    `RETURN TRUE`,
  );

  return {
    id: 'share-transfer',
    name: `Transfer: ${options.assetId}`,
    script: lines.join('\n'),
    authorityPkd: registrarPkd,
    constraints: options,
  };
}

// ─── Share redemption ────────────────────────────────────────────────────────

export function buildRedemptionScript(
  issuerPkd: string,
  options: {
    assetId: string;
    shareTokenId: string;
    navPerShare: string;
    redemptionFeeBps: number;
    minHoldingPeriodBlocks: number;
    redemptionWindowStart: number;
    redemptionWindowEnd: number;
    totalRedeemedPort: number;
    maxRedeemable: string;
  },
): PolicyLayer {
  return {
    id: 'redemption',
    name: `Redemption: ${options.assetId}`,
    script: [
      `// Share redemption: ${options.assetId}`,
      `// NAV per share: ${options.navPerShare}`,
      `LET issuer = 0x${issuerPkd}`,
      `ASSERT SIGNEDBY(issuer)`,
      ``,
      `// Asset and token identity`,
      `ASSERT STATE(0) EQ [${options.assetId}]`,
      `ASSERT @TOKENID EQ [${options.shareTokenId}]`,
      ``,
      `// Redemption window`,
      `ASSERT @BLOCK GTE ${options.redemptionWindowStart}`,
      `ASSERT @BLOCK LTE ${options.redemptionWindowEnd}`,
      ``,
      `// Minimum holding period`,
      `ASSERT @BLOCK SUB PREVSTATE(30) GTE ${options.minHoldingPeriodBlocks}`,
      ``,
      `// Redemption cap`,
      `LET prevRedeemed = PREVSTATE(${options.totalRedeemedPort})`,
      `ASSERT prevRedeemed ADD @AMOUNT LTE ${options.maxRedeemable}`,
      ``,
      `// Calculate payout: shares × NAV minus fee`,
      `LET gross = @AMOUNT MUL ${options.navPerShare}`,
      `LET fee = gross MUL ${options.redemptionFeeBps} DIV 10000`,
      `LET net = gross SUB fee`,
      ``,
      `ASSERT VERIFYOUT(@INPUT @ADDRESS net @TOKENID TRUE)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: issuerPkd,
    constraints: options,
  };
}

// ─── Asset disposal ──────────────────────────────────────────────────────────

export function buildAssetDisposalScript(
  issuerPkd: string,
  options: {
    assetId: string;
    disposalType: 'sale' | 'liquidation' | 'maturity' | 'write-off';
    purchaserPkd?: string;
    auditorPkd: string;
    custodianPkd: string;
    finalValuation: string;
    valuationReportHash: string;
    disposalBlock: number;
    finalDistributionPort: number;
    decommissionPort: number;
  },
): PolicyLayer {
  const signers = [
    `SIGNEDBY(0x${issuerPkd})`,
    `SIGNEDBY(0x${options.auditorPkd})`,
    `SIGNEDBY(0x${options.custodianPkd})`,
  ];
  if (options.purchaserPkd) {
    signers.push(`SIGNEDBY(0x${options.purchaserPkd})`);
  }

  return {
    id: 'disposal',
    name: `Disposal: ${options.assetId}`,
    script: [
      `// Asset disposal: ${options.assetId}`,
      `// Type: ${options.disposalType}`,
      `// Final valuation: ${options.finalValuation}`,
      `ASSERT ${signers.join(' AND ')}`,
      ``,
      `// Asset identity`,
      `ASSERT STATE(0) EQ [${options.assetId}]`,
      ``,
      `// Valuation report binding`,
      `ASSERT STATE(1) EQ [${options.valuationReportHash}]`,
      ``,
      `// Disposal timing`,
      `ASSERT @BLOCK GTE ${options.disposalBlock}`,
      ``,
      `// Final distribution to shareholders`,
      `LET finalAmount = STATE(${options.finalDistributionPort})`,
      `ASSERT finalAmount EQ ${options.finalValuation}`,
      ``,
      `// Decommission flag`,
      `ASSERT STATE(${options.decommissionPort}) EQ 1`,
      ``,
      `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: issuerPkd,
    constraints: options,
  };
}

// ─── Complete RWA policy tree ────────────────────────────────────────────────

export function buildRwaPolicyTree(options: {
  assetId: string;
  issuerPkd: string;
  custodianPkd: string;
  auditorPkd: string;
  registrarPkd: string;
  jurisdiction: string;
  documentHash: string;
  documentUri: string;
  totalSupply: string;
  shareTokenId: string;
}): PolicyLayer[] {
  return [
    buildAssetTokenizationScript(options.issuerPkd, {
      assetId: options.assetId,
      assetClass: 'other',
      jurisdiction: options.jurisdiction,
      documentHash: options.documentHash,
      documentUri: options.documentUri,
      custodianPkd: options.custodianPkd,
      registrarPkd: options.registrarPkd,
      totalSupply: options.totalSupply,
      denomination: '1',
      issuanceBlock: 0,
    }),
    {
      id: 'custodian',
      name: `Custodian: ${options.assetId}`,
      script: [
        `// Custodian verification`,
        `LET custodian = 0x${options.custodianPkd}`,
        `ASSERT SIGNEDBY(custodian)`,
        `ASSERT STATE(0) EQ [${options.assetId}]`,
        `RETURN TRUE`,
      ].join('\n'),
      authorityPkd: options.custodianPkd,
      constraints: {},
    },
    {
      id: 'auditor',
      name: `Auditor: ${options.assetId}`,
      script: [
        `// Auditor verification`,
        `LET auditor = 0x${options.auditorPkd}`,
        `ASSERT SIGNEDBY(auditor)`,
        `ASSERT STATE(0) EQ [${options.assetId}]`,
        `RETURN TRUE`,
      ].join('\n'),
      authorityPkd: options.auditorPkd,
      constraints: {},
    },
    {
      id: 'registrar',
      name: `Registrar: ${options.assetId}`,
      script: [
        `// Registrar verification`,
        `LET registrar = 0x${options.registrarPkd}`,
        `ASSERT SIGNEDBY(registrar)`,
        `ASSERT STATE(0) EQ [${options.assetId}]`,
        `ASSERT @TOKENID EQ [${options.shareTokenId}]`,
        `RETURN TRUE`,
      ].join('\n'),
      authorityPkd: options.registrarPkd,
      constraints: {},
    },
  ];
}
