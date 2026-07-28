# Privacy Policy — Totem Extension

## Data Collection

The Totem Extension collects minimal data necessary for wallet operation:

### Collected (always)
- **Wallet addresses** — stored locally in `chrome.storage.local`. Never transmitted except when the user explicitly signs a transaction.
- **Encrypted seed phrase** — stored locally in `chrome.storage.local`. Never transmitted. Encrypted with a user-chosen password using AES-256-GCM.

### Collected (with consent)
- **Connected sites list** — origins of dApps the user has explicitly connected to. Stored locally.
- **Transaction permissions** — per-site transaction approval grants. Stored locally.

### Network requests
The extension makes requests to:
- `api.axia.to` / `rpc.axia.to` — Axia API for balance queries, transaction submission, and account state. Required for wallet operation.
- `telemetry.axia.to` — anonymous usage telemetry (version, feature usage). No personal data, wallet addresses, or keys.
- `api.coingecko.com` — MINIMA price ticker for fiat display in the wallet UI.
- `ipfs.io` — IPFS gateway for token image loading.

### Telemetry details
Telemetry payload is a JSON POST containing:
- Extension version
- Feature event name (e.g., `wallet_created`, `transaction_signed`)
- Anonymous session ID (rotated on each service worker start)

Telemetry does NOT include: wallet addresses, seed phrases, private keys, transaction amounts, connected site URLs, or any personally identifiable information.

### NOT collected
Totem Extension never collects:
- Private keys or seed phrases (never leave the device)
- Browsing history
- Passwords
- Personal identifiable information
- IP addresses (API requests go directly to Axia, not through a Totem proxy)

### Third-party sharing
No user data is sold or shared with third parties. Network requests are limited to the services listed above, all of which are required for wallet functionality.

### Data retention
- Wallet data persists in `chrome.storage.local` until the user removes the extension or explicitly clears wallet data.
- Telemetry logs are retained for 90 days on the Axia telemetry server.

## Changes
This policy may be updated. Continued use after changes constitutes acceptance of the updated policy.
