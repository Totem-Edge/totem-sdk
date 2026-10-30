# Chrome Web Store Submission

Current status: **v1.0.12 is built and published as a signed GitHub release; the Store bundle passes the dynamic-code/permission checks. Awaiting upload and submission in the Chrome Web Store Developer Dashboard.**

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

## 3. Store listing assets (prepared)

The Dashboard needs these assets. They are checked into the repository:

| Asset | Spec | Status |
|---|---|---|
| Screenshots | 1280×800 or 640×400, JPEG/PNG, 1–5 | ✅ `store-assets/screenshots/` |
| Small promo tile | 440×280 | ✅ `store-assets/small-promo-440x280.png` |
| Marquee promo tile | 1400×560 (optional) | ✅ `store-assets/marquee-1400x560.png` |
| Store icon | 128×128 | ✅ `icons/icon-128.png` |
| Short description | ≤ 132 chars | ✅ below |
| Detailed description | long-form | ✅ below |
| Category | **Productivity** | ✅ selected |
| Language | English (US) | ✅ |
| Homepage URL | `https://totem.ing` | ✅ (in manifest `homepage_url`) |
| Privacy policy URL | `https://totem.ing/privacy` | ✅ (page now live) |
| Support URL | `https://totem.ing/support` | ✅ live |

**Short description:**
> Self-custodial Minima wallet with quantum-resistant WOTS signatures. Your keys never leave your device.

**Detailed description:**
>
> Totem is a self-custodial wallet for the Minima network. It generates and
> stores your keys on your device, signs locally, and connects to dApps through
> an explicit consent flow. Minima uses WOTS/TreeKey signatures, a
> quantum-resistant design. Send and receive MIN and tokens, manage NFTs,
> inspect balances, and connect to Axia or a paired lookup node. Your seed is
> never sent to a server.

**Listing notes:** Browser transaction mining is disabled in the Store build;
TxPoW is mined by the Axia/Hawk node. The extension requests HTTP(S) page access
only to inject the Totem provider for dApp connection and relays consent/signing
messages without reading page content. The Chrome Web Store origins are explicitly
excluded from content-script injection. Optional host permissions are used only
for self-hosted node pairing. The Store bundle contains no dynamically evaluated
code and no `tabs` or `activeTab` permission.

---

## 4. Privacy disclosures (Store questionnaire)

Answers must match `PRIVACY.md` and `https://totem.ing/privacy`.

**Single purpose:** "A self-custodial cryptocurrency wallet for the Minima network."

**Data collected / used:**

| Data type | Collected? | Purpose | Sold/shared? |
|---|---|---|---|
| Authentication info (seed/keys) | Stored **locally only** | Wallet function | No |
| Personal communications | No | — | — |
| Financial info (addresses, tx) | Addresses sent to Axia for portfolio/balance and transaction preparation | Wallet function | No |
| Location | No | — | — |
| Web history | No (content script doesn't read page content) | — | — |
| User activity (opt-in telemetry) | **Only if user opts in** | Diagnostics | No |

**Remote code:** No. All executable code is bundled. The bundled WebAssembly is
the Totem cryptographic core used for SHA3/WOTS operations; browser TxPoW mining
was removed from the Store build. The production JS bundle is scanned for
`new Function`, `eval`, `return require`, and `importScripts` before release.

**Certifications** (must be true): no selling data, no unrelated purposes, no
creditworthiness use. All hold.

---

## 5. Permission & CSP justifications

Paste these into the Dashboard's justification fields.

### HTTP(S) page access (content script)
Injects the wallet provider into HTTP(S) pages so any dApp can detect it — there
is no finite allowlist of dApp URLs. The content script only injects the provider
and relays allowlisted `TOTEM_*` messages to the service worker; it does not read
or modify page content. `document_start` ensures the provider exists before dApp
scripts run. `https://chromewebstore.google.com/*` and
`https://chrome.google.com/webstore/*` are excluded.

### `tabs` / `activeTab`
Not requested. `chrome.tabs.create()` for internal approval pages and
`chrome.tabs.sendMessage()` for disconnect events do not require these
permissions. The disconnect fan-out no longer reads tab URLs.

### `storage`
Local wallet state: encrypted seed, connected sites, permissions, history, settings.
`chrome.storage.local` only — never synced.

### `alarms`
Keeps the service worker alive while a session is active (balance keepalive).

### Host permissions
`api.axia.to` and `rpc.axia.to` are required for balance, portfolio, and
transaction submission. `api2.axia.to` is the WAF-bypass submission host.
`telemetry.axia.to` is used **only** for opt-in anonymous telemetry (default off),
gated in `src/telemetry.ts`, with an allowlisted payload (version/event/timing/
outcome; no addresses, keys, content, or origins). `api.coingecko.com` supplies
the MIN price. `ipfs.io` resolves token/NFT artwork. Self-hosted node origins
are requested at runtime through `optional_host_permissions`.

### CSP: `'wasm-unsafe-eval'`
Required for the bundled Totem WebAssembly cryptographic core (SHA3/WOTS). No
browser TxPoW mining is included in the Store build; no remote code is loaded.

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
git tag extension-v1.0.12 && git push origin extension-v1.0.12
# 2. publish a Release from that tag (this is the approval step)
```

For the Store, upload the **zip** via the Developer Dashboard. For direct
download and enterprise policy, the Release supplies the zip, crx, and xml.

---

## 8. Pre-submission checklist

- [x] `EXTENSION_CRX_KEY` secret set (stable extension ID)
- [x] Version bumped in `manifest.json` + `package.json` (1.0.12)
- [x] `npm run build` + `node verify-extension.js` pass
- [x] Production bundle scan: no `new Function`, `eval`, `return require`, or `importScripts`
- [x] Extension tests pass (88 tests + verification binding)
- [x] Store listing assets produced (screenshots, promo tiles, descriptions)
- [x] Privacy questionnaire answers match `PRIVACY.md` / `/privacy`
- [ ] Permission + CSP justifications pasted in Dashboard
- [ ] `https://totem.ing/privacy` reachable (Store requires a live policy URL)
- [ ] Support contact reachable (`support@totem.ing`)
- [x] `extension-v1.0.12` tagged and signed Release published
  - https://github.com/Totem-Edge/totem-sdk/releases/tag/extension-v1.0.12
- [ ] Zip uploaded to the Developer Dashboard
- [ ] Store listing reviewed and submitted for Chrome Web Store review

## 9. Dashboard-only submission steps

These require the Chrome Web Store developer account that owns the Totem item:

1. Open the Developer Dashboard and select (or create) the Totem item.
2. Upload `totem-extension-v1.0.12.zip` from the release above.
3. Set the listing fields and upload the assets from section 3.
4. Complete the privacy practices questionnaire and paste the permission/CSP
   justifications from section 5.
5. Confirm distribution, pricing, and support contact, then submit for review.

No code changes are required for this step.

