import { track } from './index.js';

export function instrumentPortfolio(result) {
  try {
    track({
      kind: 'portfolio_fetch',
      outcome: result && !result.error ? 'ok' : 'error',
      error_class: result && result.error ? 'fetch' : undefined,
      latency_ms: result && result.latency_ms,
    });
  } catch (_) {}
}

export function instrumentWs() {
  try { track({ kind: 'ws_event', outcome: 'ok', latency_ms: 0 }); } catch (_) {}
}

export default { instrumentPortfolio, instrumentWs };
