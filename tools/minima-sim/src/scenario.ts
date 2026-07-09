const fs = require('fs');
const yaml = require('yaml');

export type FailureMode = 'none' | 'timeout' | 'http500' | 'malformed' | 'drop';

export type MethodRule = {
  match: string; // e.g. "status", "balance", "*" wildcard
  baseLatencyMs?: number;
  jitterMs?: number;
  errorRate?: number; // 0..1
  failure?: FailureMode;
  enabled?: boolean; // capability toggle
};

export type TimedEvent = {
  atSec: number; // seconds since start
  set?: Partial<MethodRule> & { forMatch?: string };
};

export type Scenario = {
  name: string;
  region?: string;
  nodeType?: 'rpc'|'meg'|'hybrid';
  healthScore?: number;
  responseShape?: 'ok'|'degraded'|'flaky';
  rules: MethodRule[];
  timeline?: TimedEvent[];
};

export function loadScenario(path?: string): Scenario {
  if (!path) {
    return {
      name: 'default',
      region: 'eu-west',
      nodeType: 'rpc',
      responseShape: 'ok',
      healthScore: 100,
      rules: [{ match: '*', baseLatencyMs: 50, jitterMs: 20, errorRate: 0, enabled: true }]
    };
  }
  const txt = fs.readFileSync(path, 'utf8');
  return yaml.parse(txt) as Scenario;
}