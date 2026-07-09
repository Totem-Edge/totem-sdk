# totem-pear-android-starter

Quickstart scaffold: `@totemsdk/pear` adapters wired into `@totemsdk/edge` for a mobile Pear app, with Omnia L2 payment channels.

**Full guide:** [`docs/developers/sdk/edge-android-quickstart`](https://github.com/MrGheek/axia-totem/blob/main/packages/docs-site/docs/developers/sdk/edge-android-quickstart.md)

## Quick start

```bash
cp config.json.example config.json   # fill in minimaNodeUrl + axiaApiKey
npm install
node app.js                           # or: pear run --dev .
```

## What's here

| File | Purpose |
|---|---|
| `app.js` | Entry point — all wiring in one annotated file |
| `src/storage/seedStore.js` | Seed persistence via `BareKVStore` |
| `src/ports/liquidityPort.js` | `EdgeLiquidityPort` — balance + UTXOs |
| `src/ports/paymentPort.js` | `EdgePaymentPort` — on-chain send |
| `src/ports/lookupPort.js` | `EdgeLookupPort` — lookup + polling watch |
| `src/omnia/channelManager.js` | Omnia L2 channels over Axia hosted relay |
