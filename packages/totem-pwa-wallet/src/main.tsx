import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './theme/axia-tokens.css';
import { init as initObs, track } from './core/observability';

initObs({
  dappId: import.meta.env.VITE_OBS_DAPP_ID ?? 'totem-pwa-wallet',
  endpoint: import.meta.env.VITE_OBS_ENDPOINT ?? 'https://api.axia.to/v1/telemetry',
  clientVersion: '1.0.0',
});

// Track PWA install events for observability
window.addEventListener('appinstalled', () => {
  track('pwa.installed');
});

// Track provider events from the dApp injection layer with required fields
window.addEventListener('totem#connect-requested', (e) => {
  const d = (e as CustomEvent<{ callerOrigin?: string; method?: string; mode?: string }>).detail ?? {};
  track('provider.connect.requested', {
    callerOrigin: d.callerOrigin ?? document.referrer ?? '',
    method: d.method ?? 'TOTEM_CONNECT',
    mode: d.mode ?? 'popup',
  });
});

// provider.connect.approved / rejected are emitted via totem#result on redirect return
window.addEventListener('totem#result', (e) => {
  const d = (e as CustomEvent<{ result?: { error?: string }; method?: string }>).detail ?? {};
  const method = d.method ?? 'TOTEM_CONNECT';
  const isError = !!(d.result as { error?: string } | undefined)?.error;
  track(isError ? 'provider.connect.rejected' : 'provider.connect.approved', { method });
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
