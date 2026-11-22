# PWA ↔ extension parity

Audit of the two wallets after aligning the PWA (`extensions/totem-pwa-wallet`,
served at `wallet.totem.ing/web/`) with the extension
(`extensions/totem-extension`).

Both wallets are expected to show the same **information**, in the same
**structure**, with the same **formatting rules**. Visual identity is shared
through the same CSS variables and the same six palettes.

## Surfaces

| Surface | Extension | PWA | Notes |
|---|---|---|---|
| Wallet / Home | `TotemHome` | `pages/Home.tsx` | balance card, USD + 24h, assets/NFT tabs, token rows |
| Send | `TotemSend` | `pages/Send.tsx` | address + QR, amount + MAX, token select, review, receipt |
| Receive | `TotemReceive` | `pages/Receive.tsx` | QR, address, copy |
| Activity | `TotemActivity` | `pages/Activity.tsx` | netted rows, day groups, state updates, cache |
| Transaction detail | `TotemTxDetail` | `pages/TxDetail.tsx` | legs, confirmations, explorer link, raw JSON |
| Token detail | `TotemTokenDetail` | `pages/TokenDetail.tsx` | artwork, vintage, verified, metadata, send/receive |
| Settings | `TotemSettings` | `pages/Settings.tsx` | accounts, network, appearance, connected apps, phrase, reset |
| Connected apps | `ConnectedSites` | Settings section | list + revoke (connection and spending permission) |

## Feature matrix

| Feature | Extension | PWA |
|---|---|---|
| Balance with live indicator | ✓ | ✓ |
| Fiat value + 24h change (CoinGecko) | ✓ | ✓ (no fabricated fallback price) |
| Assets / NFTs tabs with counts | ✓ | ✓ |
| Token artwork (`<artimage>`, ipfs, hex) | ✓ | ✓ |
| NFT badge, truncated token id, pending, coin count | ✓ | ✓ |
| Verified star (`webvalidate`) | ✓ | ✓ |
| Token detail page with vintage tier | ✓ | ✓ |
| Send: QR scanning | ✓ (scanner page) | ✓ (`BarcodeDetector`) |
| Send: MAX | – | ✓ |
| Send: review + WOTS one-time warning | ✓ | ✓ |
| Send: receipt with explorer link | ✓ | ✓ |
| Activity: one netted row per transaction | ✓ | ✓ |
| Activity: decoded token scale + names | ✓ | ✓ |
| Activity: day headers, state updates, block height | ✓ | ✓ |
| Activity: click → detail, explorer deep link | ✓ | ✓ |
| Activity: local cache for first paint | ✓ | ✓ |
| Connected apps: list + revoke | ✓ | ✓ |
| Theme palettes (6) | ✓ | ✓ |
| Accounts (multi-address switch) | ✓ | ✓ |
| Seed phrase backup (password gated) | ✓ | ✓ |
| Reset wallet | ✓ | ✓ |

## Deliberate deltas

- **Announcement banner** — the extension shows operator announcements on Home;
  the PWA shows its service-worker update banner instead. Marketing content is
  not part of wallet parity.
- **Receive account selector** — the extension's Receive page can pick any
  address; the PWA shows the active account, which is switched on Home and in
  Settings. Same capability, one click away.
- **Fiat fallback** — the extension falls back to a hardcoded price when
  CoinGecko fails; the PWA omits the fiat line instead of showing a stale figure.

## Data contract

Both wallets read the same archive-backed routes:

- `GET /v1/wallet/transactions/:address` — one row per (transaction, token),
  net movement, `decimals` per row.
- `GET /v1/wallet/transaction/:txpowid` — inputs/outputs with `decimals`.
- `GET /v1/portfolio/:address` — balances with `name`, `ticker`, `decimals`,
  artwork and `webvalidate`.

Amounts arrive as node `MiniNumber` text at 44 decimal places and are decoded
with the token's own scale by `decodeMinimaAmount` (mirrored in both wallets).
