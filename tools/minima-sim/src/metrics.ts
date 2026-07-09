const client = require('prom-client');
export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'sim_' });

export const simReqs = new client.Counter({
  name: 'sim_requests_total',
  help: 'Total RPC requests',
  labelNames: ['method'] as const
});
export const simErrors = new client.Counter({
  name: 'sim_errors_total',
  help: 'Simulated errors by reason',
  labelNames: ['reason'] as const
});
export const simLatency = new client.Histogram({
  name: 'sim_latency_ms',
  help: 'Simulated latency',
  labelNames: ['method'] as const,
  buckets: [10,25,50,100,200,400,800,1500,3000]
});
/** Current scenario marker (label holds scenario name). Set 1 for current, 0 for previous. */
export const simScenario = new client.Gauge({
  name: 'sim_scenario',
  help: 'Current active scenario (label=scenario, value=1 for current)',
  labelNames: ['scenario']
});

/** Blend factor during ramp [0..1] */
export const simBlendAlpha = new client.Gauge({
  name: 'sim_blend_alpha',
  help: 'Scenario blend factor during ramp [0..1]'
});

/** Count transitions */
export const simTransitions = new client.Counter({
  name: 'sim_transitions_total',
  help: 'Total number of scenario transitions'
});

registry.registerMetric(simReqs);
registry.registerMetric(simErrors);
registry.registerMetric(simLatency);
registry.registerMetric(simScenario);
registry.registerMetric(simBlendAlpha);
registry.registerMetric(simTransitions);