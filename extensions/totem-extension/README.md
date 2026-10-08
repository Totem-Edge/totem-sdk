# Totem Browser Extension

MetaMask-style browser wallet for the Minima blockchain, featuring quantum-resistant WOTS cryptography and a standard dApp provider API.

---

## dApp Developer Guide

**Primary reference: [docs/TOTEM_CONNECT.md](docs/TOTEM_CONNECT.md)**

`TOTEM_CONNECT.md` is the single canonical guide for integrating your dApp with Totem. It covers:

- Provider API and connection flow
- All wallet RPC methods (`TOTEM_CONNECT`, `TOTEM_GET_ACCOUNTS`, `TOTEM_SEND_TRANSACTION`, etc.)
- Event subscriptions and lifecycle
- Transaction signing and broadcasting
- Multisig coordination
- Error codes and troubleshooting

> **Note:** The older files `DAPP_BUILDER_GUIDE.md`, `TOTEM_CONNECT_SPEC.md`, and `TOTEM_TX_SPEC.md` have all been superseded by `TOTEM_CONNECT.md`. Do not refer to them for new integrations.

---

## Quick Start

```javascript
// Discover available wallets via the totem:announce protocol
const TOTEM_ANNOUNCE = 'totem:announce';
const TOTEM_REQUEST_ANNOUNCE = 'totem:requestAnnounce';

let provider = null;

window.addEventListener(TOTEM_ANNOUNCE, (event) => {
  provider = event.detail.provider;
});
window.dispatchEvent(new CustomEvent(TOTEM_REQUEST_ANNOUNCE));

// (give ~300 ms for wallets to respond, or use WalletDiscovery from @totemsdk/connect)

// Connect and request accounts
const response = await provider.request({
  method: 'TOTEM_CONNECT',
  params: { origin: location.origin }
});
const { address } = response;

// Send a transaction
const tx = await provider.request({
  method: 'TOTEM_SEND_TRANSACTION',
  params: { origin: location.origin, request: { version: 1, outputs: [{ address: '<recipient>', amount: '10' }] } }
});
```

For the full API contract, see **[docs/TOTEM_CONNECT.md](docs/TOTEM_CONNECT.md)**.

---

## Development Setup

```bash
# Install dependencies
pnpm install

# Start development build with hot reload
npm run dev

# Run end-to-end tests
npm run test:e2e

# Production build
npm run build
```

---

## Distribution (direct download)

The extension is distributed as a **GitHub Release**, not on npm. The build
workflow (`.github/workflows/build-extension.yml`) keeps a rolling
`extension-latest` release updated on every change to
`extensions/totem-extension/**`, and additionally publishes versioned
`extension-v<version>` releases (the approval gate).

`totem.ing` links to the extension's own rolling release tag. This is
deliberately **not** GitHub's repo-wide `releases/latest` feed — that feed is
shared with the `@totemsdk/*` npm package releases, so it can point at an
unrelated package. The dedicated tag is owned by the extension workflow:

```
https://github.com/Totem-Edge/totem-sdk/releases/download/extension-latest/totem-extension.zip
https://github.com/Totem-Edge/totem-sdk/releases/download/extension-latest/totem-extension.crx
```

### Signing

The `.crx` is signed (CRX3) so Chrome accepts it. The PEM key **must stay stable** across releases: a different key makes Chrome treat the build as a different extension and refuse in-place updates. Store the PEM contents as the `EXTENSION_CRX_KEY` Actions secret. Without it, CI generates an ephemeral key and warns.

Generate the key once:

```bash
npx crx3 -p extension-key.pem -o /tmp/x.crx -z /tmp/x.zip -- dist
gh secret set EXTENSION_CRX_KEY -R Totem-Edge/totem-sdk < extension-key.pem
```

To ship a release:

```bash
git tag extension-v1.0.0 && git push origin extension-v1.0.0
# then publish a Release from that tag
```

---

## Project Structure

```
packages/totem-extension/
├── src/              # Extension source code
├── docs/
│   └── TOTEM_CONNECT.md      # Primary dApp developer guide (canonical)
├── manifest.json     # Extension manifest
├── popup.html        # Wallet popup UI
└── tests/            # Test suites
```

---

## Security

- All signing happens client-side; keys never leave the device
- PBKDF2 (100,000 iterations) + AES-GCM encryption for stored seeds
- Quantum-resistant WOTS signatures

[Security FAQ →](../../docs/developers/extension/security-faq.md)

---

## License

MIT — see [LICENSE](../../LICENSE) for details.
