import { recordProbe, recordHeartbeat } from '../probes.js';

describe('probes', () => {
  describe('recordProbe', () => {
    it('records a probe with deterministic ID', () => {
      const probe = recordProbe({ providerId: 'p-1', type: 'heartbeat', ok: true, now: 1000 });
      expect(probe.providerId).toBe('p-1');
      expect(probe.type).toBe('heartbeat');
      expect(probe.ok).toBe(true);
      expect(probe.observedAt).toBe(1000);
      expect(probe.probeId).toBeDefined();
    });

    it('records a failed probe', () => {
      const probe = recordProbe({ providerId: 'p-1', type: 'endpoint', ok: false, latencyMs: 500, now: 1000 });
      expect(probe.ok).toBe(false);
      expect(probe.latencyMs).toBe(500);
    });
  });

  describe('recordHeartbeat', () => {
    it('records a heartbeat probe', () => {
      const probe = recordHeartbeat('p-1', 1000);
      expect(probe.type).toBe('heartbeat');
      expect(probe.ok).toBe(true);
      expect(probe.providerId).toBe('p-1');
    });
  });
});
