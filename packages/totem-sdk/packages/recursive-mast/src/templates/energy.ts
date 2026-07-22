/**
 *
 * EXPERIMENTAL — NOT AUDITED. Do not use in production without
 * independent security review against a Minima node.
 * Energy and utilities templates for recursive MAST.
 *
 * These templates encode energy sector operations as KISSVM scripts
 * that can be inserted into any layer of the policy chain. Each
 * template generates a PolicyLayer ready for use with
 * buildLayeredPolicy().
 *
 * Models:
 *   REC trading               — Renewable Energy Certificate issuance and transfer
 *   Microgrid management       — Islanded/grid-connected mode switching
 *   P2P energy trading         — Prosumer-to-consumer energy sales
 *   Demand response            — Load shedding with incentive verification
 *   Net metering               — Export/import tracking with settlement
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import type { PolicyLayer } from '../layered-policy.js';

// ─── REC trading ─────────────────────────────────────────────────────────────

export function buildRecTradingScript(
  registryPkd: string,
  options: {
    recId: string;
    generatorPkd: string;
    energySource: 'solar' | 'wind' | 'hydro' | 'biomass' | 'geothermal';
    mwhGenerated: string;
    vintageYear: number;
    certificationBodyPkd: string;
    issuancePort: number;
    retirementPort: number;
  },
): PolicyLayer {
  return {
    id: 'rec',
    name: `REC: ${options.recId}`,
    script: [
      `// REC: ${options.recId}`,
      `// Source: ${options.energySource}`,
      `// Vintage: ${options.vintageYear}`,
      `// MWh: ${options.mwhGenerated}`,
      `LET registry = 0x${registryPkd}`,
      `LET generator = 0x${options.generatorPkd}`,
      `LET certifier = 0x${options.certificationBodyPkd}`,
      ``,
      `// Issuance: generator + certifier must sign`,
      `IF STATE(${options.issuancePort}) EQ 1 THEN`,
      `  ASSERT SIGNEDBY(generator) AND SIGNEDBY(certifier)`,
      `  ASSERT STATE(0) EQ [${options.recId}]`,
      `  ASSERT STATE(1) EQ [${options.energySource}]`,
      `  ASSERT STATE(2) EQ [${options.mwhGenerated}]`,
      `  ASSERT STATE(3) EQ [${options.vintageYear}]`,
      `ENDIF`,
      ``,
      `// Transfer: registry must sign`,
      `IF STATE(${options.issuancePort}) EQ 0 AND STATE(${options.retirementPort}) EQ 0 THEN`,
      `  ASSERT SIGNEDBY(registry)`,
      `ENDIF`,
      ``,
      `// Retirement: final holder retires the REC`,
      `IF STATE(${options.retirementPort}) EQ 1 THEN`,
      `  ASSERT SIGNEDBY(registry)`,
      `  ASSERT STATE(${options.issuancePort}) EQ 0`,
      `ENDIF`,
      ``,
      `ASSERT VERIFYOUT(@INPUT @ADDRESS @AMOUNT @TOKENID TRUE)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: registryPkd,
    constraints: options,
  };
}

// ─── Microgrid management ────────────────────────────────────────────────────

export function buildMicrogridScript(
  gridOperatorPkd: string,
  options: {
    microgridId: string;
    modePort: number;
    frequencyPort: number;
    voltagePort: number;
    loadPort: number;
    generationPort: number;
    minFrequency: number;
    maxFrequency: number;
    minVoltage: number;
    maxVoltage: number;
    maxLoadKw: number;
  },
): PolicyLayer {
  return {
    id: 'microgrid',
    name: `Microgrid: ${options.microgridId}`,
    script: [
      `// Microgrid: ${options.microgridId}`,
      `LET operator = 0x${gridOperatorPkd}`,
      `ASSERT SIGNEDBY(operator)`,
      ``,
      `// Grid identity`,
      `ASSERT STATE(0) EQ [${options.microgridId}]`,
      ``,
      `// Mode: 0 = islanded, 1 = grid-connected`,
      `LET mode = STATE(${options.modePort})`,
      ``,
      `// Frequency bounds (Hz × 100)`,
      `LET freq = PREVSTATE(${options.frequencyPort})`,
      `ASSERT freq GTE ${options.minFrequency}`,
      `ASSERT freq LTE ${options.maxFrequency}`,
      ``,
      `// Voltage bounds (V)`,
      `LET voltage = PREVSTATE(${options.voltagePort})`,
      `ASSERT voltage GTE ${options.minVoltage}`,
      `ASSERT voltage LTE ${options.maxVoltage}`,
      ``,
      `// Load limit`,
      `LET load = PREVSTATE(${options.loadPort})`,
      `ASSERT load LTE ${options.maxLoadKw}`,
      ``,
      `// Generation must meet load in islanded mode`,
      `IF mode EQ 0 THEN`,
      `  LET gen = PREVSTATE(${options.generationPort})`,
      `  ASSERT gen GTE load`,
      `ENDIF`,
      ``,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: gridOperatorPkd,
    constraints: options,
  };
}

// ─── P2P energy trading ──────────────────────────────────────────────────────

export function buildP2PEnergyScript(
  marketPkd: string,
  options: {
    tradeId: string;
    sellerPkd: string;
    buyerPkd: string;
    kwhAmount: string;
    pricePerKwh: string;
    deliveryStartBlock: number;
    deliveryEndBlock: number;
    meterPort: number;
    settlementPort: number;
  },
): PolicyLayer {
  return {
    id: 'p2p-energy',
    name: `P2P: ${options.tradeId}`,
    script: [
      `// P2P energy trade: ${options.tradeId}`,
      `// ${options.kwhAmount} kWh at ${options.pricePerKwh} per kWh`,
      `LET market = 0x${marketPkd}`,
      `LET seller = 0x${options.sellerPkd}`,
      `LET buyer = 0x${options.buyerPkd}`,
      ``,
      `// Trade execution: market operator signs`,
      `ASSERT SIGNEDBY(market)`,
      `ASSERT STATE(0) EQ [${options.tradeId}]`,
      ``,
      `// Delivery window`,
      `ASSERT @BLOCK GTE ${options.deliveryStartBlock}`,
      `ASSERT @BLOCK LTE ${options.deliveryEndBlock}`,
      ``,
      `// Metered delivery`,
      `LET delivered = PREVSTATE(${options.meterPort})`,
      `ASSERT delivered GTE ${options.kwhAmount}`,
      ``,
      `// Settlement: buyer pays seller`,
      `LET total = ${options.kwhAmount} MUL ${options.pricePerKwh}`,
      `ASSERT VERIFYOUT(@INPUT 0x${options.sellerPkd} total @TOKENID TRUE)`,
      ``,
      `// Settlement flag`,
      `ASSERT STATE(${options.settlementPort}) EQ 1`,
      ``,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: marketPkd,
    constraints: options,
  };
}

// ─── Demand response ─────────────────────────────────────────────────────────

export function buildDemandResponseScript(
  utilityPkd: string,
  options: {
    programmeId: string;
    participantPkd: string;
    baselineLoadKw: string;
    targetReductionKw: string;
    incentivePerKw: string;
    eventStartBlock: number;
    eventEndBlock: number;
    actualLoadPort: number;
    compliancePort: number;
  },
): PolicyLayer {
  return {
    id: 'demand-response',
    name: `DR: ${options.programmeId}`,
    script: [
      `// Demand response: ${options.programmeId}`,
      `// Target reduction: ${options.targetReductionKw} kW`,
      `LET utility = 0x${utilityPkd}`,
      `LET participant = 0x${options.participantPkd}`,
      ``,
      `// Event window`,
      `ASSERT @BLOCK GTE ${options.eventStartBlock}`,
      `ASSERT @BLOCK LTE ${options.eventEndBlock}`,
      ``,
      `// Load reduction verification`,
      `LET actualLoad = PREVSTATE(${options.actualLoadPort})`,
      `LET reduction = ${options.baselineLoadKw} SUB actualLoad`,
      `ASSERT reduction GTE ${options.targetReductionKw}`,
      ``,
      `// Incentive calculation`,
      `LET incentive = reduction MUL ${options.incentivePerKw}`,
      `ASSERT VERIFYOUT(@INPUT 0x${options.participantPkd} incentive @TOKENID TRUE)`,
      ``,
      `// Compliance flag`,
      `ASSERT STATE(${options.compliancePort}) EQ 1`,
      ``,
      `ASSERT SIGNEDBY(utility)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: utilityPkd,
    constraints: options,
  };
}

// ─── Net metering ────────────────────────────────────────────────────────────

export function buildNetMeteringScript(
  utilityPkd: string,
  options: {
    meterId: string;
    customerPkd: string;
    billingPeriodBlocks: number;
    exportRate: string;
    importRate: string;
    exportPort: number;
    importPort: number;
    netBalancePort: number;
    settlementPort: number;
  },
): PolicyLayer {
  return {
    id: 'net-metering',
    name: `Net meter: ${options.meterId}`,
    script: [
      `// Net metering: ${options.meterId}`,
      `// Export rate: ${options.exportRate}, Import rate: ${options.importRate}`,
      `LET utility = 0x${utilityPkd}`,
      `LET customer = 0x${options.customerPkd}`,
      ``,
      `// Meter identity`,
      `ASSERT STATE(0) EQ [${options.meterId}]`,
      ``,
      `// Billing period`,
      `LET periodStart = PREVSTATE(${options.netBalancePort})`,
      `ASSERT @BLOCK SUB periodStart LTE ${options.billingPeriodBlocks}`,
      ``,
      `// Net balance calculation`,
      `LET exported = PREVSTATE(${options.exportPort})`,
      `LET imported = PREVSTATE(${options.importPort})`,
      `LET exportValue = exported MUL ${options.exportRate}`,
      `LET importValue = imported MUL ${options.importRate}`,
      ``,
      `// Settlement`,
      `IF exportValue GT importValue THEN`,
      `  LET credit = exportValue SUB importValue`,
      `  ASSERT VERIFYOUT(@INPUT 0x${options.customerPkd} credit @TOKENID TRUE)`,
      `ELSE`,
      `  LET debit = importValue SUB exportValue`,
      `  ASSERT VERIFYOUT(@INPUT 0x${utilityPkd} debit @TOKENID TRUE)`,
      `ENDIF`,
      ``,
      `ASSERT STATE(${options.settlementPort}) EQ 1`,
      `ASSERT SIGNEDBY(utility)`,
      `RETURN TRUE`,
    ].join('\n'),
    authorityPkd: utilityPkd,
    constraints: options,
  };
}
