# Notes for agents authoring the Totem SDK

**Scope:** you are changing, testing or releasing the SDK itself. This file is
not integration guidance for applications that consume `@totemsdk/*`; those
belong in the package READMEs and `docs/`.

Human release policy lives in [docs/RELEASE-PROCESS.md](docs/RELEASE-PROCESS.md).
This note records the operational lessons from the multi-package trains; follow
it when you are asked to "run the release train".

## Running a multi-package release train

A train is a set of packages that must reach npm in dependency order. The
failure mode to avoid is approving a dependent before its workspace
dependencies exist on the registry: the code is fine, but
`smoke-release-install.mjs` fails at **Consumer smoke install (registry deps, no
overrides)**.

1. **Create and approve per dependency level, not all at once.**
   `node scripts/create-releases.mjs --create` creates a release for every
   untagged package in one pass. For a multi-package train, split the set into
   topological levels and release one level per pass; wait until every package
   in that level is visible on npm before creating the next level's releases
   (or make the publish workflow wait for each workspace dependency range to
   resolve on npm before running the smoke install). This alone prevents most
   red workflows.

2. **Parallelise within a level, serialise only across levels.**
   Packages that do not depend on each other can be re-run and approved
   concurrently. The old driver waited for one publish to finish before even
   looking at the next package, which turned a 4-level train into a fully serial
   chain. Drive each level with `Promise.all` (or equivalent) and keep ordering
   only at the dependency boundary.

3. **Cache the workflow run list.**
   `gh run list --workflow publish-totemsdk.yml --limit N --json ...` is fast
   enough once per level. Do not call it once per package inside a loop.

4. **Poll quickly and treat npm as the success signal.**
   Three to five seconds between checks is sufficient. Consider a package
   published as soon as `npm view <pkg>@<version> version` succeeds; do not wait
   for the whole workflow's post-publish cleanup. The default 10–15 s sleeps
   plus a 30-minute per-package timeout add minutes of pure waiting per train.

5. **Optional: make the smoke install train-aware.**
   If full parallelism is wanted, let `smoke-release-install.mjs` resolve
   siblings that are part of the same release set from the packed tarball or the
   workspace instead of the registry, or run the registry smoke install only for
   the top package of each dependency level. This removes the level gate
   entirely.

### Recovery after a red publish

The `Publish <pkg>@<version>` step is idempotent: it skips when the exact
version already exists. A run that failed at the smoke install can therefore be
retried safely with `gh run rerun <run-id>` once its dependencies are published;
`release-sequentially.mjs` already does this when it reaches the package. Do not
delete or move a release tag to "fix" a failed publish.

### Release set checklist

- Confirm the findings gate per package:
  `node scripts/verify-findings-gate.mjs --min-severity high --packages <pkg>`.
- Confirm the version bump matches the change class in
  [docs/RELEASE-PROCESS.md](docs/RELEASE-PROCESS.md): a breaking state/wire
  change is a major bump (or a minor bump for `0.x`).
- Regenerate `SDK_MANIFEST.json`, `docs/maturity.md` and the MCP symbol index
  before tagging.
- Tag/publish from a commit that contains the exact manifest and changelog the
  publish workflow will read.
