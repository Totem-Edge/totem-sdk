# Compatibility Policy

**Status:** Active — pre-1.0.
**Enforced by:** `scripts/check-legacy-surface.mjs` (CI: `Legacy surface guard`).

The Totem SDK is **pre-release**. Until the first supported production release,
breaking changes are allowed and compatibility shims are not. This policy exists
because several RFCs and code paths assumed an installed user base that does not
exist; see `docs/audits/prelaunch-compatibility-audit-2026-10.md`.

## Rules

1. **No SDK-consumer compatibility shims.** Do not add aliases, `@deprecated`
   re-exports, dual code paths, deprecation windows, migration guides or
   “restore old behaviour” flags for external callers.
2. **Breaking changes are allowed.** Rename, replace or delete APIs directly and
   update the workspace in the same change.
3. **Compatibility is preserved only for:**
   - persisted local state that can contain funds, signing history, recovery
     material or evidence;
   - on-chain scripts, addresses and committed state;
   - wire protocols with deployed peers;
   - security defaults that fail closed.
4. **State changes are versioned.** When a persisted format must change, bump
   the format version and either migrate once or fail closed with a clear error.
   Do not carry the old format indefinitely.
5. **Justify protocol/state compatibility by the data it protects**, not by
   “existing callers.” Name the data and the owning RFC.
6. **Comments must match code.** A compatibility comment with no implementing
   code path is a bug; delete it or restore the code intentionally.
7. **Dev-only flags default off** and are not part of the public API.

## Enforcement

`scripts/check-legacy-surface.mjs` scans publishable package sources, extension
sources and package `exports` for:

- `@deprecated` markers;
- exports beginning with `legacy`, `compat` or `backward`;
- `./legacy`, `./compat` or `./backward` export subpaths;
- dual-mode flags such as `initMode`, `fallbackOnError`, `SdkInitMode`,
  `legacyMode`, `allowLegacy*`;
- unsafe compatibility defaults such as `requireSignedCommands: false`.

Existing occurrences are recorded in `scripts/legacy-surface-baseline.json`.
**New occurrences fail CI.** As cleanup lands, remove entries and run:

```bash
node scripts/check-legacy-surface.mjs --update
```

The baseline is a debt register, not an approval. Each entry should eventually
be removed or annotated with the protected data class (`S`/`P`) and its RFC.

## Cleanup

The removal plan is in §7 of the audit. Do not add new baseline entries to ship a
feature; remove the compatibility decision instead.
