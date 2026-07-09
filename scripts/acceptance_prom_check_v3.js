// scripts/acceptance_prom_check_v3.js
import fs from 'fs';
import fetch from 'node-fetch';

const PROM_URL = process.env.PROM_URL;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const TENANT_EXPECTATIONS_FILE = process.env.TENANT_EXPECTATIONS_FILE || './tenants_expectations_ext.json';

if (!PROM_URL) {
  console.error('PROM_URL is required'); process.exit(2);
}

function url(path, params={}) {
  const u = new URL(path, PROM_URL);
  for (const [k,v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

async function q(expr) {
  const res = await fetch(url('/api/v1/query', { query: expr }));
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

const baseGlobal = [
  { id:'p1_rpc_present', kind:'present', expr:'axia_rpc_requests_total', severity:'required', desc:'RPC requests metric present' },
  { id:'p1_project_label', kind:'cmp', expr:'count(count by (project_id) (axia_rpc_requests_total))', op:'ge', threshold:1, severity:'required', desc:'project_id labeled' },
  { id:'p2_ingestor_present', kind:'present', expr:'axia_tlm_concurrency_in_flight', severity:'required', desc:'ingestor metrics present' },
  { id:'p2_pii_zero', kind:'cmp', expr:'sum(increase(axia_tlm_pii_drop_total[1h]))', op:'eq', threshold:0, severity:'required', desc:'PII drops (1h) == 0' },
  { id:'p2_card_zero', kind:'cmp', expr:'sum(increase(axia_tlm_cardinality_overflow_total[1h]))', op:'eq', threshold:0, severity:'required', desc:'Cardinality overflow (1h) == 0' },
  { id:'p3_blackbox_ok', kind:'cmp', expr:'sum(probe_success{job="blackbox-telemetry"})', op:'ge', threshold:3, severity:'required', desc:'blackbox healthz (3 targets) up' },
];

function loadTenants() {
  try {
    const t = fs.readFileSync(TENANT_EXPECTATIONS_FILE, 'utf8');
    const arr = JSON.parse(t);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function pushResult(results, scope, check, ok, value=null, err=null) {
  results.push({ scope, ...check, ok, value, err });
}

async function runTenantChecks(t, results) {
  const pid = t.project_id;
  // Basic availability/traffic
  if (typeof t.min_rps === 'number') {
    const check = { id:`t_min_rps_${pid}`, kind:'cmp', severity:'required',
      desc:`${pid}: min req/s >= ${t.min_rps}`,
      expr:`sum(rate(axia_client_requests_total{project_id="${pid}"}[5m]))`, op:'ge', threshold:t.min_rps };
    const { ok, v, err } = await compare(check.expr, check.op, check.threshold);
    pushResult(results, 'tenant', check, ok, v, err);
  }
  if (typeof t.max_retry_rps === 'number') {
    const check = { id:`t_max_retry_${pid}`, kind:'cmp', severity:'warn',
      desc:`${pid}: retry req/s <= ${t.max_retry_rps}`,
      expr:`sum(rate(axia_client_retries_total{project_id="${pid}"}[5m]))`, op:'le', threshold:t.max_retry_rps };
    const { ok, v, err } = await compare(check.expr, check.op, check.threshold);
    pushResult(results, 'tenant', check, ok, v, err);
  }
  if (typeof t.max_error_rps === 'number') {
    const check = { id:`t_max_err_${pid}`, kind:'cmp', severity:'warn',
      desc:`${pid}: error req/s <= ${t.max_error_rps}`,
      expr:`sum(rate(axia_client_errors_total{project_id="${pid}"}[5m]))`, op:'le', threshold:t.max_error_rps };
    const { ok, v, err } = await compare(check.expr, check.op, check.threshold);
    pushResult(results, 'tenant', check, ok, v, err);
  }
  if (typeof t.max_quota_ratio_projected === 'number') {
    const check = { id:`t_quota_ratio_${pid}`, kind:'cmp', severity:'required',
      desc:`${pid}: projected 24h quota ratio <= ${t.max_quota_ratio_projected}`,
      expr:`max(axia:tenant:quota_ratio_projected{project_id="${pid}"})`, op:'le', threshold:t.max_quota_ratio_projected };
    const { ok, v, err } = await compare(check.expr, check.op, check.threshold);
    pushResult(results, 'tenant', check, ok, v, err);
  }
  // Region coverage
  if (typeof t.min_distinct_regions === 'number') {
    const thr = Number(t.region_min_rps || 0.005);
    const check = { id:`t_regions_min_${pid}`, kind:'cmp', severity:'warn',
      desc:`${pid}: distinct regions with rps>${thr} >= ${t.min_distinct_regions}`,
      expr:`sum(sum by (region) (rate(axia_client_requests_total{project_id="${pid}"}[5m]) > ${thr}))`,
      op:'ge', threshold: t.min_distinct_regions };
    const { ok, v, err } = await compare(check.expr, check.op, check.threshold);
    pushResult(results, 'tenant', check, ok, v, err);
  }
  if (Array.isArray(t.required_regions) && t.required_regions.length) {
    const thr = Number(t.region_min_rps || 0.005);
    for (const r of t.required_regions) {
      const check = { id:`t_region_${pid}_${r}`, kind:'cmp', severity:'required',
        desc:`${pid}: region ${r} rps >= ${thr}`,
        expr:`sum(rate(axia_client_requests_total{project_id="${pid}",region="${r}"}[5m]))`,
        op:'ge', threshold: thr };
      const { ok, v, err } = await compare(check.expr, check.op, check.threshold);
      pushResult(results, 'tenant', check, ok, v, err);
    }
  }
  // Method presence and min rps
  if (Array.isArray(t.required_methods) && t.required_methods.length) {
    for (const m of t.required_methods) {
      const check = { id:`t_method_present_${pid}_${m}`, kind:'cmp', severity:'required',
        desc:`${pid}: method ${m} present (rps>0)`,
        expr:`sum(rate(axia_client_requests_total{project_id="${pid}",method="${m}"}[15m]))`,
        op:'gt', threshold: 0 };
      const { ok, v, err } = await compare(check.expr, check.op, check.threshold);
      pushResult(results, 'tenant', check, ok, v, err);
    }
  }
  if (t.methods_min_rps && typeof t.methods_min_rps === 'object') {
    for (const [m, thr] of Object.entries(t.methods_min_rps)) {
      const check = { id:`t_method_minrps_${pid}_${m}`, kind:'cmp', severity:'warn',
        desc:`${pid}: method ${m} rps >= ${thr}`,
        expr:`sum(rate(axia_client_requests_total{project_id="${pid}",method="${m}"}[5m]))`,
        op:'ge', threshold: Number(thr) };
      const { ok, v, err } = await compare(check.expr, check.op, check.threshold);
      pushResult(results, 'tenant', check, ok, v, err);
    }
  }
  // Latency p95 global and by region
  if (typeof t.p95_latency_s_max === 'number') {
    const check = { id:`t_p95_${pid}`, kind:'cmp', severity:'required',
      desc:`${pid}: p95 latency (s) <= ${t.p95_latency_s_max}`,
      expr:`histogram_quantile(0.95, sum(rate(axia_client_latency_seconds_bucket{project_id="${pid}"}[5m])) by (le))`,
      op:'le', threshold: t.p95_latency_s_max };
    const { ok, v, err } = await compare(check.expr, check.op, check.threshold);
    pushResult(results, 'tenant', check, ok, v, err);
  }
  if (t.p95_latency_s_max_by_region && typeof t.p95_latency_s_max_by_region === 'object') {
    for (const [region, maxv] of Object.entries(t.p95_latency_s_max_by_region)) {
      const check = { id:`t_p95_region_${pid}_${region}`, kind:'cmp', severity:'warn',
        desc:`${pid}: region ${region} p95 latency (s) <= ${maxv}`,
        expr:`histogram_quantile(0.95, sum(rate(axia_client_latency_seconds_bucket{project_id="${pid}",region="${region}"}[5m])) by (le))`,
        op:'le', threshold: Number(maxv) };
      const { ok, v, err } = await compare(check.expr, check.op, check.threshold);
      pushResult(results, 'tenant', check, ok, v, err);
    }
  }
  // Error & retry ratios
  if (typeof t.error_ratio_max === 'number') {
    const check = { id:`t_err_ratio_${pid}`, kind:'cmp', severity:'required',
      desc:`${pid}: error ratio <= ${t.error_ratio_max}`,
      expr:`(sum(rate(axia_client_errors_total{project_id="${pid}"}[5m])) / clamp_min(sum(rate(axia_client_requests_total{project_id="${pid}"}[5m])), 1e-6))`,
      op:'le', threshold: t.error_ratio_max };
    const { ok, v, err } = await compare(check.expr, check.op, check.threshold);
    pushResult(results, 'tenant', check, ok, v, err);
  }
  if (typeof t.retry_ratio_max === 'number') {
    const check = { id:`t_retry_ratio_${pid}`, kind:'cmp', severity:'warn',
      desc:`${pid}: retry ratio <= ${t.retry_ratio_max}`,
      expr:`(sum(rate(axia_client_retries_total{project_id="${pid}"}[5m])) / clamp_min(sum(rate(axia_client_requests_total{project_id="${pid}"}[5m])), 1e-6))`,
      op:'le', threshold: t.retry_ratio_max };
    const { ok, v, err } = await compare(check.expr, check.op, check.threshold);
    pushResult(results, 'tenant', check, ok, v, err);
  }
  // Retry-on-429 cap
  if (typeof t.retry_429_rps_max === 'number') {
    const check = { id:`t_retry_429_${pid}`, kind:'cmp', severity:'warn',
      desc:`${pid}: retry rps (429) <= ${t.retry_429_rps_max}`,
      expr:`sum(rate(axia_client_retries_total{project_id="${pid}",reason="429"}[5m]))`,
      op:'le', threshold: t.retry_429_rps_max };
    const { ok, v, err } = await compare(check.expr, check.op, check.threshold);
    pushResult(results, 'tenant', check, ok, v, err);
  }
  // Daily credits
  if (typeof t.credits_min_daily === 'number') {
    const check = { id:`t_credits_min_${pid}`, kind:'cmp', severity:'warn',
      desc:`${pid}: daily credits (requests) >= ${t.credits_min_daily}`,
      expr:`sum(increase(axia_credits_consumed_total{project_id="${pid}",unit="request"}[24h]))`,
      op:'ge', threshold: t.credits_min_daily };
    const { ok, v, err } = await compare(check.expr, check.op, check.threshold);
    pushResult(results, 'tenant', check, ok, v, err);
  }
  if (typeof t.credits_max_daily === 'number') {
    const check = { id:`t_credits_max_${pid}`, kind:'cmp', severity:'warn',
      desc:`${pid}: daily credits (requests) <= ${t.credits_max_daily}`,
      expr:`sum(increase(axia_credits_consumed_total{project_id="${pid}",unit="request"}[24h]))`,
      op:'le', threshold: t.credits_max_daily };
    const { ok, v, err } = await compare(check.expr, check.op, check.threshold);
    pushResult(results, 'tenant', check, ok, v, err);
  }
  // Version adoption min share
  if (t.min_version_share && typeof t.min_version_share === 'object') {
    const pattern = t.min_version_share.pattern;
    const win = t.min_version_share.window || '15m';
    const threshold = Number(t.min_version_share.min_share || 0.5);
    const expr = `(sum(rate(axia_client_requests_total{project_id="${pid}",client_version=~"${pattern}"}[${win}])) / clamp_min(sum(rate(axia_client_requests_total{project_id="${pid}"}[${win}])), 1e-6))`;
    const check = { id:`t_version_share_${pid}`, kind:'cmp', severity:'warn',
      desc:`${pid}: version share for /${pattern}/ >= ${threshold}`,
      expr, op:'ge', threshold };
    const { ok, v, err } = await compare(expr, 'ge', threshold);
    pushResult(results, 'tenant', check, ok, v, err);
  }
  // Required platforms min share
  if (Array.isArray(t.required_platforms) && t.required_platforms.length) {
    const minShare = Number(t.platform_min_share || 0.05);
    for (const plat of t.required_platforms) {
      const expr = `(sum(rate(axia_client_requests_total{project_id="${pid}",platform="${plat}"}[15m])) / clamp_min(sum(rate(axia_client_requests_total{project_id="${pid}"}[15m])), 1e-6))`;
      const check = { id:`t_platform_share_${pid}_${plat}`, kind:'cmp', severity:'warn',
        desc:`${pid}: platform ${plat} share >= ${minShare}`,
        expr, op:'ge', threshold: minShare };
      const { ok, v, err } = await compare(expr, 'ge', minShare);
      pushResult(results, 'tenant', check, ok, v, err);
    }
  }
}

async function run() {
  const results = [];
  // Global checks
  for (const c of baseGlobal) {
    try {
      if (c.kind === 'present') {
        const ok = await present(c.expr);
        pushResult(results, 'global', c, ok, null, null);
      } else {
        const { ok, v, err } = await compare(c.expr, c.op, c.threshold);
        pushResult(results, 'global', c, ok, v, err);
      }
    } catch (e) {
      pushResult(results, 'global', c, false, null, String(e));
    }
  }
  // Tenant checks
  const tenants = loadTenants();
  for (const t of tenants) {
    if (!t.project_id) continue;
    try {
      await runTenantChecks(t, results);
    } catch (e) {
      pushResult(results, 'tenant', { id:`t_error_${t.project_id}`, desc:`${t.project_id}: tenant check error`, severity:'required' }, false, null, String(e));
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

  const summary = `*Axia Extended Acceptance (P1–P3) — ${status}*\n` + lines.map(l => `• ${l}`).join('\n');

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