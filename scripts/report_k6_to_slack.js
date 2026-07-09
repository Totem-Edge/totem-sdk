// scripts/report_k6_to_slack.js
// Reads Pushgateway metrics and posts a summary to Slack via webhook.
import fetch from 'node-fetch';

const PUSHGATEWAY_URL = process.env.PUSHGATEWAY_URL;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const PROJECT_ID = process.env.K6_PROJECT_ID || 'totem-shared';
const REPO = process.env.GITHUB_REPOSITORY || process.env.REPO || 'axia/monorepo';

if (!PUSHGATEWAY_URL || !SLACK_WEBHOOK_URL) {
  console.error('Missing PUSHGATEWAY_URL or SLACK_WEBHOOK_URL');
  process.exit(1);
}

const endpoint = `${PUSHGATEWAY_URL.replace(/\/$/, '')}/metrics/job/nightly_k6`;

function parsePromText(text) {
  const lines = text.split(/\n+/).filter(l => l && !l.startsWith('#'));
  const metrics = {};
  for (const l of lines) {
    const m = l.match(/^(\w+)(\{[^}]*\})?\s+([\d\.eE+-]+)$/);
    if (!m) continue;
    const name = m[1];
    const labels = m[2] || '';
    const value = Number(m[3]);
    if (!metrics[name]) metrics[name] = [];
    metrics[name].push({ labels, value });
  }
  return metrics;
}

function pickByLabel(arr, key, val) {
  return arr?.find(s => s.labels.includes(`${key}="${val}"`)) || arr?.[0];
}

function fmtPct(x) { return (x * 100).toFixed(2) + '%'; }
function fmtMs(x) { return Number(x).toFixed(0) + ' ms'; }
function fmtRate(x) { return Number(x).toFixed(2) + '/s'; }

(async () => {
  const res = await fetch(endpoint);
  if (!res.ok) {
    console.error('Pushgateway fetch failed', res.status);
    process.exit(2);
  }
  const text = await res.text();
  const m = parsePromText(text);

  const failed = pickByLabel(m['axia_k6_http_req_failed_rate'], 'project_id', PROJECT_ID)?.value ?? 0;
  const p95 = pickByLabel(m['axia_k6_http_req_duration_p95_ms'], 'project_id', PROJECT_ID)?.value ?? 0;
  const rps = pickByLabel(m['axia_k6_http_reqs_rate'], 'project_id', PROJECT_ID)?.value ?? 0;

  const summary = `*Nightly k6* (${REPO}, project: \`${PROJECT_ID}\`)\n• Failure rate: *${fmtPct(failed)}*\n• p95: *${fmtMs(p95)}*\n• RPS: *${fmtRate(rps)}*`;

  const payload = {
    text: summary,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: summary } }
    ]
  };

  const s = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!s.ok) {
    console.error('Slack post failed', s.status, await s.text());
    process.exit(3);
  }
  console.log('Posted nightly k6 summary to Slack');
})();