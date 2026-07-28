import { recordIncident, acknowledgeIncident, resolveIncident, rejectIncident } from '../incidents.js';

describe('incidents', () => {
  describe('recordIncident', () => {
    it('records an incident', () => {
      const incident = recordIncident({ providerId: 'p-1', type: 'downtime', severity: 'high', now: 1000 });
      expect(incident.providerId).toBe('p-1');
      expect(incident.type).toBe('downtime');
      expect(incident.severity).toBe('high');
      expect(incident.status).toBe('open');
      expect(incident.createdAt).toBe(1000);
    });
  });

  describe('acknowledgeIncident', () => {
    it('acknowledges an incident', () => {
      const incident = recordIncident({ providerId: 'p-1', type: 'downtime', severity: 'high', now: 1000 });
      const acked = acknowledgeIncident(incident, 2000);
      expect(acked.status).toBe('acknowledged');
      expect(acked.resolvedAt).toBe(2000);
    });
  });

  describe('resolveIncident', () => {
    it('resolves an incident', () => {
      const incident = recordIncident({ providerId: 'p-1', type: 'downtime', severity: 'high', now: 1000 });
      const resolved = resolveIncident(incident, 3000);
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolvedAt).toBe(3000);
    });
  });

  describe('rejectIncident', () => {
    it('rejects an incident with reason', () => {
      const incident = recordIncident({ providerId: 'p-1', type: 'downtime', severity: 'high', now: 1000 });
      const rejected = rejectIncident(incident, 'false alarm', 4000);
      expect(rejected.status).toBe('rejected');
      expect(rejected.message).toContain('false alarm');
    });
  });
});
