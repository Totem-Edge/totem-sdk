// const { MethodRule, Scenario } = require('./scenario');
type MethodRule = any;
type Scenario = any;

function pick<T>(arr: T[]) { return arr[Math.floor(Math.random()*arr.length)]; }

export class Behavior {
  private start = Date.now();
  private rules: MethodRule[];
  private timeline: any[];

  constructor(private scenario: Scenario) {
    this.rules = scenario.rules || [];
    this.timeline = scenario.timeline || [];
  }

  /** allow sequencer to replace the active rule set (blending or final switch) */
  setRules(rules: MethodRule[]) {
    this.rules = rules;
    // timeline remains from original scenario until fully switched; OK for MVP
  }

  /** Apply timeline mutations based on elapsed time */
  tick() {
    const elapsedSec = Math.floor((Date.now() - this.start) / 1000);
    (this.timeline || [])
      .filter(ev => ev.atSec === elapsedSec)
      .forEach(ev => {
        const tgt = ev.set?.forMatch;
        if (tgt) this.rules = this.rules.map(r => r.match === tgt ? { ...r, ...ev.set } : r);
        else this.rules = this.rules.map(r => ({ ...r, ...ev.set }));
      });
  }

  /** Find rule for a command */
  ruleFor(cmd: string): MethodRule {
    // exact match first
    const exact = this.rules.find(r => r.match.toLowerCase() === cmd.toLowerCase());
    if (exact) return exact;
    // wildcard
    const star = this.rules.find(r => r.match === '*');
    return star || { match: '*', baseLatencyMs: 50, jitterMs: 10, errorRate: 0, enabled: true, failure: 'none' };
  }

  /** Decide latency and failure for this call */
  decide(cmd: string) {
    this.tick();
    const r = this.ruleFor(cmd);
    const enabled = r.enabled !== false;
    const base = r.baseLatencyMs ?? 50;
    const jitter = r.jitterMs ?? 10;
    const latency = Math.max(0, base + (Math.random()*2-1) * jitter);
    const err = Math.random() < (r.errorRate ?? 0);
    const failure = err ? (r.failure || pick(['http500','timeout','malformed'])) : 'none';
    return { enabled, latency, failure };
  }
}