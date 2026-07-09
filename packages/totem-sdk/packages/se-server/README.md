# @totemsdk/se-server

Self-hostable Statechain Entity (SE) server for the Minima Mercury protocol.
Run your own SE operator node — competing on uptime, fees, and latency with Axia's hosted instance.

## Quick start (Docker)

```bash
# 1. Generate a secure SE key (store this offline — losing it loses all chains)
node scripts/generate-se-key.mjs

# 2. Run with Docker Compose
SE_KEY=<your-64-char-hex-key> docker-compose -f docker-compose.se.yml up
```

The SE will be available at `http://localhost:4000/statechain`.

## Manual setup

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Set environment variables
export SE_KEY=<64-char hex>        # Required: 32-byte WOTS seed
export DATABASE_URL=postgres://...  # Required: Postgres connection string
export PORT=4000                    # Optional: default 4000
export SE_RECLAIM_TIMELOCK=256      # Optional: block timelock, default 256
export SE_BETA_MODE=true            # Optional: adds X-Beta headers

# Start
node dist/cli.js
```

## Generating an SE key

```bash
node scripts/generate-se-key.mjs
```

This outputs a random 64-character hex string. The SE derives its WOTS public key
from this seed using `sha3_256(seed || [0,0,0,0])`. The public key is what clients
store in `statechain_records.se_public_key` and what the SE Registry lists.

## Postgres setup

The server runs migrations automatically on startup. No manual schema setup required.

Minimum Postgres version: 12.

## API endpoints

All routes are mounted under `/statechain`:

| Method | Path | Description |
|---|---|---|
| `GET` | `/statechain/se-public-key` | Returns SE public key and reclaim timelock |
| `POST` | `/statechain/create` | Lock a coin into a new statechain |
| `GET` | `/statechain/:chainId/challenge` | Issue a nonce for ownership proof |
| `POST` | `/statechain/:chainId/blind-sign` | SE co-sign a state update |
| `POST` | `/statechain/:chainId/revoke-key` | Transfer ownership to new key |
| `GET` | `/statechain/:chainId` | Get chain status |
| `POST` | `/statechain/:chainId/claim` | Cooperative claim (SE countersigns) |
| `GET` | `/statechain/:chainId/reclaim-tx` | Retrieve pre-signed reclaim TX |

## SE Registry

Register your SE operator with the Axia SE Registry so wallets can discover it:

```bash
curl -X POST https://api.axia.to/public/se-registry/announce \
  -H 'Content-Type: application/json' \
  -d '{
    "sePublicKey": "<your-se-public-key>",
    "url": "https://your-se.example.com",
    "name": "My SE Operator",
    "feeBasisPoints": 10,
    "proofNonce": "<random-hex>",
    "proofSignature": "<wots-sig-over-se-announce:nonce:url>"
  }'
```

Registry entries expire after 7 days. Re-announce before expiry to stay listed.
Use `SE_REGISTRY_SELF_ANNOUNCE=true` on an Axia-API instance to auto-register at startup.

## Security checklist

- [ ] **Back up `SE_KEY` offline** — losing it makes all managed chains unrecoverable
- [ ] **Firewall port 4000** — only expose via a TLS-terminating reverse proxy (nginx/Caddy)
- [ ] **Rotate keys periodically** — create a new SE key and migrate chains before the old key expires
- [ ] **Monitor timelock alerts** — disputed chains approaching the reclaim window will be logged as warnings
- [ ] **Use a dedicated Postgres user** — grant only the tables this server needs
- [ ] **Enable Postgres SSL** — set `?sslmode=require` in `DATABASE_URL`

## Embedding in an existing Express app

```ts
import { createSeServer } from '@totemsdk/se-server';

const se = createSeServer({
  seSeed: Buffer.from(process.env.SE_KEY!, 'hex'),
  databaseUrl: process.env.DATABASE_URL!,
  onSign: ({ chainId, eventType, projectId }) => {
    // billing hook — deduct credits, log to audit trail, etc.
  },
});

// Mount the SE router at any path in your existing app
existingApp.use('/my-se', se.app);
```
