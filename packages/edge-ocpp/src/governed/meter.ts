/**
 * RFC-024 §5.7 — metering and settlement evidence.
 *
 * Meter values must come from the charger through the transport, never from the
 * caller. The evidence digest is canonical so a settlement action can cite the
 * charging operation id and prove which meter readings backed it.
 */

import { hashCanonical } from '@totemsdk/act-core';
import type { OcppMeterValue, OcppTransportPort } from './transport.js';

export interface ChargingMeterEvidence {
  operationId: string;
  connectorId: number;
  transactionId: number;
  /** Latest cumulative energy register, in Wh. */
  energyWattHours: string;
  readings: readonly OcppMeterValue[];
  digest: string;
}

export interface ChargingMeterQuery {
  operationId: string;
  connectorId: number;
  transactionId: number;
}

export type ChargingReconcileStatus = 'running' | 'confirmed' | 'unknown';

export interface ChargingReconcileResult {
  status: ChargingReconcileStatus;
  energyWattHours?: string;
  evidence?: ChargingMeterEvidence;
  detail?: string;
}

export function meterEvidenceDigest(evidence: Omit<ChargingMeterEvidence, 'digest'>): string {
  return hashCanonical('TOTEM_ACT_OCPP_METER_EVIDENCE_V1', {
    operationId: evidence.operationId,
    connectorId: evidence.connectorId,
    transactionId: evidence.transactionId,
    energyWattHours: evidence.energyWattHours,
    readings: evidence.readings
      .map((reading) => ({
        transactionId: reading.transactionId,
        connectorId: reading.connectorId,
        timestamp: reading.timestamp,
        energyWattHours: reading.energyWattHours,
        measurand: reading.measurand ?? null,
      }))
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)),
  });
}

function latestReading(readings: readonly OcppMeterValue[]): OcppMeterValue | undefined {
  return readings
    .slice()
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .at(-1);
}

/**
 * Reconcile an accepted charging operation against the charger.
 *
 * - `confirmed` only when the charger reports the transaction ended (an energy
 *   register alone is progress, not completion);
 * - `running` while the transaction is active or meter values advance;
 * - `unknown` when the charger cannot be read — the reservation must stay held.
 */
export async function reconcileChargingSession(
  transport: OcppTransportPort,
  query: ChargingMeterQuery,
): Promise<ChargingReconcileResult> {
  const readings = await transport.readMeterValues({
    connectorId: query.connectorId,
    transactionId: query.transactionId,
  });
  const scoped = readings.filter((reading) => reading.transactionId === query.transactionId);
  const latest = latestReading(scoped);

  let state: { status: 'active' | 'ended' | 'unknown'; energyWattHours?: string } = { status: 'unknown' };
  if (transport.readTransactionState) {
    state = await transport.readTransactionState({
      connectorId: query.connectorId,
      transactionId: query.transactionId,
    });
  }

  const energyWattHours = state.energyWattHours ?? latest?.energyWattHours;
  if (state.status === 'ended' && energyWattHours !== undefined) {
    const base = {
      operationId: query.operationId,
      connectorId: query.connectorId,
      transactionId: query.transactionId,
      energyWattHours,
      readings: scoped,
    };
    return {
      status: 'confirmed',
      energyWattHours,
      evidence: { ...base, digest: meterEvidenceDigest(base) },
    };
  }

  if (state.status === 'active' || scoped.length > 0) {
    return {
      status: 'running',
      ...(energyWattHours !== undefined ? { energyWattHours } : {}),
      detail: state.status === 'active' ? 'transaction active' : 'meter values observed',
    };
  }

  return { status: 'unknown', detail: 'no transaction state or meter readback' };
}
