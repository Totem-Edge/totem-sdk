# npm Dist-Tag Migration

**Status:** Planned — non-breaking tag additions first; `latest` removal requires
release approval

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

---

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

## 3. Phase B — remove `latest` from non-production packages

This is the breaking part. Once `latest` is removed, `npm install <package>`
fails until the user specifies `@next`, `@beta` or `@alpha`.

Example:

```bash
npm dist-tag rm @totemsdk/omnia latest
npm dist-tag rm @totemsdk/omnia-host latest
npm dist-tag rm @totemsdk/storage latest
```

Do this only for packages that are intentionally not production. Announce the
change in release notes before removing `latest`.

### Packages with an older stable v1

If a package has an older stable v1 version, the safer move is to point `latest`
at that v1 and leave the newer RC on `next`:

```bash
npm dist-tag add @totemsdk/example@1.2.3 latest
npm dist-tag add @totemsdk/example@2.0.0-rc.1 next
```

### Packages with no stable v1

For `omnia`, `omnia-host`, `storage`, `lookup-*`, `industrial-action`,
`edge-mqtt` and `edge-modbus`, there may be no stable v1 to point at. The options
are:

1. remove `latest` and require explicit `@next` / `@alpha`; or
2. keep `latest` temporarily and mark the package with an npm deprecation
   warning while the stable release is prepared.

Option 1 is the truthful end state. Option 2 is a transition state, not a
permanent solution.

---

## 4. Phase C — prevent future drift

`scripts/resolve-release-matrix.mjs` now resolves a `dist_tag` from the maturity
config, and `.github/workflows/publish-totemsdk.yml` publishes with:

```bash
pnpm publish --access public --no-git-checks --tag "${{ matrix.dist_tag }}"
```

That means a future RC publish uses `next`, a beta publish uses `beta`, and an
alpha publish uses `alpha`. A subsequent release cannot silently recreate
`latest` for a non-v1 package.

The release matrix still publishes one package per release tag. It does not
rewrite tags retrospectively; Phase A/B handle existing versions.

---

## 5. Phase D — release gate

After the registry matches the model, add the check to the release workflow:

```bash
node scripts/report-dist-tags.mjs --check
```

Do not add it to pull-request CI before the migration is complete; historical
drift would make unrelated PRs fail.

---

## 6. Rollback

Every tag move is reversible without republishing:

```bash
# restore the previous default
npm dist-tag add @totemsdk/omnia@2.3.0 latest

# remove an opt-in tag if it was created by mistake
npm dist-tag rm @totemsdk/omnia next
```

Record the before/after tags in the release notes.

---

## 7. Approval and execution

This migration changes public npm resolution. It needs:

- an npm identity with write access to `@totemsdk`;
- 2FA/OTP or trusted-publishing approval;
- a release note for the `latest` removals;
- a rollback operator.

The local environment used for this audit is not authenticated to npm, so the
commands should be run from the release environment or an approved operator
session.
