# Chrome Web Store Submission Notes

## Justification for Sensitive Permissions

### `<all_urls>` in content_scripts
The content script matches `<all_urls>` because Totem is a dApp wallet that must inject its provider (`src/provider.js`) into every page a user might visit. dApps can run on any domain — there is no finite allowlist of dApp URLs. The content script:
- Only injects the provider script into the page's main world.
- Only relays messages for an allowlist of `TOTEM_*` methods to the background service worker.
- Does not read or modify page content.
- Uses `document_start` timing to ensure the provider is available before any dApp script runs.

Alternatives considered and rejected:
- A curated allowlist would miss new or self-hosted dApps.
- Per-site user activation would break dApps that auto-detect the wallet on page load.

### `tabs` permission
Required by `chrome.tabs.query({})` at `background/index.ts:4181` to find and notify open tabs when a user disconnects a site. On disconnect, the service worker queries all tabs for matching origins and sends an `accountsChanged` event so open dApps react immediately.

### `storage` permission
Required for all wallet state persistence: encrypted seed, connected sites, transaction history, feature flags, and settings. All data stored in `chrome.storage.local` (never synced).

### `alarms` permission
Required for:
- Balance keepalive alarm (1-minute interval) — keeps the service worker alive while the wallet has active sessions.
- Future scheduled features (e.g., transaction expiry notifications).

### `activeTab` permission
Required to open approval popups (connect, transaction signing, permissions) via `chrome.windows.create` in response to dApp requests.

### `https://telemetry.axia.to/*` host permission
Used **only** to send anonymous, opt-in telemetry. No telemetry is collected or transmitted unless the user explicitly enables "Anonymous Usage Data" in Settings (default: **off**). The toggle is stored in `chrome.storage.local` under `totem_telemetry_consent` and is gated in `src/telemetry.ts`.

### Telemetry data minimization
`telemetry.axia.to` host permission exists purely to support the opt-in feature. When enabled, the extension sends only:
- An opaque `project_id`, event `method`, extension `client_version`, platform, timestamp, latency, outcome, error class, retry count, and credit usage.
- **No** wallet addresses, public keys, seed material, transaction content, page URLs, or site origins are ever collected.
- The full allowlist is defined in `src/telemetry.ts` (`TlmEvent`), which strips all fields outside the allowlist before enqueueing.

## Justification for CSP Exceptions

### `'wasm-unsafe-eval'`
Required for client-side TxPoW mining using the bundled `miner.wasm` WASM binary from `@totemsdk/txpow`. Mining must execute in the service worker context to avoid blocking the UI. The WASM binary is:
- Bundled with the extension (not fetched from a remote URL).
- Used exclusively for SHA3-256 hash computation during proof-of-work.
- Falls back to server-side mining if WASM initialization fails.

### `'unsafe-inline'` for `style-src`
Required by Tailwind CSS, which generates inline styles at build time. All styles are determined at compile time — no user-controlled CSS is injected.

## WASM Disclosure

The extension bundles `miner.wasm` (SHA3-256 TxPoW miner compiled from Rust). During Chrome Web Store review, please note:
- **Source**: `@totemsdk/txpow` package, compiled from Rust via `wasm-pack`.
- **Purpose**: Client-side proof-of-work computation for Minima blockchain transactions.
- **Execution context**: Service worker only. Never executed in page contexts.
- **No network access**: The WASM binary performs pure computation. No network, file system, or system API access.

## Privacy Disclosure

See `PRIVACY.md` for the complete privacy policy. Key points for the Store privacy questionnaire:

1. **User data collected**: Wallet addresses (local only), encrypted seed (local only), connected sites (local only).
2. **Network requests**: Balance/transaction API (`api.axia.to`), **opt-in anonymous telemetry only** (`telemetry.axia.to`, disabled by default), price ticker (CoinGecko), token image loading (IPFS).
3. **Data sharing**: No user data is sold or shared. Telemetry is anonymous, **opt-in only** (default off), and does not include wallet addresses, keys, or transaction data.
4. **Data handling**: Private keys never leave the device. Seed phrases are encrypted with AES-256-GCM using the user's password.

## Build Instructions

```bash
# 1. Build SDK dependencies
pnpm install
pnpm run -r build

# 2. Build extension
cd extensions/totem-extension
npm run build:artifact
```

The production artifact is in `extensions/totem-extension/dist/`. Verify with:
```bash
node verify-extension.js
```

## Versioning

Extension version follows semver. Update `manifest.json` and `package.json` before each submission. Include a changelog entry in the Store description.
