---
id: typescript-configuration
title: TypeScript Configuration
sidebar_label: TypeScript Configuration
description: Required tsconfig.json settings when using @totemsdk packages in a TypeScript project.
---

# TypeScript Configuration

## The DOM lib requirement

Several `@totemsdk` packages use the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) (`globalThis.crypto.subtle`) for Ed25519 key generation and signing. The type names for this API — `CryptoKeyPair`, `AlgorithmIdentifier`, `EcKeyGenParams`, `CryptoKey` — live in TypeScript's built-in `DOM` lib, **even when your project targets Node.js**.

Without `"DOM"` in your `lib` array, `tsc` will fail with errors like:

```
error TS2304: Cannot find name 'AlgorithmIdentifier'
error TS2304: Cannot find name 'CryptoKeyPair'
error TS2304: Cannot find name 'EcKeyGenParams'
```

## Fix

Add `"DOM"` to the `lib` array in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"]
  }
}
```

This is safe for Node.js projects — it only adds type definitions, it does not change what gets emitted or what runs at runtime.

## Affected packages

| Package | Files that require DOM types |
|---------|------------------------------|
| `@totemsdk/core` | `verify.ts` |
| `@totemsdk/lookup-client` | `auth.ts` |
| `@totemsdk/lookup-node` | `lease.ts`, `registry.ts`, `server-auth.ts` |
| `@totemsdk/node` | Web Crypto + WebSocket types |
| `@totemsdk/omnia-factory` | `factory.ts`, `virtual.ts` |
| `@totemsdk/omnia-hyperswarm` | `relay.ts` (`ErrorEvent`) |
| `@totemsdk/omnia-router` | `request.ts` |
| `@totemsdk/realtime` | WebSocket / event types |

Since `@totemsdk/core` is a transitive dependency of almost every other package, the simplest rule is:

> **Always include `"DOM"` in `lib` when using any `@totemsdk` package in a TypeScript project.**

## Why not just use `@types/node`?

`@types/node` v18+ does include `globalThis.crypto` as a value, but it does not re-export the Web Crypto *type names* (`AlgorithmIdentifier` etc.) into the global scope — those remain in the DOM lib. Adding `"DOM"` is the correct fix.
