// scripts/acceptance_prom_check_v2.js
// Programmatically verifies PromQL conditions for Phases 1–3 plus tenant expectations.
// Posts a PASS/WARN/FAIL summary to Slack.
//
// Env:
//   PROM_URL (required) — e.g., https://prom.monitoring.svc:9090
//   SLACK_WEBHOOK_URL (optional) — Incoming Webhook URL
//   TENANT_EXPECTATIONS_FILE (optional) — default ./tenants_expectations.json
//
import fs from 'fs';
import fetch from 'node-fetch';

const PROM_URL = process.env.PROM_URL;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const TENANT_EXPECTATIONS_FILE = process.env.TENANT_EXPECTATIONS_FILE || './tenants_expectations.json';

if (!PROM_URL) {
  console.error('PROM_URL is required'); process.exit(2);
}

function mkurl(path, params={}) {
  const u = new URL(path, PROM_URL);
  for (const [k,v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

async function q(expr) {
  const res = await fetch(mkurl('/api/v1/query', { query: expr }));
  const j = await res.json();
  if (j.status !== 'success') throw new Error('Prometheus query failed: ' + JSON.stringify(j));
  return j.data.result;
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

const baseChecks = [
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

function loadTenantExpectations() {
  try {
    const txt = fs.readFileSync(TENANT_EXPECTATIONS_FILE, 'utf8');
    const arr = JSON.parse(txt);
    if (Array.isArray(arr)) return arr;
  } catch {}
  return [];
}

async function run() {
  const results = [];
  // Global checks
  for (const c of baseChecks) {
    try {
      if (c.kind === 'present') {
        const ok = await present(c.expr);
        results.push({ scope:'global', ...c, ok });
      } else {
        const { ok, v, err } = await compare(c.expr, c.op, c.threshold);
        results.push({ scope:'global', ...c, ok, value: v, err });
      }
    } catch (e) {
      results.push({ scope:'global', ...c, ok:false, err: String(e) });
    }
  }

  // Tenant checks
  const tenants = loadTenantExpectations();
  for (const t of tenants) {
    const pid = t.project_id;
    if (!pid) continue;

    const tChecks = [];
    if (typeof t.min_rps === 'number') {
      tChecks.push({
        id:`t_min_rps_${pid}`,
        kind:'cmp',
        expr:`sum(rate(axia_client_requests_total{project_id="${pid}"}[5m]))`,
        op:'ge', threshold: t.min_rps, severity:'required',
        desc:`${pid}: min req/s >= ${t.min_rps}`
      });
    }
    if (typeof t.max_retry_rps === 'number') {
      tChecks.push({
        id:`t_max_retry_${pid}`,
        kind:'cmp',
        expr:`sum(rate(axia_client_retries_total{project_id="${pid}"}[5m]))`,
        op:'le', threshold: t.max_retry_rps, severity:'warn',
        desc:`${pid}: retry req/s <= ${t.max_retry_rps}`
      });
    }
    if (typeof t.max_error_rps === 'number') {
      tChecks.push({
        id:`t_max_err_${pid}`,
        kind:'cmp',
        expr:`sum(rate(axia_client_errors_total{project_id="${pid}"}[5m]))`,
        op:'le', threshold: t.max_error_rps, severity:'warn',
        desc:`${pid}: error req/s <= ${t.max_error_rps}`
      });
    }
    if (typeof t.max_quota_ratio_projected === 'number') {
      tChecks.push({
        id:`t_quota_ratio_${pid}`,
        kind:'cmp',
        expr:`max(axia:tenant:quota_ratio_projected{project_id="${pid}"})`,
        op:'le', threshold: t.max_quota_ratio_projected, severity:'required',
        desc:`${pid}: projected 24h quota ratio <= ${t.max_quota_ratio_projected}`
      });
    }

    for (const c of tChecks) {
      try {
        const { ok, v, err } = await compare(c.expr, c.op, c.threshold);
        results.push({ scope:'tenant', ...c, ok, value: v, err });
      } catch (e) {
        results.push({ scope:'tenant', ...c, ok:false, err: String(e) });
      }
    }
  }

  const requiredFails = results.filter(r => r.severity === 'required' && !r.ok);
  const warnFails = results.filter(r => r.severity === 'warn' && !r.ok);
  const status = requiredFails.length ? 'FAIL' : (warnFails.length ? 'WARN' : 'PASS');

  const lines = results.map(r => {
    const icon = r.ok ? '✅' : (r.severity === 'warn' ? '⚠️' : '❌');
    const scope = r.scope === 'tenant' ? '(tenant)' : '(global)';
    const extra = (r.kind === 'cmp') ? ` (expr: ${r.expr} => ${r.value ?? 'n/a'})` : '';
    return `${icon} *${r.id}* ${scope} — ${r.desc}${extra}`;
  });

  const summary = `*Axia Acceptance (P1–P3) — ${status}*\n` + lines.map(l => `• ${l}`).join('\n');

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