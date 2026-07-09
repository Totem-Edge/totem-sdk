// scripts/k6_summary_to_pushgateway.js
// Usage: node scripts/k6_summary_to_pushgateway.js <summary.json> <pushgateway_url> <repo> <sha> <base_url> <project_id>
import fs from 'fs';
import fetch from 'node-fetch';

const [,, summaryPath, pushUrl, repo, sha, baseUrl, projectId] = process.argv;
if (!summaryPath || !pushUrl) {
  console.error('Usage: node scripts/k6_summary_to_pushgateway.js <summary.json> <pushgateway_url> <repo> <sha> <base_url> <project_id>');
  process.exit(1);
}

const s = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

function get(path, def) {
  return path.split('.').reduce((o,k)=> (o && o[k] !== undefined) ? o[k] : undefined, s) ?? def;
}

const httpFailedRate = get('metrics.http_req_failed.rate', 0);
const httpDurP95 = get('metrics.http_req_duration.percentiles.p(95)', get('metrics.http_req_duration.percentiles["p(95)"]', 0));
const httpReqsRate = get('metrics.http_reqs.rate', 0);
const checksPasses = get('metrics.checks.passes', 0);
const checksFails = get('metrics.checks.fails', 0);
const dataRecvRate = get('metrics.data_received.rate', 0);
const dataSentRate = get('metrics.data_sent.rate', 0);

const labels = `repo="${repo}",sha="${sha}",base="${baseUrl}",project_id="${projectId}"`;

const lines = [
  `axia_k6_http_req_failed_rate{${labels}} ${httpFailedRate}`,
  `axia_k6_http_req_duration_p95_ms{${labels}} ${httpDurP95}`,
  `axia_k6_http_reqs_rate{${labels}} ${httpReqsRate}`,
  `axia_k6_checks_passes{${labels}} ${checksPasses}`,
  `axia_k6_checks_fails{${labels}} ${checksFails}`,
  `axia_k6_data_received_rate{${labels}} ${dataRecvRate}`,
  `axia_k6_data_sent_rate{${labels}} ${dataSentRate}`
].join('\n') + '\n';

const endpoint = `${pushUrl.replace(/\/$/, '')}/metrics/job/nightly_k6`;

fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: lines
}).then(async (res) => {
  if (!res.ok) {
    const t = await res.text();
    console.error('Pushgateway error', res.status, t);
    process.exit(2);
  } else {
    console.log('Pushed metrics to', endpoint);
  }
}).catch((e) => {
  console.error('Push failed', e);
  process.exit(3);
});