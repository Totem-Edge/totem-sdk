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
npm install

# Start development build with hot reload
npm run dev

# Run end-to-end tests
npm run test:e2e

# Production build
npm run build
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
