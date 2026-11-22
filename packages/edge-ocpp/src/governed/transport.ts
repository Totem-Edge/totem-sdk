/**
 * RFC-024 §5.2 — OCPP transport port.
 *
 * The caller injects a transport that talks to a CSMS or a local charger stack.
 * This package owns the governed operation semantics only: it never opens a
 * socket and never implements an OCPP stack. A deployment can back the port
 * with a CSMS client, a charger stack, or a simulator.
 *
 * Every operation is idempotent at the port boundary: the prepared command and
 * the operation id are stable across retries (RFC-022 §5.1), so a transport may
 * safely deduplicate a replayed request.
 */

export interface OcppResponse {
  /** OCPP status (`Accepted`, `Rejected`, `Occupied`, `Faulted`, …). */
  status?: string;
  payload?: Record<string, unknown>;
  errorCode?: string;
  errorDescription?: string;
}

export interface OcppStartRequest {
  connectorId: number;
  idTag: string;
  maxPowerWatts?: string;
  maxEnergyWattHours?: string;
  maxSessionSeconds?: string;
}

export interface OcppStopRequest {
  connectorId: number;
  transactionId: number;
}

export interface OcppChargingProfileRequest {
  connectorId: number;
  profileId: number;
  maxPowerWatts: string;
  maxEnergyWattHours?: string;
  maxSessionSeconds?: string;
}

export interface OcppClearProfileRequest {
  connectorId: number;
  profileId?: number;
}

export interface OcppReserveRequest {
  connectorId: number;
  idTag: string;
  reservationId: number;
  expiresInSeconds: number;
}

export interface OcppMeterValue {
  transactionId: number;
  connectorId: number;
  /** ISO-8601 timestamp from the charger. */
  timestamp: string;
  /** Cumulative energy register for the transaction, in Wh (decimal string). */
  energyWattHours: string;
  measurand?: string;
}

export type OcppTransactionEventType = 'Started' | 'Updated' | 'Ended';

export interface OcppTransactionEvent {
  transactionId: number;
  connectorId: number;
  eventType: OcppTransactionEventType;
  timestamp: string;
  energyWattHours?: string;
}

export interface OcppMeterQuery {
  connectorId: number;
  transactionId?: number;
}

export interface OcppTransactionState {
  status: 'active' | 'ended' | 'unknown';
  /** Final cumulative energy register, in Wh. */
  energyWattHours?: string;
  endedAt?: string;
}

/**
 * Injected OCPP port. Implementations map these calls onto their CSMS/charger
 * stack (RemoteStartTransaction, SetChargingProfile, ReserveNow, …).
 */
export interface OcppTransportPort {
  remoteStartTransaction(request: OcppStartRequest): Promise<OcppResponse>;
  remoteStopTransaction(request: OcppStopRequest): Promise<OcppResponse>;
  /**
   * Stop whatever session is active on a connector. Used as the connector's
   * safe state, where the transaction id may not be known.
   */
  stopConnector?(connectorId: number): Promise<OcppResponse>;
  setChargingProfile(request: OcppChargingProfileRequest): Promise<OcppResponse>;
  clearChargingProfile(request: OcppClearProfileRequest): Promise<OcppResponse>;
  reserveNow(request: OcppReserveRequest): Promise<OcppResponse>;
  /** Readback path used for reconciliation; must originate from the charger. */
  readMeterValues(query: OcppMeterQuery): Promise<OcppMeterValue[]>;
  /** Charger/CSMS view of the transaction; required for definitive completion. */
  readTransactionState?(query: OcppMeterQuery): Promise<OcppTransactionState>;
  /** Optional push path for transaction events (Started/Updated/Ended). */
  onTransactionEvent?(handler: (event: OcppTransactionEvent) => void): () => void;
}

/** Transport/OCPP rejection carrying the protocol code. */
export class OcppTransportError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'OcppTransportError';
    this.code = code;
  }
}

export const OCPP_ACCEPTED = 'Accepted';

/** Throw unless the response status is `Accepted`. */
export function assertAccepted(response: OcppResponse, action: string): void {
  const status = response.status ?? OCPP_ACCEPTED;
  if (status !== OCPP_ACCEPTED) {
    throw new OcppTransportError(status, `${action} rejected with status '${status}'`);
  }
}
