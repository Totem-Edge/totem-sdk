# Deploying the Totem PWA wallet

The wallet is served by the `totem-pwa-wallet` Cloudflare Pages project on
`wallet.totem.ing`. It is being moved under `/web` so the wallet host root can
serve the portfolio:

| Path | Served by |
|---|---|
| `wallet.totem.ing/` | portfolio (Toteming Pages project) |
| `wallet.totem.ing/web/` | this PWA |
| `wallet.totem.ing/web/provider.js` | this PWA's dApp provider |
| `wallet.totem.ing/web/approval/*` | this PWA's approval pages |

## Build

```bash
cd extensions/totem-pwa-wallet
VITE_BASE_PATH=/web/ npm run build
```

`VITE_BASE_PATH` controls the Vite base, the PWA manifest scope/start URL, the
service-worker scope, the provider's approval URLs and the icon URLs. The
default is `/`, which keeps the old root deployment working during migration.

The build also pins `@totemsdk/core-wasm` to its browser artifact; the root
export otherwise selects the Node build and crashes on `__dirname`.

## Deploy

The Pages project is deployed by upload (no git integration), so deploy the
built directory explicitly:

```bash
npx wrangler pages deploy dist --project-name=totem-pwa-wallet
```

The supported release path is the **Deploy Totem PWA** GitHub Actions workflow
(`.github/workflows/deploy-pwa.yml`). It builds the PWA with
`VITE_BASE_PATH=/web/`, verifies the production assets, and deploys with
`wrangler pages deploy`.

Required repo secrets:

```text
CLOUDFLARE_API_TOKEN   # Pages:Edit
CLOUDFLARE_ACCOUNT_ID
```

Run it:

```bash
gh workflow run deploy-pwa.yml --repo Totem-Edge/totem-sdk \
  --ref main -f branch=main
```

Use `branch=web-preview` for the preview alias. A push to `main` does not deploy
the PWA automatically; manual dispatch is the promotion gate.

Preview the `/web` migration without touching production:

```bash
npx wrangler pages deploy dist --project-name=totem-pwa-wallet --branch=web-preview
```

The preview alias is `https://web-preview.totem-pwa-wallet.pages.dev`. It exposes
`/web/` and `/_worker.js` routes `/web/*` to the PWA and everything else to the
portfolio origin (`PORTFOLIO_ORIGIN`, default `https://toteming.pages.dev`).

## Routing

`public/_worker.js` is a Pages advanced-mode worker:

- `/web` redirects to `/web/`
- `/web/*` serves the PWA with the prefix stripped
- `/early-access` redirects to `/`
- everything else is proxied to the portfolio origin

Do not deploy this worker to production until the portfolio host is ready; at
that point `wallet.totem.ing/` becomes the portfolio and the PWA stays at `/web`.
