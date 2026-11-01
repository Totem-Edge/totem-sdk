/**
 * OCPP-J framing (OCPP 1.6J and 2.0.1).
 *
 *   CALL        [2, messageId, action, payload]
 *   CALLRESULT  [3, messageId, payload]
 *   CALLERROR   [4, messageId, errorCode, errorDescription, errorDetails]
 */

export const OCPP_ERROR_CODES = [
  'NotSupported',
  'InternalError',
  'ProtocolError',
  'SecurityError',
  'FormationViolation',
  'PropertyConstraintViolation',
  'OccurrenceConstraintViolation',
  'TypeConstraintViolation',
  'GenericError',
] as const;

export type OcppErrorCode = (typeof OCPP_ERROR_CODES)[number];

export interface OcppCall {
  type: 2;
  messageId: string;
  action: string;
  payload: Record<string, unknown>;
}

export interface OcppCallResult {
  type: 3;
  messageId: string;
  payload: Record<string, unknown>;
}

export interface OcppCallError {
  type: 4;
  messageId: string;
  errorCode: OcppErrorCode;
  errorDescription: string;
  errorDetails: Record<string, unknown>;
}

export type OcppFrame = OcppCall | OcppCallResult | OcppCallError;

export class OcppProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OcppProtocolError';
  }
}

export class OcppError extends Error {
  constructor(
    readonly code: OcppErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'OcppError';
  }
}

export function encodeCall(messageId: string, action: string, payload: Record<string, unknown>): string {
  return JSON.stringify([2, messageId, action, payload]);
}

export function encodeCallResult(messageId: string, payload: Record<string, unknown>): string {
  return JSON.stringify([3, messageId, payload]);
}

export function encodeCallError(
  messageId: string,
  errorCode: OcppErrorCode,
  errorDescription: string,
  errorDetails: Record<string, unknown> = {},
): string {
  return JSON.stringify([4, messageId, errorCode, errorDescription, errorDetails]);
}

export function parseOcppFrame(raw: string): OcppFrame {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new OcppProtocolError('OCPP frame is not valid JSON');
  }
  if (!Array.isArray(value) || value.length < 3) throw new OcppProtocolError('OCPP frame must be an array');
  const [type, messageId] = value;
  if (typeof messageId !== 'string' || messageId.length === 0) throw new OcppProtocolError('OCPP message id must be a non-empty string');

  if (type === 2) {
    if (value.length !== 4) throw new OcppProtocolError('OCPP CALL must have four elements');
    const [, , action, payload] = value;
    if (typeof action !== 'string' || action.length === 0) throw new OcppProtocolError('OCPP CALL action must be a non-empty string');
    if (!isRecord(payload)) throw new OcppProtocolError('OCPP CALL payload must be an object');
    return { type: 2, messageId, action, payload };
  }

  if (type === 3) {
    if (value.length !== 3) throw new OcppProtocolError('OCPP CALLRESULT must have three elements');
    const payload = value[2];
    if (!isRecord(payload)) throw new OcppProtocolError('OCPP CALLRESULT payload must be an object');
    return { type: 3, messageId, payload };
  }

  if (type === 4) {
    if (value.length !== 5) throw new OcppProtocolError('OCPP CALLERROR must have five elements');
    const [, , errorCode, errorDescription, errorDetails] = value;
    if (typeof errorCode !== 'string' || !isErrorCode(errorCode)) throw new OcppProtocolError(`Invalid OCPP error code ${String(errorCode)}`);
    if (typeof errorDescription !== 'string') throw new OcppProtocolError('OCPP error description must be a string');
    if (!isRecord(errorDetails)) throw new OcppProtocolError('OCPP error details must be an object');
    return { type: 4, messageId, errorCode, errorDescription, errorDetails };
  }

  throw new OcppProtocolError(`Unsupported OCPP message type ${String(type)}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isErrorCode(value: string): value is OcppErrorCode {
  return (OCPP_ERROR_CODES as readonly string[]).includes(value);
}
