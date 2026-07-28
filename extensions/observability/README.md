# @totem/observability

Drop-in observability for any dApp built on top of `@totem/connect` / Totem wallet.

Streams the same kind of signals Axia uses internally (`axia_client_*`) into the
shared Loki / Prometheus / Tempo stack, scoped by a `dappId` issued through the
Axia Dashboard.

## Five-line install

```js
import { init } from '@totem/observability';

init({
  dappId: 'dapp_my_thing',           // mint one in the Axia Dashboard
  endpoint: 'https://telemetry.axia.to/v1/telemetry',
  // optional: hmacSecret, sampleRate, optOut, axiaHosts
});
```

That's it. Once `init()` runs, the package will:

- Auto-instrument `fetch` and `XHR` calls to `*.axia.to` with W3C
  `traceparent` headers.
- Capture connect / verify / sign-tx funnel events from
  `provider.request(...)` (the provider obtained via `totem:announce`).
- Capture `useAxiaPortfolio` / `useAxiaWs` outcomes from the `totem-dapp-starter`
  React hooks.
- Batch events in memory and ship them to `telemetry.axia.to/v1/telemetry`
  every 4s (or on `pagehide`).
- Sample (default 100% on errors, 25% on success), scrub PII (no addresses,
  no signatures, no public keys leave the page), and respect a global
  `localStorage` opt-out (`axia_obs_opt_out=1`).

## What we capture

| Event | Trigger | Fields |
|---|---|---|
| `connect` | `TOTEM_CONNECT` request | outcome, latency_ms, error_class |
| `verify` | `TOTEM_VERIFY` + `/api/auth/verify` | outcome, latency_ms, error_class, session_skipped |
| `send_tx` | `wots_sign` / submit_tx | outcome, latency_ms, error_class |
| `portfolio_fetch` | `useAxiaPortfolio` resolve/reject | outcome, latency_ms, address_count, token_count |
| `ws_event` | `useAxiaWs` connect/message/error | outcome, kind |
| `error` | uncaught error in instrumented path | message_class, source |

## What we do NOT capture

- No wallet addresses, public keys, signatures, or transaction payload bytes.
- No raw request/response bodies — only outcome class and latency.
- No cookies, no localStorage values other than the opt-out flag.

## Opt-out

```js
localStorage.setItem('axia_obs_opt_out', '1');
```

…or pass `optOut: true` to `init()` directly. No events will be batched or
sent.

## See also

- `docs/developers/observability/external-dapp-integration.md` — full guide.
- `docs/admins/ops/observability-coverage-audit.md` — coverage matrix.
