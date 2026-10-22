# npm Dist-Tag Migration

**Status:** Phase A complete (channel tags added); Phase B blocked on npm token
permission for `latest` removal

**Parent:** [RFC-063 §3.1 and §4](rfc/RFC-063-PRODUCTION-READINESS-AND-MATURITY-PROMOTION.md)

**Audit:** `node scripts/report-dist-tags.mjs`

**Generated commands:** `node scripts/report-dist-tags.mjs --commands`

An npm dist-tag is a named pointer to an already-published version. It is not a
version, a tarball or a new release. Retagging does not change package contents or
provenance.

---

## 1. Why this is needed

`npm install <package>` resolves the `latest` tag by default. If an RC or Alpha
package is on `latest`, the default install path silently delivers an unstable
package while the docs/maturity model says it is not production.

At the time of writing:

- all 10 Tier 1 packages are on `latest`;
- `storage` is Alpha and on `latest`;
- 49 packages have some dist-tag drift;
- `scripts/resolve-release-matrix.mjs` previously published every package with
  the default `latest` tag.

The target model is:

| Level | Expected tag |
|---|---|
| `v1` | `latest` |
| `rc` | `next` |
| `beta` | `beta` |
| `alpha` | `alpha` |

Tier 0 must use `latest`. Tier 1 must not claim `latest`. Tier 2 and outside
packages follow their measured level.

### Current registry state (2026-10-22)

- All 49 missing channel tags were added successfully.
- The follow-up `npm dist-tag rm <pkg> latest` calls returned **403 Forbidden**
  from the `npm-production` token.
- Registry state is therefore: Tier 0 v1 packages have only `latest`; Tier 1/2/
  outside non-v1 packages currently have **both** `latest` and their correct
  `next`/`beta`/`alpha` tag.
- No package content was changed.
- Phase B needs an npm token with permission to delete/rewrite dist-tags, or an
  owner with registry access to run the removals.

---

> **Pre-release policy.** The SDK is pre-release with no known users. The
> non-breaking/breaking split below is therefore a safety option, not a
> requirement: Phase A and Phase B may be executed atomically. There is no
> migration announcement or backwards-compatibility window to preserve.

## 2. Phase A — add channel tags (non-breaking)

This phase only adds tags. It does not remove `latest`, so existing default
installs keep working.

```bash
node scripts/report-dist-tags.mjs --commands
```

Review the commands, then run them with an npm identity that can manage the
`@totemsdk` scope and any required 2FA/OTP.

Example:

```bash
npm dist-tag add @totemsdk/omnia@2.3.0 next
npm dist-tag add @totemsdk/omnia-host@0.10.0 next
npm dist-tag add @totemsdk/storage@0.1.0 alpha
```

After this phase, users can explicitly opt in:

```bash
npm install @totemsdk/omnia@next
npm install @totemsdk/storage@alpha
```

Phase A is reversible and does not break `npm install <package>`.

---

## 3. Phase B — the `latest` constraint

npm does **not** allow removing the `latest` tag. A `DELETE
/-/package/<pkg>/dist-tags/latest` request returns `403 Forbidden`; `latest` is
required so that `npm install <package>@latest` always resolves. This was
verified with both the `npm-production` token and a separate owner token.

The policy is therefore:

- **v1 packages:** `latest` points at the stable v1.
- **Non-v1 packages with a stable v1:** point `latest` at that stable v1 and
  keep the newer release on `next`/`beta`/`alpha`.
- **Non-v1 packages with no stable v1:** `latest` points at the newest published
  version as npm's required default. It is **not** a production claim. The
  explicit channel is `next`, `beta` or `alpha`.
- **Future publishes:** always pass `--tag next`, `--tag beta` or `--tag alpha`
  for a non-v1 release. The publish workflow now does this automatically, so a
  later release does not move `latest`.

If a package has no stable v1 and you want to warn default installers, use
`npm deprecate <pkg>@<version> "<message>"`. This is optional and does not change
the tag.

### Current state

- All 49 missing channel tags are present.
- `node scripts/report-dist-tags.mjs --check` reports **0 drift** under the
  corrected policy.
- `latest` remains on the current version for packages with no stable v1.
- No package contents were changed.

---

## 4. Phase C — prevent future drift

`scripts/resolve-release-matrix.mjs` now resolves a `dist_tag` from the maturity
config, and `.github/workflows/publish-totemsdk.yml` publishes with:

```bash
pnpm publish --access public --no-git-checks --tag "${{ matrix.dist_tag }}"
```

That means a future RC publish uses `next`, a beta publish uses `beta`, and an
alpha publish uses `alpha`. A subsequent release does not move `latest` for an
existing non-v1 package.

The release matrix still publishes one package per release tag. It does not
rewrite tags retrospectively; the channel tags handle existing versions.

---

## 5. Phase D — release gate

The check is now part of `publish-totemsdk.yml`:

```bash
node scripts/report-dist-tags.mjs --check
```

It is not in pull-request CI because it queries the public registry for all 67
packages; the publish workflow is the release gate.

---

## 6. Rollback

Channel-tag changes are reversible without republishing:

```bash
# remove an opt-in channel tag if it was created by mistake
npm dist-tag rm @totemsdk/omnia next

# repoint latest at a stable v1 if one exists
npm dist-tag add @totemsdk/example@1.2.3 latest
```

`latest` cannot be removed, only repointed.

---

## 7. Approval and execution

Channel-tag changes need an npm identity with write access to `@totemsdk` and
any required 2FA/OTP. The `npm-production` environment token can add channel tags
and is sufficient for the current policy. No destructive `latest` operation is
required or possible.

Because the SDK is pre-release with no users, no compatibility window is
required for channel tags.

The repository provides these execution paths:

- `node scripts/apply-dist-tags.mjs` — authenticated local dry-run;
- `node scripts/apply-dist-tags.mjs --execute --add-only` — add channel tags only;
- `node scripts/apply-dist-tags.mjs --execute` — add channel tags and remove
  `latest` from non-v1 packages;
- **Actions → Dist-tag migration** — manual workflow using the
  `npm-production` environment and `NPM_TOKEN`. Use `dry-run`, then `add-only`,
  then `apply`. The workflow runs the post-apply `--check` gate.

The local environment used for this audit is not authenticated to npm, so the
commands should be run from the release environment or an approved operator
session.
