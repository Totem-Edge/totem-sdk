# Chrome Web Store Submission

Current status and the exact remaining steps to publish the Totem extension.

The extension is distributed **direct-download first** (GitHub Release → totem.ing)
and **Chrome Web Store second**. Both paths use the same signing key and therefore
the same extension ID.

---

## 1. Signing key (do this first — it fixes the extension ID)

The extension ID is derived from the CRX signing key (or, for an unpacked build,
from the manifest `key`). Set the key once; every build and the Store listing
then share one ID, and in-place updates work.

```bash
# 1. Generate a key (only once — never regenerate; back it up offline)
npx crx3 -p extension-key.pem -o /tmp/x.crx -z /tmp/x.zip -- dist

# 2. Store it as the CI secret
gh secret set EXTENSION_CRX_KEY -R Totem-Edge/totem-sdk < extension-key.pem

# 3. Print the extension ID this key produces
node scripts/print-extension-id.js extension-key.pem
```

- The PEM is gitignored. **Losing it means you can never update the published extension.**
- CI writes the public half into `dist/manifest.json` as `"key"` (see
  `scripts/set-manifest-key.js`), so Load-unpacked and `.crx` installs match.

> Without this secret, CI generates an ephemeral key: the `.crx` won't update
> in place and the ID changes every build. Treat it as a hard prerequisite.

---

## 2. Build the submission artifact

```bash
# From the repo root — builds the SDK packages the extension imports
pnpm \
  --filter @totemsdk/core --filter @totemsdk/txpow --filter @totemsdk/connect \
  --filter @totemsdk/realtime --filter @totemsdk/chain-provider \
  --filter @totemsdk/wots-lease --filter @totemsdk/root-identity \
  --filter @totemsdk/storage --filter @totemsdk/minima-rpc \
  --filter @totemsdk/lookup-protocol run build

# Build the extension
cd extensions/totem-extension
npm run build            # → dist/
node verify-extension.js # structure + manifest + bundle-size checks
```

The uploadable package is a **zip of `dist/`** (not the `.crx`). CI produces this
automatically as `totem-extension.zip`.

---

## 3. Store listing assets (not yet created — required)

The Dashboard needs these before you can submit. None exist in the repo yet:

| Asset | Spec | Status |
|---|---|---|
| Screenshots | 1280×800 or 640×400, JPEG/PNG, 1–5 | **TODO** |
| Small promo tile | 440×280 | **TODO** |
| Marquee promo tile | 1400×560 (optional) | **TODO** |
| Store icon | 128×128 | ✅ `icons/icon-128.png` |
| Short description | ≤ 132 chars | **TODO** (draft below) |
| Detailed description | long-form | **TODO** (structure below) |
| Category | Product / Productivity? → **Productivity** recommended | **TODO** |
| Language | English (US) | — |
| Homepage URL | `https://totem.ing` | ✅ (in manifest `homepage_url`) |
| Privacy policy URL | `https://totem.ing/privacy` | ✅ (page now live) |
| Support URL | `mailto:support@totem.ing` (or a /support page) | ⚠️ footer only |

**Short description draft:**
> Self-custodial Minima wallet with quantum-resistant WOTS signatures. Your keys never leave your device.

**Detailed description structure:** what it is → self-custody/security →
dApp connection (Totem Connect) → supported networks → link to docs.

---

## 4. Privacy disclosures (Store questionnaire)

Answers must match `PRIVACY.md` and `https://totem.ing/privacy`.

**Single purpose:** "A self-custodial cryptocurrency wallet for the Minima network."

**Data collected / used:**

| Data type | Collected? | Purpose | Sold/shared? |
|---|---|---|---|
| Authentication info (seed/keys) | Stored **locally only** | Wallet function | No |
| Personal communications | No | — | — |
| Financial info (addresses, tx) | Locally; addresses sent only when user signs | Wallet function | No |
| Location | No | — | — |
| Web history | No (content script doesn't read page content) | — | — |
| User activity (opt-in telemetry) | **Only if user opts in** | Diagnostics | No |

**Remote code:** No. All code is bundled; `miner.wasm` ships in the package and is
used only for local TxPoW computation.

**Certifications** (must be true): no selling data, no unrelated purposes, no
creditworthiness use. All hold.

---

## 5. Permission & CSP justifications

Paste these into the Dashboard's justification fields.

### `<all_urls>` (content script)
Injects the wallet provider into every page so any dApp can detect it — there is
no finite allowlist of dApp URLs. The content script only injects the provider and
relays `TOTEM_*` messages to the service worker; it does not read or modify page
content. `document_start` ensures the provider exists before dApp scripts run.

### `tabs`
`chrome.tabs.query({})` finds open tabs to notify (`accountsChanged`) when a user
disconnects a site.

### `storage`
Local wallet state: encrypted seed, connected sites, permissions, history, settings.
`chrome.storage.local` only — never synced.

### `alarms`
Keeps the service worker alive while a session is active (balance keepalive).

### `activeTab`
Opens approval popups (connect / sign / permissions) in response to dApp requests.

### Host permissions (`*.axia.to`, `telemetry.axia.to`)
`api/rpc.axia.to` are required for balance and transaction submission.
`telemetry.axia.to` is used **only** for opt-in anonymous telemetry (default off),
gated in `src/telemetry.ts`, payload allowlisted to version/event/timing/outcome —
no addresses, keys, content, or origins. `coingecko` (price) and `ipfs.io` (token
images) are reached via `optional_host_permissions` (`https://*/*`).

### CSP: `'wasm-unsafe-eval'`
Required for local TxPoW mining with the bundled `miner.wasm` (from
`@totemsdk/txpow`). Runs in the service worker only; pure SHA3-256 computation, no
network or filesystem access.

### CSP: `'unsafe-inline'` (style-src)
Tailwind emits inline styles at build time; no user-controlled CSS.

---

## 6. Versioning

Bump `version` in **both** `manifest.json` and `package.json` before each
submission. Include release notes in the Store description. Never reuse a version.

---

## 7. Release & distribution

Publishing an `extension-v<version>` **Release** on GitHub is the approval gate.
It triggers `.github/workflows/build-extension.yml`, which:

1. builds the extension,
2. signs `totem-extension.crx`, writes `totem-extension.zip` and the
   `totem-extension.xml` update manifest,
3. updates the rolling `extension-latest` release (resolved by
   `releases/download/extension-latest/totem-extension.zip` on totem.ing),
4. also uploads them as CI artifacts.

```bash
# 1. bump version, commit, tag
git tag extension-v1.0.0 && git push origin extension-v1.0.0
# 2. publish a Release from that tag (this is the approval step)
```

For the Store, upload the **zip** via the Developer Dashboard. For direct
download and enterprise policy, the Release supplies the zip, crx, and xml.

---

## 8. Pre-submission checklist

- [ ] `EXTENSION_CRX_KEY` secret set (stable extension ID)
- [ ] Version bumped in `manifest.json` + `package.json`
- [ ] `npm run build` + `node verify-extension.js` pass
- [ ] Store listing assets produced (screenshots, promo tiles, descriptions)
- [ ] Privacy questionnaire answers match `PRIVACY.md` / `/privacy`
- [ ] Permission + CSP justifications pasted
- [ ] `https://totem.ing/privacy` reachable (Store requires a live policy URL)
- [ ] Support contact reachable (`support@totem.ing`)
- [ ] `extension-v<version>` tagged and Release published
- [ ] Zip uploaded to the Developer Dashboard
