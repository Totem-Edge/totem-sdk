# Totem dApp Starter

A minimal, production-ready React + Vite starter template implementing the
**TOTEM_CONNECT v4.0.0** patterns. Copy this template to start building a
decentralized application on the Minima network without any boilerplate.

---

## What's included

| Pattern | File |
|---------|------|
| `TotemProvider` (v4.3 — discovery, no balance) | `src/totem-context.jsx` |
| `useAxiaPortfolio` hook | `src/hooks/useAxiaPortfolio.js` |
| Axia WebSocket subscription | `src/hooks/useAxiaWs.js` |
| Connect / Verify flow | `src/components/LandingPage.jsx`, `NavBar.jsx` |
| Balance display via Axia API | `src/components/PortfolioCard.jsx` |
| Send transaction | `src/components/SendForm.jsx` |
| **On-chain hash anchoring (Integritas)** | `src/hooks/useIntegritasProof.js`, `src/components/AnchorProof.jsx` |
| Backend proxy (API key stays server-side) | `server/index.js` |

### v4.0.0 key principles

- **Totem is a consent and signing standard — not a data oracle.**
  Balance, UTXOs, and portfolio data come from the **Axia API**, never from
  wallet events.

- **CONNECT + VERIFY is one atomic step.**
  `TOTEM_VERIFY` is called immediately after `TOTEM_CONNECT`, with no
  intermediate UI or buttons. This is mandatory and has no exceptions.

- **API key stays on the server.**
  The Express backend proxies all Axia API calls. The raw key never appears
  in browser JavaScript.

---

## Prerequisites

- **Node.js** 18 or newer
- **Totem Browser Extension** installed in your browser
  (get it at <https://totem.minima.global>)
- An **Axia API key** (free tier at <https://api.axia.to>)

---

## Quick start

### 1. Clone / copy

```bash
# Clone the starter directly
git clone https://github.com/axia-to/totem-dapp-starter my-dapp
cd my-dapp

# Or scaffold via CLI
npx create-totem-app my-dapp
cd my-dapp
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure your environment

```bash
cp .env.example .env
# Edit .env — at minimum set AXIA_API_KEY and SESSION_SECRET:
#   AXIA_API_KEY=axia_key_your_key_here
#   SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

`SESSION_SECRET` must be set in production so session tokens survive server
restarts and work across multiple server instances. See `.env.example` for full
instructions.

### 4. Run in development mode

```bash
npm run dev
```

This starts two processes concurrently:

| Process | Port | Command |
|---------|------|---------|
| Vite dev server (frontend) | 5174 | `npm run dev:client` |
| Express backend (API proxy) | 3001 | `npm run dev:server` |

Open <http://localhost:5174> in a browser with the Totem extension installed.

### 5. Connect your wallet

Click **Connect Wallet**. The extension opens an address picker, then a
verification confirmation popup. After both popups are approved, the dashboard
displays your balance fetched from the Axia API.

---

## Project structure

```
totem-dapp-starter/
├── server/
│   └── index.js              Express backend — proxies Axia API calls
├── src/
│   ├── App.jsx               App root — wraps tree in <TotemProvider>
│   ├── main.jsx              React entry point
│   ├── totem-context.jsx     TotemProvider + useTotem (v4.0.0)
│   ├── hooks/
│   │   ├── useAxiaPortfolio.js    Fetch balance from Axia API
│   │   ├── useAxiaWs.js           Real-time updates via Axia WebSocket
│   │   └── useIntegritasProof.js  On-chain hash anchoring via Integritas
│   └── components/
│       ├── NavBar.jsx/css         Connect / disconnect button
│       ├── LandingPage.jsx/css    Pre-connect landing
│       ├── Dashboard.jsx/css      Authenticated view
│       ├── PortfolioCard.jsx/css  Balance display
│       ├── SendForm.jsx/css       TOTEM_SEND_TRANSACTION form
│       └── AnchorProof.jsx        Hash stamping UI (Integritas)
├── index.html
├── vite.config.js
├── package.json
├── .env.example
└── README.md
```

---

## Backend API endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/portfolio/:address` | Proxies `GET /v1/{AXIA_PROJECT_ID}/portfolio/:address` from Axia API |
| `GET /api/price` | Proxies `GET /v1/{AXIA_PROJECT_ID}/price/minima?vs=usd` from Axia API |
| `GET /api/ws-token` | Issues a short-lived WebSocket token for the Axia balance stream |
| `POST /api/proof/stamp` | Stamps a hex hash on Minima via Integritas. Body: `{ hash }`. Returns `{ ok, txId?, anchorRef?, timestamp? }`. `INTEGRITAS_API_KEY` stays server-side. |
| `POST /api/auth/verify` | Receives TOTEM_VERIFY proof, validates it, mints a 24-hour session token (HttpOnly cookie + body), and records it in the server-side store. Stub — replace WOTS verification with real `TreeKey.verify()` check. |
| `GET /api/auth/session` | Returns `{ valid, address, expiresAt }` — checks both the token signature **and** the server-side session record. Returns `{ valid: false, reason: "revoked" }` if the session was logged out. |
| `POST /api/auth/refresh` | Extends the session (reset 24-hour TTL) without a new WOTS signature, as long as the 7-day max-lifetime has not elapsed. Rotates the server-side record. |
| `POST /api/auth/logout` | Immediately revokes the session by removing its server-side record and clearing the cookie. Safe to call on explicit disconnect. |

### Session lifecycle

```
First connect (no active session):
  TOTEM_CONNECT → GET /api/auth/session (invalid) → POST /api/auth/refresh (fail)
  → TOTEM_VERIFY → POST /api/auth/verify → session token set (24 h, cookie + body)
  → TOTEM_GET_ACCOUNTS

Subsequent connects within 24 h:
  TOTEM_CONNECT → GET /api/auth/session (valid, same address) → SKIP TOTEM_VERIFY
  → TOTEM_GET_ACCOUNTS  ← no WOTS leaf consumed

After 24 h but within 7 days:
  TOTEM_CONNECT → GET /api/auth/session (expired) → POST /api/auth/refresh (ok)
  → SKIP TOTEM_VERIFY → TOTEM_GET_ACCOUNTS  ← no WOTS leaf consumed

After 7 days or explicit logout:
  Same as first connect — TOTEM_VERIFY is triggered once.
```

### SESSION_SECRET and server-side session store

Session tokens are validated against a **server-side store** keyed by the token's
`jti` claim. A valid token whose record is absent from the store is treated as
revoked — this enables instant logout even if the cookie is still live.

Two store backends are selected automatically at startup:

| Condition | Store | Sessions survive restart? | Multi-server safe? |
|-----------|-------|--------------------------|-------------------|
| `REDIS_URL` not set | In-memory `Map` | **No** | **No** |
| `REDIS_URL` set | Redis | **Yes** | **Yes** (all instances share the same Redis) |

**Development / single-server:**  
Omit `REDIS_URL`. Set a stable `SESSION_SECRET` in `.env`. Sessions are cleared when the process exits (users must re-verify on the next server restart).

**Production / multi-server:**  
Set both `SESSION_SECRET` and `REDIS_URL` in `.env`. All instances must share the same values. Session records are stored in Redis with a TTL matching the token expiry, so they survive restarts and are visible across all instances.

```bash
# Generate a strong SESSION_SECRET (run once):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Real-time balance updates (Axia WebSocket)

`useAxiaWs` implements the §5.2 pattern from TOTEM_CONNECT.md:

1. The frontend calls `GET /api/ws-token` — your backend calls
   `POST https://api.axia.to/v1/wallet/ws-token` with the server-side API key
   and returns the short-lived token.
2. The hook opens
   `wss://api.axia.to/v1/wallet/balance/ws?token=<token>&address=<address>`.
3. On every `utxoChanged` message the hook calls `refresh()` from
   `useAxiaPortfolio`, triggering a REST re-fetch for the latest balance.

Tokens are short-lived. The hook reconnects automatically before expiry.

---

## On-chain hash anchoring (Integritas)

`useIntegritasProof` gives any component one-line access to Minima's
[Integritas](https://integritas.minima.global) proof-of-existence service.

### 3-line setup

```bash
# 1. Add your Integritas API key to .env (optional — works without one at lower rate limits)
echo "INTEGRITAS_API_KEY=integritas_key_your_key_here" >> .env

# 2. Use the hook in any component — the key never leaves the server
```

```jsx
import { useIntegritasProof } from '../hooks/useIntegritasProof.js';

function MyComponent() {
  const { stamp, stamping, result } = useIntegritasProof();

  return (
    <button onClick={() => stamp('a3f1b2c4d5e6...')} disabled={stamping}>
      {stamping ? 'Anchoring…' : 'Stamp on Minima'}
    </button>
  );
}
// result.txId — the Minima transaction ID confirming the on-chain anchor
```

The `AnchorProof` component in the dashboard is a ready-made example you can
copy, extend, or replace with your own UI. It calls `POST /api/proof/stamp`
on your Express backend, which forwards the hash to Integritas using
`@totemsdk/proof-integritas` — the `INTEGRITAS_API_KEY` stays server-side,
consistent with the rest of the starter's security model.

---

## Build for production

```bash
npm run build
# Output: dist/
```

Serve the `dist/` folder with any static host (Vercel, Netlify, Cloudflare
Pages, NGINX…). Run `server/index.js` on a Node.js server alongside it,
setting `AXIA_API_KEY` in your server environment.

---

## Production hardening

Before deploying this starter to production, address the following:

| Item | Status | Action required |
|------|--------|-----------------|
| WOTS signature verification | **Implemented** | `/api/auth/verify` calls `@totem/sdk-core`'s `verifySignatureDetailed(address, message, signature, publicKey)` one-liner, which re-derives the Minima address from `publicKey`, parses the WOTS `TreeSignature`, and verifies it against `sha3_256(message)`. v4.1 signs from the connected spend address, so the address↔publicKey binding check inside the helper holds for every valid proof. |
| HTTPS | Required | The Totem provider API only works on HTTPS origins. Use TLS in production (Cloudflare, nginx, etc.). |
| Session issuance | **Included** | `POST /api/auth/verify` mints a 24-hour HMAC-SHA256 session token and sets an HttpOnly cookie. `GET /api/auth/session` and `POST /api/auth/refresh` allow the client to skip TOTEM_VERIFY on subsequent connects. Set `SESSION_SECRET` in `.env`. |
| Session secret | **Action required** | Set `SESSION_SECRET` in `.env` to a 32+ byte random secret. Without it, tokens are re-keyed on every server restart. |
| Rate limiting | Not included | Add rate limiting to `/api/auth/verify`, `/api/auth/refresh`, and `/api/portfolio/:address` to prevent abuse. |
| Permissions scope | Minimal | Call `TOTEM_GRANT_TX_PERMISSION` with specific intents (`send`, `token_send`) and short expiry (7–30 days) before `TOTEM_SEND_TRANSACTION`. |
| API key rotation | Manual | Rotate `AXIA_API_KEY` periodically and never expose it client-side. |

---

## Security checklist (from TOTEM_CONNECT.md §15)

- [x] `TOTEM_VERIFY` is called only when no valid session exists (session-gated)
- [x] `TOTEM_VERIFY` (v4.1) signs from the connected spend address — `deriveAddress(publicKey) === address` holds
- [x] Server verifies proofs with `@totem/sdk-core`'s `verifySignatureDetailed(address, message, signature, publicKey)` one-liner
- [x] API key is server-side only — never in `fetch()` from the browser
- [x] `accountsChanged` listener resets UI on disconnect
- [x] Balance comes from Axia API, not wallet events
- [x] Session token issued after TOTEM_VERIFY (HttpOnly cookie + response body)
- [x] `GET /api/auth/session` and `POST /api/auth/refresh` endpoints present
- [ ] Set `SESSION_SECRET` env var to a persistent secret in production
- [ ] Add HTTPS in production
- [ ] Scope permissions via `TOTEM_GRANT_TX_PERMISSION` as needed

---

## Further reading

- **TOTEM_CONNECT.md** — `packages/totem-extension/docs/TOTEM_CONNECT.md`
  Full v4.0.0 specification: all RPC methods, events, React patterns, security model.
- **Axia API** — `https://api.axia.to` for base URL, rate limits, and endpoint docs.
