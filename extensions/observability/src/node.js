import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import crypto from 'node:crypto';

export function makeTraceparent() {
  const traceId = crypto.randomBytes(16).toString('hex');
  const spanId = crypto.randomBytes(8).toString('hex');
  return `00-${traceId}-${spanId}-01`;
}

function postEvent(opts, eventBody) {
  return new Promise((resolve) => {
    try {
      const u = new URL(opts.endpoint || 'https://telemetry.axia.to/v1/telemetry');
      const body = JSON.stringify({
        source: 'external_dapp',
        dapp_id: opts.dappId,
        events: [eventBody],
      });
      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Axia-Dapp-Id': opts.dappId,
      };
      if (opts.hmacSecret) {
        const ts = String(Math.floor(Date.now() / 1000));
        const sig = crypto.createHmac('sha256', opts.hmacSecret)
          .update(ts + '.').update(body).digest('hex');
        headers['X-Axia-Project-Id'] = opts.dappId;
        headers['X-Axia-Timestamp'] = ts;
        headers['X-Axia-Signature'] = `sha256=${sig}`;
      }
      const lib = u.protocol === 'http:' ? http : https;
      const req = lib.request(
        { method: 'POST', hostname: u.hostname, port: u.port, path: u.pathname, headers, timeout: 1500 },
        (res) => { res.on('data', () => {}); res.on('end', () => resolve(true)); }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.write(body);
      req.end();
    } catch (_) { resolve(false); }
  });
}

export async function emitInvocation(opts) {
  if (!opts || !opts.dappId) return;
  const platform = opts.platform || 'node';
  await postEvent(opts, {
    project_id: opts.dappId,
    method: opts.method || 'cli.invocation',
    client_version: opts.clientVersion || '0.1.0',
    platform,
    region: opts.region,
    ts: Date.now(),
    outcome: 'ok',
    source: 'external_dapp',
    dapp_id: opts.dappId,
  });
}

export default { makeTraceparent, emitInvocation };
