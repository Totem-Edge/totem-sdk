// tools/minima-sim/src/sequencer.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
const fs = require('fs');
const yaml = require('yaml');

const { Behavior } = require('./behavior');
const { loadScenario } = require('./scenario');
const { simBlendAlpha, simScenario, simTransitions } = require('./metrics');

type ScheduleEntry = {
  at: string;                 // "HH:MM" (24h)
  scenario: string;           // path to scenario YAML
  rampSeconds?: number;       // optional override; default from schedule.rampSeconds
};

type ScheduleSpec = {
  timezone?: string;          // e.g. "Europe/Zurich"
  rampSeconds?: number;       // default ramp time between scenarios
  loop?: boolean;             // default true (diurnal loop)
  entries: ScheduleEntry[];
};

export class ScenarioSequencer {
  private schedule: ScheduleSpec;
  private tz: string;
  private timer?: NodeJS.Timeout;
  private currentIdx = 0;
  private current: { name: string; scenario: any } | null = null;
  private target: { name: string; scenario: any } | null = null;
  private rampStart = 0;
  private rampDur = 0;
  private lastScenarioName = '';

  constructor(schedulePath: string) {
    this.schedule = this.loadSchedule(schedulePath);
    this.tz = this.schedule.timezone || process.env.TZ || 'UTC';
  }

  private loadSchedule(path: string): ScheduleSpec {
    const raw = fs.readFileSync(path, 'utf8');
    const spec = yaml.parse(raw) as ScheduleSpec;
    if (!spec.entries?.length) throw new Error('Schedule has no entries');
    spec.loop = spec.loop !== false;
    spec.rampSeconds = spec.rampSeconds ?? 300;
    // basic validation
    spec.entries.forEach((e, i) => {
      if (!/^\d{2}:\d{2}$/.test(e.at)) throw new Error(`Invalid time at entries[${i}].at`);
      if (!e.scenario) throw new Error(`Missing scenario at entries[${i}]`);
    });
    return spec;
  }

  /** parse "HH:MM" for today's date in TZ; return seconds since midnight */
  private secondsSinceMidnight(tz: string): number {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(new Date());
    const get = (t: string) => Number(parts.find(p => p.type === t)?.value || 0);
    return get('hour') * 3600 + get('minute') * 60 + get('second');
  }

  private entryToSeconds(entry: ScheduleEntry): number {
    const [hh, mm] = entry.at.split(':').map(Number);
    return hh * 3600 + mm * 60;
  }

  /** pick current schedule index based on local time */
  private indexForNow(nowSec: number): number {
    const secs = this.schedule.entries.map(e => this.entryToSeconds(e)).sort((a,b)=>a-b);
    let idx = secs.findIndex(s => nowSec < s);
    if (idx === -1) idx = secs.length - 1;       // after last entry → last index
    else idx = Math.max(0, idx - 1);             // previous entry is active
    // map back to original order index
    const targetSec = secs[idx];
    return this.schedule.entries.findIndex(e => this.entryToSeconds(e) === targetSec);
  }

  /** compute blend of rules A→B given alpha [0..1] */
  private static blendRules(a: any[], b: any[], alpha: number): any[] {
    const byMatch = new Map<string, { a?: any; b?: any }>();
    for (const r of a) byMatch.set(r.match, { ...(byMatch.get(r.match)||{}), a: r });
    for (const r of b) byMatch.set(r.match, { ...(byMatch.get(r.match)||{}), b: r });

    const mixNum = (x?: number, y?: number) => {
      if (x == null && y == null) return undefined;
      if (x == null) return y;
      if (y == null) return x;
      return x * (1 - alpha) + y * alpha;
    };

    const out: any[] = [];
    for (const [match, pair] of byMatch) {
      const srcA = pair.a || { match };
      const srcB = pair.b || { match };
      const enabled =
        (srcA.enabled ?? true) === (srcB.enabled ?? true)
          ? (srcA.enabled ?? true)
          : alpha < 0.5 ? (srcA.enabled ?? true) : (srcB.enabled ?? true);

      // failure mode: step at 0.5
      const failure = alpha < 0.5 ? (srcA.failure || 'none') : (srcB.failure || 'none');

      out.push({
        match,
        baseLatencyMs: mixNum(srcA.baseLatencyMs, srcB.baseLatencyMs),
        jitterMs: mixNum(srcA.jitterMs, srcB.jitterMs),
        errorRate: mixNum(srcA.errorRate, srcB.errorRate),
        enabled,
        failure
      });
    }
    return out;
  }

  /** Start sequencing; updates Behavior in-place */
  start(behavior: any, updateMeta?: (meta: { name: string; region?: string; nodeType?: string }) => void) {
    // Seed current/next based on time
    const nowSec = this.secondsSinceMidnight(this.tz);
    this.currentIdx = this.indexForNow(nowSec);

    const curEntry = this.schedule.entries[this.currentIdx];
    const nxtEntry = this.schedule.entries[(this.currentIdx + 1) % this.schedule.entries.length];

    this.current = { name: curEntry.scenario, scenario: loadScenario(curEntry.scenario) };
    this.target  = { name: nxtEntry.scenario, scenario: loadScenario(nxtEntry.scenario) };

    behavior.setRules(this.current.scenario.rules);
    this.bumpScenarioMetric(this.current.name);

    updateMeta?.({
      name: this.current.scenario.name || this.current.name,
      region: this.current.scenario.region,
      nodeType: this.current.scenario.nodeType
    });

    // compute next ramp window start
    const nextStartSec = this.entryToSeconds(nxtEntry);
    const secondsUntilNext = ((nextStartSec - nowSec) + 86400) % 86400;
    this.rampDur = (nxtEntry.rampSeconds ?? this.schedule.rampSeconds!) * 1000;
    this.rampStart = Date.now() + Math.max(0, (secondsUntilNext * 1000 - this.rampDur));

    // tick loop
    this.timer = setInterval(() => this.tick(behavior, updateMeta), 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  private bumpScenarioMetric(name: string) {
    if (this.lastScenarioName) {
      simScenario.labels(this.lastScenarioName).set(0);
    }
    simScenario.labels(name).set(1);
    this.lastScenarioName = name;
  }

  private rotateToNext() {
    this.currentIdx = (this.currentIdx + 1) % this.schedule.entries.length;
    const curEntry = this.schedule.entries[this.currentIdx];
    const nxtEntry = this.schedule.entries[(this.currentIdx + 1) % this.schedule.entries.length];
    this.current = { name: curEntry.scenario, scenario: loadScenario(curEntry.scenario) };
    this.target  = { name: nxtEntry.scenario, scenario: loadScenario(nxtEntry.scenario) };
    this.bumpScenarioMetric(this.current.name);
    simTransitions.inc();
    // next ramp window
    const nextStartSec = this.entryToSeconds(nxtEntry);
    const nowSec = this.secondsSinceMidnight(this.tz);
    const secondsUntilNext = ((nextStartSec - nowSec) + 86400) % 86400;
    this.rampDur = (nxtEntry.rampSeconds ?? this.schedule.rampSeconds!) * 1000;
    this.rampStart = Date.now() + Math.max(0, (secondsUntilNext * 1000 - this.rampDur));
  }

  private tick(behavior: any, updateMeta?: (meta: { name: string; region?: string; nodeType?: string }) => void) {
    if (!this.current || !this.target) return;

    const now = Date.now();
    // ramp not started yet
    if (now < this.rampStart) {
      simBlendAlpha.set(0);
      return;
    }

    const alpha = Math.min(1, (now - this.rampStart) / this.rampDur);
    simBlendAlpha.set(alpha);

    const blendedRules = ScenarioSequencer.blendRules(this.current.scenario.rules, this.target.scenario.rules, alpha);
    behavior.setRules(blendedRules);

    // when we finish the ramp, lock in target as current and compute the next target
    if (alpha >= 1) {
      // final switch: also propagate metadata (region/nodeType/name)
      updateMeta?.({
        name: this.target.scenario.name || this.target.name,
        region: this.target.scenario.region,
        nodeType: this.target.scenario.nodeType
      });
      // finalize current = target, advance next
      this.rotateToNext();
    }
  }
}