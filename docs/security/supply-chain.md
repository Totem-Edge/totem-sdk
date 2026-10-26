# Supply chain evidence — RFC-063 B5

**Status:** automated for dependency scanning, SBOM generation, provenance and
reproducible WASM artifacts; release-asset attachment of SBOMs remains a
follow-up.
**Owner:** Totem SDK maintainers
**Related:** [SECURITY.md](../../SECURITY.md), [crypto policy](crypto-policy.md),
RFC-031 (WASM provenance), RFC-063 §5E

## Controls

| Control | Automation | Evidence |
|---|---|---|
| Production dependency audit | CI job **Supply chain** runs `pnpm audit --prod --audit-level high` | `.github/workflows/ci.yml` |
| Dependency updates | Dependabot (npm, GitHub Actions, extensions) | `.github/dependabot.yml` |
| SBOM (CycloneDX 1.7) | CI generates one SBOM per workspace project with `pnpm sbom --sbom-format cyclonedx --prod --lockfile-only --split` and uploads the set | `.github/workflows/ci.yml` |
| Core WASM SBOM | Committed `packages/core-wasm/sbom.json`; CI regenerates and fails on drift | `.github/workflows/ci.yml`, `packages/core-wasm/scripts` |
| Signed/published artifacts | npm trusted publishing with provenance (`id-token`, `NPM_CONFIG_PROVENANCE=true`) | `.github/workflows/publish-totemsdk.yml` |
| Reproducible WASM | CI rebuilds `pkg`, `pkg-node`, `pkg-web` and fails if committed bytes differ; artifact hashes are verified | `.github/workflows/ci.yml`, `packages/core-wasm/artifacts.json` |
| Frozen dependency graph | CI installs with `--frozen-lockfile` and fails if install dirties the tree | `.github/workflows/ci.yml` |
| Package contents | `pnpm pack --dry-run` gate in `scripts/verify-workspace.mjs --pack` | `verify` / release gates |

Container scanning is not applicable: the SDK ships npm packages and WASM
artifacts, not container images. Go modules are built, vetted and tested by the
**Go mirrors** job; Rust/WASM by **Rust core** and the CI provenance steps.

## Manual or residual

- Attach the generated SBOM set to each GitHub release (the publish workflow
  currently publishes provenance but not per-release SBOM assets).
- The dependency audit covers npm; Go modules rely on `go vet`/`go test` and
  Dependabot version bumps, not a vulnerability database scan.
- Human review is still required for licence/provenance exceptions; the audit
  gate blocks High/Critical npm findings but does not triage them automatically.
