// scripts/acceptance_prom_check.js
// Programmatically verifies PromQL conditions for Phases 1–3 and posts a Slack summary.
// Usage in CI: node scripts/acceptance_prom_check.js
import fetch from 'node-fetch';

const PROM_URL = process.env.PROM_URL;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

if (!PROM_URL) {
  console.error('PROM_URL is required'); process.exit(2);
}

function q(expr) {
  const u = new URL('/api/v1/query', PROM_URL);
  u.searchParams.set('query', expr);
  return fetch(u.toString()).then(r => r.json()).then(j => {
    if (j.status !== 'success') throw new Error('Prometheus query failed: ' + JSON.stringify(j));
    return j.data.result;
  });
}

function valueOf(result, def=0) {
  if (!result || result.length === 0) return def;
  const v = Number(result[0].value?.[1] ?? result[0].value ?? def);
  return Number.isFinite(v) ? v : def;
}

async function present(expr) {
  const res = await q(`absent(${expr})`);
  return res.length === 0;
}

async function compare(expr, op, threshold) {
  const r = await q(expr);
  const v = valueOf(r, 0);
  switch (op) {
    case 'gt': return { ok: v > threshold, v };
    case 'ge': return { ok: v >= threshold, v };
    case 'lt': return { ok: v < threshold, v };
    case 'le': return { ok: v <= threshold, v };
    case 'eq': return { ok: v === threshold, v };
    default: return { ok: false, v, err: 'unknown op' };
  }
}

const checks = [
  // Phase 1
  { id:'p1_rpc_present',        kind:'present', expr:'axia_rpc_requests_total', severity:'required', desc:'RPC requests metric present' },
  { id:'p1_project_label',      kind:'cmp',     expr:'count(count by (project_id) (axia_rpc_requests_total))', op:'ge', threshold:1, severity:'required', desc:'project_id labeled' },
  { id:'p1_rate_limit_present', kind:'present', expr:'axia_rate_limit_denied_total', severity:'required', desc:'rate limit metric present' },
  { id:'p1_idem_present',       kind:'present', expr:'axia_idem_collisions_total', severity:'required', desc:'idempotency metric present' },
  { id:'p1_credits_present',    kind:'present', expr:'axia_credits_consumed_total', severity:'required', desc:'credits metric present' },
  { id:'p1_quota_present',      kind:'present', expr:'axia_quota_limit', severity:'required', desc:'quota limit metric present' },

  // Phase 2
  { id:'p2_ingestor_present',   kind:'present', expr:'axia_tlm_concurrency_in_flight', severity:'required', desc:'ingestor metrics present' },
  { id:'p2_pii_zero',           kind:'cmp',     expr:'sum(increase(axia_tlm_pii_drop_total[1h]))', op:'eq', threshold:0, severity:'required', desc:'PII drops (1h) == 0' },
  { id:'p2_card_zero',          kind:'cmp',     expr:'sum(increase(axia_tlm_cardinality_overflow_total[1h]))', op:'eq', threshold:0, severity:'required', desc:'Cardinality overflow (1h) == 0' },
  { id:'p2_k6_present',         kind:'present', expr:'axia_k6_http_req_failed_rate', severity:'warn', desc:'k6 metrics present' },

  // Phase 3
  { id:'p3_zscore_retry',       kind:'present', expr:'axia:tenant:retry_zscore', severity:'required', desc:'retry z-score present' },
  { id:'p3_quota_ratio',        kind:'present', expr:'axia:tenant:quota_ratio_projected', severity:'required', desc:'quota ratio projected present' },
  { id:'p3_blackbox_ok',        kind:'cmp',     expr:'sum(probe_success{job="blackbox-telemetry"})', op:'ge', threshold:3, severity:'required', desc:'blackbox healthz (3 targets) up' },
];

async function run() {
  const results = [];
  for (const c of checks) {
    try {
      if (c.kind === 'present') {
        const ok = await present(c.expr);
        results.push({ ...c, ok });
      } else if (c.kind === 'cmp') {
        const { ok, v, err } = await compare(c.expr, c.op, c.threshold);
        results.push({ ...c, ok, value: v, err });
      } else {
        results.push({ ...c, ok:false, err:'unknown kind' });
      }
    } catch (e) {
      results.push({ ...c, ok:false, err: String(e) });
    }
  }

  const requiredFails = results.filter(r => r.severity === 'required' && !r.ok);
  const warnFails = results.filter(r => r.severity === 'warn' && !r.ok);
  const status = requiredFails.length ? 'FAIL' : (warnFails.length ? 'WARN' : 'PASS');

  const lines = results.map(r => {
    const icon = r.ok ? '✅' : (r.severity === 'warn' ? '⚠️' : '❌');
    const extra = (r.kind === 'cmp') ? ` (expr: ${r.expr} => ${r.value ?? 'n/a'})` : '';
    return `${icon} *${r.id}* — ${r.desc}${extra}`;
  });

  const summary = `*Axia Phases 1–3 Acceptance — ${status}*\n` + lines.map(l => `• ${l}`).join('\n');

  console.log(summary);

  if (SLACK_WEBHOOK_URL) {
    const payload = { text: summary, blocks: [{ type:'section', text:{ type:'mrkdwn', text: summary } }] };
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error('Slack post failed', res.status, await res.text());
      process.exit(3);
    }
  }

  process.exit(status === 'PASS' ? 0 : (status === 'WARN' ? 0 : 1));
}

run().catch(e => { console.error(e); process.exit(1); });