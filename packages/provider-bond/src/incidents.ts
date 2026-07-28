import type { IncidentRecord, RecordIncidentParams } from './types.js';

let incidentCounter = 0;

export function recordIncident(params: RecordIncidentParams): IncidentRecord {
  const now = params.now ?? Date.now();
  incidentCounter++;
  return {
    incidentId: `incident-${now}-${incidentCounter}`,
    providerId: params.providerId,
    type: params.type,
    severity: params.severity,
    status: 'open',
    createdAt: now,
    message: params.message,
    metadata: params.metadata,
  };
}

export function acknowledgeIncident(incident: IncidentRecord, now?: number): IncidentRecord {
  return {
    ...incident,
    status: 'acknowledged',
    resolvedAt: now ?? Date.now(),
  };
}

export function resolveIncident(incident: IncidentRecord, now?: number): IncidentRecord {
  return {
    ...incident,
    status: 'resolved',
    resolvedAt: now ?? Date.now(),
  };
}

export function rejectIncident(incident: IncidentRecord, reason: string, now?: number): IncidentRecord {
  return {
    ...incident,
    status: 'rejected',
    resolvedAt: now ?? Date.now(),
    message: incident.message ? `${incident.message} (rejected: ${reason})` : `Rejected: ${reason}`,
  };
}
