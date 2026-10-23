# Release Process

**Status:** Pre-release policy

**Related:** [RFC-063](rfc/RFC-063-PRODUCTION-READINESS-AND-MATURITY-PROMOTION.md), [maturity.md](maturity.md), [DIST-TAG-MIGRATION.md](DIST-TAG-MIGRATION.md)

This document defines how a package moves from the repository to npm without
overstating its maturity. It applies to every publishable `@totemsdk/*` package.

---

## 1. Release model

There is no fixed calendar during the pre-release period. A release happens when
a package has a coherent change set and its evidence gates are satisfied. Tier 0
packages may follow a predictable cadence once the first stable release is
established.

| Change | Version |
|---|---|
| Compatible fix | patch |
| Compatible feature | minor |
| Breaking API or state/wire change | major |
| Release candidate | can use the same semver with an `rc` label only when the package is intentionally prerelease |
| License, metadata, docs only | patch |

The source of truth is the package's `package.json` version. Do not create a
release tag that disagrees with it.

---

## 2. Promotion and maturity

A package's release claims follow [maturity.md](maturity.md):

- **Tier 0 / v1:** first-line production support.
- **Tier 1:** production candidate; no production claim.
- **Tier 2:** required support dependency; not a headline production package.
- **Outside:** not part of the first-line production surface.

Tier 1 → Tier 0 requires the RFC-063 §3.2 gates and dependency closure. A version
bump does not promote a package by itself.

---

## 3. Release checklist

1. Confirm the package version in `package.json`.
2. Confirm `LICENSE`, `NOTICE` and `files` include both.
3. Add a `CHANGELOG.md` entry under `[Unreleased]`.
4. Run the package tests and build:
   ```bash
   pnpm --filter <package> test
   pnpm --filter <package> build
   ```
5. Run the workspace gates that apply:
   ```bash
   node scripts/validate-pkg-meta.mjs
   node scripts/verify-sdk-manifest.mjs
   node scripts/verify-public-claims.mjs
   node scripts/check-family-install.mjs
   node scripts/report-dist-tags.mjs --check
   ```
6. Create a GitHub Release with the tag convention:
   ```text
   totemsdk/<package>-v<semver>
   ```
7. The publish workflow resolves the matrix, tags the package from the maturity
   config, publishes with provenance, and verifies the final dist-tags.
8. Confirm the package tarball contains `LICENSE`, `NOTICE` and the expected
   exports.
9. Update `CHANGELOG.md` `[Unreleased]` to the released version if the project is
   maintaining dated sections.

---

## 4. Dist-tags

The publish workflow sets the tag from the maturity level:

| Level | Tag |
|---|---|
| v1 | `latest` |
| rc | `next` |
| beta | `beta` |
| alpha | `alpha` |

npm requires a `latest` tag. When a package has no stable v1, `latest` may point
at the newest prerelease as npm's required default; it is not a production claim.
Explicit channels are the supported way to consume Tier 1 packages.

See [DIST-TAG-MIGRATION.md](DIST-TAG-MIGRATION.md) for the full policy and audit.

---

## 5. Release notes

Release notes must state:

- what changed;
- which package(s) and versions;
- the maturity level and whether the release changes a support claim;
- migration or compatibility impact;
- known limitations or blocked gates;
- license changes, if any.

Do not describe a Tier 1 release as production-supported.

---

## 6. Rollback

- A bad npm version can be deprecated; do not unpublish a version that consumers
  may have locked.
- A dist-tag can be repointed at the previous known-good version.
- A GitHub Release can be marked as prerelease or superseded, but the tag remains
  part of the release history.
- Record the rollback reason and affected versions in the release notes and
  `CHANGELOG.md`.

---

## 7. Ownership

`CODEOWNERS` declares the default owner. `SUPPORT.md` defines the support scope
and response targets. Security reports follow `SECURITY.md`.
