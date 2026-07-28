import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { init as initObservability } from '@totem/observability';

initObservability({
  dappId: import.meta.env?.VITE_DAPP_ID || 'dapp_starter_local',
  endpoint: import.meta.env?.VITE_TLM_ENDPOINT || 'https://telemetry.axia.to/v1/telemetry',
  hmacSecret: import.meta.env?.VITE_TLM_HMAC_SECRET,
  clientVersion: '0.1.0',
});
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
